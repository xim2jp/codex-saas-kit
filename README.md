# Noguchi SaaS Framework

野口さんのSaaS量産フレームワーク（OpenAI Codex 向け 46エージェント + 30 Skill）

> 元は Claude Code 向けに構築したフレームワークを、機能同一のまま Codex CLI の規約（`.codex/agents/*.toml`・`.agents/skills/`・`AGENTS.md`）へ移植したもの。

> プライベートリポジトリです。野口慎一個人および取引先のみがアクセス可能。

## バージョン

現在: `v0.20.0`（Claude Code 版 v0.16.0〜v0.18.0 を移植。企画・戦略の上流 4 フェーズと全フェーズ採番し直し、要件定義 Skill の IPA 準拠刷新、ハーネスの最新モデル向け刷新。Claude Code 版 v0.18.0 と同内容）

CHANGELOG.md で履歴を確認

## クイックスタート

### 新規SaaSプロジェクトを始める

```bash
# 1. このリポジトリをテンプレートとしてクローン
git clone https://github.com/xim2jp/codex-saas-kit.git my-new-saas
cd my-new-saas

# 2. .git を初期化（テンプレートとして使うため）
rm -rf .git
git init

# 3. セットアップスクリプト実行
bash templates/project-init/setup.sh

# 4. AGENTS.md をプロジェクトルートにコピー
cp templates/project-init/AGENTS.md ./

# 5. （任意）RFP・既存企画書・参考資料を置く。エージェントはこのフォルダを書き換えない
cp ~/path/to/rfp.md docs/00-inputs/rfp.md
cp ~/path/to/企画書.md docs/00-inputs/existing-concept.md

# 6. プロジェクト固有のリモートを設定
git remote add origin <your-saas-repo-url>
git add .
git commit -m "Initial: framework $(cat .framework-version)"
git push -u origin main

# 7. Codex を起動し「RFP を置いたので始めて」または「企画を始めよう」と話す
#    → PM が Phase 1（企画）から開始。要件定義（Phase 5）は企画・戦略の Approve 後に自動で始まる
```

### 既存案件にフレームワークを導入する

```bash
cd existing-saas-project

# 1. 必要なディレクトリだけコピー
git clone https://github.com/xim2jp/codex-saas-kit.git /tmp/framework
cp -r /tmp/framework/.codex ./
cp -r /tmp/framework/.agents ./
cp /tmp/framework/templates/project-init/AGENTS.md ./
cp /tmp/framework/templates/project-init/setup.sh ./
bash setup.sh

# 2. バージョン記録（正本からコピー）
cp /tmp/framework/templates/project-init/.framework-version ./

# 3. 学習ファイル作成
cp /tmp/framework/templates/project-init/PROJECT_LEARNINGS.md ./
```

## リポジトリ構造

```
noguchi-saas-framework/
├── .codex/                           # フレームワーク本体（正本）
│   ├── agents/                       # 46エージェント（Codex サブエージェント定義・TOML）
│   └── config.toml                   # Codex プロジェクト設定（並列数・web_search 等）
├── .agents/
│   └── skills/                       # 30 Skill（Codex Agent Skills 形式）
├── templates/
│   └── project-init/                 # 新規案件の初期セットアップ
│       ├── AGENTS.md                 # Codex メインコンテキスト（PM ロール）
│       ├── PROJECT_LEARNINGS.md      # 案件知見テンプレ
│       ├── setup.sh
│       └── .framework-version        # バージョン記録テンプレ
├── docs/
│   ├── learnings/                    # 各案件から還流した知見
│   │   ├── INDEX.md                  # 一覧
│   │   └── YYYY-MM-<project>.md      # 個別レポート
│   ├── operations/                   # 運用ガイド
│   │   ├── feedback-loop.md          # 還流プロセス
│   │   ├── version-strategy.md       # バージョニング方針
│   │   └── monthly-review.md         # 月次レビュー手順
│   └── projects/                     # 案件レジストリ
│       └── INDEX.md                  # どの案件がどのバージョンを使っているか
├── scripts/
│   ├── new-project.sh                # 新規案件初期化補助
│   ├── update-project.sh             # 既存案件のフレームワーク更新（.codex-manifest 3分類、v0.16.0）
│   ├── export-to-projects.sh         # 登録済み派生システムへの一括配布（v0.16.0）
│   ├── check-layout-drift.sh         # エージェント×artifact-layout の整合検証（v0.16.0）
│   └── collect-learnings.sh          # 案件のLEARNINGS集約補助
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── framework-improvement.md  # 還流PR候補
│   │   ├── new-agent-proposal.md
│   │   └── bug-report.md
│   └── workflows/
│       └── changelog-check.yml       # PR時のCHANGELOG更新確認
├── CHANGELOG.md                       # バージョン履歴
├── README.md                          # 本ファイル
└── ROADMAP.md                         # 将来計画
```

## Jev による選択の判断補助

全エージェントは、複数の実行可能な候補を比較するときに `jev-decision` Skill を参照し、判断の影響や不確実性に応じて Jev を利用します。利用先は本家 API ではなく [jevtypesafeai.com](https://jevtypesafeai.com/docs) の Decision API です。API キーは実行環境の `JEV_API_KEY` を優先し、未設定なら `~/.hermes/.env` の `TYPESAFE_API_KEY` を使用します。リクエストには課金が発生します。秘密情報などを送らず、結果はユーザーの指示や必須要件を優先して検証します。キーがない場合や API が使えない場合は通常の判断で進めます。

詳細: `.agents/skills/jev-decision/SKILL.md`

## 推奨外部スキル（frontend-design）

Anthropic 公式プラグイン `frontend-design` の SKILL.md を **`.agents/skills/frontend-design/` に移植**すると、フロントエンド実装コードの美的品質を底上げできます（Codex にはプラグインマーケットプレイスがないため、SKILL.md の手動移植で導入する）。

```
入手元: https://github.com/anthropics/claude-plugins-official/tree/main/plugins/frontend-design
配置先: .agents/skills/frontend-design/SKILL.md
```

- `frontend-design` … 没個性な "AI slop" を避け、特徴的なタイポ・配色・モーションを持つ本番品質コードを生成（`marketing-site-builder` / `implementation-worker` の実装フェーズで発動）。
- 本フレームワークの `visual-director` / `visual-design-toolkit`（上流の方向性決定・アセット生成）とは**役割が異なり共存**する。プロジェクトの `visual-style-guide.md` / `design-system.md` が常に最優先。

判断根拠・優先順位ルール: `docs/operations/external-plugins/frontend-design-vs-visual-director.md`

## 監視 MCP サーバー（オブザバビリティ）

成果物の本番障害・エラー・予兆を Codex から直接調査するため、`observability-integration` Skill が **New Relic / Datadog / Sentry の公式リモート MCP サーバー**の接続をサポートします。

`.codex/config.toml`（または `~/.codex/config.toml`）に追記：

```toml
# Sentry（OAuth。追記後に codex mcp login sentry）
[mcp_servers.sentry]
url = "https://mcp.sentry.dev/mcp"

# Datadog（OAuth or API key）
[mcp_servers.datadog]
url = "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp"

# New Relic（Public Preview, User key を環境変数で）
[mcp_servers.newrelic]
url = "https://mcp.newrelic.com/mcp/"
env_http_headers = { "Api-Key" = "NEW_RELIC_API_KEY" }
```

- 役割分担：**Sentry**（エラー深掘り + Seer AI 根本原因分析）/ **New Relic**（無料枠でフルスタック APM）/ **Datadog**（Tier B 本格運用）。
- 選定・登録・計装・PII対策・アラート設計は `observability-integration` Skill と `observability-integration-specialist` エージェントが担当。
- 詳細: `.agents/skills/observability-integration/references/mcp-servers.md`

## SEO / AIO（検索・生成AI検索からの集客）

営業サイトと公開ページを **Google/Bing と生成AI検索（AI Overviews / ChatGPT / Perplexity）の両方**から発見・引用される状態にするため、`seo-toolkit` Skill と `seo-specialist` エージェントを用意しています。

- **従来SEO**：キーワード戦略（指名/比較/課題の3段）・テクニカルSEO（Next.js App Router の `sitemap.ts`/`robots.ts`/`generateMetadata`/レンダリング戦略）・構造化データ（JSON-LD）・Core Web Vitals
- **AIO/LLMO**：AI Overviews/ChatGPT/Perplexity への**引用最適化**・`llms.txt`・AIクローラ許可方針（GPTBot/ClaudeBot/PerplexityBot 等）
- **計測**：Search Console + GA4（**無料で完結**）／有料SEOツールはクライアント費用負担が確定した案件に限定（野口Profile）
- 主担当：`seo-specialist`。営業サイト実装の `marketing-site-builder` から深掘りを委譲。成果物は `docs/15-marketing-site/seo-plan.md`
- 詳細: `.agents/skills/seo-toolkit/SKILL.md`

## SNS広告戦略（SEOが頭打ちになるカテゴリの集客加速）

競合の多いカテゴリではSEOだけで集客が頭打ちになるため、`paid-ads-toolkit` Skill と新設 `ad-strategy-specialist` エージェントが**SNS広告（Meta/Instagram・TikTok・X・LINE広告・YouTube）を中心とした有料広告戦略**を設計します。

- **役割分担**：SEO/AIOは中長期の資産構築、広告は**即効性のある需要の刈り取り**。競合カテゴリが飽和し指名検索が育ちにくいと判断される場合、`ad-strategy-specialist` が広告を主戦力に据える提案を行う
- **財務制約への対応（最重要）**：民事再生中で一括払いのみ・借入/分割不可のため、広告アカウントの支払い方式は**与信枠に依存しないプリペイド/デビット/前払いを優先**。テスト予算からの段階的スケール、日予算・Lifetime Budgetの上限設定を必須化
- **クリエイティブ**：`promo-video-producer`（動画）・`visual-director`/`page-designer`（静止画）と連携し、フック設計・フォーマット別要件・疲労対策込みで量産体制を構築
- **CAC/LTV管理**：`pricing-strategist`（LTV）・`cost-guardian`（原価）と連携し、CAC回収期間・LTV/CAC比率の目標と、感情に流されない撤退基準（即時停止・見直し・クリエイティブ入れ替え・媒体撤退の4段階）を数値で設定
- **コンプライアンス**：景品表示法（優良誤認・有利誤認）・ステルスマーケティング規制（2023年10月施行）・各SNS広告ポリシーを出稿前に確認
- 主担当：`ad-strategy-specialist`。成果物は `docs/15-marketing-site/ad-strategy.md`
- 詳細: `.agents/skills/paid-ads-toolkit/SKILL.md`

## プロモーション動画（LP・SNS・デモ）

SaaS の集客用動画（**LPヒーロー動画・プロダクトデモ動画・SNS縦型広告・explainer/説明動画**）を、`promo-video-toolkit` Skill と `promo-video-producer` エージェントが**低コストで量産**します。

- **ハイブリッド手法**：①**Remotion**（React で動画をコード生成・ブランド整合・データ連動・**ほぼ無料**）②**画面録画**（Playwright/OBS で実UIをデモ・無料）③**AI動画生成**（Veo/Sora/Runway/Kling を冒頭フック/B-roll に**差し色**）④**AIナレーション/字幕**
- **野口Profile**：Remotion ＋ 録画で骨格（ほぼ無料）、AI動画/AIナレーションは**本数×尺をコスト試算してから**最小利用。Remotion テンプレ化で次案件へ流用
- **無音・自動再生前提**（冒頭3秒フック・テロップ必須）、LP埋め込みは Core Web Vitals を壊さない（poster/preload/圧縮）
- 主担当：`promo-video-producer`。埋め込みは `marketing-site-builder`、動画SEO（VideoObject）は `seo-specialist` と連携。成果物は `docs/15-marketing-site/promo-video-plan.md`
- 詳細: `.agents/skills/promo-video-toolkit/SKILL.md`
- **SNS縦型ショート動画（9:16・30秒）**は、実案件（センセイメモ、実績約¥130/本）で確立した **Sora 2 × Remotion ハイブリッドの実証済みレシピ** `short-promo-video-production` Skill を参照（6カット構成テンプレ・Sora 2 実践知・Remotion テンプレート同梱）。詳細: `.agents/skills/short-promo-video-production/SKILL.md`

## ハーネスの設計（v0.20.0）

エージェントと Skill は、最新モデルが自分で手順を組める前提で書いている。各エージェントは「入力・成果物・品質基準・判断の軸・連携」だけを持ち、共通作法は `sdlc-toolkit` Skill に一本化した。各エージェント定義の冒頭に「作業開始時に読む Skill」を置き、共通契約とドメイン Skill を最初に読ませる。

- **モデル**：エージェント定義に `model` を書かず、セッション既定のモデルを継承する
- **PM**：Codex のルートセッション自身が `AGENTS.md` 経由で project-manager を担う。サブエージェントは他のエージェントを起動できないため、PM を spawn しない
- **不変条件**：`docs/00-inputs/` の読み取り専用とレビューの Verdict ブロック必須は共通契約に一度だけ書き、PM が確認する（Claude Code 版は hooks で強制）
- **MCP**：案件ルートの `mcp-servers.example.toml` から必要なサーバーだけ `.codex/config.toml` に写す。トークンは `env_http_headers` で環境変数から渡す
- **改訂の作法**：`docs/operations/harness-authoring-guide.md` が正本。改訂のたびに `bash scripts/check-harness.sh` を実行する
## 要件定義の IPA 準拠（v0.20.0）

Phase 5 の要件定義を IPA『ユーザのための要件定義ガイド 第2版 — 128 の勘どころ』に基づいて再構成した。正本は `requirements-toolkit` Skill。

- **2 層プロセス**：ビジネス要求定義（現状把握 → 問題・課題 → 業務目的と測定尺度 → 業務手段と IT 手段 → 要求構造の妥当性・十分性 → 優先順位 6 基準・MoSCoW・**採否**）→ システム化要求定義（UC・非機能・権限・用語）。経営レベルの目的（OBJ）・ターゲット（SEG）・KPI は企画・戦略から転記し、聞き直さない。「現行踏襲」は要求として受け入れない
- **成果物**：`requirements.md`（正本：文書構成・ステークホルダ・現状・スコープ・概念データモデル・状態遷移・外部 I/F・運用/移行・受入テスト観点・投資と効果・Before/After）＋ `business-requirements.md`（BZ）・`use-cases.md`（UC）・`non-functional.md`（NFR-<CAT>-NN、検証方法付き）・`permissions-matrix.md`（ROLE × CRUD）・`glossary.md`（禁止語付き）・`open-questions.md`（OQ、先送り基準）。文書カタログの Phase 5 文書すべてにテンプレートが揃った
- **記述規約**：一文一義・単文・数式化・形容詞副詞の数値補足・接続助詞「が」禁止・口頭言語禁止・禁止語・MEDIC（成果は維持/廃止/削減/増加/創出で書く）・ビジネスルールの記法選択表（デシジョンテーブル・状態遷移・CRUD）。requirements-reviewer が Grep で機械的に検査
- **マネジメント**：ステークホルダ分析（7 種の要件と聞き先）、要求量の制御（発散／収束・ベースライン・機能化しない基準）、変更手続き、トレーサビリティ（フォワード／バックワード）、決まらない要件の 3 択と先送り基準、完了判断（投資＋36 ヶ月運用費 vs 効果、中止・棚上げも選択肢）
- **整合修正**：ユースケース一覧の正本を `docs/03-requirements/use-cases.md` に統一（Phase 7 は追記）。機能一覧（F）は親 BZ を必ず持つ。非機能 6 カテゴリのコードを AVL/PERF/OPS/MIG/SEC/ENV に確定

## 企画・戦略フェーズ（SDLC の起点、v0.20.0）

従来は RFP（要件定義策定依頼書）を置いていきなり要件定義に入っていたが、v0.20.0 から **SDLC は Phase 1（企画）から始まる**。「このリポジトリで何を作り何を成し遂げるか」と「それをどう売りどう収益化するか」を要件定義より前に確定し、企画書・戦略書・RFP を突合した入力で要件定義に入る。正本は `business-strategy-toolkit` Skill。

```
Phase 0  ユーザーが docs/00-inputs/ に RFP（rfp.md）・既存企画書（existing-concept.md）・参考資料（materials/）を置く（無くても可）
Phase 1  企画                       concept-planner        → docs/01-concept/concept.md
Phase 2  企画レビュー               concept-reviewer       → Approve 後に文書セット（document-set.md）をユーザー承認で確定
Phase 3  ビジネス・マーケティング戦略  business-strategist    → docs/02-business-strategy/business-strategy.md
Phase 4  戦略レビュー               business-strategy-reviewer
Phase 5  要件定義                   requirements-architect → docs/03-requirements/upstream-reconciliation.md（企画×戦略×RFP の突合表）を作ってからヒアリング
```

- **企画書（concept.md）**：課題仮説の定量化（金額・時間・頻度）、最初の顧客 1 人、提供価値の一文、**リポジトリ成果物スコープ表**（営業ポータル／モバイル／LINE／MCP／法務文書の含む・含めない。これが Phase 9 の営業ポータルモック必須ルールと文書セットプロファイルの根拠）、達成目標 **OBJ-NN**、やらないこと、撤退条件。**既存の企画書があれば取り込み、ゼロから聞き直さない**
- **戦略書（business-strategy.md）**：市場規模（TAM/SAM/SOM、出典付き）、競合（直接・間接・代替手段）、ポジショニングと**選ばない軸**、顧客セグメント **SEG-NN**、収益モデルと価格仮説（価値・競合・原価の 3 方向）、ユニットエコノミクス（**LTV/CAC ≥ 3、回収 ≤ 6 ヶ月**）、チャネル **1〜2 本**、営業ポータル要否、ローンチ計画、KPI ツリー **KPI-NN**（Phase 19 の kpi-baseline の目標値になる）、PMF 判定・撤退基準、法規制の初出し。民事再生中の財務制約（一括払い・借入不可・前払い広告）は Phase 4 の Block 条件。社内ツール・PoC は document-set.md のプロファイルで軽量版
- **突合（upstream-reconciliation.md）**：企画・戦略・RFP の矛盾は要件定義で勝手に解釈せず OQ を起票。PM が「達成目標・スコープ・ターゲットの変更 → Phase 1 差し戻し」「収益・チャネル・KPI の変更 → Phase 3 差し戻し」を判定する
- **円環との接続**：戦略書の KPI 目標 → Phase 19 kpi-baseline → Phase 20 ops-review → Phase 21 で「企画見直し（Phase 1 から）」「戦略見直し（Phase 3 から）」を判定。起点と終点を同じ数値で結ぶ
- **Phase 1-4 のスキップは禁止**。RFP が精緻でも同じ。requirements-architect は企画・戦略が未 Approve なら起動しない
- **採番（BREAKING）**：旧 Phase 1-17 → 新 5-21（12.5 → 16.5）。`docs/00-requirements/` → `docs/03-requirements/`。アクティブ派生案件ゼロの時点で実施。移行手順は CHANGELOG v0.16.0

## 文書カタログ・HTML公開文書体系（v0.17.0）

生成文書を「AI向けの正本（Markdown）」と「人間向けの公開層（HTML）」に分離し、非エンジニアにも読める体系的な文書セットを構築します。正本は `sdlc-toolkit` の `references/document-catalog.md`。

- **二層構造**：`docs/`（Markdown＝正本）から `htmldocs/`（HTML）を機械生成。`node .agents/skills/sdlc-toolkit/scripts/build-htmldocs.mjs`（依存ゼロ）で全量再生成し、ポータル `index.html`・フェーズ表紙・**ID 逆引き索引**を自動構築。各フェーズのレビュー Approve 時・デプロイ Go 時に PM が再生成
- **文書カタログの拡充**：ウォーターフォール標準文書（業務要件・ユースケース・画面仕様・権限マトリクス・エラー一覧・バッチ/通知/外部連携一覧・データ項目定義等）との対応表付き。**案件固有の業務処理仕様書群（`business-rules/PS-NNN-*.md`、年度更新・役員交代・引継ぎ処理などを1件1文書）**、**1画面1仕様書（`screen-specs/S-XXX-NNN.md`）**、**用語集（glossary）**、運用手順書（runbook、障害対応・バックアップ/リストア・デプロイ節必須）、セキュリティ設計書・データ移行手順書、ライセンス一覧・SBOM、**利用者/管理者向け操作マニュアル（`70-manuals/`）**を新設
- **ID 相互参照体系**：BZ→F→S/API/ENT/PS→UC のトレーサビリティを ID で貫通し、HTML 生成時に全 ID を正本文書へ自動リンク化。執筆ルールとして**指示代名詞（「あれ」「それ」）の禁止・ID＋名称併記**を全 producer に義務化（レビュワーの指摘対象）
- **文書セット選択制（`docs/99-pm/document-set.md`）**：全文書必須ではなく、プロファイル（`full-saas` / `internal-tool` / `api-mcp` / `minimal`）を初期値に **PM が「作成する文書セットはこれでいいですか」とユーザー承認を取って確定**。管理者専用 CLI ならブランド・営業サイト・SEO・法務系を除外可能
- **既存案件へは追記型（非破壊）**：生成器は `.agents/` 配下のため `update-project.sh` の NEW 分類で無衝突配布。初回実行だけで既存 Markdown がそのまま HTML 化され、**既存 docs/ の分割・改名はしない**

## セキュリティ基準参照とアカウンタビリティ（v0.16.0）

セキュリティを「やっています」ではなく**「この公的基準のこの項目に、この実装で対応しています」と顧客に説明できる状態**にする `security-compliance` Skill を追加。

- **公的基準の参照集**：IPA（中小企業ガイドライン・安全なウェブサイトの作り方・SECURITY ACTION 自己宣言）、ISMS/ISO27001 附属書A、プライバシーマーク（JIS Q 15001）、NIST CSF 2.0。認証取得が目的ではなく**基準を設計の物差しに使い、「対応済み／代替策／対象外（理由）」の3値対応表**でアカウンタビリティを確保
- **脆弱性データベース監視**：JVN/NVD/CISA KEV/GitHub Advisory/JPCERT。CVSS 点数だけでなく **KEV（悪用実績）掲載で実効優先度を判定**、KEV 該当は即時ホットフィックス
- **EOL データベース監視**：endoflife.date で採用技術のサポート終了を管理。技術選定時に EOL 日を ADR 記録（EOL 2年未満は新規採用しない）、Phase 20 の ops-review で「EOL 接近一覧」を定期確認
- **顧客向けセキュリティチェックシート**（`docs/50-legal/security-compliance-sheet.md`）：legal-docs-generator が生成し security-auditor の監査結果で裏付け。NFR の数値と必ず一致させ、ISMS 取得企業（顧客）の委託先評価にも回答できる形式。「取得」と「準拠」を混同させる表現は禁止

## 非機能要件・IaC・CI/CD・外部ツール（v0.15.0）

- **非機能要件の6カテゴリ必須化**：requirements.md の非機能要件を「可用性／性能・拡張性／運用・保守性／移行性／セキュリティ／システム環境・制約」の表形式で**全項目数値化 or 対象外（理由明記）**に。1名運用で守れる Tier A 既定値（99.5%/月、RTO 4h 等）を `requirements-toolkit/references/non-functional-requirements.md` に収録し、「高速」「安定」等の曖昧語は Phase 6 で Block。確定した NFR はテスト計画（k6 閾値・障害シナリオ）・Tier 判定・KPI ベースラインへ直接接続
- **`iac-multicloud` Skill**：Terraform/OpenTofu を第一選択に AWS（ECS Fargate）/GCP（Cloud Run）/Azure（Container Apps）対応。State 管理（S3/GCS/Blob）・環境分離・plan 承認ゲート・tfsec/Checkov・ドリフト検出。**コードを書く前に Terraform MCP サーバーで最新プロバイダ仕様を引くのが必須手順**。Tier A は「IaC 最小」を明示（過剰品質の回避）
- **`cicd-pipeline` Skill**：フレームワークの品質ゲート（E2E 3回連続 Green・ミューテーション・セキュリティ監査）を GitHub Actions に写像。PR ゲート→プレビュー→本番デプロイ→ロールバックを標準化し、デプロイを CI/CD 経由に一本化。クラウド認証は全て OIDC（キーレス）、Supabase マイグレーションの2段階適用、夜間 flaky 検出・週次ドリフト検出ジョブ
- **`external-tools-catalog` Skill**：生産性を飛躍させる外部 MCP/ツールの厳選カタログ（Terraform・Sentry/New Relic/Datadog・Supabase・Stripe・Context7・Figma MCP 等）。導入判断3基準（実測の短縮／権限リスク／コンテキスト消費）と、本番書き込み権限を渡さない等のセキュリティ規律付き

## 4階層PDCA・円環SDLC（v0.13.0）

「人間社会の業務はすべて循環構造」という設計思想を、`sdlc-toolkit` の `references/lifecycle-loop.md` を正本とする**4つの入れ子ループ**として実装しています。

```
L0 マイクロループ（エージェント内）      ：作る → Self-Check → 直す → 提出
L1 フェーズループ（rework-loop.md）      ：提出 → レビュー → 修正 → 再レビュー（上限5回）
L2 プロダクトループ（Phase 19-21）       ：開発 → リリース → 運用 → 課題 → 改善 → 開発…
L3 フレームワークループ（feedback-loop） ：案件知見 → 本体進化 → 全案件へ配信
```

- **L0 Self-Check**：全 producer 系エージェントは提出前に自己チェック結果を成果物に添付。レビュワーは Self-Check なしを即差し戻し可（レビュワーを浅い指摘から解放し深い指摘に集中させる）
- **L2 円環化（本丸）**：デプロイ Go は「案件終了」ではなく **Phase 19（リリース・計測開始）→ 20（`operations-analyst` の月次運用レビュー）→ 21（`retrospective-facilitator` の改善起票）→ 次サイクル**の入口。成果物は `docs/60-operations/`（release-log / kpi-baseline / ops-review / retrospective / improvement-backlog）
- **軽量チェンジサイクル（二重円環）**：全改善にフル SDLC を強制すると円環が止まるため、改善はフルサイクル／軽量サイクル（5ステップ）／ホットフィックスの3種別で判定。課金・認証・権限・データモデルに触れる変更は必ずフルサイクル
- **ループ計測**：`scripts/loop-metrics.sh` が status.md のループ回数・Verdict 分布・バグ台帳の「混入×発見」マトリクスを機械集計し、Check を印象論から数値に変える。retrospective と月次還流レビュー（L3）の一次資料

## テスト重厚化（二重三重のテスト構造、v0.12.0）

「綿密にテスト計画・実装をしてもすぐバグが出る」問題への構造的対策として、`sdlc-toolkit` の `references/test-hardening.md` を正本とする**テスト重厚化プロトコル**を導入しています。根本診断は「テストの量ではなく**独立性と多様性の不足**」（同じ頭で実装とテストを作ると盲点が共有される）。

- **ケース抽出の二重化（Phase 13）**：新設 `test-case-adversary` が test-planner の成果物を**一切見ずに**独立抽出 → 突合して片方にしかないケースを原則全件採用。test-planner には導出技法マトリクス（同値分割・境界値・状態遷移・デシジョンテーブル等の適用証跡）を義務化
- **ブラックボックス・ファースト（Phase 15）**：tester はまず仕様のみからテストを書き、実装コードの Read は禁止（実装の思い込みの転写防止）。その後カバレッジ穴埋めでホワイトボックス追加
- **テストのテスト（Phase 15）**：Stryker によるミューテーションテスト（クリティカルモジュール スコア80%以上）＋ fast-check のプロパティベーステスト。「カバレッジ80%」の見かけ倒しを機械的に検出
- **探索的・敵対的テスト（Phase 16.5 新設・スキップ禁止）**：新設 `exploratory-tester` が攻撃カタログ7分類（操作順序攪乱・二重送信・ブラウザバック・セッション攪乱・境界/異常入力・IDOR・中断再開）で**台本外の操作**を実ブラウザ試行。レポートが無ければ Phase 18 で Block
- **バグ・エスケープ分析（全フェーズ）**：全バグに「修正より先に再現テスト」＋ `bug-escape-ledger.md`（本来どのフェーズで捕まえるべきだったか）＋チェックリスト即日追記を義務化。バグが出ること自体がテスト網を進化させる燃料になる
- **多重実行**：E2E は3回連続 Green で初めて通過（flaky＝実装の競合状態バグの兆候として扱う）

## 修正ループ（レビュー指摘の強制手戻り）と画面モック

レビューで指摘が出たまま次フェーズに進んでしまう「指摘スルー」を構造的に防ぐため、**修正ループプロトコル**（`.agents/skills/sdlc-toolkit/references/rework-loop.md`）を全レビューフェーズに適用しています。

- 🔴 Block → PM が**ユーザー確認なしで自動的に**担当エージェントを修正モードで再起動 → 指摘対応表を作成 → レビュワー再起動、を Approve まで繰り返す
- **上限5回**のストッパー付き。5回目でも Block なら PM がエスカレーション（上流差し戻し / approve 強制 / スコープ見直し）
- レビュワーの完了報告には機械可読 Verdict ブロック（`VERDICT:` / `LOOP:` / `RETURN_TO:` / `REPORT:`）が必須。PM がこれをパースしてループを回す
- ループ回数は status.md の「ループ」列で可視化

また、外部設計（Phase 9）では**目に見えるビジュアル成果物**として画面HTMLモック（`docs/20-external-design/mockups/`、Tailwind CDN の自己完結HTML + Playwright スクショ）が必須になり、Phase 10 では `external-design-reviewer`（文書整合）と新設の **`ui-mockup-reviewer`**（ビジュアル品質・反復差分）が並列レビューします。再生成時はバリエーション軸（レイアウト骨格・情報密度・一覧表現など）の回転を強制し、**酷似モックの量産を防止**します（`iteration-log.md` で追跡、無変更再提出は NO-CHANGE で即 Block）。

アプリ・営業サイトのモックを作る前には、必ず `visual-director` がデザインイメージ画像とスタイルガイドを準備・確認します。後続のモック担当はその配色・構図・余白・情報階層を HTML/CSS に反映します。

**v0.9.0 から、営業ポータル（LP兼営業サイト）のモックアップも Phase 9 の必須タスク**です。`marketing-site-builder` がモックアップモードで external-designer と並列起動され、`docs/15-marketing-site/mockups/`（同じ自己完結HTML＋スクショ＋iteration-log 作法）を作成し、Phase 10 で `ui-mockup-reviewer` がアプリ画面モックと合わせてレビューします（差し戻し先はモック種別で分岐）。スキップできるのは**要件定義に「営業サイト不要」が明記されている案件のみ**（PM がリスク提示のうえ明示承認を取得し status.md に記録）。

ポータルサイトの標準は**8ページ構成**（トップ／機能紹介／運営者紹介／スクリーンショット集／料金表／FAQ／お問い合わせ／法務。モック必須は前者5ページ）。ビジュアルは厳格ルールではなく傾向として、**幾何学・抽象イラストよりも写実的画像、そして実画面スクリーンショットの多用**を目指します（SaaSは画面がプロダクトそのもの。モック段階ではアプリ画面モックのスクショを流用）。運営者紹介は https://shinichi.noguchi.jp.net から写真含め引用して構成します。

## ローカル開発環境（Docker完結、Phase 15 タスク0）

「開発環境の立ち位置があやふや」問題を解消するため、`local-dev-environment` Skill（v0.9.0 新設）が **Docker ベースで全機能をローカルのみでテストできる開発環境**の構築標準を定めます。

- **Phase 15 の最初の必須タスク（タスク0）**：`implementation-worker` が機能実装より先に環境を構築し、検証レポート（`docs/41-test-results/local-env-verification-*.md`）を作成。レポートが無ければ Phase 16（E2E）に進めない
- **カバー範囲**：アプリ本体・**営業ポータル8ページ**・認証（Supabase ローカルスタック + Mailpit でメール確認）・決済（Stripe テストモード転送 or モック）・AI機能（モック既定、実API課金なし）・Unit/Integration/E2E テスト実行
- **構築物**：`docker-compose.yml` / `supabase/`（config・migrations・seed.sql）/ `scripts/dev-setup.sh`（冪等・一発起動）・`dev-check.sh`（ヘルスチェック一覧）/ `.env.local.example`
- **役割分担**：Phase 13 で `test-planner` が「ローカル完結テスト環境要件」（実体で動かすもの／モックにするもの）を宣言 → Phase 15 タスク0で `implementation-worker` が構築 → `tester` / `e2e-usecase-tester` はその環境上でテスト実行（環境未検証ならテスト着手禁止・差し戻し）
- WSL2 の注意点（Linux FS 配置・host.docker.internal・ポート衝突）も収録
- 詳細: `.agents/skills/local-dev-environment/SKILL.md`

## AI向けSaaS提供（MCPサーバー化）

SaaS の機能を**ブラウザUIだけでなく AI エージェント向けの MCP サーバーとしても提供**できるようにする、`mcp-server-development` Skill と `mcp-server-specialist` エージェントを用意しています。

- **リモートMCP**：Streamable HTTP を Next.js Route Handler / Vercel でホスト（Tier A スタックにそのまま統合）
- **認可**：OAuth 2.1 + Supabase Auth ブリッジ、APIキー発行、テナント分離（RLS）
- **デュアルサーフェス設計**：`external-designer` が同じ `feature-list.md` から人間向け（画面）と AI向け（MCPツール）の2面を設計（`docs/20-external-design/agent-interface.md`）。AI向け提供の要否は要件・技術スタックの決定に従う
- **課金**：Stripe Billing Meters によるツール呼び出しの従量課金。人間向けサブスクと AI 向け従量課金のハイブリッド価格を `payment-integration-specialist` と共同設計
- **AXレビュー**：新設 `agent-experience-reviewer` が、ツール名・description の曖昧さ、レスポンスの冗長さ（コンテキスト浪費）、誤用しやすい命名等を pedantic にレビュー（`ui-mockup-reviewer` と対の存在。画面のビジュアル品質 ⇔ ツールのAI体験品質）
- 詳細: `.agents/skills/mcp-server-development/SKILL.md`

## セキュリティ監査（Phase 18 並列ゲート）

新設 `security-auditor` エージェントが、Phase 18（`implementation-reviewer`）と並列でセキュリティ専任の監査を行います。

- Supabase **RLS ポリシー全数監査**（テーブル×操作×ロール。RLS無効テーブルは即Block）
- **OWASP Top 10**（インジェクション、認可不備=IDOR、SSRF 等）の実コード監査
- シークレットスキャン、`npm audit` による依存関係監査
- Stripe Webhook 署名検証・冪等性の実機確認
- 本番デプロイ前は事実上必須：`docs/41-test-results/security-audit-*.md` が無い、または Critical 項目があれば No-Go

`resilience-testing` Skill（k6 負荷試験、Supabase/Stripe/AI API 障害時のフォールバック演習）と合わせ、Phase 16 の E2E にはビジュアルリグレッション（モック vs 実装）と axe-core による a11y 自動チェックも組み込まれます。

## ビジネス・運用系エージェント（1名運用の増幅装置）

案件の必要性に応じて PM がオンデマンドで起動する6エージェント：

- `legal-docs-generator` … 利用規約・プライバシーポリシー・特商法表記・外部送信規律の雛形生成（`docs/50-legal/`。最終的な適法性確認は専門家に委ねる旨を必ず明記）
- `pricing-strategist` … 競合価格調査・プラン設計・価格心理・MCP従量課金との組み合わせ
- `onboarding-designer` … 初回体験フロー・Activation指標・ライフサイクルメール設計（「登録はさせたが使われない」対策）
- `blog-content-producer` … `seo-toolkit` のキーワードマップから AIO 最適化済みブログ記事を量産
- `cost-guardian` … ランニングコスト見積り・無料枠超過アラート（一括払いのみ・分割借入不可という財務制約に直結）
- `ad-strategy-specialist` … SNS広告戦略（詳細は上記「SNS広告戦略」節）

複数SaaSを1名で運用する段階では `fleet-operations` Skill（横串ダッシュボード設計・複数プロジェクト同時インシデントのトリアージ・月次棚卸し）も参照します。

## 生成 SaaS の main PR 二重レビューゲート（Amazon Q × レビュワーエージェント）

テンプレートから生成した各 SaaS リポジトリでは、`main` へのマージを **2 つのレビューゲート**で守ります。

1. **レビュワーエージェント側**：開発中の Phase 18 `implementation-reviewer` ＋ PR 上の Code Owner approve（`.github/CODEOWNERS` + branch protection）
2. **Amazon Q Developer 側**：PR 作成後「少し時間をおいて」Amazon Q が自動コードレビュー。CI `amazon-q-review-gate` が **3 分間隔 × 3 回ポーリング**して Q のレビューを待機・評価（`CHANGES_REQUESTED` ならブロック／検出でパス／既定回数で無反応なら fail-open でパス）

新リポジトリには `setup.sh` / `new-project.sh` 経由で以下が自動配置されます。

```
.github/workflows/amazon-q-review-gate.yml   # Amazon Q 待機・評価ゲート（required check）
.github/CODEOWNERS                            # Code Owner approve（雛形）
.github/pull_request_template.md              # 二重ゲートのチェックリスト
.github/PR_REVIEW_GATE.md                     # 導入・branch protection・env 一覧
scripts/setup-branch-protection.sh            # main を保護し両ゲートを必須化
```

有効化手順（リポジトリ作成後に一度だけ）：Amazon Q Developer GitHub App を導入 → `.github/CODEOWNERS` を自分/チームに置換 → `bash scripts/setup-branch-protection.sh`。詳細は生成先の `.github/PR_REVIEW_GATE.md`。

## 運用方針（v1）

**Phase 1: コピー運用（〜3案件）**
- 各案件は git clone でフレームワークを取得
- 案件側で自由にカスタマイズ可
- 月次でPROJECT_LEARNINGS.mdをレビューし、本体に還流

**Phase 2: 振り返り（3案件完了後）**
- 還流フローの実効性を評価
- CLIツール化の要否を判断

**Phase 3: CLIツール化（5案件以降）**
- `npx @noguchi/saas-framework` 形式に進化
- 案件ごとのバージョン管理を自動化

詳細: `docs/operations/feedback-loop.md`

## 還流ループ

```
案件で気付き → PROJECT_LEARNINGS.md に記録
       ↓
月次レビュー（毎月最終金曜推奨）
       ↓
本体への Issue 作成（テンプレ使用）
       ↓
PR 作成 → .codex/ .agents/ 更新
       ↓
CHANGELOG.md 更新 → タグ付け（v0.x.y）
       ↓
既存案件に通知 → 各案件で取り込み判断
```

詳細: `docs/operations/monthly-review.md`

## 派生システムへの配布（エクスポート機構、v0.14.0）

本体の改善を派生システム（本フレームワーク導入済みの各 SaaS 案件）へ**安全に一括配布**する仕組み。正本は `docs/operations/compatibility-contract.md`（互換性契約）。

- **互換性契約**：成果物パス・機械可読ブロック（Verdict / Handoff / Self-Check）・status.md 形式・フェーズ番号・エージェント名を「安定API」と定義。破壊は MAJOR のみ、フェーズ番号は追加のみ。エージェント本文などの「内部実装」は MINOR/PATCH で自由に改善 → **配布するだけで派生システムの品質が上がる**
- **マニフェスト3分類更新**：導入時に `.codex-manifest`（配布時ハッシュ台帳）を生成し、`update-project.sh` が SAFE_UPDATE（未カスタマイズ＆本体更新→上書き）／CUSTOM_KEEP（案件カスタマイズ保持）／CONFLICT（両方変更→保持して要マージレポート）を自動判定。**案件カスタマイズを潰さない**
- **一括配布**：`bash scripts/export-to-projects.sh` が `docs/projects/INDEX.md` の配布先リストへ最新版を一括適用（`--dry-run` 対応、`export-log.md` に記録）。CRITICAL 還流は月次を待たず即配布
- **ドリフト検知**：`scripts/check-layout-drift.sh`（エージェント参照パス×artifact-layout の整合）をリリース前に手動実行して機械検証（本キットは git リポジトリではないため CI ではなくスクリプト実行）

## 案件レジストリ

現在運用中の案件: `docs/projects/INDEX.md` 参照

## ライセンス・利用条件

- このフレームワークは野口慎一の個人事業ノウハウ集
- 取引先プロジェクトでの利用可
- 第三者への配布・公開はしない（プライベートリポジトリ運用）

## サポート

- 自分用のためIssueは野口本人のみが作成・対応
- 取引先には完成品（案件成果物）のみを引き渡す

## ROADMAP

詳細: `ROADMAP.md`
