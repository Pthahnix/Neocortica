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
- Tools: google-scholar-scraper (Apify), paper_searching, paper_fetching, paper_content, paper_reference, paper_reading, brave_web_search

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
  "How to solve [Gap 1 title]?",
  "How to solve [Gap 2 title]?",
  "How to solve [Gap 3 title]?"
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
     - google-scholar-scraper × 3 (one per query, focus on methods/solutions)
     - brave_web_search × 3 (one per query, target: GitHub repos, blog posts, workshop papers with novel approaches)
     - Total: 6 searches in parallel

  3. Enrich & Fetch
     - For Scholar results: paper_searching per result (sequential)
     - For those with arxivUrl/oaPdfUrl: paper_fetching (sequential)

  4. Deduplication
     - Filter out papers in papersRead
     - Keep only new papers

  4. Log to diary
     - "Round {iteration+1} SEARCH: targeting '{currentGap}', searched for solutions and innovative methods, found X new papers"

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
       * paper_reference to find follow-up works
       * paper_searching → paper_fetching on discovered references
       * Add discovered papers to search results for next iteration

  8. Update State
     - papersRead.add(all read papers' normalizedTitle)

  9. Log to diary
     - "Round {iteration+1} READ: read K papers, total read {papersRead.size}, focusing on innovative methods and technique combinations"

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
      - Search brave_web_search results: any GitHub repos with this approach?
      - IF close match found: mark as "extension" not "novel"
      - IF no match: mark as "potentially novel"

  12. Update Gaps
      - IF new solution angles discovered:
          * Add refined questions to gaps queue
          * noProgressCount = 0
      - ELSE:
          * noProgressCount++

  13. Log to diary
      - "Round {iteration+1} REFLECT: {progressAssessment}, generated X candidate ideas, Y passed novelty pre-check"

  // ===== EVALUATE Phase =====
  14. Idea Scoring
      - For each idea candidate that passed novelty pre-check:
        * Load prompt/idea-scoring.md
        * Input: idea description, supporting papers, gap context
        * Output: { novelty: 1-10, feasibility: 1-10, impact: 1-10, clarity: 1-10, evidence: 1-10 }
        * Total score = sum of 5 dimensions (max 50)

  15. Idea Validation
      - Load prompt/evaluate-answer.md
      - Input: "Is this idea feasible and supported by sufficient evidence?"
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
      - IF idea added: "Round {iteration+1} EVALUATE: confirmed idea '{title}' (total score: {totalScore}/50)"
      - ELSE: "Round {iteration+1} EVALUATE: current idea quality insufficient or evidence lacking, continuing search"

  // ===== Stop Condition Check =====
  18. Check Termination
      - IF ideas.length >= MIN_IDEAS_TARGET AND gaps.length == 0:
          * STOP: "generated sufficient high-quality ideas"
      - IF noProgressCount >= NO_PROGRESS_THRESHOLD:
          * STOP: "no new ideas generated for 3 consecutive rounds"
      - IF ideas.length >= MIN_IDEAS_TARGET AND iteration >= 3:
          * STOP: "reached idea target and completed initial exploration"
      - IF iteration >= MAX_ITERATIONS:
          * STOP: "reached max iterations"

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
- Novelty pre-check against papersRead and brave_web_search results
- Require >= 2 papers as evidence for feasibility
- Conservative novelty scoring: most ideas should score 4-6, not 8-10

### Low-Quality Ideas
- Minimum score threshold: 25/50
- Ideas below threshold are discarded, not added to output

## Output Format

After loop terminates and ranking complete, produce:

```markdown
## Research Ideas: [topic]

### Executive Summary
- Total iterations: {iteration}
- Total papers read: {papersRead.size} (including Stages 1-2)
- Candidate gaps: {initial gaps.length}
- Ideas generated: {ideas.length}
- Stop reason: [reached target / no new findings / reached limit]

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

### Research Diary
{diary[0]}
{diary[1]}
...

### Unresolved Gaps
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
