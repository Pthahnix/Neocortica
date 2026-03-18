# Validation: Gap Analysis

## Context

{{GAP_OUTPUT}}

## Task

You are a rigorous academic reviewer. Search extensively and verify:

1. **Gap authenticity**: For each identified gap, has it actually been addressed by recent work?
2. **Gap feasibility**: Are any gaps infeasible due to fundamental limitations (data, compute, theory)?
3. **Gap completeness**: Are there obvious research gaps in this field that were missed?
4. **Ranking accuracy**: Does the feasibility × impact × novelty ranking seem reasonable?

## Output Format

Return a JSON object:
{
  "score": 7,
  "verdict": "PASS | REVISE | FAIL",
  "suggestions": ["Concrete improvement direction 1", "Concrete improvement direction 2"],
  "issues": [
    {
      "severity": "CRITICAL | WARNING | INFO",
      "category": "gap_already_addressed | gap_infeasible | gap_misidentified | missing_gap",
      "claim": "The specific gap claim being checked",
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
- 9-10: Top-venue quality, gaps are genuine, well-evidenced, and well-ranked
- 7-8: Solid analysis, minor ranking issues or one questionable gap
- 5-6: Some gaps already addressed or infeasible, ranking needs work
- 3-4: Major problems — multiple false gaps or critical omissions
- 1-2: Fundamental misunderstanding of the field's open problems

### Verdict Rules
- PASS: score >= 8 AND no CRITICAL issues
- REVISE: score >= 5
- FAIL: score < 5

### Suggestions
Provide 2-5 concrete directions for improving the gap analysis. Each should be specific enough to guide targeted research (e.g., "Verify gap #3 against recent work by Author X on topic Y" not "Check gaps more carefully").
