#!/usr/bin/env bash
# =============================================================================
# Sonaro Gate — GitHub Push Script
# Usage: bash scripts/github-push.sh
# =============================================================================
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
GITHUB_REPO="huynhtrungcsc/sonaro-gate"
AUTHOR_NAME="Huỳnh Chí Trung"
AUTHOR_EMAIL="huynhtrungcsc@users.noreply.github.com"
BRANCH="main"

# ── Token ────────────────────────────────────────────────────────────────────
# Read token from environment (set via the Secrets panel) or prompt user
TOKEN="${GITHUB_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  echo "Enter your GitHub Personal Access Token:"
  read -rs TOKEN
  echo
fi

REMOTE_URL="https://${TOKEN}@github.com/${GITHUB_REPO}.git"

# ── Git identity ──────────────────────────────────────────────────────────────
git config user.name  "$AUTHOR_NAME"
git config user.email "$AUTHOR_EMAIL"

# ── Stage all changes ─────────────────────────────────────────────────────────
git add -A

# ── Check if there is anything to commit ─────────────────────────────────────
if git diff --cached --quiet; then
  echo "✓ Nothing new to stage — working tree is clean."
  echo "  All changes are already part of the checkpoint commits."
  SKIP_COMMIT=true
else
  SKIP_COMMIT=false
fi

# ── Commit ────────────────────────────────────────────────────────────────────
if [ "$SKIP_COMMIT" = false ]; then
  git commit \
    --author="${AUTHOR_NAME} <${AUTHOR_EMAIL}>" \
    -m "chore(branding): rebrand from aegis-ngfw to sonaro-gate across all configs

Replace all legacy Aegis / Wallix / Lovable placeholder identifiers with the
canonical Sonaro Gate brand and new repository URL throughout the project:

- index.html: title, description, author, OG/Twitter meta, favicon, theme-color
- CONTRIBUTING.md: full rewrite with correct repo URL and commit guidelines
- SECURITY.md: updated advisory link, repo URL, and default credentials
- Dockerfile: image name, env var SONARO_SKIP_SETUP, header comment
- docker-compose.yml: container names (sonaro-gate, sonaro-db), network, DB vars
- docker-compose.production.yml: all sonaro-* container and volume names
- .env.example / docker/.env.*: DB name sonaro_gate, user sonaro, SONARO_SKIP_SETUP
- .github/workflows/ci.yml: Docker image tag sonaro-gate:<sha>
- deploy/install.sh: install path /opt/sonaro, service name sonaro-gate
- public/favicon.png: brand favicon added"
fi

# ── Update remote and push ─────────────────────────────────────────────────
echo "→ Setting remote origin → https://github.com/${GITHUB_REPO}.git"
git remote set-url origin "$REMOTE_URL"

echo "→ Pushing to ${BRANCH}…"
git push origin "${BRANCH}" 2>&1 | sed "s/${TOKEN}/***TOKEN***/g"

# ── Remove token from stored remote (security) ────────────────────────────
git remote set-url origin "https://github.com/${GITHUB_REPO}.git"
echo "✓ Token removed from remote URL."

echo ""
echo "✅ Push complete → https://github.com/${GITHUB_REPO}"
