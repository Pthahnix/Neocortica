# Validation: Research Ideas

## Context

{{IDEA_OUTPUT}}

## Task

You are a rigorous academic reviewer. Search extensively and verify:

1. **Novelty**: For each idea, does prior art already exist? Search for papers, preprints, and blog posts that implement similar approaches.
2. **Feasibility**: Are the technical assumptions sound? Are there known obstacles?
3. **Overclaims**: Do any ideas claim to be "first" at something that has already been done?
4. **Scoring accuracy**: Do the novelty/feasibility/impact scores seem calibrated?

## Output Format

Return a JSON object:
{
  "score": 7,
  "verdict": "PASS | REVISE | FAIL",
  "suggestions": ["Concrete improvement direction 1", "Concrete improvement direction 2"],
  "issues": [
    {
      "severity": "CRITICAL | WARNING | INFO",
      "category": "novelty_invalid | prior_art_exists | feasibility_concern | overclaim",
      "claim": "The specific claim being checked",
      "verdict": "CORRECT | INCORRECT | PARTIALLY_CORRECT | UNVERIFIABLE",
      "evidence": "What you found with source URLs",
      "suggestion": "How to fix this"
    }
  ],
  "missing_works": ["Title — why it matters"],
  "overall_assessment": "Summary paragraph",
  "confidence": 0.0-1.0
}

### Scoring Rubric
- 9-10: Top-venue quality, genuinely novel and feasible ideas with strong evidence
- 7-8: Solid ideas, minor novelty concerns or feasibility questions
- 5-6: Some ideas lack novelty or have significant feasibility gaps
- 3-4: Major problems — prior art exists for key ideas or fundamental feasibility issues
- 1-2: Ideas are not novel or not feasible

### Verdict Rules
- PASS: score >= 8 AND no CRITICAL issues
- REVISE: score >= 5
- FAIL: score < 5

### Suggestions
Provide 2-5 concrete directions for improving the ideas. Each should be specific (e.g., "Search for prior art combining method A with technique B before claiming novelty" not "Check novelty more carefully").
