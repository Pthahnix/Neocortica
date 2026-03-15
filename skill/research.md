# Research Strategy

Flexible research strategies for Claude Code. Choose a strategy based on the user's research goal, then orchestrate Neocortica's external MCP tools accordingly. These are guidelines, not rigid scripts — adapt tool usage, ordering, and depth to the actual findings as you go.

## User Input

$ARGUMENTS — research topic, question, or specific paper

## Strategy Selection

Assess the user's intent and pick the appropriate strategy:

| Strategy | When to Use | Typical Scope |
| ---------- | ------------- | --------------- |
| **quick** | Specific question, single paper, or known topic | 1-3 papers or pages |
| **survey** | Literature review, topic exploration, "what's the state of X" | 10-30+ papers |
| **deep** | Trace a paper's intellectual lineage, find foundational work | 1 seed → recursive refs |
| **web** | Non-academic: blog posts, docs, tutorials, news | Web search + content |
| **hybrid** | Complex question needing both academic and web sources | Mix of above |

If unclear, default to **quick** and escalate if results are insufficient.

## Strategy: quick

Goal: Answer a specific question or retrieve a specific paper quickly.

1. If user provides a paper title/URL → `paper_fetching` directly
2. If user asks a question about a known topic:
   - Execute acd-searching pipeline with 1 focused query, papersRead=Set()
   - Read the most relevant 1-3 papers from results
3. Rate each paper: **high** (directly answers), **medium** (context), **low** (tangential)
4. Summarize findings, cite sources with paper titles

Decision points:

- If Scholar returns nothing useful → execute web-searching pipeline as fallback
- If a paper's full text wasn't obtained (no `markdownPath`) → note it, don't block on it

## Strategy: survey

Goal: Comprehensive literature review on a topic. Discover, collect, and organize papers.

1. Analyze topic breadth and craft 1-3 search queries (rephrase for coverage)
2. Execute acd-searching pipeline with queries, papersRead=Set()
3. Read via `paper_content` or `paper_reading` for AI-assisted analysis
4. Rate each paper: **high** / **medium** / **low**
5. For **high** papers with interesting references → `paper_reference` → enrich and fetch discovered references via acd-searching pipeline
6. Present results grouped by rating, with summary per paper

Decision points:

- If initial results are too narrow → broaden query terms, add synonyms
- If too many results → add year filters or more specific keywords in follow-up queries
- If a subfield emerges as important → run a focused search on that subfield
- Stop expanding when new papers are mostly duplicates of what you already have

## Strategy: deep

Goal: Trace a paper's reference tree to understand its intellectual context.

1. Start with seed paper → `paper_fetching` to get full text and metadata
2. Read the paper, identify its key contributions and most-cited references
3. `paper_reference` on the seed paper to get its reference list
4. Enrich interesting references via acd-searching pipeline (pass reference titles as queries)
5. From results, identify clusters/themes in the references
6. Rate discovered papers by relevance to the original research question
7. Optionally: for the most important discovered papers, run another `paper_reference` to go deeper

Decision points:

- If seed paper has no `s2Id`/`arxivId`/`doi` → `paper_reference` can fall back to markdown parsing if `markdownPath` is available
- If references are mostly irrelevant → stop early
- If a foundational paper appears repeatedly in references → it's important, prioritize reading it

## Strategy: web

Goal: Gather non-academic information — blog posts, documentation, tutorials, news.

1. Execute web-searching pipeline with user's query, urlsVisited=Set()
2. Read fetched pages — for those with markdownPath, read and synthesize
3. For results without markdownPath (fetchFailed), use Brave snippets
4. Present findings with source URLs

Decision points:

- If search results are low quality → rephrase query, add "tutorial", "guide", "explained"
- If a page's content is thin → try the next result
- If the topic has academic depth too → suggest escalating to **hybrid**

## Strategy: hybrid

Goal: Complex research question requiring both academic papers and web sources.

1. Decompose the question into sub-questions
2. For each sub-question, decide: academic or web
   - Theoretical foundations, algorithms, benchmarks → execute acd-searching pipeline
   - Implementation details, tooling, recent developments → execute web-searching pipeline
3. Execute searches, collect and read sources
4. Cross-reference: do web sources cite papers you found? Do papers reference tools/frameworks from web results?
5. Synthesize a unified answer drawing from both source types

## Rating Papers

When presenting results, rate each paper for the user:

| Rating | Meaning | Action |
| -------- | --------- | -------- |
| **high** | Core paper, directly relevant, high impact | Read fully, track its references |
| **medium** | Useful context, relevant technique or result | Read fully, note key points |
| **low** | Tangential, redundant, or low quality | Summary only, skip deep reading |

Rating criteria (use your judgment, weigh all factors):

- Relevance to the user's specific question
- Citation count relative to age (a 2025 paper with 50 citations > a 2018 paper with 50)
- Venue quality if known
- Whether it introduces novel ideas vs. incremental improvements

## Output Format

After completing any strategy, present:

1. Brief methodology note (which strategy, how many queries, what was found)
2. Results grouped by rating (high → medium → low)
3. For each paper/source: title, year/date, key takeaway, link
4. For **high** items: detailed summary and why it matters
5. Suggested next steps if the user wants to go deeper

## Principles

- **Start small, escalate as needed.** Don't run 5 queries when 1 might suffice.
- **Cache is your friend.** If a paper was already fetched, don't fetch again — check `markdownPath`.
- **Be honest about gaps.** If full text wasn't obtained, say so. If a search returned nothing, say so.
- **Let findings guide you.** If an unexpected but important thread emerges, follow it.
- **Don't over-collect.** 20 well-chosen papers beat 100 unread ones.

## Advanced: Research Pipeline

For full scientific research workflows (topic → idea), use the five-stage pipeline instead of the strategies above. See `skill/neocortica.md` for the overview, or invoke each stage directly:

1. `skill/literature-survey.md` — structured literature survey with three-pass reading
2. `skill/gap-analysis.md` — cross-paper gap discovery
3. `skill/idea-generation.md` — idea generation and scoring
4. `skill/experiment-design.md` — experiment plan (skeleton)
5. `skill/experiment-execution.md` — remote GPU experiment execution
