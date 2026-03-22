import { resolve, basename } from "path";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import AdmZip from "adm-zip";

const MINERU_BASE = "https://mineru.net/api/v4";
const POLL_INTERVAL = 3000;
const POLL_TIMEOUT = 600_000;

export type ProgressCallback = (info: {
  message: string;
  current?: number;
  total?: number;
}) => void | Promise<void>;

function getToken(): string {
  const token = process.env.MINERU_TOKEN;
  if (!token) throw new Error("MINERU_TOKEN not set in .env");
  return token;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return { Authorization: `Bearer ${getToken()}`, ...extra };
}

async function apiPost(path: string, body: object): Promise<any> {
  const res = await fetch(`${MINERU_BASE}${path}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if ((json as any).code !== 0)
    throw new Error(`MinerU API error: ${(json as any).msg ?? JSON.stringify(json)}`);
  return (json as any).data;
}

async function apiGet(path: string): Promise<any> {
  const res = await fetch(`${MINERU_BASE}${path}`, { headers: headers() });
  const json = await res.json();
  if ((json as any).code !== 0)
    throw new Error(`MinerU API error: ${(json as any).msg ?? JSON.stringify(json)}`);
  return (json as any).data;
}

export function extractMarkdownFromZip(zipBuf: Buffer): string {
  const zip = new AdmZip(zipBuf);
  const mdEntry = zip.getEntries().find((e) => e.entryName.endsWith(".md"));
  if (!mdEntry) throw new Error("No .md file found in MinerU result ZIP");
  return mdEntry.getData().toString("utf-8");
}

/**
 * Convert a PDF to markdown via MinerU cloud API.
 * Accepts a URL (downloads to temp first) or local file path.
 */
export async function content(
  source: string,
  onProgress?: ProgressCallback,
): Promise<string | null> {
  let fullPath: string;

  if (source.startsWith("http://") || source.startsWith("https://")) {
    await onProgress?.({ message: "Downloading PDF..." });
    const resp = await fetch(source);
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    fullPath = resolve(tmpdir(), `neocortica-scholar_${Date.now()}.pdf`);
    writeFileSync(fullPath, buf);
  } else {
    fullPath = resolve(source);
    if (!existsSync(fullPath)) return null;
  }

  const fileName = basename(fullPath);
  const pdfBuf = readFileSync(fullPath);

  await onProgress?.({ message: "Requesting upload URL..." });
  const batchData = await apiPost("/file-urls/batch", {
    files: [{ name: fileName, is_ocr: true }],
    enable_formula: true,
    language: "en",
    model_version: "vlm",
  });
  const batchId: string = batchData.batch_id;
  const uploadUrl: string = batchData.file_urls?.[0];
  if (!batchId || !uploadUrl)
    throw new Error("Failed to get batch_id or upload URL from MinerU");

  await onProgress?.({ message: `Uploading ${fileName}...` });
  const putRes = await fetch(uploadUrl, { method: "PUT", body: pdfBuf });
  if (!putRes.ok)
    throw new Error(`Upload failed: ${putRes.status} ${putRes.statusText}`);

  await onProgress?.({ message: "Processing...", current: 0, total: 100 });
  const deadline = Date.now() + POLL_TIMEOUT;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    const result = await apiGet(`/extract-results/batch/${batchId}`);
    const state: string = result.extract_result?.[0]?.state ?? result.state;

    if (state === "done") {
      const zipUrl: string = result.extract_result[0].full_zip_url;
      if (!zipUrl) throw new Error("No full_zip_url in MinerU result");
      await onProgress?.({ message: "Downloading result...", current: 90, total: 100 });
      const zipRes = await fetch(zipUrl);
      if (!zipRes.ok) throw new Error(`ZIP download failed: ${zipRes.status}`);
      const zipBuf = Buffer.from(await zipRes.arrayBuffer());
      const markdown = extractMarkdownFromZip(zipBuf);
      await onProgress?.({ message: "Done", current: 100, total: 100 });
      return markdown;
    }

    if (state === "failed") throw new Error("MinerU extraction failed");

    const pct = result.extract_result?.[0]?.progress ?? 0;
    await onProgress?.({ message: `Processing... ${pct}%`, current: pct, total: 100 });
  }

  throw new Error(`MinerU polling timed out after ${POLL_TIMEOUT / 1000}s`);
}
