// src/pdf_utils.ts

import 'dotenv/config';
import { execFile } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODAL_BIN = process.env['MODAL_BIN'] ?? 'modal';
const PDF2MD_SCRIPT = resolve(__dirname, './assets/pdf2markdown.py');

export async function pdfMarkdown({ path }: { path: string }): Promise<string> {
  const absPath = resolve(path);
  const outPath = resolve(tmpdir(), `pdf2md-${randomUUID()}.md`);

  return new Promise<string>((res, rej) => {
    const proc = execFile(
      MODAL_BIN,
      ['run', PDF2MD_SCRIPT, '--pdf-path', absPath, '--output', outPath],
      { env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }, maxBuffer: 50 * 1024 * 1024 },
      async (err, _stdout, stderr) => {
        if (err) return rej(new Error(`modal run failed: ${stderr || err.message}`));
        try {
          const md = await readFile(outPath, 'utf-8');
          await unlink(outPath).catch(() => {});
          res(md);
        } catch (e) {
          rej(new Error(`failed to read output: ${e}`));
        }
      },
    );
    proc.stdout?.pipe(process.stdout);
  });
}
