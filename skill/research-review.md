# Research Review

Single-shot academic review of Stage 1-3 research outputs. Invokes an independent Claude Code process (`claude -p`) to critically evaluate literature survey, gap analysis, and idea generation outputs.

## Prerequisites

- `{PROJECT_ROOT}/output/survey.md` exists (literature survey output)
- `{PROJECT_ROOT}/output/gaps.md` exists (gap analysis output)
- `{PROJECT_ROOT}/output/ideas.md` exists (idea generation output)
- `CLAUDE_CODE_GIT_BASH_PATH` environment variable set (Windows only)

## Procedure

### 1. Prepare Review Prompt

Read `prompt/research-review.md` and substitute `{PROJECT_ROOT}` with the actual absolute project root path (e.g., `D:/NEOCORTICA`).

### 2. Invoke Reviewer CC

```bash
export CLAUDE_CODE_GIT_BASH_PATH='D:\Git\bin\bash.exe'
REVIEW_OUTPUT=$(claude -p "$(cat prompt/research-review.md | sed 's|{PROJECT_ROOT}|<actual_path>|g')" \
  --allowedTools "Read,Glob,Grep,WebSearch,WebFetch,mcp__brave-search__brave_web_search,mcp__perplexity__perplexity_ask" \
  2>/dev/null)
```

The reviewer CC has:
- Read-only file access (Read, Glob, Grep) — reads research outputs
- Search tools (WebSearch, WebFetch, Brave, Perplexity) — verifies claims
- No Write/Edit — reviewer only judges, never modifies

### 3. Parse Output

Extract JSON from the reviewer's output:
1. Look for the outermost `{...}` JSON block in `REVIEW_OUTPUT`
2. Parse as JSON and validate required fields: `overall_score`, `has_critical`, `verdict`, `stages`, `next_actions`
3. If parsing fails, retry the `claude -p` invocation once
4. If retry also fails, log error and return a fallback review with `overall_score: 0, verdict: "FAIL"`

### 4. Validate Review Quality

Check for hallucination indicators:
- Count issues across all stages that have empty or missing `evidence` fields
- If > 50% of issues lack evidence, mark as low-quality review
- If low-quality: retry `claude -p` once with an additional instruction prepended: "REMINDER: Every issue MUST have an evidence field with source URLs. Issues without evidence will be discarded."
- If retry is also low-quality: log warning, proceed with available feedback but note low confidence

### 5. Write Review Output

Write the full review result (raw JSON + any parsing notes) to `{PROJECT_ROOT}/output/review-round-{N}.md` where N is the current round number.

Format:
```markdown
# Review Round {N}

## Score: {overall_score}/10 — {verdict}

## Raw JSON
```json
{parsed JSON}
```

## Quality Check
- Issues with evidence: {count}/{total}
- Low quality: {yes/no}
- Retry used: {yes/no}
```

### 6. Return Result

Return the parsed review JSON to the caller (research-loop.md or human operator).

## Standalone Usage

This skill can be invoked independently (not just from research-loop.md):

```
/research-review
```

When invoked standalone:
1. Check that output/survey.md, output/gaps.md, output/ideas.md exist
2. If any are missing, report which files are missing and stop
3. Execute the review procedure above
4. Present the review results to the user in a readable format
