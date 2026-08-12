#!/bin/bash
# new-project.sh - 新規SaaS案件を作る補助スクリプト
# 使い方: bash scripts/new-project.sh ~/projects/my-new-saas

set -e

if [ -z "$1" ]; then
  echo "使い方: bash scripts/new-project.sh <新規プロジェクトのパス>"
  echo "例: bash scripts/new-project.sh ~/projects/shift-saas"
  exit 1
fi

TARGET_PATH="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRAMEWORK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 新規SaaS案件を作成"
echo "  ターゲット: $TARGET_PATH"
echo ""

# 既存ディレクトリチェック
if [ -e "$TARGET_PATH" ]; then
  echo "⚠️  $TARGET_PATH は既に存在します"
  read -p "中断しますか？ (Y/n): " confirm
  if [[ ! $confirm == [nN] ]]; then
    exit 1
  fi
fi

# ディレクトリ作成
mkdir -p "$TARGET_PATH"
cd "$TARGET_PATH"

# フレームワークから .codex/ と .agents/ をコピー
cp -r "$FRAMEWORK_ROOT/.codex" ./
cp -r "$FRAMEWORK_ROOT/.agents" ./
echo "✅ .codex/ と .agents/ を配置"

# テンプレートをコピー
cp "$FRAMEWORK_ROOT/templates/project-init/AGENTS.md" ./
cp "$FRAMEWORK_ROOT/templates/project-init/PROJECT_LEARNINGS.md" ./
cp "$FRAMEWORK_ROOT/templates/project-init/.framework-version" ./
cp "$FRAMEWORK_ROOT/templates/project-init/setup.sh" ./
chmod +x setup.sh
echo "✅ テンプレートファイル配置"

# main への PR 二重レビューゲート（Amazon Q × レビュワーエージェント）を配置
mkdir -p .github/workflows scripts
cp "$FRAMEWORK_ROOT/templates/project-init/.github/workflows/amazon-q-review-gate.yml" .github/workflows/
cp "$FRAMEWORK_ROOT/templates/project-init/.github/PR_REVIEW_GATE.md" .github/
cp "$FRAMEWORK_ROOT/templates/project-init/.github/CODEOWNERS" .github/
cp "$FRAMEWORK_ROOT/templates/project-init/.github/pull_request_template.md" .github/
cp "$FRAMEWORK_ROOT/templates/project-init/scripts/setup-branch-protection.sh" scripts/
chmod +x scripts/setup-branch-protection.sh
echo "✅ PR レビューゲート（.github/ + scripts/setup-branch-protection.sh）配置"

# setup.sh は本体から独立して動かすため、フレームワーク本体のコピーを参照しないバージョンを書き出す
# （setup.sh内で .codex/ .agents/ の場所を探す処理は既に対応済み）

# セットアップスクリプト実行
# FRAMEWORK_BOOTSTRAP=1 を付けることで setup.sh 内のファイル再配置（同一ファイルcpエラーや
# ~/.codex 誤コピーの危険）をスキップし、docs/ 構造や status.md などの初期化のみを行う。
FRAMEWORK_BOOTSTRAP=1 bash setup.sh

echo ""
echo "🎉 新規案件 '$TARGET_PATH' の準備完了"
echo ""
echo "次のステップ:"
echo "  cd $TARGET_PATH"
echo "  git init"
echo "  git add ."
echo "  git commit -m 'Initial: framework $(cat $TARGET_PATH/.framework-version)'"
echo "  # リモートを設定して push"
echo ""
echo "  codex を起動して「現状を把握して」で開始（AGENTS.md の PM ロールが自動適用）"
echo ""

# フレームワーク本体の案件レジストリにエントリ追加候補を表示
PROJECT_NAME="$(basename $TARGET_PATH)"
echo "📋 フレームワーク本体の案件レジストリに以下を追加することを推奨:"
echo ""
echo "  docs/projects/INDEX.md に追記:"
echo "  | $PROJECT_NAME | $(cat $TARGET_PATH/.framework-version) | $(date +%Y-%m-%d) | - | アクティブ |"
echo ""
