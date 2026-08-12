#!/bin/bash
# init-repo.sh - フレームワーク本体リポジトリの初期化
# このスクリプトは、ZIPを展開した直後に1回だけ実行する

set -e

echo "🚀 Noguchi SaaS Framework リポジトリを初期化"
echo ""

# Git リポジトリ初期化
if [ -d ".git" ]; then
  echo "⚠️  既に .git/ が存在します"
  read -p "削除して再初期化しますか？ (y/N): " confirm
  if [[ $confirm == [yY] ]]; then
    rm -rf .git
  else
    echo "中止しました"
    exit 0
  fi
fi

git init -b main
echo "✅ Git リポジトリ初期化"

# .gitignore
cat > .gitignore << 'EOF'
# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# 仮ファイル
*.tmp
*.bak
.framework.backup.*/
EOF
echo "✅ .gitignore 作成"

# 初回コミット
git add .
git commit -m "Initial: framework v0.1.0

21 agents + 7 skills を統合したSaaS量産フレームワーク。

含まれるもの:
- .codex/agents/ (エージェント定義・TOML)
- .agents/skills/ (Skill)
- docs/operations/ (還流ループ運用ガイド)
- templates/project-init/ (新規案件テンプレ)
- scripts/ (新規作成・更新・集約スクリプト)
- .github/ (Issue/PRテンプレ)

詳細は README.md / CHANGELOG.md / ROADMAP.md を参照。
"

echo "✅ 初回コミット完了"

# タグ付け
git tag -a v0.1.0 -m "Initial release"
echo "✅ v0.1.0 タグ作成"

echo ""
echo "🎉 初期化完了！"
echo ""
echo "次のステップ:"
echo ""
echo "1. GitHub でプライベートリポジトリを作成:"
echo "   https://github.com/new"
echo "   - リポジトリ名: noguchi-saas-framework"
echo "   - Private を選択"
echo "   - README、.gitignore、ライセンスは作らない（既存のため）"
echo ""
echo "2. リモート設定とプッシュ:"
echo "   git remote add origin git@github.com:<your-username>/noguchi-saas-framework.git"
echo "   git push -u origin main"
echo "   git push origin v0.1.0"
echo ""
echo "3. 最初の案件を作る:"
echo "   bash scripts/new-project.sh ~/projects/my-first-saas"
echo ""
echo "詳しくは README.md を参照"
