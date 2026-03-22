import type { PaperMeta } from "../types.js";
import { normTitle } from "./misc.js";

/** Query Unpaywall by DOI. Returns PaperMeta with oaPdfUrl if OA available. */
export async function query(doi: string): Promise<PaperMeta | null> {
  const email = process.env.EMAIL;
  if (!email) throw new Error("EMAIL not set in .env");
  const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${email}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = (await resp.json()) as any;
  const oaPdfUrl = data.best_oa_location?.url_for_pdf ?? undefined;
  if (!oaPdfUrl) return null;
  const authors = Array.isArray(data.z_authors)
    ? data.z_authors
        .map((a: any) => [a.given, a.family].filter(Boolean).join(" "))
        .join(", ")
    : undefined;
  return {
    title: data.title ?? "",
    normalizedTitle: normTitle(data.title ?? ""),
    doi,
    year: data.year ?? undefined,
    authors,
    oaPdfUrl,
    sourceUrl: data.doi_url ?? undefined,
  };
}
