#!/usr/bin/env bash
# setup-env.sh — Configure API credentials for cc user
# Usage: bash setup-env.sh <BASE_URL> <AUTH_TOKEN> [MODEL] [HF_TOKEN]
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: setup-env.sh <ANTHROPIC_BASE_URL> <ANTHROPIC_AUTH_TOKEN> [ANTHROPIC_MODEL] [HF_TOKEN]"
  exit 1
fi

BASE_URL="$1"
AUTH_TOKEN="$2"
MODEL="${3:-}"
HF_TOKEN="${4:-}"

echo "[setup-env] Configuring API credentials for cc user..."

# Remove old entries if re-running
sed -i '/^export ANTHROPIC_BASE_URL=/d' /home/cc/.bashrc
sed -i '/^export ANTHROPIC_AUTH_TOKEN=/d' /home/cc/.bashrc
sed -i '/^export ANTHROPIC_MODEL=/d' /home/cc/.bashrc
sed -i '/^export HF_TOKEN=/d' /home/cc/.bashrc

# Append new values
cat >> /home/cc/.bashrc <<ENVEOF
export ANTHROPIC_BASE_URL="$BASE_URL"
export ANTHROPIC_AUTH_TOKEN="$AUTH_TOKEN"
ENVEOF

if [ -n "$MODEL" ]; then
  echo "export ANTHROPIC_MODEL=\"$MODEL\"" >> /home/cc/.bashrc
fi

if [ -n "$HF_TOKEN" ]; then
  echo "export HF_TOKEN=\"$HF_TOKEN\"" >> /home/cc/.bashrc
fi

echo "[setup-env] Done"
