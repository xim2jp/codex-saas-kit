#!/usr/bin/env bash
# setup-branch-protection.sh
# main ブランチに「二重レビューゲート」をマージ必須として適用する。
#   - Amazon Q ゲート: required status check `amazon-q-review-gate`
#   - レビュワーエージェント側: Code Owner の approve 必須（CODEOWNERS）
#
# 前提: gh CLI が認証済みで、対象リポジトリの admin 権限があること。
#
# 使い方:
#   bash scripts/setup-branch-protection.sh                 # 現在のリポジトリの main
#   bash scripts/setup-branch-protection.sh owner/repo      # 指定リポジトリの main
#   bash scripts/setup-branch-protection.sh owner/repo dev  # ブランチも指定

set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ gh CLI が見つかりません。https://cli.github.com/ からインストールしてください。" >&2
  exit 1
fi

REPO="${1:-}"
BRANCH="${2:-main}"

if [ -z "$REPO" ]; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
fi

CHECK_NAME="amazon-q-review-gate"

echo "🔒 branch protection を設定します"
echo "   リポジトリ: $REPO"
echo "   ブランチ  : $BRANCH"
echo "   必須チェック: $CHECK_NAME"
echo "   Code Owner approve: 必須"
echo ""

gh api -X PUT "repos/${REPO}/branches/${BRANCH}/protection" \
  -H "Accept: application/vnd.github+json" \
  --input - <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["${CHECK_NAME}"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo ""
echo "✅ 完了。$BRANCH への直 push は禁止され、PR は次の両方を満たすとマージ可能になります:"
echo "   ① Code Owner の approve（= レビュワーエージェント側ゲート）"
echo "   ② CI チェック '$CHECK_NAME' のパス（= Amazon Q 側ゲート）"
echo ""
echo "💡 まだ '$CHECK_NAME' が候補に出ない場合は、一度 main 向け PR を作って"
echo "   ワークフローを走らせてから本スクリプトを再実行してください。"
