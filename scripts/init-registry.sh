#!/bin/bash
# SkillHub Git Registry 初始化脚本
# 手动运行以创建 Git 注册中心仓库

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REGISTRY_PATH="${1:-$SCRIPT_DIR/../server/data/skillhub-registry}"

echo "Initializing SkillHub Registry at: $REGISTRY_PATH"

mkdir -p "$REGISTRY_PATH"
cd "$REGISTRY_PATH"

if [ ! -d ".git" ]; then
  git init
  git config user.name "SkillHub"
  git config user.email "skillhub@local"

  mkdir -p resources bundles manifests

  cat > README.md << 'EOF'
# SkillHub Registry

跨平台 AI 资源注册中心，由 SkillHub Server 自动管理。
EOF

  git add .
  git commit -m "chore: initialize skill hub registry"
  echo "Registry initialized successfully."
else
  echo "Registry already initialized (git repo exists)."
fi
