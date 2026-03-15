# Experiment Execution

Execute an experiment on a remote GPU pod via Supervisor architecture. This is Stage 5 of the research pipeline.

## Input

- Completed Experiment Plan from Stage 4 (hypothesis, method, datasets, baselines, metrics, resources, risks)
- User confirmation to proceed (this stage costs real money)

## Prerequisites

- RunPod MCP available (@runpod/mcp-server configured in .mcp.json)
- Bash tool available for curl commands
- Prompts: `prompt/hardware-estimation.md`, `prompt/experiment-task.md`
- Environment: `API_KEY_RUNPOD` set in .env
- Pre-built Docker image: `neocortica-pod:latest` (built via `npm run docker:build`)

## Overview

Seven-phase sequential pipeline using Supervisor + Remote Claude Code architecture. Local CC communicates with the pod via HTTP API (curl). Remote CC executes the experiment autonomously, pausing at checkpoints for user review.

**Critical safety rule**: Once a pod is created (Phase 2), ALL subsequent failures MUST still execute Phase 7 (Cleanup) before stopping. Never leave a pod running unattended — it costs money.

## Execution State

Maintain these variables throughout execution:

```
podId: string               // RunPod pod ID (set in Phase 2)
podUrl: string              // Pod HTTP endpoint URL (set in Phase 2)
taskId: string              // Supervisor task ID (set in Phase 3)
hardware: HardwareEstimate  // GPU config (set in Phase 1)
experimentName: string      // Derived from Experiment Plan title
localResultsDir: string     // ./results/<experimentName> (local)
```

---

## Phase 0: Task Orchestration

1. Analyze the Experiment Plan to determine checkpoint granularity:
   - Default checkpoints: `["phase_3", "phase_4", "phase_5", "phase_6"]`
   - For complex experiments, add sub-checkpoints (e.g., `"phase_4_dryrun"`)

2. Load `prompt/experiment-task.md`

3. Build the task payload by injecting:
   - `{{EXPERIMENT_PLAN}}` → full experiment plan text
   - `{{CHECKPOINT_LIST}}` → formatted checkpoint list

4. Prepare the JSON payload for Supervisor:

```json
{
  "experimentPlan": "<rendered task prompt>",
  "checkpoints": ["phase_3", "phase_4", "phase_5", "phase_6"],
  "envConfig": {},
  "modelConfig": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKey": "<from env>"
  }
}
```

5. Save payload to a temporary local file: `/tmp/task_payload.json`

---

## Phase 1: Hardware Estimation

1. Load `prompt/hardware-estimation.md`
2. Feed the Experiment Plan's method, datasets, resources sections as input
3. Produce hardware estimate JSON: gpuType, gpuCount, estimatedHours, estimatedCost, diskEstimate, dockerImage
4. Present to user in a clear table:

```
GPU Configuration Estimate:
  GPU: NVIDIA A100 80GB PCIe × 1
  Estimated duration: 12 hours
  Estimated cost: ~$19.68
  Disk: 50 GB
  Alternative: H100 80GB ($26.32, 40% faster)
```

5. **USER CONFIRMATION GATE**: Ask user to confirm budget. If declined, STOP.

---

## Phase 2: Pod Provisioning

1. Call RunPod MCP `create-pod`:
   - name: `neocortica-<experimentName>`
   - imageName: `neocortica-pod:latest`
   - gpuTypeIds: from hardware estimate (RunPod gpuTypeId string)
   - gpuCount: from hardware estimate
   - volumeInGb: from hardware estimate diskEstimate_GB
   - ports: `["8080/http"]`
   - containerDiskInGb: 20

2. Record `podId` from response

3. Extract pod URL from response:
   - RunPod HTTP endpoint format: `https://<podId>-8080.proxy.runpod.net`
   - Set `podUrl`

4. Poll Supervisor health until ready:
   ```bash
   curl -s --max-time 10 ${podUrl}/health
   ```
   - Max wait: 5 minutes, poll every 15 seconds
   - Look for: `{ "status": "ok" }`
   - On timeout: report error, call `delete-pod`, STOP

---

## Phase 3: Task Dispatch

1. Submit task to Supervisor:
   ```bash
   curl -s -X POST ${podUrl}/task \
     -H "Content-Type: application/json" \
     -d @/tmp/task_payload.json
   ```

2. Record `taskId` from response

3. Enter the **Checkpoint Loop** (Phase 4)

---

## Phase 4: Checkpoint Loop

This is the core execution loop. Repeat until task completes or is aborted.

### 4.1 Poll Status

```bash
curl -s ${podUrl}/task/${taskId}/status
```

Poll every 30 seconds. Handle each status:

- `"running"` → continue polling
- `"initializing"` → continue polling
- `"awaiting_approval"` → proceed to 4.2
- `"completed"` → proceed to Phase 5
- `"failed"` → fetch report, show error to user, decide retry or abort → Phase 7

### 4.2 Review Checkpoint

1. Fetch the report:
   ```bash
   curl -s ${podUrl}/task/${taskId}/report
   ```

2. Present report to user:
   - Phase name
   - Summary
   - Key metrics (if any)
   - Files created
   - Any issues encountered

3. **USER DECISION GATE**: Ask user for action:
   - **Continue**: proceed to next phase
   - **Revise**: provide instructions for what to change
   - **Abort**: stop experiment → Phase 6

### 4.3 Send Feedback

```bash
curl -s -X POST ${podUrl}/task/${taskId}/feedback \
  -H "Content-Type: application/json" \
  -d '{"action": "<continue|revise|abort>", "message": "<optional instructions>"}'
```

4. Return to 4.1 (poll status again)

---

## Phase 5: Result Collection

When task status is `"completed"`:

### 5.1 Create Local Directory

```bash
mkdir -p ./results/${experimentName}/{logs,metrics,src}
```

### 5.2 Download Results via Supervisor

```bash
# Download key files
curl -s ${podUrl}/task/${taskId}/files/experiment/train.log \
  -o ./results/${experimentName}/logs/train.log

curl -s ${podUrl}/task/${taskId}/files/experiment/results/ \
  -o ./results/${experimentName}/metrics/

curl -s ${podUrl}/task/${taskId}/files/experiment/model.py \
  -o ./results/${experimentName}/src/model.py

curl -s ${podUrl}/task/${taskId}/files/experiment/train.py \
  -o ./results/${experimentName}/src/train.py

curl -s ${podUrl}/task/${taskId}/files/experiment/eval.py \
  -o ./results/${experimentName}/src/eval.py

curl -s ${podUrl}/task/${taskId}/files/experiment/config.yaml \
  -o ./results/${experimentName}/src/config.yaml
```

### 5.3 Checkpoints (optional)

Ask user: "Download model checkpoints? (may be large)"
If yes: download via `/files` endpoint.

---

## Phase 6: Cleanup

### 6.1 Stop Pod

Call RunPod MCP `stop-pod` with podId.

### 6.2 Delete Pod

Ask user: "Pod stopped. Delete? (data is unrecoverable after deletion)"
If confirmed: call RunPod MCP `delete-pod` with podId.
If declined: inform user the pod is stopped but still incurring storage costs.

### 6.3 Experiment Summary

Output a final summary:

```
## Experiment Complete: <experimentName>

### Results
- Key metrics: <metrics from final report>

### Resource Usage
- Total runtime: <hours>
- Estimated cost: ~$<cost>
- GPU: <type> × <count>

### Local Files
- Results directory: ./results/<experimentName>/
- Logs: ./results/<experimentName>/logs/
- Metrics: ./results/<experimentName>/metrics/
- Code: ./results/<experimentName>/src/

### Pod Status
- Pod ID: <podId>
- Status: <deleted / stopped>
```

---

## Error Recovery Matrix

| Phase | Error | Action |
|-------|-------|--------|
| 2 | Pod creation fails | Report to user, STOP |
| 2 | Supervisor health timeout | Delete pod, STOP |
| 3 | Task submission fails | Retry 3×, then abort → Phase 6 |
| 4 | Remote CC fails (status: failed) | Show error report, ask user: retry or abort |
| 4 | Poll timeout (no response 10min) | Check pod status via RunPod MCP, decide |
| 5 | File download fails | Retry 3×, warn user about missing files |
| Any | Unrecoverable error | Save partial results → Phase 5 → Phase 6 |

**Golden rule**: Phase 6 ALWAYS runs if Phase 2 succeeded. No exceptions.
