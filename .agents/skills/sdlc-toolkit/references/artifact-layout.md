# SDLC 成果物配置ルール

全エージェント（requirements-architect、本Phase 1の5エージェント、後続のレビュワー・実装・PM）が共有する成果物配置ルール。

## ディレクトリ構造

プロジェクトルート配下に `docs/` を作り、フェーズごとに成果物を配置する。

```
<project-root>/
├── docs/
│   ├── 00-requirements/      # 要件定義（requirements-architect）
│   │   ├── requirements.md
│   │   ├── decision-log.md
│   │   └── reviews/
│   ├── 10-business-design/    # 業務フロー・機能一覧
│   │   ├── business-flow.md
│   │   ├── feature-list.md
│   │   ├── pricing-strategy.md    # 価格戦略（pricing-strategist、オンデマンド）
│   │   └── reviews/
│   ├── 11-tech-stack/         # 技術スタック選定
│   │   ├── tech-stack.md
│   │   ├── adr/               # Architecture Decision Records
│   │   ├── cost-estimate.md   # ランニングコスト見積り（cost-guardian、オンデマンド）
│   │   └── reviews/
│   ├── 12-brand-design/       # ブランド・デザイン戦略
│   │   ├── brand-strategy.md
│   │   ├── design-system.md
│   │   └── reviews/
│   ├── 15-marketing-site/     # 営業サイト・集客戦略
│   │   ├── mockups/                # 営業ポータル（LP兼営業サイト）モック（marketing-site-builder、Phase 5、必須、v0.9.0）
│   │   │   ├── index.html          # 全モックへのリンク集
│   │   │   ├── MK-NNN-<slug>.html  # ページごとの自己完結HTMLモック（8ページ構成。必須5：トップ/機能紹介/スクショ集/料金/FAQ、簡易可3：運営者紹介/問い合わせ/法務）
│   │   │   ├── screenshots/        # Playwrightスクショ（MK-NNN-loopN.png、上書き禁止）
│   │   │   └── iteration-log.md    # バリエーション反復ログ（酷似モック量産防止）
│   │   ├── moodboard/              # ムードボード（visual-director）
│   │   ├── screenshots/            # 実装ページのスクショ（page-designer）
│   │   ├── seo-plan.md             # SEO/AIO計画（seo-specialist、オンデマンド）
│   │   ├── promo-video-plan.md     # プロモ動画計画（promo-video-producer、オンデマンド）
│   │   ├── content-calendar.md     # ブログ更新計画（blog-content-producer、オンデマンド）
│   │   ├── ad-strategy.md          # SNS広告戦略（ad-strategy-specialist、オンデマンド、v0.7.0）
│   │   └── reviews/
│   ├── 20-external-design/    # 外部設計
│   │   ├── screen-list.md
│   │   ├── api-spec.md
│   │   ├── data-model.md
│   │   ├── agent-interface.md     # AI向けデュアルサーフェス設計（external-designer、AI向け提供がある案件のみ）
│   │   ├── onboarding-flow.md     # オンボーディング設計（onboarding-designer、オンデマンド）
│   │   ├── mockups/               # 画面HTMLモック（external-designer、必須）
│   │   │   ├── index.html         # 全モックへのリンク集
│   │   │   ├── S-XXX-NNN.html     # 画面ごとの自己完結HTMLモック
│   │   │   ├── screenshots/       # Playwrightスクショ（S-XXX-NNN-loopN.png、上書き禁止）
│   │   │   └── iteration-log.md   # バリエーション反復ログ（酷似モック量産防止）
│   │   └── reviews/
│   ├── 30-internal-design/    # 内部設計
│   │   ├── module-design.md
│   │   ├── class-design.md
│   │   ├── sequence.md
│   │   ├── infra-design.md        # インフラ構成設計（internal-designer、Tier B/C・IaC 案件のみ、v0.15.0。iac-multicloud Skill 準拠）
│   │   └── reviews/
│   ├── 40-test-plan/          # テスト計画（test-planner + test-case-adversary 並列、v0.12.0）
│   │   ├── test-strategy.md   # 「ローカル完結テスト環境要件」節を必須で含む（v0.9.0、local-dev-environment Skill 準拠）
│   │   ├── test-cases.md
│   │   ├── case-derivation-matrix.md  # 導出技法マトリクス（test-planner、必須、v0.12.0）
│   │   ├── adversarial-cases.md       # 独立抽出ケース集（test-case-adversary、必須、v0.12.0）
│   │   ├── case-reconciliation.md     # 突合表（test-planner、必須、v0.12.0）
│   │   ├── e2e-scenarios.md   # ユースケースE2Eシナリオ（test-planner 初版、e2e-usecase-tester が補完）
│   │   ├── test-data.md
│   │   ├── non-functional-tests.md    # 負荷・障害耐性（resilience-testing）・a11y対象画面の宣言を含む
│   │   └── reviews/
│   ├── 41-test-results/       # テスト実行結果・監査結果（Phase 11 / 12 / 13 / 14並列 の出力）
│   │   ├── local-env-verification-YYYYMMDD-HHMM.md # implementation-worker（Phase 11 タスク0、必須、v0.9.0）
│   │   ├── unit-integration-YYYYMMDD-HHMM.md      # tester（Phase 11）
│   │   ├── mutation-YYYYMMDD-HHMM.md              # ミューテーションテスト結果（tester、Phase 11。クリティカルモジュールがある案件は必須、v0.12.0）
│   │   ├── usecase-e2e-YYYYMMDD-HHMM.md           # e2e-usecase-tester（Phase 12、必須。「安定性」節＝3回連続実行の結果を含む、v0.12.0）
│   │   ├── exploratory-YYYYMMDD-HHMM.md           # exploratory-tester（Phase 12.5、必須、v0.12.0）
│   │   ├── bug-escape-ledger.md                   # バグ・エスケープ台帳（全エージェント追記、累積、v0.12.0）
│   │   ├── traceability-audit-YYYYMMDD-HHMM.md    # requirement-traceability-auditor（Phase 13、必須、v0.2.0）
│   │   ├── security-audit-YYYYMMDD-HHMM.md        # security-auditor（Phase 14 と並列、本番デプロイ前は事実上必須、v0.6.0）
│   │   └── reviews/                               # security-auditor 等のレビューループ記録
│   ├── 50-legal/              # 法務文書（legal-docs-generator、オンデマンド、v0.6.0）
│   │   ├── terms-of-service.md
│   │   ├── privacy-policy.md
│   │   ├── tokushoho.md            # 特定商取引法に基づく表記
│   │   ├── external-transmission-disclosure.md  # 外部送信規律（総務省ガイドライン）
│   │   ├── security-compliance-sheet.md         # 顧客向けセキュリティチェックシート（legal-docs-generator 生成・security-auditor 裏付け、B2B案件推奨、v0.16.0。security-compliance Skill 準拠）
│   │   └── reviews/
│   ├── 60-operations/         # 運用サイクル（Phase 15-17、v0.13.0）
│   │   ├── release-log.md                  # リリース記録（PM、Phase 15。軽量サイクルのリリースも追記）
│   │   ├── kpi-baseline.md                 # KPI ベースライン（Phase 15、必須。無ければ Phase 16 に進めない）
│   │   ├── ops-review-YYYY-MM.md           # 運用レビュー（operations-analyst、Phase 16、月次）
│   │   ├── retrospective-YYYY-MM.md        # ふりかえり（retrospective-facilitator、Phase 17）
│   │   ├── improvement-backlog.md          # 優先度付き改善バックログ（Phase 17 → 次サイクル入力）
│   │   ├── loop-metrics-YYYY-MM.md         # ループ計測（scripts/loop-metrics.sh 出力）
│   │   └── changes/                        # 軽量チェンジサイクルの変更要求
│   │       └── CR-NNN.md
│   └── 99-pm/                 # PM領域
│       ├── roadmap.md
│       ├── risk-register.md
│       └── status-log.md
└── (実装コード等)
    ├── docker-compose.yml              # ローカル開発環境（implementation-worker、Phase 11 タスク0、v0.9.0）
    ├── supabase/                       # config.toml / migrations/ / seed.sql（Supabase CLI ローカルスタック）
    ├── scripts/
    │   ├── dev-setup.sh                # 環境構築＋起動（冪等、v0.9.0）
    │   ├── dev-check.sh                # ヘルスチェック（v0.9.0）
    │   └── dev-teardown.sh             # 停止・破棄（v0.9.0）
    ├── .env.local.example              # ローカル用環境変数の雛形（コミット対象。実ファイル .env.local は gitignore）
    ├── content/blog/ または app/blog/  # ブログ記事（blog-content-producer、オンデマンド）
    ├── app/api/mcp/ 等                 # MCP サーバー実装（mcp-server-specialist、オンデマンド）
    └── tests/
        └── e2e/
            ├── auth.setup.ts          # 認証済み storageState 生成
            ├── usecases/              # ユースケースE2Eテスト（e2e-usecase-tester が生成）
            │   ├── signup-oauth.spec.ts
            │   ├── signup-email.spec.ts
            │   ├── login-password-reset.spec.ts
            │   ├── profile-edit.spec.ts
            │   ├── billing-upgrade.spec.ts
            │   ├── billing-invoice-download.spec.ts
            │   └── withdraw.spec.ts
            ├── fixtures/              # 共通フィクスチャ
            └── helpers/               # ヘルパー（DB クリーンアップ等）
```

## テスト結果ファイル（41-test-results/）の必須性

Phase 11 / 12 / 13 で実行結果・監査結果ファイルを出力する：

| Phase | 担当 | ファイル | 必須 |
|-------|------|---------|-----|
| **11（タスク0）** | **implementation-worker** | **`local-env-verification-YYYYMMDD-HHMM.md`** | **必須（無い＝ローカル開発環境未検証。Phase 12 に進めない、v0.9.0）** |
| 11 | tester | `unit-integration-YYYYMMDD-HHMM.md` | 任意（npm test の生ログでも可） |
| 11 | tester | `mutation-YYYYMMDD-HHMM.md` | クリティカルモジュール（課金・認証・権限）がある案件は必須（v0.12.0） |
| **12** | **e2e-usecase-tester** | **`usecase-e2e-YYYYMMDD-HHMM.md`** | **必須**（無い＝Phase 12 未完了） |
| **12.5** | **exploratory-tester** | **`exploratory-YYYYMMDD-HHMM.md`** | **必須（無い＝Phase 12.5 未完了。Phase 14 で Block、v0.12.0）** |
| 全域 | 発見者＋修正者 | `bug-escape-ledger.md` | バグが 1 件でも発見されたら必須（累積台帳、v0.12.0） |
| **13** | **requirement-traceability-auditor** | **`traceability-audit-YYYYMMDD-HHMM.md`** | **必須**（無い＝Phase 13 未完了、v0.2.0） |
| 14並列 | security-auditor | `security-audit-YYYYMMDD-HHMM.md` | 本番デプロイ前は事実上必須（v0.6.0。無ければ Go/No-Go で No-Go 理由になる） |

Phase 14（implementation-reviewer）は `41-test-results/usecase-e2e-*.md` と `41-test-results/traceability-audit-*.md` の最新ファイルを**必ず Read** し、レビュー対象に含める。いずれかが存在しなければレビューを Block する。`security-audit-*.md` も存在すれば必ずレビュー対象に含める。

## 番号付けの理由

- 数字プレフィックスで**ファイルシステム上の表示順 = SDLC進行順**になる
- レビュワーは `reviews/` サブディレクトリに配置（本体と区別）
- 10番台は「並列で進められる設計フェーズ」を示す（10/11/12は並行可能）

## ファイル形式

- 原則**Markdown**（Git管理・差分比較・レビュー記録に最適）
- 図はMermaid形式で本文内に埋め込み（Mermaidが扱えないツールはPNG出力を別途配置）
- 表は標準Markdown表記
- ADR（Architecture Decision Record）は `adr/NNNN-title.md` 形式

## レビュー記録の命名（rework-loop.md 準拠）

- レビューレポート：`reviews/YYYY-MM-DD-<reviewer名>-loopN.md`（N = ループカウント。同日再レビューでも上書きされない）
- 指摘対応表（producer 作成）：`reviews/YYYY-MM-DD-<producer名>-response-loopN.md`

例：
- `reviews/2026-05-14-external-design-reviewer-loop1.md`
- `reviews/2026-05-14-external-designer-response-loop1.md`
- `reviews/2026-05-15-external-design-reviewer-loop2.md`
- `reviews/2026-05-15-ui-mockup-reviewer-loop1.md`

## エージェント間の引き継ぎプロトコル

【v0.13.0】全 producer 系エージェントは、Handoff Block の**直前**に **Self-Check ブロック**（提出前セルフレビュー結果。`lifecycle-loop.md` の L0 プロトコル準拠）を添付する。レビュワーは Self-Check が無い成果物を即差し戻してよい。

各エージェントは作業終了時に成果物の末尾に**Handoff Block**を追加する：

```markdown
---

## 📤 Handoff

- **Created by**: <agent-name>
- **Date**: YYYY-MM-DD
- **Next suggested agent(s)**: <agent-name>, ...
- **Open questions for next phase**:
  - ...
- **Assumptions made**:
  - ...
- **Files referenced**:
  - ...
```

これにより、後続エージェントは前段の判断・前提を引き継げる。

## 上流成果物との整合性チェック

各設計エージェントは作業開始時に：
1. `docs/00-requirements/requirements.md` を必ず Read
2. 上流フェーズの成果物を Read
3. 自分のフェーズで「上流と矛盾しそうな決定」を検出したら、上流の見直しを提案（勝手に解釈変更しない）

## 既存案件への適用

既にdocsの一部が存在する場合は、上書きせず**該当ファイルが既にあるか確認 → なければ作成 / あれば追記・Section更新**で対応する。

## 文書カタログ・htmldocs（v0.17.0、document-catalog.md が正本）

本ファイルの構造に加えて、`document-catalog.md` が以下を定義する（詳細はそちらが正本）：

- **拡充文書**：`00-requirements/`（business-requirements / non-functional / use-cases / user-stories / permissions-matrix / glossary / open-questions）、`10-business-design/`（business-rules/PS-NNN-*.md＝案件固有の業務処理仕様、batch-jobs / notifications / external-integrations）、`20-external-design/`（screen-transitions / screen-specs/S-XXX-NNN.md / error-catalog / auth-design）、`30-internal-design/`（security-design / data-migration）、`50-legal/`（third-party-licenses / sbom.cdx.json）、`60-operations/runbook.md`、`70-manuals/`（user-manual / admin-manual）。**いずれも選択制**（`docs/99-pm/document-set.md` で案件ごとに採否を確定）
- **`htmldocs/`（プロジェクトルート直下）**：`docs/` の Markdown から機械生成する人間向け HTML。手書き禁止。生成コマンド：`node .agents/skills/sdlc-toolkit/scripts/build-htmldocs.mjs`
- **既存案件では追記型**：既存 docs の分割・改名・再構成は禁止。htmldocs は既存 Markdown をそのまま変換して立ち上げる
