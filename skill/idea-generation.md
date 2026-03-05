# Idea Generation

Generate and evaluate research ideas using iterative loop engine. This is Stage 3 of the research pipeline.

## Input

- Ranked gap list from Stage 2 (Gap Analysis)
- Literature survey notes for context
- knowledge array from Stages 1-2
- papersRead set from Stages 1-2

## Prerequisites

- Completed gap analysis with ranked gaps
- Prompts: `prompt/idea-scoring.md`, `prompt/reflect-gaps.md`, `prompt/evaluate-answer.md`
- Tools: web_search, acd_search, dfs_search, paper_content

## Overview

This skill uses an iterative SEARCH→READ→REFLECT→EVALUATE loop to generate and validate research ideas. The system autonomously searches for solution approaches, validates novelty, and judges when sufficient evidence is gathered.

## Loop State

Maintain these variables throughout execution:

```typescript
gaps: string[]              // Questions about how to solve identified research gaps
knowledge: Finding[]        // Confirmed findings (inherited from Stages 1-2)
diary: string[]             // Narrative log of each iteration
iteration: number           // Current iteration count
noProgressCount: number     // Consecutive iterations without new findings
papersRead: Set<string>     // normalizedTitle of papers already read (inherited)
ideas: Idea[]               // Generated and validated research ideas
```

## Initial State

Select top 3-5 gaps from Stage 2 ranked list. Transform into solution-seeking questions:

```typescript
gaps = [
  "如何解决 [Gap 1 title]？",
  "如何解决 [Gap 2 title]？",
  "如何解决 [Gap 3 title]？"
]
knowledge = [...] // Inherited from Stages 1-2
papersRead = Set(...) // Inherited from Stages 1-2
ideas = []
iteration = 0
noProgressCount = 0
diary = []
```

## Loop Parameters

- MAX_ITERATIONS: 5
- MIN_IDEAS_TARGET: 3
- PAPERS_PER_ITERATION: 8-12
- NO_PROGRESS_THRESHOLD: 3

## Iterative Loop

```
WHILE (gaps.length > 0 AND iteration < MAX_ITERATIONS):

  currentGap = gaps[iteration % gaps.length]

  // ===== SEARCH Phase =====
  1. Query Rewriting
     - Rewrite currentGap into 3 queries focused on:
       * Solution query: "methods approaches solutions [gap topic]"
       * Transfer query: "similar problems [adjacent field] techniques"
       * Innovation query: "novel [gap topic] recent advances breakthroughs"

  2. Parallel Search
     - acd_search × 3 (one per query, focus on methods/solutions)
     - web_search × 3 (one per query, target: GitHub repos, blog posts, workshop papers with novel approaches)
     - Total: 6 searches in parallel

  3. Deduplication
     - Filter out papers in papersRead
     - Keep only new papers

  4. Log to diary
     - "第 {iteration+1} 轮 SEARCH: 针对'{currentGap}'，搜索解决方案和创新方法，找到 X 篇新论文"

  // ===== READ Phase =====
  5. Priority Ranking
     - Same scoring as previous stages
     - Bonus: +0.1 for papers with "novel", "first", "new approach" in title
     - Sort by score descending

  6. Read Top Papers (focus on Methods/Innovation)
     - Select top 8-12 papers
     - Apply prompt/paper-rating.md → High/Medium/Low
     - Apply prompt/paper-reading.md with special focus:
       * High: Pass 1 → Pass 2 → Pass 3, extract Methods + key innovations
       * Medium: Pass 1 → Pass 2, extract Methods
       * Low: Pass 1 only
     - Extract: novel techniques, method combinations, cross-domain transfers

  7. Reference Expansion (conditional)
     - IF any High-rated paper with novel method found:
       * dfs_search(depth=1, breadth=5) to find follow-up works
       * Add discovered papers to search results for next iteration

  8. Update State
     - papersRead.add(all read papers' normalizedTitle)

  9. Log to diary
     - "第 {iteration+1} 轮 READ: 阅读了 K 篇论文，累计已读 {papersRead.size} 篇，重点关注创新方法和技术组合"

  // ===== REFLECT Phase =====
  10. Idea Generation
      - Load prompt/reflect-gaps.md (adapted for idea generation)
      - Input: currentGap, readContent (methods/innovations), knowledge, diary
      - Output: { newGaps: string[], progressAssessment: string }
      - Additionally, generate idea candidates using approaches:
        * **Combination**: merge strengths of two methods seen in papers
        * **Transfer**: apply technique from another field
        * **Inversion**: challenge an assumption
        * **Scale**: apply to new scale/domain
        * **Simplification**: achieve similar results with simpler approach

  11. Novelty Pre-Check (for each idea candidate)
      - Search papersRead: does any paper already implement this?
      - Search web_search results: any GitHub repos with this approach?
      - IF close match found: mark as "extension" not "novel"
      - IF no match: mark as "potentially novel"

  12. Update Gaps
      - IF new solution angles discovered:
          * Add refined questions to gaps queue
          * noProgressCount = 0
      - ELSE:
          * noProgressCount++

  13. Log to diary
      - "第 {iteration+1} 轮 REFLECT: {progressAssessment}，生成 X 个候选 idea，其中 Y 个通过新颖性预检"

  // ===== EVALUATE Phase =====
  14. Idea Scoring
      - For each idea candidate that passed novelty pre-check:
        * Load prompt/idea-scoring.md
        * Input: idea description, supporting papers, gap context
        * Output: { novelty: 1-10, feasibility: 1-10, impact: 1-10, clarity: 1-10, evidence: 1-10 }
        * Total score = sum of 5 dimensions (max 50)

  15. Idea Validation
      - Load prompt/evaluate-answer.md
      - Input: "该 idea 是否可行且具有足够的证据支撑？"
      - Output: { canAnswer: bool, answer: string, sources: string[], confidence: string, missingInfo: string }

  16. Update Ideas
      - IF canAnswer == true AND total score >= 25:
          * ideas.push({
              title: idea title,
              description: idea description,
              addressesGap: currentGap,
              scores: { novelty, feasibility, impact, clarity, evidence },
              totalScore: sum,
              sources: supporting papers,
              confidence: confidence
            })
          * gaps.remove(currentGap)
      - ELSE IF total score < 25:
          * Discard idea (too low quality)
          * Keep currentGap in queue
      - ELSE:
          * Keep currentGap in queue for more exploration

  17. Log to diary
      - IF idea added: "第 {iteration+1} 轮 EVALUATE: 确认 idea '{title}'（总分: {totalScore}/50）"
      - ELSE: "第 {iteration+1} 轮 EVALUATE: 当前 idea 质量不足或证据不够，继续搜索"

  // ===== Stop Condition Check =====
  18. Check Termination
      - IF ideas.length >= MIN_IDEAS_TARGET AND gaps.length == 0:
          * STOP: "已生成足够数量的高质量 idea"
      - IF noProgressCount >= NO_PROGRESS_THRESHOLD:
          * STOP: "连续 3 轮无新 idea 生成"
      - IF ideas.length >= MIN_IDEAS_TARGET AND iteration >= 3:
          * STOP: "已达到 idea 目标且完成初步探索"
      - IF iteration >= MAX_ITERATIONS:
          * STOP: "达到最大迭代次数"

  19. Increment
      - iteration++

END LOOP
```

## Post-Loop: Rank and Recommend

After loop terminates, rank ideas by totalScore descending. Select Top 3 for detailed recommendation.

## Risk Controls

### Infinite Loop Prevention
- Hard limit: MAX_ITERATIONS = 5
- Soft limit: noProgressCount >= 3 → stop
- Idea deduplication: similar ideas (edit distance < 5) → merge or keep higher scored one

### False Novelty Claims
- Novelty pre-check against papersRead and web_search results
- Require >= 2 papers as evidence for feasibility
- Conservative novelty scoring: most ideas should score 4-6, not 8-10

### Low-Quality Ideas
- Minimum score threshold: 25/50
- Ideas below threshold are discarded, not added to output

## Output Format

After loop terminates and ranking complete, produce:

```markdown
## Research Ideas: [topic]

### 执行摘要
- 总迭代轮数: {iteration}
- 总阅读论文数: {papersRead.size} (含 Stages 1-2)
- 候选 gap 数: {initial gaps.length}
- 生成的 idea 数: {ideas.length}
- 停止原因: [达到目标 / 无新发现 / 达到上限]

### All Ideas (ranked by total score)

#### Idea 1: [title] — Score: XX/50
- **Addresses Gap**: [gap title]
- **Description**: [2-3 sentences]
- **Scores**:
  - Novelty: X/10
  - Feasibility: X/10
  - Impact: X/10
  - Clarity: X/10
  - Evidence: X/10
- **Key Insight**: [why this could work]
- **Supporting Sources**: [papers]
- **Confidence**: {confidence}

#### Idea 2: ...

### Top 3 Recommendations

#### Recommended #1: [title] (Score: XX/50)
[2-3 sentences: why this is the best bet, what makes it promising, what the main risk is]

#### Recommended #2: [title] (Score: XX/50)
[...]

#### Recommended #3: [title] (Score: XX/50)
[...]

### Discarded Ideas
[Brief list of ideas that scored < 25, with one-line reason]

### 研究日志
{diary[0]}
{diary[1]}
...

### 未解决的 Gap
[List remaining gaps that didn't yield viable ideas]
```

## Decision Points

- If all ideas score low (< 25/50) → gaps may be too hard, revisit gap analysis or broaden search
- If ideas cluster around one gap → that gap is the most fertile, focus there
- If no ideas generated after 3 iterations → trigger "expansion mode" (broaden search, lower threshold)

## Next Stage

Pass the top-ranked idea (or user-selected idea) + full knowledge + papersRead to **Experiment Design** (skill/experiment-design.md).

## Key Differences from Previous Version

**Removed** (from earlier versions):
- Fixed "novelty pre-check" as separate step
- External validation checkpoint (previously Perplexity-based)

**Added**:
- Iterative SEARCH→READ→REFLECT→EVALUATE loop
- Autonomous idea generation and scoring
- Novelty pre-check integrated into REFLECT phase
- Dynamic stopping conditions based on idea quality and quantity
- State inheritance from Stages 1-2 (knowledge, papersRead)

**Philosophy**: Ideas are generated and validated through iterative exploration of solution spaces, not external verification.
