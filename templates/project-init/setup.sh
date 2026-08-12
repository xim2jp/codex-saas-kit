#!/bin/bash
# setup.sh - Noguchi SaaS Framework 初期セットアップ（Codex 版）

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# バージョンは .framework-version（正本: templates/project-init/.framework-version）から動的に読む。
# - new-project.sh 経由（FRAMEWORK_BOOTSTRAP=1）: カレントに配置済みの .framework-version を読む
# - standalone 実行: setup.sh と同じ場所（テンプレートディレクトリ）の .framework-version を読む
if [ -f ".framework-version" ]; then
  FRAMEWORK_VERSION=$(head -n 1 .framework-version | tr -d ' ')
elif [ -f "$SCRIPT_DIR/.framework-version" ]; then
  FRAMEWORK_VERSION=$(head -n 1 "$SCRIPT_DIR/.framework-version" | tr -d ' ')
else
  FRAMEWORK_VERSION="unknown"
fi

echo "🚀 Noguchi SaaS Framework セットアップ"
echo "   バージョン: $FRAMEWORK_VERSION"
echo ""

# FRAMEWORK_BOOTSTRAP=1 が設定されているときは
# new-project.sh から呼ばれており、ファイル配置は既に完了している。
# その場合は .codex/ .agents/ 上書き確認・テンプレ再コピーをスキップする。
if [ -z "$FRAMEWORK_BOOTSTRAP" ]; then
  for d in .codex .agents; do
    if [ -d "$d" ]; then
      echo "⚠️  既存の $d/ ディレクトリが見つかりました"
      read -p "バックアップして上書きしますか？ (y/N): " confirm
      if [[ $confirm == [yY] ]]; then
        mv "$d" "$d.backup.$(date +%Y%m%d_%H%M%S)"
        echo "✅ バックアップ完了"
      else
        echo "❌ セットアップを中止しました"
        exit 1
      fi
    fi
  done

  # .codex/ .agents/ の場所を探す（standaloneでsetup.shを置いた場合の親探索）
  if [ -d "$SCRIPT_DIR/../../.codex" ]; then
    cp -r "$SCRIPT_DIR/../../.codex" ./
    cp -r "$SCRIPT_DIR/../../.agents" ./
  elif [ -d "$SCRIPT_DIR/../.codex" ] && [ "$SCRIPT_DIR/.." != "$HOME" ]; then
    # $HOME 配下の場合はユーザーのグローバル ~/.codex を誤コピーしてしまうため除外
    cp -r "$SCRIPT_DIR/../.codex" ./
    cp -r "$SCRIPT_DIR/../.agents" ./
  else
    echo "❌ .codex/ が見つかりません（FRAMEWORK_BOOTSTRAP=1 を付けて new-project.sh から実行してください）"
    exit 1
  fi
  echo "✅ .codex/ と .agents/ を配置"

  # テンプレートファイル
  cp "$SCRIPT_DIR/AGENTS.md" ./
  cp "$SCRIPT_DIR/PROJECT_LEARNINGS.md" ./
  cp "$SCRIPT_DIR/.framework-version" ./
  echo "✅ テンプレートファイル配置"

  # main への PR 二重レビューゲート（Amazon Q × レビュワーエージェント）
  if [ -d "$SCRIPT_DIR/.github" ]; then
    mkdir -p .github/workflows
    # ワークフローはフレームワーク管理物なので常に最新化
    cp "$SCRIPT_DIR/.github/workflows/amazon-q-review-gate.yml" .github/workflows/
    cp "$SCRIPT_DIR/.github/PR_REVIEW_GATE.md" .github/
    # プロジェクト側で編集する想定のものは既存を尊重（上書きしない）
    [ -f .github/CODEOWNERS ] || cp "$SCRIPT_DIR/.github/CODEOWNERS" .github/
    [ -f .github/pull_request_template.md ] || cp "$SCRIPT_DIR/.github/pull_request_template.md" .github/
    mkdir -p scripts
    cp "$SCRIPT_DIR/scripts/setup-branch-protection.sh" scripts/ 2>/dev/null || true
    chmod +x scripts/setup-branch-protection.sh 2>/dev/null || true
    # ループ計測・マニフェスト生成スクリプト（lifecycle-loop / compatibility-contract 準拠、v0.15.0/v0.16.0）
    cp "$SCRIPT_DIR/scripts/loop-metrics.sh" scripts/ 2>/dev/null || true
    cp "$SCRIPT_DIR/scripts/gen-manifest.sh" scripts/ 2>/dev/null || true
    chmod +x scripts/loop-metrics.sh scripts/gen-manifest.sh 2>/dev/null || true
    echo "✅ PR レビューゲート（.github/workflows/amazon-q-review-gate.yml 他）配置"
  fi
else
  echo "✅ ファイル配置はスキップ（new-project.sh から呼び出されたため）"
fi

# .codex-manifest（配布時ハッシュ台帳、v0.16.0）— bootstrap/standalone 両モードで生成
if [ -d ".codex" ] && [ ! -f ".codex-manifest" ]; then
  if [ -f "scripts/gen-manifest.sh" ]; then
    bash scripts/gen-manifest.sh
  else
    {
      echo "# .codex-manifest — フレームワーク配布ファイルのハッシュ台帳（compatibility-contract.md 準拠）"
      echo "# update-project.sh がカスタマイズ検出（3分類）に使用する。手動編集しない"
      echo "version: $FRAMEWORK_VERSION"
      find .codex .agents -type f | LC_ALL=C sort | xargs -d '\n' sha256sum
    } > .codex-manifest
    echo "✅ .codex-manifest を生成"
  fi
fi

# docs/ 構造
echo ""
echo "📁 docs/ 構造を初期化..."
mkdir -p docs/{00-requirements,10-business-design,11-tech-stack/adr,12-brand-design,15-marketing-site/moodboard,15-marketing-site/screenshots,20-external-design/mockups/screenshots,30-internal-design,40-test-plan,41-test-results,50-legal,60-operations/changes,99-pm}
mkdir -p public/images
mkdir -p tmp/ai-drafts

for dir in docs/00-requirements docs/10-business-design docs/11-tech-stack docs/12-brand-design docs/15-marketing-site docs/20-external-design docs/30-internal-design docs/40-test-plan docs/41-test-results docs/50-legal docs/99-pm; do
  touch "$dir/.gitkeep"
done
echo "✅ docs/ 構造作成完了"

# .gitignore
if [ -f ".gitignore" ]; then
  if ! grep -q "tmp/ai-drafts" .gitignore; then
    cat >> .gitignore << 'EOF'

# Codex framework
tmp/ai-drafts/
.codex.backup.*/
.agents.backup.*/
EOF
    echo "✅ .gitignore 更新"
  fi
else
  cat > .gitignore << 'EOF'
node_modules/
.next/
dist/
build/
.env
.env.local
.env*.local
tmp/ai-drafts/
.DS_Store
Thumbs.db
.vscode/
.idea/
.codex.backup.*/
.agents.backup.*/
EOF
  echo "✅ .gitignore 作成"
fi

# status.md
TODAY=$(date +%Y-%m-%d)
if [ ! -f "docs/99-pm/status.md" ]; then
  cat > docs/99-pm/status.md << EOF
# プロジェクト進捗

- **プロジェクト名**: （未設定）
- **開始日**: $TODAY
- **最終更新**: $TODAY
- **フレームワーク版**: $FRAMEWORK_VERSION
- **現在フェーズ**: Phase 1 / 14（未着手）
- **次のアクション**: @requirements-architect で要件定義を開始

## フェーズ別ステータス

| Phase | 名称 | ステータス | 担当 | 成果物 | Verdict | ループ | 完了日 |
|-------|------|----------|------|--------|---------|-------|--------|
| 1 | 要件定義 | ⏳ | requirements-architect | - | - | - | - |
| 2 | 要件レビュー | ⏳ | requirements-reviewer | - | - | - | - |
| 3 | 企画 | ⏳ | business-flow-designer 他 | - | - | - | - |
| 4 | 企画レビュー | ⏳ | planning-reviewer | - | - | - | - |
| 5 | 外部設計（文書＋画面モック） | ⏳ | external-designer | docs/20-external-design/（mockups/ 含む） | - | - | - |
| 6 | 外部設計レビュー（2レビュワー並列） | ⏳ | external-design-reviewer + ui-mockup-reviewer | - | - | - | - |
| 7 | 内部設計 | ⏳ | internal-designer | - | - | - | - |
| 8 | 内部設計レビュー | ⏳ | internal-design-reviewer | - | - | - | - |
| 9 | テスト計画 | ⏳ | test-planner | - | - | - | - |
| 10 | テスト計画レビュー | ⏳ | test-plan-reviewer | - | - | - | - |
| 11 | 実装＋ユニット/統合テスト | ⏳ | implementation-worker + tester | - | - | - | - |
| 12 | ユースケースE2Eテスト（必須） | ⏳ | e2e-usecase-tester | docs/41-test-results/usecase-e2e-*.md | - | - | - |
| 12.5 | 探索的・敵対的テスト（必須） | ⏳ | exploratory-tester | docs/41-test-results/exploratory-*.md | - | - | - |
| 13 | 要件トレーサビリティ監査（必須） | ⏳ | requirement-traceability-auditor | docs/41-test-results/traceability-audit-*.md | - | - | - |
| 14 | 実装＋全テスト結果レビュー（+セキュリティ監査並列） | ⏳ | implementation-reviewer + security-auditor | docs/41-test-results/security-audit-*.md | - | - | - |
| 15 | リリース・計測開始 | ⏳ | project-manager + observability-integration-specialist | docs/60-operations/release-log.md, kpi-baseline.md | - | - | - |
| 16 | 運用サイクル（常設・繰り返し） | ⏳ | operations-analyst | docs/60-operations/ops-review-*.md | - | - | - |
| 17 | 改善サイクル起票 | ⏳ | retrospective-facilitator | docs/60-operations/improvement-backlog.md | - | - | - |

## 運用サイクル（Phase 15-17、v0.15.0）

| サイクル | 期間 | ops-review | 改善起票 | 実施サイクル種別 | 状態 |
|---------|------|-----------|---------|----------------|------|

## 凡例: ⏳ 待機 / 🚧 進行中 / 🔄 レビュー中 / 🔁 再レビュー / ⛔ Block / ✅ 完了 / ⚠️ エスカレーション
## 「ループ」列: レビュー実行回数/上限5回（rework-loop.md 準拠。Phase 6・14 は複数レビュワー独立カウント。Block は自動で修正ループ、5回超えで PM エスカレーション）

## オンデマンド系ステータス（v0.6.0、起動した案件のみ行を追加）

| エージェント | ステータス | 成果物 | Verdict | ループ | 完了日 |
|--------------|----------|--------|---------|-------|--------|

## エスカレーション履歴
（なし）

## リスク・課題
| ID | 内容 | 発生Phase | 影響 | 対応状況 |
|----|------|----------|------|---------|

## 意思決定ログ
（PM判断を記録）

## 還流ループ記録
| 日付 | アクション | 詳細 |
|------|----------|------|
| $TODAY | フレームワーク導入 | $FRAMEWORK_VERSION からスタート |
EOF
  echo "✅ docs/99-pm/status.md 初期化"
fi

# プロジェクト名入力
echo ""
echo "📝 プロジェクト情報を入力してください（後で編集可）"
read -p "プロジェクト名: " project_name
if [ -n "$project_name" ]; then
  if sed --version 2>/dev/null | grep -q GNU; then
    sed -i "s/<案件名をここに>/$project_name/" PROJECT_LEARNINGS.md
  else
    sed -i "" "s/<案件名をここに>/$project_name/" PROJECT_LEARNINGS.md
  fi
  echo "✅ PROJECT_LEARNINGS.md 更新"
fi

echo ""
echo "🎉 セットアップ完了！"
echo ""
echo "📂 配置されたファイル:"
echo "  - .codex/agents/            エージェント定義（38体・TOML）"
echo "  - .codex/config.toml        Codex プロジェクト設定"
echo "  - .agents/skills/           スキル（22種）"
echo "  - .framework-version        $FRAMEWORK_VERSION"
echo "  - AGENTS.md                 Codex メインコンテキスト（PM ロール）"
echo "  - PROJECT_LEARNINGS.md      案件知見の記録（重要！）"
echo "  - docs/                     成果物配置先"
echo "  - .github/                  PR 二重レビューゲート（Amazon Q × レビュワーエージェント）"
echo ""
echo "🚀 次のステップ:"
echo "  1. codex を起動（AGENTS.md が自動で読み込まれ、PM ロールが適用される）"
echo "  2. 「現状を把握して」で現状把握"
echo "  3. 「要件定義を始めよう」で要件定義開始"
echo ""
echo "🔒 main への PR レビューゲートを有効化（リポジトリ作成後に一度だけ）:"
echo "  - Amazon Q Developer GitHub App を導入"
echo "  - .github/CODEOWNERS の @OWNER_PLACEHOLDER を自分/チームに置換"
echo "  - bash scripts/setup-branch-protection.sh で main を保護"
echo "  - 詳細: .github/PR_REVIEW_GATE.md"
echo ""
echo "💡 重要な習慣:"
echo "  - 気付きは PROJECT_LEARNINGS.md にその日のうちに記録"
echo "  - 月次レビューで本体へ還流（毎月最終金曜推奨）"
