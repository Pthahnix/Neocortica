import { resolve } from "path";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { normTitle } from "./misc.js";
import type { PaperMeta } from "../types.js";

function cacheDir(): string {
  return resolve(process.env.NEOCORTICA_CACHE || ".cache");
}

function ensureDirs(): { markdown: string; paper: string } {
  const base = cacheDir();
  const markdown = resolve(base, "markdown");
  const paper = resolve(base, "paper");
  mkdirSync(markdown, { recursive: true });
  mkdirSync(paper, { recursive: true });
  return { markdown, paper };
}

/** Save markdown content to cache. Returns the absolute file path. */
export function saveMarkdown(title: string, markdown: string): string {
  const dirs = ensureDirs();
  const filename = normTitle(title) + ".md";
  const filePath = resolve(dirs.markdown, filename);
  writeFileSync(filePath, markdown, "utf-8");
  return filePath;
}

/** Save paper metadata JSON to cache. */
export function saveMeta(paper: PaperMeta): string {
  const dirs = ensureDirs();
  const filename = paper.normalizedTitle + ".json";
  const filePath = resolve(dirs.paper, filename);
  writeFileSync(filePath, JSON.stringify(paper, null, 2), "utf-8");
  return filePath;
}

/** Load paper metadata from cache. Returns null if not found. */
export function loadMeta(normalizedTitle: string): PaperMeta | null {
  const dirs = ensureDirs();
  const filePath = resolve(dirs.paper, normalizedTitle + ".json");
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

/** Check if markdown is cached. Returns path or null. */
export function loadMarkdownPath(normalizedTitle: string): string | null {
  const dirs = ensureDirs();
  const filePath = resolve(dirs.markdown, normalizedTitle + ".md");
  return existsSync(filePath) ? filePath : null;
}
