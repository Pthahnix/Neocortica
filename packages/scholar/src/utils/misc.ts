/** Normalize a title into a safe, dedup-friendly string. */
export function normTitle(title: string): string {
  return title
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}
