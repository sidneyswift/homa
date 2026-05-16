#!/usr/bin/env bash
set -euo pipefail

# Homa Setup Script
# Copies workspace, creates vault, configures crons, and starts OpenClaw.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OPENCLAW_DIR="$HOME/.openclaw"
WORKSPACE_DIR="$OPENCLAW_DIR/workspace"

echo ""
echo "📚 Homa — Setup"
echo "================"
echo ""

# ─── Pre-checks ───────────────────────────────────────────────────────────

if ! command -v openclaw &>/dev/null; then
    echo "❌ OpenClaw is not installed."
    echo "   Install it first: npm install -g openclaw"
    echo "   Then run this script again."
    exit 1
fi

if ! command -v node &>/dev/null; then
    echo "❌ Node.js is not installed."
    echo "   Install it first: https://nodejs.org"
    exit 1
fi

# ─── Workspace ─────────────────────────────────────────────────────────────

if [ -d "$WORKSPACE_DIR" ] && [ "$(ls -A "$WORKSPACE_DIR" 2>/dev/null)" ]; then
    echo "⚠️  Workspace already exists at $WORKSPACE_DIR"
    echo "   If you want a fresh install, back it up first:"
    echo "   mv $WORKSPACE_DIR ${WORKSPACE_DIR}.backup.$(date +%Y%m%d)"
    echo ""
    read -p "Overwrite existing workspace? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

echo "📁 Copying workspace to $WORKSPACE_DIR..."
mkdir -p "$WORKSPACE_DIR"
cp -R "$SCRIPT_DIR/workspace/"* "$WORKSPACE_DIR/"
cp -R "$SCRIPT_DIR/workspace/".[!.]* "$WORKSPACE_DIR/" 2>/dev/null || true
echo "   ✅ Workspace installed"

# Make scripts executable
chmod +x "$WORKSPACE_DIR/scripts/"*.py 2>/dev/null || true
chmod +x "$WORKSPACE_DIR/scripts/"*.sh 2>/dev/null || true

# ─── Obsidian Vault ────────────────────────────────────────────────────────

echo ""
echo "📖 Obsidian Vault Setup"
echo ""
echo "   Homa maintains a knowledge base in Obsidian that syncs to your phone."
echo "   Default location: ~/Documents/Homeschool"
echo ""
read -p "   Vault path (press Enter for default): " VAULT_PATH
VAULT_PATH="${VAULT_PATH:-$HOME/Documents/Homeschool}"

# Expand ~ if present
VAULT_PATH="${VAULT_PATH/#\~/$HOME}"

if [ ! -d "$VAULT_PATH" ]; then
    echo "   Creating vault at $VAULT_PATH..."
    cp -R "$SCRIPT_DIR/vault-template/" "$VAULT_PATH/"
    echo "   ✅ Vault created"
else
    echo "   ⚠️  Vault directory already exists. Skipping template copy."
    echo "      (Existing content preserved)"
fi

# Write vault path to tools so Homa knows where it is
sed -i '' "s|VAULT_PATH_PLACEHOLDER|$VAULT_PATH|g" "$WORKSPACE_DIR/TOOLS.md" 2>/dev/null || true

# ─── Environment Variables ─────────────────────────────────────────────────

ENV_FILE="$OPENCLAW_DIR/.env"

echo ""
echo "🔑 API Key Setup"
echo ""

if [ -f "$ENV_FILE" ]; then
    echo "   .env file already exists at $ENV_FILE"
    read -p "   Overwrite? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "   Keeping existing .env"
    else
        cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
    fi
else
    cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
fi

echo ""
echo "   Required:"
echo "   - Anthropic API key → https://console.anthropic.com"
echo ""
read -p "   Anthropic API key (or press Enter to set later): " ANTHROPIC_KEY
if [ -n "$ANTHROPIC_KEY" ]; then
    sed -i '' "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$ANTHROPIC_KEY|" "$ENV_FILE"
    echo "   ✅ Saved"
fi

echo ""
echo "   Optional (for AI image generation — picture books, flash cards):"
echo "   - fal.ai API key → https://fal.ai/dashboard/keys"
echo ""
read -p "   fal.ai API key (or press Enter to skip): " FAL_KEY
if [ -n "$FAL_KEY" ]; then
    sed -i '' "s|^FAL_API_KEY=.*|FAL_API_KEY=$FAL_KEY|" "$ENV_FILE"
    echo "   ✅ Saved"
fi

# ─── Cron Jobs ─────────────────────────────────────────────────────────────

echo ""
echo "⏰ Setting up cron jobs..."
CRON_DIR="$OPENCLAW_DIR/cron"
mkdir -p "$CRON_DIR/runs"

if [ ! -f "$CRON_DIR/jobs.json" ]; then
    cp "$SCRIPT_DIR/cron-templates/jobs.json" "$CRON_DIR/jobs.json"
    echo "   ✅ Cron jobs installed"
else
    echo "   ⚠️  Cron jobs already exist. Skipping."
fi

# ─── Children directory ────────────────────────────────────────────────────

mkdir -p "$WORKSPACE_DIR/children"
mkdir -p "$WORKSPACE_DIR/reference-images/children"
mkdir -p "$WORKSPACE_DIR/reference-images/family"
mkdir -p "$WORKSPACE_DIR/reference-images/pets-toys"
mkdir -p "$WORKSPACE_DIR/activities"
mkdir -p "$WORKSPACE_DIR/profile-history"
mkdir -p "$WORKSPACE_DIR/memory"

# ─── Done ──────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════"
echo "✅ Homa is installed!"
echo ""
echo "Next steps:"
echo "  1. Start OpenClaw:  openclaw start"
echo "  2. Connect a messaging app (Slack, Discord, etc.)"
echo "  3. Send Homa a message — she'll walk you through onboarding"
echo ""
echo "If you haven't set up a messaging channel yet:"
echo "  openclaw setup"
echo ""
echo "Vault location: $VAULT_PATH"
echo "Workspace: $WORKSPACE_DIR"
echo "═══════════════════════════════════════════════"
echo ""
