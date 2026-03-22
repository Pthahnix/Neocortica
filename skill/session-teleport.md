# Session Teleport — Git-based Context Transfer SOP

Orchestrates deploying a CC research context to a remote GPU pod (RunPod or user-managed Remote server) via Git. No session JSONL transfer — CLAUDE.md + MEMORY provide equivalent durable context.

## Prerequisites

- RunPod MCP server configured (if using RunPod)
- Experiment repo on GitHub (public or private)
- `.mcp.json` with `neocortica-session` entry containing: ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_MODEL, GITHUB_PAT, HF_TOKEN
- Repo remote URL must be HTTPS format (e.g., `https://github.com/user/repo.git`) — PAT auth requires HTTPS, not SSH

## Phase 0: Pod Selection

Ask the user which pod type to use:

- **RunPod** — ephemeral GPU pod, created and deleted via RunPod MCP
- **Remote** — user-managed server, user provides SSH credentials

Based on selection, proceed to Phase 1-RunPod or Phase 1-Remote.

If user cancels, STOP.

## Phase 1-RunPod: Hardware Estimation + Pod Creation

### Step 1: Hardware Estimation

1. Read the experiment plan from the current research context
2. Estimate: GPU type/count, disk space, estimated cost/hour
3. Present estimate to user and **wait for confirmation**
   - If user declines, STOP (no cleanup needed)

### Step 2: Pod Creation (RunPod MCP)

1. Call `create-pod` with estimated hardware:
   - `gpuTypeIds`: from estimate
   - `gpuCount`: from estimate
   - `imageName`: `runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04`
   - `containerDiskInGb`: from estimate
   - `volumeInGb`: 0 (no persistent volume needed)
   - `ports`: `['22/tcp']`
   - `name`: `neocortica-experiment`
2. Wait for pod status = RUNNING
3. Extract SSH connection info (host, port)
4. **Record `podId` for cleanup**
   - If pod creation fails, STOP (no cleanup needed)

SSH user is `root` for RunPod pods.

## Phase 1-Remote: SSH Info Collection

1. Ask user for:
   - **Host**: IP address or hostname
   - **User**: SSH username (e.g., `root`)
   - **Password**: SSH password (or key-based auth if configured)
   - **Port**: SSH port (default 22)
2. Test SSH connectivity:
   ```bash
   ssh -p <port> <user>@<host> "echo 'connection ok'"
   ```
3. Record connection info (host, port, user)
   - If SSH test fails, ask user to verify credentials and retry
   - If unresolvable, STOP

## Phase 2: Context Collection + Push

Shared between both pod types.

1. Copy local CC memory files to repo:
   ```bash
   # Compute local project hash (Windows: D:\path -> D--path)
   cp ~/.claude/projects/<project-hash>/memory/* ./memory/
   ```
2. Commit and push:
   ```bash
   git add memory/
   git commit -m "sync: context for pod deployment"
   git push
   ```
   - If no memory files exist, skip copy — CLAUDE.md alone provides context

## Phase 3: Provision (SSH — smart detection + per-need scripts)

Shared between both pod types. SSH into the pod and detect what's present, then execute only what's needed.

**Credential source**: Read `.mcp.json` and extract ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_MODEL, GITHUB_PAT, HF_TOKEN from the `neocortica-session` MCP server entry's `env` field.

### Step 1: Detection

```bash
ssh -p <port> <user>@<host> "node --version 2>/dev/null; id cc 2>/dev/null; which claude 2>/dev/null; echo '---'"
```

For **Remote** pods: if a component is already present and up-to-date, skip its installation step. For **RunPod** pods: always run all steps (fresh pod).

### Step 2: Install Node.js (if missing or < v22)

```bash
scp -P <port> packages/session/scripts/install-node.sh <user>@<host>:/tmp/
ssh -p <port> <user>@<host> "bash /tmp/install-node.sh"
```

### Step 3: Create cc user (if missing)

```bash
scp -P <port> packages/session/scripts/create-cc-user.sh <user>@<host>:/tmp/
ssh -p <port> <user>@<host> "bash /tmp/create-cc-user.sh"
```

### Step 4: Install Claude Code (if missing)

```bash
scp -P <port> packages/session/scripts/install-cc.sh <user>@<host>:/tmp/
ssh -p <port> <user>@<host> "bash /tmp/install-cc.sh"
```

### Step 5: Configure API credentials

```bash
scp -P <port> packages/session/scripts/setup-env.sh <user>@<host>:/tmp/
ssh -p <port> <user>@<host> "bash /tmp/setup-env.sh '<BASE_URL>' '<AUTH_TOKEN>' '<MODEL>' '<HF_TOKEN>'"
```

Read credentials from `.mcp.json` `neocortica-session` entry (not `.env`).

### Step 6: Configure bypassPermissions

```bash
ssh -p <port> <user>@<host> "mkdir -p /home/cc/.claude && cat > /home/cc/.claude/settings.json << 'SETTINGSEOF'
{
  \"permissions\": {
    \"defaultMode\": \"bypassPermissions\"
  }
}
SETTINGSEOF
chown -R cc:cc /home/cc/.claude"
```

### Step 7: Configure GitHub auth via PAT

```bash
ssh -p <port> <user>@<host> "su - cc -c 'git config --global credential.helper store && echo \"https://<PAT>@github.com\" > /home/cc/.git-credentials'"
```

Read PAT from `.mcp.json` `neocortica-session.env.GITHUB_PAT`.

### Step 8: Deploy context

```bash
scp -P <port> packages/session/scripts/deploy-context.sh <user>@<host>:/tmp/
ssh -p <port> <user>@<host> "bash /tmp/deploy-context.sh '<REPO_HTTPS_URL>' /workspace"
```

Repo URL **must** be HTTPS format for PAT credential store to work.

- If any provision step fails:
  - **RunPod**: inform user, suggest `session-return` for cleanup
  - **Remote**: inform user, retry the failed step

## Phase 4: Handoff

Output to user:

```
Pod ready. Connect:
  ssh -p <port> cc@<host>
  cd /workspace/<repo>
  claude
```

No tmux, no auto-start. User connects and starts CC themselves.
CC reads CLAUDE.md from repo root and MEMORY from `~/.claude/projects/<hash>/memory/` automatically.

For RunPod: remind user to run `session-return` when done to avoid ongoing charges.

## Error Recovery Matrix

| Phase | Failure | RunPod Action | Remote Action |
|-------|---------|---------------|---------------|
| 0 | User cancels | Stop | Stop |
| 1 | Pod creation / SSH fails | Stop (no cleanup) | Troubleshoot connection |
| 2 | Git push fails | Fix locally, retry | Fix locally, retry |
| 3 | Provision fails | Suggest session-return | Inform user, retry step |
| 4 | User can't connect | Troubleshoot SSH | Troubleshoot SSH |
