# Experiment Design

Design an experiment plan using iterative loop engine. This is Stage 4 of the research pipeline.

> **Status**: Active. Outputs feed into Stage 5 (Experiment Execution) via `skill/experiment-execution.md`.

## Input

- Selected idea from Stage 3 (Idea Generation)
- Literature survey notes (for baselines and datasets)
- knowledge array from Stages 1-3
- papersRead set from Stages 1-3

## Prerequisites

- Completed idea generation with selected idea
- Prompts: `prompt/reflect-gaps.md`, `prompt/evaluate-answer.md`
- Tools: google-scholar-scraper (Apify), paper_searching, paper_fetching, paper_content, paper_reference, brave_web_search

## Overview

This skill uses an iterative SEARCH→READ→REFLECT→EVALUATE loop to design a complete experiment plan. The system autonomously searches for evaluation setups, baselines, datasets, and validates completeness.

## Loop State

Maintain these variables throughout execution:

```typescript
gaps: string[]              // Questions about experiment design components
knowledge: Finding[]        // Confirmed findings (inherited from Stages 1-3)
diary: string[]             // Narrative log of each iteration
iteration: number           // Current iteration count
noProgressCount: number     // Consecutive iterations without new findings
papersRead: Set<string>     // normalizedTitle of papers already read (inherited)
experimentPlan: ExperimentPlan  // Accumulating experiment design
```

## Initial State

```typescript
gaps = [
  "How to evaluate the effectiveness of this idea?",
  "What baselines are needed for comparison?",
  "What datasets are needed?",
  "What are the key parameters for experimental setup?"
]
knowledge = [...] // Inherited from Stages 1-3
papersRead = Set(...) // Inherited from Stages 1-3
experimentPlan = {
  hypothesis: "",
  method: "",
  datasets: [],
  baselines: [],
  metrics: [],
  ablations: [],
  resources: {},
  risks: []
}
iteration = 0
noProgressCount = 0
diary = []
```

## Loop Parameters

- MAX_ITERATIONS: 4
- MIN_PAPERS_TARGET: 15 (cumulative with previous stages)
- PAPERS_PER_ITERATION: 8-12
- NO_PROGRESS_THRESHOLD: 3

## Iterative Loop

```
WHILE (gaps.length > 0 AND iteration < MAX_ITERATIONS):

  currentGap = gaps[iteration % gaps.length]

  // ===== SEARCH Phase =====
  1. Query Rewriting
     - Rewrite currentGap into 3 queries focused on:
       * Evaluation query: "evaluation metrics benchmarks [idea topic]"
       * Baseline query: "baseline methods comparison [idea topic]"
       * Setup query: "experimental setup datasets [idea topic]"

  2. Parallel Search
     - google-scholar-scraper × 3 (one per query, focus on Experiments/Evaluation sections)
     - brave_web_search × 3 (one per query, target: GitHub repos with experiment code, Papers With Code)
     - Total: 6 searches in parallel

  3. Enrich & Fetch
     - For Scholar results: paper_searching per result (sequential)
     - For those with arxivUrl/oaPdfUrl: paper_fetching (sequential)

  4. Deduplication
     - Filter out papers in papersRead
     - Keep only new papers

  4. Log to diary
     - "Round {iteration+1} SEARCH: targeting '{currentGap}', searched for experimental setups and evaluation methods, found X new papers"

  // ===== READ Phase =====
  5. Priority Ranking
     - Same scoring as previous stages
     - Bonus: +0.1 for papers with detailed experimental sections
     - Sort by score descending

  6. Read Top Papers (focus on Experiments/Evaluation sections)
     - Select top 8-12 papers
     - Apply prompt/paper-rating.md → High/Medium/Low
     - Apply prompt/paper-reading.md with special focus:
       * High: Pass 1 → Pass 2 → Pass 3, extract Experiments + Evaluation + Ablation sections
       * Medium: Pass 1 → Pass 2, extract Experiments
       * Low: Pass 1 only
     - Extract: datasets used, baselines compared, metrics reported, ablation studies, hyperparameters

  7. Reference Expansion (conditional)
     - IF any High-rated paper with detailed experiments found:
       * paper_reference to find follow-up works with improved setups
       * paper_searching → paper_fetching on discovered references
       * Add discovered papers to search results for next iteration

  8. Update State
     - papersRead.add(all read papers' normalizedTitle)

  9. Log to diary
     - "Round {iteration+1} READ: read K papers, total read {papersRead.size}, focusing on experimental setups and evaluation methods"

  // ===== REFLECT Phase =====
  10. Experiment Component Discovery
      - Load prompt/reflect-gaps.md (adapted for experiment design)
      - Input: currentGap, readContent (experiments/evaluation), knowledge, diary
      - Output: { newGaps: string[], progressAssessment: string }
      - Additionally, extract experiment components:
        * Datasets mentioned across papers
        * Baselines used in similar work
        * Metrics commonly reported
        * Ablation strategies
        * Resource requirements (GPU types, training time)

  11. Update Experiment Plan
      - Accumulate discovered components into experimentPlan:
        * datasets: deduplicate and add new datasets
        * baselines: deduplicate and add new baselines
        * metrics: deduplicate and add new metrics
        * ablations: identify key components to ablate
        * resources: estimate based on similar work

  12. Update Gaps
      - IF new experiment design questions discovered:
          * Add to gaps queue
          * noProgressCount = 0
      - ELSE:
          * noProgressCount++

  13. Log to diary
      - "Round {iteration+1} REFLECT: {progressAssessment}, discovered X datasets, Y baselines, Z evaluation metrics"

  // ===== EVALUATE Phase =====
  14. Completeness Check
      - Load prompt/evaluate-answer.md
      - Input: currentGap, experimentPlan, knowledge
      - Output: { canAnswer: bool, answer: string, sources: string[], confidence: string, missingInfo: string }
      - Question format: "Based on papers read, is the experiment design for '{currentGap}' complete?"

  15. Update Experiment Plan
      - IF canAnswer == true:
          * Fill in corresponding section of experimentPlan
          * gaps.remove(currentGap)
      - ELSE:
          * Keep currentGap in queue for more investigation

  16. Log to diary
      - IF component complete: "Round {iteration+1} EVALUATE: '{currentGap}' complete (confidence: {confidence})"
      - ELSE: "Round {iteration+1} EVALUATE: '{currentGap}' still needs supplementation, reason: {missingInfo}"

  // ===== Stop Condition Check =====
  17. Check Termination
      - IF gaps.length == 0:
          * STOP: "all experiment design components complete"
      - IF noProgressCount >= NO_PROGRESS_THRESHOLD:
          * STOP: "no new findings for 3 consecutive rounds"
      - IF all required fields of experimentPlan are filled AND iteration >= 2:
          * STOP: "experiment design complete"
      - IF iteration >= MAX_ITERATIONS:
          * STOP: "reached max iterations"

  18. Increment
      - iteration++

END LOOP
```

## Post-Loop: Finalize Experiment Plan

After loop terminates, finalize experimentPlan:

1. **Hypothesis**: Formalize the idea into a testable hypothesis
2. **Method**: Describe the approach based on the selected idea
3. **Evaluation**: Compile datasets, baselines, metrics, ablations
4. **Resources**: Estimate GPU type, training time, storage based on similar work
5. **Risks**: Identify potential failure modes and mitigation strategies

## Risk Controls

### Infinite Loop Prevention
- Hard limit: MAX_ITERATIONS = 4
- Soft limit: noProgressCount >= 3 → stop
- Component deduplication: same dataset/baseline/metric → merge

### Incomplete Experiment Design
- IF iteration >= 3 AND experimentPlan missing critical components:
  * Trigger "deep dive mode":
    - Focus searches on missing components
    - Lower confidence threshold
    - Force paper_reference on papers with detailed experiments

### Unrealistic Resource Estimates
- Cross-check resource estimates against multiple papers
- Flag if estimates vary widely (> 2x difference)

## Output Format

After loop terminates and plan finalized, produce:

```markdown
## Experiment Plan: [idea title]

### Executive Summary
- Total iterations: {iteration}
- Total papers read: {papersRead.size} (including Stages 1-3)
- Initial questions: 4
- Completed components: {completed components}
- Stop reason: [design complete / no new findings / reached limit]

### Hypothesis
[One clear sentence: what we're testing and expected outcome]

### Method
[Description of approach based on selected idea]
- Core algorithm/architecture
- Key design choices and justifications
- Existing code/frameworks to build on

### Evaluation

#### Datasets
[For each dataset:]
- **[Dataset Name]**: [description, size, why chosen]
- Source: [paper/URL]

#### Baselines
[For each baseline:]
- **[Method Name]**: [brief description, why relevant]
- Source: [paper]

#### Metrics
[For each metric:]
- **[Metric Name]**: [what it measures, why important]
- Primary/Secondary

#### Ablations
[For each ablation:]
- **[Component]**: [what to test, expected insight]

### Resources

#### Compute
- GPU: [type × count × estimated hours]
- Justification: [based on similar work in papers X, Y, Z]

#### Storage
- Dataset storage: [estimate]
- Model checkpoints: [estimate]

#### Frameworks
- [PyTorch/TensorFlow/JAX]
- Key libraries: [list]

#### Timeline
- Phase 1 (Implementation): [estimate]
- Phase 2 (Training): [estimate]
- Phase 3 (Evaluation): [estimate]
- Phase 4 (Analysis): [estimate]

### Risks

#### Risk 1: [description]
- Likelihood: [high/medium/low]
- Impact: [high/medium/low]
- Mitigation: [strategy]

#### Risk 2: ...

### Research Diary
{diary[0]}
{diary[1]}
...

### Unresolved Questions
[List remaining gaps in experiment design, if any]
```

## Decision Points

- If critical baselines missing → search specifically for comparison papers
- If no standard datasets found → may need to create new benchmark
- If resource estimates vary widely → investigate why, adjust conservatively

## Next Step

After this stage produces an Experiment Plan, the user may proceed to:

**Stage 5: Experiment Execution** → `skill/experiment-execution.md`

This stage takes the Experiment Plan as input and executes it on a RunPod GPU pod. It requires explicit user confirmation (real compute costs involved).

## Key Differences from Previous Version

**Removed** (from earlier versions):
- External validation checkpoint (previously Perplexity-based)

**Added**:
- Iterative SEARCH→READ→REFLECT→EVALUATE loop
- Autonomous experiment component discovery
- Focus on Experiments/Evaluation sections during reading
- Dynamic stopping conditions based on design completeness
- State inheritance from Stages 1-3 (knowledge, papersRead)

**Philosophy**: Experiment design is built iteratively by learning from similar work, not validated externally.
