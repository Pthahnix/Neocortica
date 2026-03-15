# Literature Survey

Comprehensive literature review using iterative loop engine. This is Stage 1 of the research pipeline.

## Input

$ARGUMENTS — research topic or question

## Prerequisites

- Neocortica-Scholar MCP (paper_searching, paper_fetching, paper_content, paper_reference, paper_reading) + Brave Search MCP (brave_web_search) + Apify MCP (marco.gullo/google-scholar-scraper, apify/rag-web-browser)
- Prompts: `prompt/paper-rating.md`, `prompt/paper-reading.md`, `prompt/reflect-gaps.md`, `prompt/evaluate-answer.md`

## Overview

This skill uses an iterative SEARCH→READ→REFLECT→EVALUATE loop to build comprehensive domain knowledge. The system autonomously discovers gaps and decides when sufficient understanding is achieved.

## Loop State

Maintain these variables throughout execution:

```typescript
gaps: string[]              // Unresolved research questions (queue)
knowledge: Finding[]        // Confirmed findings with sources
diary: string[]             // Narrative log of each iteration
iteration: number           // Current iteration count
noProgressCount: number     // Consecutive iterations without new findings
papersRead: Set<string>     // normalizedTitle of papers already read
```

## Initial State

```typescript
gaps = [
  "What are the main methods in this field?",
  "What are the latest advances (2024-2025)?",
  "What are the major research groups and representative works?"
]
knowledge = []
papersRead = Set()
iteration = 0
noProgressCount = 0
diary = []
```

## Loop Parameters

- MAX_ITERATIONS: 10
- MIN_PAPERS_TARGET: 50
- PAPERS_PER_ITERATION: 8-12
- NO_PROGRESS_THRESHOLD: 3

## Iterative Loop

```
WHILE (gaps.length > 0 AND iteration < MAX_ITERATIONS):

  currentGap = gaps[iteration % gaps.length]

  // ===== SEARCH Phase =====
  1. Query Rewriting
     - Rewrite currentGap into 3 queries:
       * Core query (direct): the question itself
       * Technical query (specific): key methods/techniques
       * Application query (context): use cases/scenarios

  2. Parallel Search
     - google-scholar-scraper × 3 (one per query)
     - brave_web_search × 3 (one per query)
     - Total: 6 searches in parallel

  3. Enrich & Fetch
     - For Scholar results: paper_searching per result (sequential, avoid rate limits)
     - For those with arxivUrl/oaPdfUrl: paper_fetching (sequential)

  4. Deduplication
     - Filter out papers in papersRead
     - Keep only new papers

  4. Log to diary
     - "Round {iteration+1} SEARCH: targeting question '{currentGap}', executed 6 searches, found X new papers"

  // ===== READ Phase =====
  5. Priority Ranking
     - Score = 0.3 × log(citations + 1)
             + 0.4 × (year >= 2024 ? 2 : year >= 2023 ? 1 : 0)
             + 0.2 × (top venue ? 1 : 0)
             + 0.1 × relevance
     - Sort by score descending

  6. Read Top Papers
     - Select top 8-12 papers
     - Apply prompt/paper-rating.md → High/Medium/Low
     - Apply prompt/paper-reading.md:
       * High: Pass 1 → Pass 2 → Pass 3
       * Medium: Pass 1 → Pass 2
       * Low: Pass 1 only
     - Extract segments relevant to currentGap

  7. Reference Expansion (conditional)
     - IF any High-rated paper found AND papersRead.size < MIN_PAPERS_TARGET:
       * paper_reference on top 1-2 High papers
       * paper_searching → paper_fetching on discovered references
       * Add discovered papers to search results for next iteration

  8. Update State
     - papersRead.add(all read papers' normalizedTitle)

  9. Log to diary
     - "Round {iteration+1} READ: read K papers (H High, M Medium, L Low), total read {papersRead.size} papers"

  // ===== REFLECT Phase =====
  10. Gap Discovery
      - Load prompt/reflect-gaps.md
      - Input: currentGap, readContent (this iteration), knowledge, diary
      - Output: { newGaps: string[], progressAssessment: string }

  11. Update Gaps
      - IF newGaps.length > 0:
          * Deduplicate against existing gaps (edit distance > 3)
          * gaps.push(...newGaps)
          * noProgressCount = 0
      - ELSE:
          * noProgressCount++

  12. Log to diary
      - "Round {iteration+1} REFLECT: {progressAssessment}, discovered {newGaps.length} new questions"

  // ===== EVALUATE Phase =====
  13. Answer Evaluation
      - Load prompt/evaluate-answer.md
      - Input: currentGap, knowledge, readContent
      - Output: { canAnswer: bool, answer: string, sources: string[], confidence: string, missingInfo: string }

  14. Update Knowledge
      - IF canAnswer == true:
          * knowledge.push({ question: currentGap, answer, sources, confidence })
          * gaps.remove(currentGap)
      - ELSE:
          * Keep currentGap in queue

  15. Log to diary
      - IF canAnswer: "Round {iteration+1} EVALUATE: successfully answered question '{currentGap}' (confidence: {confidence})"
      - ELSE: "Round {iteration+1} EVALUATE: cannot yet answer '{currentGap}', reason: {missingInfo}"

  // ===== Stop Condition Check =====
  16. Check Termination
      - IF gaps.length == 0:
          * STOP: "all questions resolved"
      - IF noProgressCount >= NO_PROGRESS_THRESHOLD:
          * STOP: "no new findings for 3 consecutive rounds"
      - IF papersRead.size >= MIN_PAPERS_TARGET AND knowledge.length >= gaps.length * 0.7:
          * STOP: "reached reading target and most questions resolved"
      - IF iteration >= MAX_ITERATIONS:
          * STOP: "reached max iterations"

  17. Increment
      - iteration++

END LOOP
```

## Risk Controls

### Infinite Loop Prevention
- Hard limit: MAX_ITERATIONS = 10
- Soft limit: noProgressCount >= 3 → stop
- Gap deduplication: edit distance < 3 → reject as duplicate

### Low-Quality Search Results
- IF 2 consecutive iterations yield < 5 new papers:
  * Mark currentGap as "low priority"
  * Only process low-priority gaps when iteration % 3 == 0

### Insufficient Reading Volume
- IF iteration >= 5 AND papersRead.size < MIN_PAPERS_TARGET * 0.5:
  * Trigger "expansion mode":
    - Broaden search queries (add synonyms)
    - Lower paper filtering threshold
    - Force paper_reference on all High papers

### Diary Length Control
- Keep detailed logs for last 5 iterations only
- Compress earlier iterations into summary: "Rounds 1-3: cumulative X searches, Y papers read, Z questions discovered"

## Output Format

After loop terminates, produce:

```markdown
## Literature Survey: [topic]

### Executive Summary
- Total iteration rounds: {iteration}
- Total papers read: {papersRead.size}
- Initial question count: 3
- Final resolved question count: {knowledge.length}
- Unresolved questions: {gaps}
- Stop reason: [gaps cleared / no new findings / reached reading target / reached limit]

### Domain Landscape
[Based on knowledge: 2-3 paragraphs synthesizing the field landscape]

### Research Findings
[For each item in knowledge:]
#### {question}
- **Answer**: {answer}
- **Supporting sources**: {sources}
- **Confidence**: {confidence}

### Papers Read (grouped by rating)
#### High Priority (X papers)
- [Title] (Year, Citations, Venue)
  - Key contributions: ...

#### Medium Priority (Y papers)
- [Title] (Year, Citations, Venue)
  - Key contributions: ...

#### Low Priority (Z papers)
- [Title] (Year)

### Key Themes
[Bullet list of major themes/clusters discovered]

### Research Diary
{diary[0]}
{diary[1]}
...
[Compressed summary of early iterations if > 5 iterations]

### Unresolved Questions
[List remaining gaps with explanation of why they couldn't be answered]
```

## Decision Points

- If initial searches return < 5 relevant papers → broaden queries, try synonyms
- If > 30 papers in one iteration → tighten queries, raise rating threshold
- If a subfield emerges as critical → add focused gap to queue
- If a seminal paper keeps getting cited → ensure it's rated High and fully read

## Next Stage

Pass the full output (knowledge + papersRead + diary) to **Gap Analysis** (skill/gap-analysis.md).

## Key Differences from Previous Version

**Removed** (from earlier versions):
- Fixed "Tier 1-2-3" augmentation steps
- External validation checkpoint (previously Perplexity-based)

**Added**:
- Iterative SEARCH→READ→REFLECT→EVALUATE loop
- Autonomous gap discovery via prompt/reflect-gaps.md
- Autonomous answer evaluation via prompt/evaluate-answer.md
- Dynamic stopping conditions based on task completion
- State management (gaps queue, knowledge accumulation, diary)

**Philosophy**: The system discovers its own gaps and judges its own readiness, rather than relying on external validation.
