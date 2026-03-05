# Gap Analysis

Identify research gaps using iterative loop engine. This is Stage 2 of the research pipeline.

## Input

- Reading notes from Stage 1 (Literature Survey)
- Domain landscape summary
- knowledge array from Stage 1
- papersRead set from Stage 1

## Prerequisites

- Completed literature survey with rated and read papers
- Prompts: `prompt/gap-discovery.md`, `prompt/reflect-gaps.md`, `prompt/evaluate-answer.md`
- Tools: acd_search, web_search, dfs_search, paper_content

## Overview

This skill uses an iterative SEARCH→READ→REFLECT→EVALUATE loop to identify and validate research gaps. The system autonomously discovers gaps, validates them through literature search, and judges when sufficient evidence is gathered.

## Loop State

Maintain these variables throughout execution:

```typescript
gaps: string[]              // Unresolved gap investigation questions
knowledge: Finding[]        // Confirmed gaps with evidence (inherited from Stage 1)
diary: string[]             // Narrative log of each iteration
iteration: number           // Current iteration count
noProgressCount: number     // Consecutive iterations without new findings
papersRead: Set<string>     // normalizedTitle of papers already read (inherited from Stage 1)
identifiedGaps: Gap[]       // Validated research gaps
```

## Initial State

```typescript
gaps = [
  "现有方法的主要局限性是什么？",
  "哪些应用场景尚未被充分研究？",
  "理论与实践之间的差距在哪里？"
]
knowledge = [...] // Inherited from Stage 1
papersRead = Set(...) // Inherited from Stage 1
identifiedGaps = []
iteration = 0
noProgressCount = 0
diary = []
```

## Loop Parameters

- MAX_ITERATIONS: 6
- MIN_PAPERS_TARGET: 30 (cumulative with Stage 1)
- PAPERS_PER_ITERATION: 8-12
- NO_PROGRESS_THRESHOLD: 3

## Iterative Loop

```
WHILE (gaps.length > 0 AND iteration < MAX_ITERATIONS):

  currentGap = gaps[iteration % gaps.length]

  // ===== SEARCH Phase =====
  1. Query Rewriting
     - Rewrite currentGap into 3 queries focused on:
       * Limitations query: "limitations challenges problems [topic]"
       * Unsolved query: "unsolved open problems future work [topic]"
       * Practical query: "real-world deployment practical challenges [topic]"

  2. Parallel Search
     - acd_search × 3 (one per query)
     - web_search × 3 (one per query, target: GitHub issues, workshop papers, blog posts discussing limitations)
     - Total: 6 searches in parallel

  3. Deduplication
     - Filter out papers in papersRead
     - Keep only new papers

  4. Log to diary
     - "第 {iteration+1} 轮 SEARCH: 针对'{currentGap}'，执行了 6 次搜索，找到 X 篇新论文"

  // ===== READ Phase =====
  5. Priority Ranking
     - Same scoring as Stage 1
     - Sort by score descending

  6. Read Top Papers (focus on Limitations/Future Work sections)
     - Select top 8-12 papers
     - Apply prompt/paper-rating.md → High/Medium/Low
     - Apply prompt/paper-reading.md with special focus:
       * High: Pass 1 → Pass 2 → Pass 3, extract Limitations + Future Work sections
       * Medium: Pass 1 → Pass 2, extract Limitations
       * Low: Pass 1 only
     - Extract segments discussing problems, challenges, limitations

  7. Reference Expansion (conditional)
     - IF any High-rated paper found AND papersRead.size < MIN_PAPERS_TARGET:
       * dfs_search(depth=1, breadth=5) on papers that explicitly discuss limitations
       * Add discovered papers to search results for next iteration

  8. Update State
     - papersRead.add(all read papers' normalizedTitle)

  9. Log to diary
     - "第 {iteration+1} 轮 READ: 阅读了 K 篇论文，累计已读 {papersRead.size} 篇，重点关注 Limitations/Future Work 章节"

  // ===== REFLECT Phase =====
  10. Gap Discovery
      - Load prompt/reflect-gaps.md
      - Input: currentGap, readContent (this iteration, focus on limitations), knowledge, diary
      - Output: { newGaps: string[], progressAssessment: string }
      - Additionally, apply prompt/gap-discovery.md to synthesize:
        * Method comparison matrix
        * Contradiction detection
        * Blank identification
        * Trend analysis

  11. Update Gaps
      - IF newGaps.length > 0:
          * Deduplicate against existing gaps (edit distance > 3)
          * gaps.push(...newGaps)
          * noProgressCount = 0
      - ELSE:
          * noProgressCount++

  12. Log to diary
      - "第 {iteration+1} 轮 REFLECT: {progressAssessment}，发现 {newGaps.length} 个新的潜在空白"

  // ===== EVALUATE Phase =====
  13. Gap Validation
      - Load prompt/evaluate-answer.md
      - Input: currentGap, knowledge, readContent
      - Output: { canAnswer: bool, answer: string, sources: string[], confidence: string, missingInfo: string }
      - Question format: "基于已读论文，'{currentGap}' 是否是一个真实存在的研究空白？"

  14. Update Identified Gaps
      - IF canAnswer == true AND answer confirms it's a real gap:
          * identifiedGaps.push({
              title: currentGap,
              description: answer,
              evidence: sources,
              confidence: confidence,
              type: [infer from description: contradiction/blank/limitation/trend]
            })
          * gaps.remove(currentGap)
      - ELSE:
          * Keep currentGap in queue for more investigation

  15. Log to diary
      - IF gap confirmed: "第 {iteration+1} 轮 EVALUATE: 确认'{currentGap}'是真实研究空白（置信度: {confidence}）"
      - ELSE: "第 {iteration+1} 轮 EVALUATE: '{currentGap}'需要更多证据，原因: {missingInfo}"

  // ===== Stop Condition Check =====
  16. Check Termination
      - IF gaps.length == 0:
          * STOP: "所有潜在空白已验证"
      - IF noProgressCount >= NO_PROGRESS_THRESHOLD:
          * STOP: "连续 3 轮无新发现"
      - IF identifiedGaps.length >= 5 AND papersRead.size >= MIN_PAPERS_TARGET:
          * STOP: "已识别足够数量的研究空白"
      - IF iteration >= MAX_ITERATIONS:
          * STOP: "达到最大迭代次数"

  17. Increment
      - iteration++

END LOOP
```

## Post-Loop: Rank Gaps

After loop terminates, rank identifiedGaps by:
- Feasibility (high/medium/low) - based on available methods and resources mentioned in papers
- Potential impact (high/medium/low) - based on how often the limitation is mentioned
- Novelty (high/medium/low) - based on whether solutions have been attempted

Ranking formula:
```
score = feasibility_score × 0.4 + impact_score × 0.4 + novelty_score × 0.2
```

## Risk Controls

### Infinite Loop Prevention
- Hard limit: MAX_ITERATIONS = 6
- Soft limit: noProgressCount >= 3 → stop
- Gap deduplication: edit distance < 3 → reject as duplicate

### False Positive Gaps
- Require >= 2 papers as evidence for each gap
- Cross-check: if a gap is mentioned but solutions exist, mark as "partially addressed" not "open"

### Insufficient Evidence
- IF iteration >= 3 AND identifiedGaps.length < 2:
  * Trigger "deep dive mode":
    - Focus on Limitations/Future Work sections exclusively
    - Lower confidence threshold for gap identification
    - Force dfs_search on all papers discussing limitations

## Output Format

After loop terminates and ranking complete, produce:

```markdown
## Gap Analysis: [topic]

### 执行摘要
- 总迭代轮数: {iteration}
- 总阅读论文数: {papersRead.size} (含 Stage 1)
- 初始问题数: 3
- 识别的研究空白数: {identifiedGaps.length}
- 未验证问题: {gaps}
- 停止原因: [gaps 清空 / 无新发现 / 达到目标 / 达到上限]

### Method Comparison Matrix
[Synthesized from gap-discovery prompt output across all iterations]

### Contradictions Found
[Numbered list with evidence from papers]

### Research Gaps (ranked by score)

#### Gap 1: [title]
- **类型**: [contradiction / blank / limitation / trend]
- **描述**: {description}
- **证据**: {evidence sources}
- **可行性**: [high/medium/low + 理由]
- **潜在影响**: [high/medium/low + 理由]
- **新颖性**: [high/medium/low + 理由]
- **置信度**: {confidence}

#### Gap 2: ...

### Field Trends
[Where the field is heading, what's gaining/losing traction - synthesized from all iterations]

### 研究日志
{diary[0]}
{diary[1]}
...

### 未验证问题
[List remaining gaps with explanation of why they couldn't be validated]
```

## Decision Points

- If few gaps found (< 2 after 4 iterations) → the survey may have been too narrow, broaden search queries
- If too many gaps (> 10) → raise confidence threshold, focus on top 5-7 most promising
- If a gap needs more evidence → add targeted sub-question to gaps queue

## Next Stage

Pass the ranked gap list + full knowledge + papersRead to **Idea Generation** (skill/idea-generation.md).

## Key Differences from Previous Version

**Removed** (from earlier versions):
- Fixed "dual-source verification" step
- External validation checkpoint (previously Perplexity-based)

**Added**:
- Iterative SEARCH→READ→REFLECT→EVALUATE loop
- Autonomous gap discovery and validation
- Focus on Limitations/Future Work sections during reading
- Dynamic stopping conditions based on gap identification progress
- State inheritance from Stage 1 (knowledge, papersRead)

**Philosophy**: Gaps are discovered and validated through iterative literature exploration, not external verification.
