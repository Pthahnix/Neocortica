"""DeepSeek-OCR2 PDF-to-Markdown on Modal (vLLM)."""

import modal
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Modal image: clone repo, install deps, patch config
# ---------------------------------------------------------------------------
ocr_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.0-devel-ubuntu22.04", add_python="3.11"
    )
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0")
    .run_commands(
        "git clone https://github.com/deepseek-ai/DeepSeek-OCR-2.git /opt/ocr2",
    )
    .pip_install(
        "torch==2.6.0", "torchvision==0.21.0", "torchaudio==2.6.0",
        extra_index_url="https://download.pytorch.org/whl/cu124",
    )
    .pip_install("vllm==0.8.5")
    .pip_install(
        "transformers==4.46.3", "tokenizers==0.20.3",
        "PyMuPDF", "img2pdf", "easydict", "addict", "einops", "Pillow",
    )
    .pip_install("wheel", "setuptools")
    .pip_install("flash-attn==2.7.3", extra_options="--no-build-isolation")
    .env({
        "VLLM_USE_V1": "0",
        "HF_HOME": "/cache/huggingface",
    })
)

app = modal.App("deepseek-ocr2-pdf2md", image=ocr_image)
model_volume = modal.Volume.from_name("deepseek-ocr2-weights", create_if_missing=True)

REPO_DIR = "/opt/ocr2/DeepSeek-OCR2-master/DeepSeek-OCR2-vllm"
MODEL_NAME = "deepseek-ai/DeepSeek-OCR-2"
PROMPT = "<image>\n<|grounding|>Convert the document to markdown."
CHUNK_SIZE = 50


def _write_config(model_path: str):
    """Write config.py that the repo code imports at module level."""
    import textwrap
    cfg = textwrap.dedent(f"""\
        BASE_SIZE = 1024
        IMAGE_SIZE = 768
        CROP_MODE = True
        MIN_CROPS = 2
        MAX_CROPS = 6
        MAX_CONCURRENCY = 4
        NUM_WORKERS = 8
        PRINT_NUM_VIS_TOKENS = False
        SKIP_REPEAT = True
        MODEL_PATH = "{model_path}"
        INPUT_PATH = ""
        OUTPUT_PATH = ""
        PROMPT = '<image>\\n<|grounding|>Convert the document to markdown.'
        from transformers import AutoTokenizer
        TOKENIZER = AutoTokenizer.from_pretrained(MODEL_PATH, trust_remote_code=True)
    """)
    with open(f"{REPO_DIR}/config.py", "w") as f:
        f.write(cfg)


@app.function(
    gpu="L40S",
    volumes={"/cache": model_volume},
    timeout=86400,
    startup_timeout=1800,
)
def pdf2md(pdf_bytes: bytes, filename: str = "input.pdf") -> str:
    """Convert a PDF to markdown. Processes in chunks of CHUNK_SIZE pages."""
    import os, io, re
    os.environ["VLLM_USE_V1"] = "0"
    os.environ["CUDA_VISIBLE_DEVICES"] = "0"

    _write_config(MODEL_NAME)
    sys.path.insert(0, REPO_DIR)

    import fitz
    from PIL import Image
    from concurrent.futures import ThreadPoolExecutor
    from vllm import LLM, SamplingParams
    from vllm.model_executor.models.registry import ModelRegistry
    from deepseek_ocr2 import DeepseekOCR2ForCausalLM
    from process.ngram_norepeat import NoRepeatNGramLogitsProcessor
    from process.image_process import DeepseekOCR2Processor
    from config import CROP_MODE

    ModelRegistry.register_model(
        "DeepseekOCR2ForCausalLM", DeepseekOCR2ForCausalLM
    )

    llm = LLM(
        model=MODEL_NAME,
        hf_overrides={"architectures": ["DeepseekOCR2ForCausalLM"]},
        block_size=256, enforce_eager=False, trust_remote_code=True,
        max_model_len=8192, swap_space=0, max_num_seqs=4,
        tensor_parallel_size=1, gpu_memory_utilization=0.9,
        disable_mm_preprocessor_cache=True,
    )

    logits_processors = [
        NoRepeatNGramLogitsProcessor(
            ngram_size=20, window_size=50,
            whitelist_token_ids={128821, 128822},
        )
    ]
    sampling_params = SamplingParams(
        temperature=0.0, max_tokens=8192,
        logits_processors=logits_processors,
        skip_special_tokens=False,
        include_stop_str_in_output=True,
    )

    # PDF to images
    pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    zoom = 144 / 72.0
    matrix = fitz.Matrix(zoom, zoom)
    images = []
    for page in pdf_doc:
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        images.append(img)
    pdf_doc.close()
    total = len(images)
    print(f"[pdf2md] {filename}: {total} pages")

    processor = DeepseekOCR2Processor()

    def process_single(image):
        return {
            "prompt": PROMPT,
            "multi_modal_data": {
                "image": processor.tokenize_with_images(
                    images=[image], bos=True, eos=True, cropping=CROP_MODE
                )
            },
        }

    # Process in chunks
    md_pages = []
    for start in range(0, total, CHUNK_SIZE):
        chunk = images[start:start + CHUNK_SIZE]
        print(f"[pdf2md] chunk {start+1}-{start+len(chunk)}/{total}")

        with ThreadPoolExecutor(max_workers=8) as pool:
            batch_inputs = list(pool.map(process_single, chunk))

        outputs_list = llm.generate(batch_inputs, sampling_params)

        for output in outputs_list:
            content = output.outputs[0].text
            if "<｜end▁of▁sentence｜>" in content:
                content = content.replace("<｜end▁of▁sentence｜>", "")
            content = re.sub(
                r"<\|ref\|>.*?<\|/ref\|><\|det\|>.*?<\|/det\|>", "",
                content, flags=re.DOTALL,
            )
            content = (
                content.replace("\\coloneqq", ":=")
                .replace("\\eqqcolon", "=:")
                .replace("\n\n\n\n", "\n\n")
                .replace("\n\n\n", "\n\n")
            )
            md_pages.append(content)

    return "\n\n".join(md_pages)


@app.local_entrypoint()
def main(pdf_path: str = "", output: str = ""):
    """Usage: modal run pdf2markdown.py --pdf-path input.pdf [--output out.md]"""
    if not pdf_path:
        print("Error: --pdf-path is required")
        return
    pdf_file = Path(pdf_path)
    pdf_bytes = pdf_file.read_bytes()
    print(f"Uploading {pdf_file.name} ({len(pdf_bytes)/1024/1024:.1f} MB)...")
    md_text = pdf2md.remote(pdf_bytes, pdf_file.name)
    out_path = Path(output) if output else pdf_file.with_suffix(".md")
    out_path.write_text(md_text, encoding="utf-8")
    print(f"Done. Output: {out_path} ({len(md_text)} chars)")
