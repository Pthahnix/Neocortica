# Research Gap Reflection

You are a rigorous researcher. Based on the papers read so far, reflect: **What do I still not know?**

## Input

- **Current research question**: {currentGap}
- **Read paper summaries**: {readContent}
- **Existing findings**: {knowledge}
- **Research diary**: {diary}

## Reflection Dimensions

1. **Method understanding**: Do I understand the main methods in this field?
2. **Recency**: Am I aware of the latest advances (2024-2025)?
3. **Diversity**: Have I seen comparisons across different schools/perspectives?
4. **Practicality**: Do I understand the challenges in real-world applications?
5. **Conceptual completeness**: Have I discovered concepts/methods mentioned in papers that I don't yet understand?

## Output Format

```json
{
  "newGaps": [
    "specific, searchable sub-question 1",
    "specific, searchable sub-question 2"
  ],
  "progressAssessment": "assessment of this round's progress (what new information was found? are we closer to answering the original question?)"
}
```

## Output Principles

1. **Specificity**: Each new gap must be a specific, searchable question — do not propose overly broad questions
2. **Necessity**: Only propose questions you genuinely don't know and need to search to answer
3. **Terminability**: If the current question is already clear, return an empty list `"newGaps": []`
4. **Deduplication**: Do not repeat existing gaps or already-answered questions

## Examples

### Example 1: New gaps discovered

**Input**:
- currentGap: "What are the main methods for 3D Gaussian Splatting?"
- readContent: "Read 5 papers, understood basic 3DGS method and Mip-Splatting"
- knowledge: []

**Output**:
```json
{
  "newGaps": [
    "What are the extension methods for 3DGS in dynamic scenes?",
    "What are the latest advances in 3DGS compression and acceleration techniques?"
  ],
  "progressAssessment": "Understood basic methods, but still unfamiliar with dynamic scenes and efficiency optimization"
}
```

### Example 2: Question already clear

**Input**:
- currentGap: "What is the attention mechanism in Transformers?"
- readContent: "Read 3 papers, including the original Transformer paper and a survey"
- knowledge: [detailed explanation of attention mechanism already available]

**Output**:
```json
{
  "newGaps": [],
  "progressAssessment": "Fully understood the principles and implementation of attention mechanism, can answer this question"
}
```

## Notes

- **Avoid infinite expansion**: Don't expand for the sake of expanding — only propose new questions when genuinely needed
- **Stay focused**: New gaps should be relevant to the current research topic, don't drift too far
- **Quality over quantity**: Better to propose fewer high-quality questions than a pile of vague ones
