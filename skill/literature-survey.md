# Literature Survey

Comprehensive literature review using iterative loop engine. This is Stage 1 of the research pipeline.

## Input

$ARGUMENTS — research topic or question

## Prerequisites

- Neocortica MCP tools available (acd_search, web_search, dfs_search, paper_content, web_content)
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
  "该领域的主要方法有哪些？",
  "最新进展（2024-2025）是什么？",
  "主要研究组和代表性工作？"
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
     - acd_search × 3 (one per query)
     - web_search × 3 (one per query)
     - Total: 6 searches in parallel

  3. Deduplication
     - Filter out papers in papersRead
     - Keep only new papers

  4. Log to diary
     - "第 {iteration+1} 轮 SEARCH: 针对问题'{currentGap}'，执行了 6 次搜索，找到 X 篇新论文"

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
       * dfs_search(depth=1, breadth=5) on top 1-2 High papers
       * Add discovered papers to search results for next iteration

  8. Update State
     - papersRead.add(all read papers' normalizedTitle)

  9. Log to diary
     - "第 {iteration+1} 轮 READ: 阅读了 K 篇论文（H 篇 High，M 篇 Medium，L 篇 Low），累计已读 {papersRead.size} 篇"

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
      - "第 {iteration+1} 轮 REFLECT: {progressAssessment}，发现 {newGaps.length} 个新问题"

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
      - IF canAnswer: "第 {iteration+1} 轮 EVALUATE: 成功回答问题'{currentGap}'（置信度: {confidence}）"
      - ELSE: "第 {iteration+1} 轮 EVALUATE: 尚不能回答'{currentGap}'，原因: {missingInfo}"

  // ===== Stop Condition Check =====
  16. Check Termination
      - IF gaps.length == 0:
          * STOP: "所有问题已解决"
      - IF noProgressCount >= NO_PROGRESS_THRESHOLD:
          * STOP: "连续 3 轮无新发现"
      - IF papersRead.size >= MIN_PAPERS_TARGET AND knowledge.length >= gaps.length * 0.7:
          * STOP: "达到阅读量目标且大部分问题已解决"
      - IF iteration >= MAX_ITERATIONS:
          * STOP: "达到最大迭代次数"

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
    - Force dfs_search on all High papers

### Diary Length Control
- Keep detailed logs for last 5 iterations only
- Compress earlier iterations into summary: "第 1-3 轮: 累计搜索 X 次，阅读 Y 篇，发现 Z 个问题"

## Output Format

After loop terminates, produce:

```markdown
## Literature Survey: [topic]

### 执行摘要
- 总迭代轮数: {iteration}
- 总阅读论文数: {papersRead.size}
- 初始问题数: 3
- 最终解决问题数: {knowledge.length}
- 未解决问题: {gaps}
- 停止原因: [gaps 清空 / 无新发现 / 达到阅读量 / 达到上限]

### 领域全景
[Based on knowledge: 2-3 paragraphs synthesizing the field landscape]

### 研究发现
[For each item in knowledge:]
#### {question}
- **答案**: {answer}
- **支撑来源**: {sources}
- **置信度**: {confidence}

### 已读论文 (按评级分组)
#### High Priority (X 篇)
- [Title] (Year, Citations, Venue)
  - 关键贡献: ...

#### Medium Priority (Y 篇)
- [Title] (Year, Citations, Venue)
  - 关键贡献: ...

#### Low Priority (Z 篇)
- [Title] (Year)

### 关键主题
[Bullet list of major themes/clusters discovered]

### 研究日志
{diary[0]}
{diary[1]}
...
[Compressed summary of early iterations if > 5 iterations]

### 未解决问题
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
