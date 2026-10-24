# Changelog

このリポジトリのすべての注目すべき変更を記録する。

形式は [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) に準拠し、
バージョニングは [Semantic Versioning](https://semver.org/spec/v2.0.0.html) に従う。

## [Unreleased]

## [v0.20.0] - 2026-10-24

Claude Code 版 v0.16.0〜v0.18.0 の移植。v0.18.0・v0.19.0 は欠番（Claude Code 版との版数対応 +2 を保つため）。

### Added

- **企画・戦略の上流 4 フェーズ**（Claude 版 v0.16.0）：concept-planner（Phase 1 企画）・concept-reviewer（2）・business-strategist（3 ビジネス・マーケティング戦略）・business-strategy-reviewer（4）の 4 エージェントと business-strategy-toolkit Skill。`docs/00-inputs/`（RFP・既存企画書の持ち込み、読み取り専用）、`docs/01-concept/`、`docs/02-business-strategy/` を新設し、要件定義は企画×戦略×RFP の突合（upstream-reconciliation.md）から始まる
- **要件定義 Skill の IPA 準拠刷新**（Claude 版 v0.17.0）：requirements-toolkit に references 4 本（requirements-process・requirements-management・writing-rules・document-guide）と templates 6 本（業務要件一覧 BZ・ユースケース UC・非機能 NFR・権限 ROLE・用語集・要確認事項 OQ）を追加
- `docs/operations/harness-authoring-guide.md`：エージェント定義・Skill・MCP の執筆ガイド（Codex 版）
- `scripts/check-harness.sh`：エージェント定義の name 一致・description・共通契約を読む指示、Skill の frontmatter、版数注記、サイズ、差し戻し先の実在を検査
- MCP 登録の雛形 `templates/project-init/mcp-servers.example.toml`（`.codex/config.toml` の `[mcp_servers.*]` に写す。トークンは `env_http_headers`）。new-project.sh が案件直下に置く

### Changed

- **全フェーズ採番し直し（BREAKING）**：旧 Phase 1-17 → 新 5-21、旧 12.5 → 16.5。`docs/00-requirements/` → `docs/03-requirements/`。移行手順は Claude Code 版 CHANGELOG v0.16.0
- **全 46 エージェント**（`.codex/agents/*.toml`）を Claude 版 v0.18.0 の役割憲章（入力／成果物／品質基準／判断の軸／連携）から変換し直した。各定義の冒頭に「作業開始時に読む Skill」（共通契約の sdlc-toolkit＋ドメイン Skill）を置く。モデルはセッション既定を継承する
- `sdlc-toolkit` を全エージェント共通の契約として再構成（pm-playbook・review-protocol・rework-loop を簡潔化）。全 SKILL.md の description を整理し、エージェント別の使い方ガイド節と版数注記を削除
- `AGENTS.md` テンプレートを簡潔な PM 憲章に書き直した（ルートセッションが PM を担い、専門エージェントだけをサブエージェントとして起動する）
- `docs/00-inputs/` の読み取り専用とレビューの Verdict ブロック必須は、Claude 版では hooks で強制するが、Codex では共通契約の規約として PM が確認する
- external-tools-catalog・iac-multicloud・observability-integration-specialist の MCP 登録手順を Codex の設定方式に合わせた
- 旧モデル名（claude-sonnet-4 系）を Claude Sonnet 5.5（claude-sonnet-5-5）に更新
- `.codex/config.toml` 冒頭コメントの件数（46 体・29 種）と MCP 雛形の案内を更新

### Fixed

- README のクイックスタートが Claude Code 版リポジトリをクローンしていたのを本キットの URL に修正
- ROADMAP に v0.17.0 の行が欠けていたのを補った
- tester のレポート出力先を artifact-layout.md の定義に合わせ、marketing-site-builder 本実装後のレビュー先を implementation-reviewer に修正（Claude 版 v0.18.0 の修正を取り込み）

### 移植しなかったもの

- Claude Code 専用の仕組み：`.claude/settings.json` の hooks、`.claude-plugin/`（plugin 配布）、CI ワークフロー `framework-checks.yml`

## [v0.17.0] - 2026-08-12

Claude Code 版 v0.15.0（文書カタログ・HTML公開文書体系・文書セット選択制）の移植。

### Added（文書カタログ・HTML公開文書体系・文書セット選択制）

- **`sdlc-toolkit` に `references/document-catalog.md` を追加**（文書体系の新しい正本）
  - **二層構造**：`docs/`（Markdown＝AI・Git 向け正本）と `htmldocs/`（HTML＝人間・非エンジニア向け生成物）を分離。HTML は手書き禁止・全量再生成
  - **フェーズ別文書カタログの拡充**：一般的なウォーターフォール成果物との対応表付き。新設文書 = `00-requirements/`（business-requirements・non-functional・use-cases・user-stories・permissions-matrix・**glossary（用語集）**・open-questions）、`10-business-design/`（**business-rules/PS-NNN-*.md ＝案件固有の業務処理仕様書群**（年度更新・役員交代・引継ぎ処理などの一般化。business-flow-designer が Phase 3 で候補列挙必須）・batch-jobs・notifications・external-integrations）、`20-external-design/`（screen-transitions・**screen-specs/S-XXX-NNN.md（1画面1仕様書）**・error-catalog・auth-design の明文化）、`60-operations/runbook.md`（運用手順書）
  - **ID・相互参照体系**：既存 ID（F / S-XXX / UC / ADR / CR / MK）に BZ・NFR・US・ROLE・PS・JOB・NTF・EXT・API・ENT・ERR・RSK・OQ・BUG を追加。「BZ → F → S/API/ENT/PS → UC」のトレーサビリティの背骨を明文化。HTML 生成時に全 ID を正本文書へ自動リンク化
  - **執筆ルール（人間可読性）**：指示代名詞（「あれ」「それ」「上記の」）の禁止、ID は名称併記、冒頭「この文書について」節の必須化、用語の glossary 一元定義、業務文書は業務言語で。違反はレビュワーの指摘対象（review-protocol に追記）
- **実務の成果物一覧との突合による追加**：操作マニュアル2種（`70-manuals/user-manual.md`＝利用者向け / `admin-manual.md`＝管理者向け。customer-support-toolkit のヘルプセンター原稿を兼ねる）、セキュリティ設計書（`30-internal-design/security-design.md`）、データ移行手順書（`30-internal-design/data-migration.md`）、利用ライブラリ・ライセンス一覧（`50-legal/third-party-licenses.md`）、SBOM（`50-legal/sbom.cdx.json`、CycloneDX 機械生成）。runbook.md は必須節を明文化（環境情報・環境変数一覧の所在／デプロイ・ロールバック／定常運用／**障害対応初動**／**バックアップ・リストア**／連絡先＝障害対応手順書・バックアップ復旧手順書を兼ねる）。data-model.md に**属性レベルのデータ項目定義（データディクショナリ）**を必須化。ワイヤーフレーム（=HTMLモック）・UIデザイン（=design-system）・テスト仕様書（=test-cases）等の既存対応も対応表に明記
- **文書セット選択制（`docs/99-pm/document-set.md`）**：全カタログ文書は必須ではなく案件ごとに採否を確定。プロファイル（`full-saas` / `internal-tool` / `api-mcp` / `minimal`）を初期値に、**PM がユーザーへ「作成する文書セットはこれでいいですか」と一覧提示して承認を得る**。除外は理由必須で記録し、既存のスキップルール（営業ポータルモック等）の「明示承認＋記録」を兼ねる。管理者専用 CLI 等ではブランド・マーケ・SEO・法務系を除外可能
- **`scripts/build-htmldocs.mjs` を `sdlc-toolkit` に同梱**（`node .agents/skills/sdlc-toolkit/scripts/build-htmldocs.mjs` で実行、依存パッケージゼロ・Node 18+）
  - `docs/**/*.md` → `htmldocs/**/*.html` の 1:1 全量生成。ルート `index.html`（ポータル）・フェーズ表紙 `index.html`・`id-index.html`（ID 逆引き索引）を自動構築
  - ID 自動リンク（正本にアンカー付与・動的ファイル解決 PS/S/ADR/CR/MK）、Mermaid ローカル同梱（オフライン時はコード表示にフォールバック）、モック・スクショは docs/ 実体へ相対リンク（複製しない）、ライト/ダーク両テーマ対応 CSS
- **既存案件への追記型導入（非破壊）**：スクリプトは `.agents/` 配下のため `update-project.sh` の 3 分類で **NEW（無衝突追加）** として配布される。既存案件では初回実行だけで既存 Markdown がそのまま HTML 化され、**既存 docs/ の分割・改名・再構成は禁止**。不足文書は次にそのフェーズを触るときに新規ファイル追加のみで補完。v0.17.0 以降の新規案件は初回から docs/ と htmldocs/ の両方をフル装備

### Changed

- `sdlc-toolkit/SKILL.md`：references 一覧に document-catalog.md を追加、重要原則 10（文書の二層構造）を追加
- `artifact-layout.md`：末尾に「文書カタログ・htmldocs」節を追加（詳細は document-catalog.md へ委譲）
- `pm-playbook.md`：「文書セット選択制と htmldocs 生成」節を追加、デプロイ Go チェックリストに「htmldocs が最新」を追加、ロールバック手順の正本を runbook.md に指定
- `review-protocol.md`：執筆ルール違反の指摘基準、document-set.md で除外された文書の不存在を指摘しないルール、htmldocs はレビュー対象外（正本は docs/）を追加

## [v0.16.0] - 2026-07-26

Claude Code 版 v0.14.0 の移植。**セキュリティ基準参照とアカウンタビリティ**。

- `security-compliance` Skill 追加（Skill 数 27 → 28）：IPA（中小企業ガイドライン・安全なウェブサイトの作り方・SECURITY ACTION）/ ISMS・ISO27001 附属書A / プライバシーマーク / NIST CSF への準拠マッピング（対応済み／代替策／対象外の3値対応表）、脆弱性DB（JVN/NVD/**CISA KEV**/GitHub Advisory/JPCERT）と EOL DB（endoflife.date）の監視運用、顧客向けセキュリティチェックシート（`docs/50-legal/security-compliance-sheet.md`）
- security-auditor / legal-docs-generator / operations-analyst / tech-stack-architect / non-functional-requirements.md へ配線

## [v0.15.0] - 2026-07-26

Claude Code 版 v0.13.0 の移植。**非機能要件・IaC・CI/CD・外部ツールカタログ**。

- 非機能要件の6カテゴリ必須化：`requirements-toolkit/references/non-functional-requirements.md`（IPA 非機能要求グレード軽量版＋Tier A 既定値。全項目数値化 or 対象外明記。曖昧語は Phase 2 で Block、テスト計画・Tier 判定・KPI ベースラインへ接続）
- `iac-multicloud` Skill 追加：Terraform/OpenTofu で AWS/GCP/Azure、State 管理、環境分離、Terraform MCP 必須参照、tfsec/Checkov、plan 承認ゲート、ドリフト検出（Skill 数 24 → 25）
- `cicd-pipeline` Skill 追加：GitHub Actions への品質ゲート写像（E2E 3回連続含む）、OIDC デプロイ、Supabase マイグレーション2段階適用、夜間/週次ジョブ（Skill 数 25 → 26）
- `external-tools-catalog` Skill 追加：外部 MCP/ツールの厳選カタログと導入判断3基準。登録手順は `.codex/config.toml` の `[mcp_servers]` 方式に適合（Skill 数 26 → 27）

## [v0.14.0] - 2026-07-26

Claude Code 版 v0.12.0 の移植。**派生システム配布機構**。

- `docs/operations/compatibility-contract.md`：安定API（成果物パス・機械可読ブロック・フェーズ番号・エージェント名）と内部実装の区別。配布単位は `.codex/`＋`.agents/`＋`AGENTS.md`
- `.codex-manifest`（配布時ハッシュ台帳）方式：`templates/project-init/scripts/gen-manifest.sh` 追加、`scripts/update-project.sh` を3分類差分適用（SAFE_UPDATE/CUSTOM_KEEP/CONFLICT、--auto 対応）に全面改修
- `scripts/export-to-projects.sh`：docs/projects/INDEX.md の EXPORT-TARGETS 節に登録した派生システムへ一括配布
- `scripts/check-layout-drift.sh`：エージェント/Skill の参照パス × artifact-layout.md の整合を機械検証（git リポジトリではないため CI ではなく手動実行）

## [v0.13.0] - 2026-07-26

Claude Code 版 v0.11.0 の移植。**4階層PDCA・円環SDLC**（エージェント数 40 → 42）。

- `sdlc-toolkit/references/lifecycle-loop.md`：L0（Self-Check）→ L1（rework-loop）→ L2（Phase 15-17 円環）→ L3（還流）の4階層。軽量チェンジサイクル（フル/軽量/ホットフィックスの3種別判定）
- Phase 15-17 新設：`operations-analyst`（Phase 16 運用レビュー）/ `retrospective-facilitator`（Phase 17 改善起票）を追加。デプロイ Go 後に自動で Phase 15 へ（案件終了で停止しない）
- 全 producer に Self-Check（L0）義務化（review-protocol / artifact-layout 更新）、`templates/project-init/scripts/loop-metrics.sh` でループ回数・Verdict 分布・バグ台帳を機械集計
- setup.sh：docs/60-operations/changes 作成、status.md 雛形に Phase 12.5 / 15-17 行と運用サイクル表を追加

## [v0.12.0] - 2026-07-26

Claude Code 版 v0.10.0 の移植。**テスト重厚化（二重三重のテスト構造）**（エージェント数 38 → 40）。

- `sdlc-toolkit/references/test-hardening.md`（6原則の正本）：ケース抽出の二重化／ブラックボックス・ファースト／ミューテーション＋プロパティ／探索的・敵対的テスト／バグ・エスケープ分析／多重実行
- `test-case-adversary` 追加：Phase 9 で test-planner と並列、成果物を見ずに独立ケース抽出 → 突合で片方のみのケースを原則全採用
- `exploratory-tester` 追加：**Phase 12.5 新設・スキップ禁止**。攻撃カタログ7分類の台本外テスト。レポートが無ければ Phase 14 で Block
- tester をブラックボックス・ファースト＋Stryker（クリティカル80%）＋fast-check に、E2E は3回連続 Green ルール、`bug-escape-ledger.md`（再現テスト先行＋チェックリスト即日追記）を全フェーズ義務化
- test-planner / test-plan-reviewer / e2e-usecase-tester / implementation-reviewer / project-manager / pm-playbook / rework-loop / artifact-layout を対応更新

※ 本文中の Skill/エージェント内のバージョン表記は本 CHANGELOG のバージョン（Codex 版）に揃えて移植済み。

## [v0.11.0] - 2026-07-08

> Claude Code 版フレームワーク v0.9.0 と同内容の機能追加（Codex 版へ移植適用）。

### Added（SNS縦型ショート動画の実証済み制作レシピ）
- **`short-promo-video-production` Skill** を追加（Skill 数 23 → 24）
  - 背景：センセイメモの30秒プロモ動画（Sora 2 生成2カット＋Remotion 4カット＋CC BY 4.0 BGM、実績コスト約¥130/予算¥5,000）で確立した制作手順を、汎用知識集 `promo-video-toolkit` とは別に「一度成功した手順の再現レシピ」として切り出したもの
  - SKILL.md：7ステップの制作パイプライン（企画→Sora 2 生成→Remotion実装→BGM→エンコード→権利チェック→納品）と実証済み原則（AI動画は差し色3割以下・テロップ主導・無音成立・コストログ必須・予算80%で停止）
  - references/：`cut-structure.md`（30秒6カット構成テンプレ：フック→機能UI→蓄積→感情→差別化→CTA、テロップ原稿ルール）／`sora2-generation.md`（Sora 2 API 実践知：input_reference 解像度厳密一致、moderation_blocked 回避の言い回し、課金ブロッカー切り分け、キャラクター一貫性3点セット、フォールバック設計）／`bgm-and-mixing.md`（incompetech CC BY 4.0 選曲基準・クレジット運用・音量エンベロープ・volumedetect 検証）／`encoding-and-delivery.md`（ffmpeg 最終エンコード・.srt/poster・納品チェックリスト）
  - templates/：Remotion プロジェクト雛形（9:16・30fps・30秒。Caption/Bgm/SoraClip/LogoCtaCut は実績コード、brand.ts/PromoVideo.tsx は TODO 付き汎用化）＋ Sora 2 生成ヘルパースクリプト（参照画像リサイズ→生成→ポーリング→DL）
  - 参照エージェント：`promo-video-producer`（SNS縦型案件で promo-video-toolkit と併読。`.codex/agents/promo-video-producer.toml` の起動時ルーチンに必読参照を追加）
- 影響ファイル：`.codex/agents/promo-video-producer.toml` / `.codex/config.toml`（Skill 数）/ `templates/project-init/AGENTS.md`（Skill 早見表・Skill 数）/ `README.md`（プロモーション動画節・Skill 数）

## [v0.10.0] - 2026-07-08

### Added（HashiCorp 公式 Terraform MCP サーバーの活用 Skill）
- **`terraform-mcp` Skill** を追加（Skill 数 22 → 23）
  - HashiCorp 公式の `hashicorp/terraform-mcp-server`（Docker イメージ）を Codex に接続し、Terraform Registry の一次情報（プロバイダのリソース/データソース仕様・モジュール）を参照しながら HCL を書くためのガイド。記憶ベースの古い引数名・非推奨リソースの混入を防ぐ
  - 登録手順：プロジェクトレベル（`.codex/config.toml` の `[mcp_servers.terraform]`）とユーザーレベル（`codex mcp add`）の両方を収録。公開レジストリ検索はトークン不要、HCP Terraform / TFE 操作時のみ `TFE_TOKEN`（直書き禁止・環境変数透過）
  - 活用パターン：書く前に引く／バージョンピン留め／モジュール流用判断の ADR 記録／レビュー時のドキュメント照合（implementation-worker / implementation-reviewer / tech-stack-architect / internal-designer 向け）
  - 位置づけ：Tier A（Vercel + Supabase）では原則不要、**Tier B（AWS/ECS Fargate）・ハイブリッド案件で必須参照**
  - 参考：Claude Code 版フレームワーク側は user スコープの MCP 登録（`claude mcp add terraform -s user -- docker run -i --rm hashicorp/terraform-mcp-server:latest`）で対応済み（リポジトリ変更なし）
- 影響ファイル：`.codex/config.toml`（Skill 数・MCP 手順コメント）/ `templates/project-init/AGENTS.md`（Skill 早見表）/ `README.md`（Skill 数）

## [v0.9.0] - 2026-07-04

> Claude Code 版フレームワーク v0.8.0 と同内容の機能追加（Codex 版へ移植適用）。

### Added（ローカル開発環境セットアップの必須タスク化）
- **`local-dev-environment` Skill** を追加（Skill 数 21 → 22）
  - 背景：開発環境の立ち位置があやふやで、案件ごとに環境構築の深さ・方式がバラついていた
  - **Docker ベースで全機能（アプリ本体・営業ポータル8ページ・認証・決済・AI・メール）をローカルのみで起動・テストできる環境**の構築標準を定義
  - 中核原則「ローカルで動かないものは作らない」。実体 > エミュレータ > モックの優先順（DB/認証/Storage/メールは Supabase CLI ローカルスタック＋Mailpit、Stripe はテストモード + stripe listen 転送〔方式A〕／stripe-mock〔B〕／msw〔C〕、AI API はモック既定で実API課金なし）
  - references/local-dev-setup.md：ゴール定義9項目、標準ファイル構成（docker-compose.yml / supabase/ / scripts/dev-setup.sh・dev-check.sh・dev-teardown.sh / .env.local.example）、シードデータ、Vitest/Playwright/CI との接続、Tier B（AWS）補足、WSL2 注意点、検証レポートテンプレート、アンチパターン
- **Phase 11 の最初の必須タスク（タスク0）としてローカル開発環境構築を組み込み**
  - **Phase 9（test-planner）**：test-strategy.md に「ローカル完結テスト環境要件」節を必須化（何を実体で動かし、何をモックにするかの宣言。タスク0の仕様になる）
  - **Phase 11（implementation-worker）**：タスク0として機能実装より先に環境構築し、検証レポート **`docs/41-test-results/local-env-verification-YYYYMMDD-HHMM.md`（必須）** を作成。営業ポータル8ページのローカル表示確認を含む
  - **Phase 11（tester）/ Phase 12（e2e-usecase-tester）**：検証レポートの存在と環境起動を確認してからテスト実施。無ければテスト着手禁止・implementation-worker に差し戻し
  - **PM**：Phase 11 起動プロンプトにタスク0を必ず含め、Phase 12 起動前に検証レポートの存在を確認。デプロイ Go/No-Go チェックリストにも追加

### Changed（営業ポータルモックアップの必須タスク化）
- **Phase 5（外部設計）に「営業ポータル（LP兼営業サイト）モックアップ」を必須の並列タスクとして追加**
  - 背景：営業用兼LPのポータルサイト構築は `marketing-site-builder` エージェント / `marketing-site-playbook` Skill として存在していたが、SDLC 14フェーズの実施タスクには含まれておらず、案件によって作られたり作られなかったりしていた
  - `marketing-site-builder` に**モックアップモード**を新設。Phase 5 で external-designer と並列起動され、`docs/15-marketing-site/mockups/` にモック（`MK-NNN-<slug>.html`。必須5ページ：トップ/LP・機能紹介・スクリーンショット集・料金表・FAQ）を作成する。アプリ画面モックと同じ作法（Tailwind CDN 自己完結HTML・Playwright スクショ・iteration-log.md・changes-from-previous コメント）
  - **スキップ条件を限定**：要件定義に「営業サイト／ポータル不要」が明記されている案件のみ。PM がリスク（集客導線の未検証・営業開始遅延）を提示し、明示承認を得て status.md に記録する。**特に言及がなければ必須**
  - visual-director はモック段階では任意（推奨）。未実施なら design-system.md ベースで作成可（AI画像は使わずプレースホルダ）。本実装前には従来どおり visual-director を先行させる
  - `pricing-strategy.md` があれば価格ページに反映。無ければ仮プランを置き iteration-log に「価格未確定」を明記
- **Phase 6（外部設計レビュー）の `ui-mockup-reviewer` のレビュー対象に営業ポータルモックを追加**
  - `docs/20-external-design/mockups/`（アプリ画面）と `docs/15-marketing-site/mockups/`（営業ポータル）の両方をレビュー
  - 営業ポータルモック固有の観点（D-2）を新設：必須ページの存在、仮コピーの訴求性（プレースホルダ文言は Major）、CTA/CV導線、pricing-strategy 整合、アプリ画面モックとのブランド印象整合
  - **Block 時の差し戻し先をモック種別で分岐**：アプリ画面 → external-designer、営業ポータル → marketing-site-builder（rework-loop.md の適用対象表を更新）
  - スキップ記録（status.md）なしで営業ポータルモックが欠落している場合は即 Block
- **ポータルサイトの標準構成とビジュアル傾向を定義**
  - **必須8ページ構成**：トップ／機能紹介／運営者紹介／スクリーンショット集／料金表／FAQ／お問い合わせ／法務（marketing-site-playbook の必須ページを改訂）。Phase 5 のモック必須は5ページ（トップ・機能紹介・スクリーンショット集・料金表・FAQ）、残り3ページは簡易モック/プレースホルダ可（index.html に8ページサイトマップを明示）
  - **運営者紹介は https://shinichi.noguchi.jp.net から写真含め引用**して構成（固定ソース、案件ごとに書き起こさない）
  - **ビジュアルの傾向（厳格ルールではなく目指す方向）**：幾何学的・抽象的イラストより**写実的画像を優先**し、SaaSは「画面がプロダクトそのもの」であるため**実画面スクリーンショットを極力多用**する（モック段階ではアプリ画面モックの Playwright スクショを流用、本実装で実画面に差し替え）。visual-director はムードボードに写実寄り案を必ず1-2案含めて既定推奨とし、page-designer は挿絵依頼をまず実画面スクショで代替できないか検討する。ui-mockup-reviewer はビジュアル傾向からの逸脱を Minor として指摘（visual-style-guide.md が明示的に抽象スタイルを採用している場合は除く）
- 影響ファイル：
  - `.agents/skills/local-dev-environment/`：SKILL.md + references/local-dev-setup.md（新規）
  - `.agents/skills/sdlc-toolkit/`：SKILL.md（重要原則3・4）/ pm-playbook.md（Phase 5/6/9/11/12・status.md テンプレ・Go/No-Go）/ artifact-layout.md（mockups/ ツリー・検証レポート必須性テーブル）/ rework-loop.md（Phase 6 差し戻し分岐）
  - `.agents/skills/marketing-site-playbook/references/marketing-site-playbook.md`：必須ページ8構成・ビジュアル方針の傾向・SDLC組み込み節
  - `.codex/agents/`：project-manager.toml / marketing-site-builder.toml（モックアップモード）/ ui-mockup-reviewer.toml / external-designer.toml / visual-director.toml / page-designer.toml / requirements-architect.toml / implementation-worker.toml（タスク0）/ test-planner.toml（4-2節）/ tester.toml / e2e-usecase-tester.toml
  - `templates/project-init/AGENTS.md` / `README.md` / `templates/project-init/.framework-version`


## [v0.8.0] - 2026-07-03

### Changed（Codex 移植）
- **フレームワーク全体を Claude Code から OpenAI Codex CLI へ移植**（機能変更なし・リファクタリングのみ）
  - `.claude/agents/*.md`（38体・YAML frontmatter）→ **`.codex/agents/*.toml`**（Codex サブエージェント定義。`name` / `description` / `developer_instructions` に変換）
    - `model: opus`（project-manager）→ `model_reasoning_effort = "high"` に置換。`model: sonnet` はセッション既定モデル継承（コメントで原定義を記録）
    - `tools:` 行は Codex に同等フィールドがないため、各 TOML の `developer_instructions` 末尾に「ツール権限（Codex 移行注記）」として行動規範化（Bash なし → シェル実行禁止、WebSearch なし → Web検索禁止 等）
  - `.claude/skills/` → **`.agents/skills/`**（Codex Agent Skills の探索パス。SKILL.md 形式は互換のため内容はパス参照の更新のみ）
  - `templates/project-init/CLAUDE.md` → **`AGENTS.md`**（Codex が自動読込。PM ゲートウェイは「ルートセッション自身が PM ロールを担い、専門エージェントをサブエージェントとして spawn する」方式に再定義。Codex はサブエージェントのネスト不可のため PM 自体は spawn しない）
  - **`.codex/config.toml`** を新設（`web_search = "live"`、`[agents]` の並列数/深度/実行時間上限）
  - `claude mcp add` / `.mcp.json` の手順 → `config.toml` の `[mcp_servers]`（url / env_http_headers / bearer_token_env_var）と `codex mcp add` / `codex mcp login` に書き換え（observability-integration、e2e-browser-testing、mcp-server-development、README）
  - `/plugin install frontend-design@claude-plugins-official` → Codex にプラグイン機構がないため、SKILL.md を `.agents/skills/frontend-design/` へ手動移植する方式に変更（marketing-site-builder、README、外部プラグイン判断ドキュメント）
  - `setup.sh` / `new-project.sh` / `update-project.sh` / `init-repo.sh`：配置・バックアップ・更新対象を `.codex/` + `.agents/` に変更
  - 全ドキュメントの「Claude Code」表記・`.claude/` パス参照を一括更新（過去バージョンの CHANGELOG エントリも表記統一。歴史的には v0.7.0 以前は Claude Code 上で開発）
  - SaaS プロダクト自体の実装スタックに関する記述（Bedrock 上の Claude モデル、AI API 選定等）は**開発ツールではなくプロダクト構成のため変更していない**

## [v0.7.0] - 2026-07-03

### Added（SNS広告戦略）
- **`paid-ads-toolkit` Skill** を追加（Skill 数 20 → 21）
  - SaaS の集客を **SNS 広告（Meta/Instagram・TikTok・X・LINE広告・YouTube）を中心とした有料広告**で加速するための知識集
  - **SEO/AIOとの役割分担**を中核方針に据える：SEOは中長期の資産構築、広告は即効性のある需要の刈り取り。競合カテゴリが飽和し指名検索が育ちにくい場合は広告を主戦力に据える判断も正当とする
  - references/: platform-selection（媒体選定・B2B/B2C別の向き不向き）/ creative-strategy（フック設計・フォーマット別要件・量産・疲労対策）/ targeting-and-budget（ターゲティング・予算配分・**支払い方式の財務制約対応**）/ conversion-tracking（Pixel/Conversions API・GA4連携・iOSプライバシー対応）/ cac-ltv-and-scaling（CAC/LTV/ROAS目標・撤退基準・段階的スケール）/ compliance-and-platform-policy（景品表示法・ステマ規制・各SNS広告ポリシー）（6本）
  - **野口Profile連動（最重要）**：民事再生中で一括払いのみ・借入/分割不可のため、**広告アカウントの支払い方式は与信枠に依存しないプリペイド/デビット/前払いを優先**。テスト予算からの段階的スケール、日予算・Lifetime Budget上限の必須化を明記
  - CAC回収期間は業界一般の12ヶ月基準より保守的な**6ヶ月以内**を推奨、撤退基準を即時停止・見直し・クリエイティブ入れ替え・媒体撤退の4段階で数値化
  - ステルスマーケティング規制（2023年10月施行）・景品表示法（優良誤認・有利誤認）を消費者庁一次ソースに基づき整理
  - 技術情報は一次ソース基準（Meta Business Help Center / TikTok for Business / X Ads / LINEヤフー for Business / Google Ads Help / 消費者庁）。プラットフォーム仕様・料金体系は更新が速いため実装直前の再確認を明記
- **`ad-strategy-specialist` エージェント** を追加（エージェント数 37 → 38）
  - 媒体選定、SEOとの優先度・予算配分バランス判断（**「SEOだけでは限界がある」ケースで広告優先を明示提言**）、広告クリエイティブ戦略、ターゲティング・予算配分設計、コンバージョン計測設計、CAC/LTV/ROAS目標設定と撤退基準、コンプライアンス確認を横断的に担当
  - `seo-specialist`（予算・優先度バランス）/ `promo-video-producer`・`visual-director`・`page-designer`（クリエイティブ制作委譲）/ `pricing-strategist`・`cost-guardian`（CAC/LTV・財務制約）/ `marketing-site-builder`（広告受け皿LP）/ `legal-docs-generator`（広告文言の法令整合）と連携
  - 成果物：`docs/15-marketing-site/ad-strategy.md`（媒体選定・クリエイティブ戦略・予算計画・計測設計・CAC/LTV目標・コンプライアンスチェック）
  - オンデマンド系（固定フェーズ番号なし）。rework-loop.md 完全準拠
  - 「SNS広告」「広告戦略」「Meta広告」「TikTok広告」「X広告」「LINE広告」「ペイドマーケティング」「CAC」「ROAS」で起動
- 影響ファイル：
  - `seo-specialist.md` / `promo-video-producer.md` / `marketing-site-builder.md` / `cost-guardian.md` / `pricing-strategist.md`：ad-strategy-specialist との連携節を追加
  - `project-manager.md`：オンデマンド系エージェント表に追加。seo-plan.md の飽和度評価から広告優先を積極提案する旨を明記
  - `sdlc-toolkit/references/artifact-layout.md`：`docs/15-marketing-site/` のディレクトリツリーが未記載だった欠落を補完しつつ `ad-strategy.md` を追加
  - `sdlc-toolkit/references/pm-playbook.md` / `sdlc-toolkit/SKILL.md`：オンデマンド系一覧に追加
  - `README.md` / `templates/project-init/AGENTS.md`：38エージェント・21 Skill 体制に更新、「SNS広告戦略」節を新設

## [v0.6.0] - 2026-07-03

### Added（AI向けSaaS提供：MCPサーバー化）
- **`mcp-server-development` Skill** を追加（Skill 数 14 → 20 のうち1本）
  - SaaS をブラウザUIだけでなく **MCP（Model Context Protocol）サーバー**として AI エージェントに提供するための知識集
  - リモートMCP（Streamable HTTP）を Next.js Route Handler / Vercel でホストする構成、OAuth 2.1 認可 + Supabase Auth ブリッジ、テナント分離（RLS）、LLM が正しく選び正しく呼べるツール/リソース設計、Stripe Billing Meters による従量課金、MCP Inspector でのテスト、レジストリ登録・発見性を収録
  - references/: architecture-and-hosting / auth-and-multitenancy / tool-and-resource-design / billing-and-metering / testing-and-debugging / registry-and-discovery（6本）。一次ソース（modelcontextprotocol.io、Vercel/Anthropic/Stripe公式ドキュメント）を確認の上で作成
- **`mcp-server-specialist` エージェント** を追加（エージェント数 29 → 37 のうち1体）
  - SaaS の機能を MCP サーバーとして設計・実装・テスト・公開する専門エージェント（SaaS特化系）
  - OAuth 2.1/Supabaseブリッジによる認可、ツール定義、Stripe従量課金の共同設計（payment-integration-specialist）、MCP Inspectorテスト、レジストリ公開を担当
  - 「MCP」「MCPサーバー」「AI向けSaaS」「エージェント向けAPI」「リモートMCP」「ツール定義」で起動
- **`agent-experience-reviewer` エージェント** を追加（レビュー系）
  - MCP ツール群の「AIにとっての使いやすさ（AX）」を pedantic にレビュー。ツール名・description の曖昧さ、スキーマの過剰必須項目、AIが誤用しやすい命名、レスポンスの冗長さ（コンテキスト浪費）、エラーメッセージの自己回復性、annotations整合、ツール数の過多を検証
  - `ui-mockup-reviewer` と対になる存在（画面のビジュアル品質 ⇔ ツールのAI体験品質）。MCP面がある案件では Phase 6 で external-design-reviewer / ui-mockup-reviewer と並列も可、実装後は MCP Inspector 等での実機確認も実施
  - rework-loop.md 完全準拠（Write は reviews/ 配下の自レポートのみ、VERDICTブロック、上限5回、対応表照合・NO-CHANGE検出）
- **external-designer に「デュアルサーフェス設計」を追加**
  - 同じ `feature-list.md` から人間向け（画面）と AI向け（MCPツール）の2面を設計。新成果物 `docs/20-external-design/agent-interface.md`（FunctionalID × 画面/ツール/両方 のマッピング表 + ツール一覧の骨子）。AI向け提供の要否は要件・tech-stackの決定に従う（無い案件はスキップ可）
- **requirement-traceability-auditor に「MCPツールカバレッジ」軸を追加**
  - agent-interface.md がある案件では、AI向け提供対象の FunctionalID × MCPツール × ツールテストを第3軸として突合。Block条件に「AI向け提供を約束したMUST FunctionalIDにツールが無い」を追加
- **payment-integration-specialist に mcp-server-specialist との連携を追加**（Stripe Billing Metersによる従量課金の共同設計、人間サブスク+AI従量のハイブリッド価格）

### Added（セキュリティ・品質強化）
- **`security-auditor` エージェント** を追加（レビュー系、Phase 14 と並列の準必須ゲート）
  - Supabase RLS ポリシー全数監査（テーブル×操作×ロール、RLS無効テーブルは即Block）、OWASP Top 10 実コード監査（インジェクション・認可不備=IDOR・SSRF等）、シークレットスキャン、`npm audit` 依存関係監査、Stripe Webhook 署名検証・冪等性の実機確認、認証周り（CSRF・レート制限）、PII混入チェックを担当
  - 成果物：`docs/41-test-results/security-audit-YYYYMMDD-HHMM.md`。本番デプロイ前は事実上必須（無い・Critical項目有りはNo-Go）
  - rework-loop.md 完全準拠
- **`resilience-testing` Skill** を追加
  - 負荷試験（k6。Vercel/Supabase無料枠での現実的な負荷目標・閾値・CI組み込み）と障害シナリオ演習（Supabase停止・Stripe API障害・AI APIレート制限時のフォールバック、graceful degradation）を収録
  - references/: load-testing-k6 / failure-scenarios（2本）
- **`e2e-browser-testing` にビジュアルリグレッションと a11y 自動チェックを追加**
  - 外部設計モック確定スクショと実装画面スクショの比較手順（「設計と実装の乖離」検出）、`@axe-core/playwright` によるWCAG 2.2 AA準拠チェックをPhase 12 E2Eに組み込み
  - e2e-usecase-tester に axe スキャン実行・乖離検出の責務を追加、test-planner に非機能テストセクション（負荷・障害耐性・a11y対象画面の宣言）を追加

### Added（ビジネス・運用系：1名運用の増幅装置）
- **`legal-docs-generator` エージェント** を追加
  - 利用規約・プライバシーポリシー・特定商取引法に基づく表記・外部送信規律対応（総務省ガイドライン準拠）を要件定義＋データモデルから生成。B2B/B2C・クライアント/自社で出し分け、案件ごとの差分確認で済む設計。法的助言ではない旨の免責原則を必須明記
  - 成果物：`docs/50-legal/`（terms-of-service.md / privacy-policy.md / tokushoho.md / external-transmission-disclosure.md）
- **`pricing-strategist` エージェント** を追加
  - 競合価格調査（WebSearch）・プラン構成設計・価格心理・MCP従量課金との組み合わせを担当。成果物：`docs/10-business-design/pricing-strategy.md`
- **`onboarding-designer` エージェント** を追加
  - 初回体験フロー・Activation指標・ライフサイクルメール（登録直後/トライアル終了前/解約防止）・空状態設計。「登録はさせたが使われない」問題への対処。成果物：`docs/20-external-design/onboarding-flow.md`
- **`blog-content-producer` エージェント** を追加
  - seo-specialist の `seo-plan.md` からAIO最適化済みブログ記事（MDX）を量産。成果物：`content/blog/` + `docs/15-marketing-site/content-calendar.md`
- **`cost-guardian` エージェント** を追加
  - Vercel/Supabase/AI API/監視ツールのランニングコスト見積りと月次監視。「無料枠を超えた瞬間に何が起きるか」を全サービス必須明記。一括払いのみ・分割借入不可という財務制約に直結。成果物：`docs/11-tech-stack/cost-estimate.md`
- **`customer-support-toolkit` Skill** を追加：ヘルプセンター自動生成・AI一次応答・FAQ自動更新
- **`analytics-integration` Skill** を追加：PostHog/GA4/Vercel Analytics の役割分担、ファネル定義、KPIダッシュボード
- **`i18n-and-currency` Skill** を追加：next-intl による多言語対応、Stripe多通貨対応
- **`fleet-operations` Skill** を追加：複数SaaS横串の運用ダッシュボード設計、インシデントトリアージ、月次棚卸し

上記8エージェント（mcp-server-specialist / agent-experience-reviewer / security-auditor / legal-docs-generator / pricing-strategist / onboarding-designer / blog-content-producer / cost-guardian）は**固定フェーズ番号を持たないオンデマンド系**として project-manager が案件の必要性に応じて随時起動する（security-auditor のみ Phase 14 並列の準必須ゲート）。

### Changed
- **エージェント数 29 → 37、Skill 数 14 → 20**
- project-manager：Phase 14 に security-auditor を並列追加、オンデマンド系8エージェントの起動判断表（パターンG）を新設
- sdlc-toolkit の `artifact-layout.md`：`docs/50-legal/`、`agent-interface.md`、`onboarding-flow.md`、`pricing-strategy.md`、`cost-estimate.md`、`security-audit-*.md` の配置を追加
- `pm-playbook.md`：デプロイ Go/No-Go チェックリストにセキュリティ監査・法務文書一式を追加、status.md テンプレにオンデマンド系ステータス表を新設
- `templates/project-init/setup.sh`：`docs/50-legal/` を初期作成、status.md テンプレを更新
- `templates/project-init/AGENTS.md` / `README.md`：37エージェント・20 Skill 体制に全面更新

## [v0.5.0] - 2026-07-03

### Added（修正ループ＋画面モックレビュー）
- **修正ループプロトコル `rework-loop.md` を新設**（`.agents/skills/sdlc-toolkit/references/`）
  - レビューで Block が出たまま指摘がスルーされ次フェーズへ進む事故を構造的に防止する。「レビュー報告＝ループ起動のトリガー」と定義
  - 🔴 Block → PM が**ユーザー確認なしで自動的に**担当エージェントを修正モードで再起動 → 指摘対応表（`reviews/*-response-loopN.md`）作成 → レビュワー再起動、を Approve まで反復
  - **ループ上限5回**のストッパー。5回目でも Block なら PM がエスカレーション（上流差し戻し / approve 強制 / スコープ見直し）。旧「3回」基準は5回に統一
  - レビュワーの完了報告に機械可読 Verdict ブロック（`VERDICT:` / `LOOP:` / `RETURN_TO:` / `REPORT:`）を必須化。PM がパースして自動実行
  - レビューレポートは `reviews/YYYY-MM-DD-<reviewer>-loopN.md` に永続化（同日再レビューの上書き防止）、ループ回数は status.md の「ループ」列で可視化
  - 無変更再提出は `NO-CHANGE` として即 Block（対応表と成果物実体の照合をレビュワーに義務化）
- **`ui-mockup-reviewer` エージェント** を追加（エージェント数 28 → 29）
  - 外部設計の画面HTMLモックを pedantic にレビュー：design-system 整合、screen-list の表示・操作要素反映、空/エラー状態網羅、スクリーンショットの**目視**確認、そして**反復間の実質的変化の検証**（酷似モック再提出の検出）
  - Phase 6 で external-design-reviewer（文書整合）と**並列レビュー**し、**両方 Approve** で通過。ループカウントはレビュワーごとに独立
- **external-designer に画面HTMLモック生成を必須化**
  - `docs/20-external-design/mockups/` に自己完結HTML（Tailwind CDN + design-system トークン反映）、`screenshots/`（Playwright・loop番号付きで上書き禁止）、`index.html` を出力。tools に Bash を追加
  - **バリエーション分散ロジック**を導入：レイアウト骨格・情報密度・ナビゲーション・フォーム形式・一覧表現・CTA配置の軸表から明示的に選択し `iteration-log.md` に記録。再生成時は指摘に関係する軸を**前回と異なる値に強制**、過去と同一の組み合わせは選択禁止（酷似モックの量産防止）
  - 初回は主要3画面程度を2案（`-a`/`-b`）で提示し、レビューで方向性を確定
- 影響ファイル：
  - `review-protocol.md`：ループカウント `N/5`、`-loopN` ファイル命名、Verdict ブロック、対応表照合・NO-CHANGE 検出を追記。レビュワーの Write を「reviews/ 配下の自レポートのみ」に限定して許可（従来は書き出し義務と読み取り専用ツールが矛盾していた）
  - `pm-playbook.md`：Verdict 分岐の自動ループ化、Phase 5/6 のモック＋2レビュワー並列、status.md テンプレに「ループ」列
  - `project-manager.md`：パターンC を自動修正ループに全面改訂、「Block 報告だけで停止」を絶対禁止に、エスカレーション基準を5回に変更
  - レビュワー5体（requirements / planning / external-design / internal-design / test-plan / implementation）：Write 追加、rework-loop.md 必読化、`-loopN` 命名、Verdict ブロック、5回基準
  - producer系7体（requirements-architect / business-flow-designer / tech-stack-architect / brand-design-strategist / internal-designer / test-planner / implementation-worker）：「修正モード」（指摘全件対応・対応表作成義務）を追加
  - `artifact-layout.md`：mockups/ 構造とレビュー記録の `-loopN` / `-response-loopN` 命名を追加
  - `templates/project-init/setup.sh`：status.md テンプレに「ループ」列、`docs/20-external-design/mockups/screenshots` を初期作成
  - `templates/project-init/AGENTS.md` / `README.md`：29エージェント化、修正ループとモックレビューの説明を追加

### Added（生成 SaaS リポジトリの main PR 二重レビューゲート）
- **テンプレートに `main` への PR 二重レビューゲートを追加**（MINOR）。テンプレートから生成される
  各 SaaS リポジトリで、`main` へのマージを **レビュワーエージェント × Amazon Q Developer** の
  二重構造で守る。
  - `templates/project-init/.github/workflows/amazon-q-review-gate.yml`: PR 作成後「少し時間をおいて」
    Amazon Q Developer の自動コードレビューを待つ CI ゲート。**3 分間隔 × 3 回ポーリング**して
    Q のレビューを検出・評価し、`CHANGES_REQUESTED` ならブロック／検出できればパス／
    既定回数で無反応なら fail-open でパス（プレビュー版の Q による永久ブロックを回避）。
    `Q_BOT_LOGIN_REGEX` / `POLL_ATTEMPTS` / `POLL_INTERVAL_SECONDS` / `ENFORCE_CHANGES_REQUESTED` /
    `PASS_ON_TIMEOUT` を env で調整可能。required status check 名は `amazon-q-review-gate`。
  - `templates/project-init/.github/CODEOWNERS`: 二重構造のもう片方（人間/AIレビュワーの最終承認）を
    Code Owner approve で必須化するための雛形。
  - `templates/project-init/.github/pull_request_template.md`: 二重ゲートのチェックリスト付き
    新リポジトリ用 PR テンプレート。
  - `templates/project-init/.github/PR_REVIEW_GATE.md`: 仕組み・Amazon Q App 導入・
    branch protection 設定・挙動と env 一覧をまとめた運用ドキュメント。
  - `templates/project-init/scripts/setup-branch-protection.sh`: `gh` で `main` を保護し、
    `amazon-q-review-gate` チェックと Code Owner approve をマージ必須にするスクリプト。
- 配置の自動化：`templates/project-init/setup.sh` と `scripts/new-project.sh` を更新し、
  新規/既存リポジトリへの導入時に `.github/`（ワークフロー・CODEOWNERS・PR テンプレ・ガイド）と
  `scripts/setup-branch-protection.sh` を配置するようにした（既存の CODEOWNERS / PR テンプレは上書きしない）。
- `templates/project-init/AGENTS.md`：PM が `main` への PR で二重ゲートを満たしてからマージする旨を明記。

### Fixed（Skill 定義の不整合解消）
- **SKILL.md 欠落 4 件を新規作成**（Codex の Skill 自動発動には frontmatter 付き SKILL.md が必須のため、references のみでは Skill として認識されなかった）
  - `sdlc-toolkit/SKILL.md`：SDLC 共通基盤（artifact-layout / pm-playbook / review-protocol / tech-stack-profile の索引と重要原則）
  - `requirements-toolkit/SKILL.md`：要件定義（質問バンク・アンチパターン・完全性チェックリスト・テンプレート4種の索引と重要原則）
  - `marketing-site-playbook/SKILL.md`：営業サイト構築の方法論（関連 Skill との役割分担を明記）
  - `visual-design-toolkit/SKILL.md`：ビジュアル設計（3エージェント共有ワークフロー・gpt-image-2 知見の索引と重要原則）
- **frontmatter（name/description）欠落 5 件を修正**：`auth-integration` / `stripe-integration` / `observability-integration` / `seo-toolkit` / `promo-video-toolkit` の SKILL.md に YAML frontmatter を追加（Skill 一覧での説明がタイトルのみにフォールバックし、起動キーワードによる自動発動が機能しない問題を解消）
- **`scripts/collect-learnings.sh`**：`stat` の呼び出し順を GNU/Linux 優先に変更（従来は BSD/macOS 形式が先で、Linux/WSL では常に失敗後のフォールバックに依存していた）

### Fixed（バージョン不整合の解消）
- **バージョン正本を `templates/project-init/.framework-version` に一元化**（v0.2.0 のまま放置されていたハードコードを撤廃）
  - `templates/project-init/.framework-version`：v0.2.0 → v0.4.0 に更新（以後ここが single source of truth）
  - `templates/project-init/setup.sh`：`FRAMEWORK_VERSION="v0.2.0"` のハードコードを廃止し、`.framework-version` から動的に読むよう変更（新規案件が旧バージョンとして記録される問題を解消）
  - `scripts/update-project.sh`：`LATEST_VERSION="v0.2.0"` のハードコードを廃止し、正本から動的に取得（v0.3.0 以降を配信できなかった問題を解消）
  - `README.md`：既存案件導入手順の `echo "v0.4.0"` を正本コピーに変更、コミット例も `$(cat .framework-version)` 参照に変更
  - `docs/projects/INDEX.md`：バージョン乖離トラッキングの最新版表記を v0.1.0 → v0.4.0 に修正
  - `ROADMAP.md`：v0.2.0〜v0.4.0 のマイルストーンを完了にマーク（実態に合わせ注記追加）
  - `docs/operations/version-strategy.md`：「バージョン正本ルール」と「リリース時チェックリスト」を新設

## [v0.4.0] - 2026-06-03

### Added（プロモーション動画生成対応）
- **`promo-video-toolkit` Skill** を追加（Skill 数 13 → 14）
  - SaaS の集客用動画（**LPヒーロー動画・プロダクトデモ動画・SNS縦型広告・explainer/説明動画**）を**低コストで量産**するための知識集
  - **ハイブリッド手法**を中核に据える：①**Remotion**（React で動画をコード生成・ブランド整合・データ連動・ほぼ無料）②**画面録画**（Playwright/OBS で実UIをデモ・無料）③**AI動画生成**（Veo/Sora/Runway/Kling を冒頭フック/B-roll に差し色）④**AIナレーション/字幕**。用途で「正確さ・コスト・映え」を割り当てる
  - 野口Profile 連動：**Remotion ＋ 画面録画（ほぼ無料）で骨格を作り、AI動画/AIナレーションは本数×尺をコスト試算（生成秒数×単価×試行3–10倍）してから差し色利用**。Remotion テンプレ化（props で文言/色/画面差し替え）で次案件へ流用
  - **無音・自動再生前提**の設計（冒頭3秒フック・テロップ必須）、ブランド整合（design-system/visual-style-guide が source of truth）、LP埋め込みは Core Web Vitals を壊さない（poster/preload/+faststart/圧縮）
  - references/: video-strategy（タイプ別設計・絵コンテ・台本）/ remotion（React動画実装・Next.js統合・レンダリング）/ screen-recording（Playwright/OBS デモ）/ ai-video-generation（AI動画選定・プロンプト・コスト・権利）/ audio-and-voiceover（AIナレーション・BGM・字幕・ラウドネス）/ delivery-and-distribution（エンコード・Web埋め込み・SNS仕様・VideoObject・計測）（6本）
  - **重要原則**：AI動画を主役にしてコスト爆発させない／音声ありき設計にしない（ミュート自動再生）／画面の正確再現はAI動画でなく録画・Remotion／1本使い捨てにせずテンプレ量産／BGM・音声の商用利用ライセンス確認
  - 技術情報は**一次ソース**を基準（Remotion 公式 / 各AI動画・音声サービス公式 / 各SNS仕様 / web.dev / MDN）。AI動画・音声・SNS仕様は更新が非常に速いため利用直前に再確認
- **`promo-video-producer` エージェント** を追加（エージェント数 27 → 28）
  - プロモ動画の企画（絵コンテ・台本・手法割り当て）〜生成（Remotion実装・画面録画・AI動画・ナレーション/字幕）〜納品（エンコード・配信仕様・計測）を横断的に担当
  - marketing-site-builder（動画の埋め込み実装を分担）/ visual-director（静止画=visual-director・動画=本エージェントの役割分担）/ seo-specialist（VideoObject 構造化データ・トランスクリプト）/ implementation-worker / tester・e2e-usecase-tester（Playwright 録画資産の共用・CWV確認）と連携
  - 成果物：`docs/15-marketing-site/promo-video-plan.md`（動画計画・絵コンテ/台本・手法割り当て・制作/納品仕様）＋ `remotion/` / `public/video/` / `tests/demo/` の実装
  - 「プロモ動画」「プロモーション動画」「動画生成」「デモ動画」「LP動画」「ヒーロー動画」「SNS広告動画」「explainer」「説明動画」「Remotion」「AI動画」「ナレーション」で起動
- 影響ファイル：
  - `.codex/agents/marketing-site-builder.md`：起動時ルーチンに `promo-video-toolkit` 参照、「他エージェントとの連携」に promo-video-producer（動画の生成は委譲し埋め込みを分担）を追加
  - `.codex/agents/visual-director.md`：静止画専門であり動画は promo-video-producer の担当である旨を明記（役割分担の混同防止）
  - `README.md`：エージェント/Skill 数を 28 / 14 に更新、バージョンを v0.4.0 に更新、「プロモーション動画（LP・SNS・デモ）」節を追加
  - `templates/project-init/AGENTS.md`：エージェント/Skill 早見表に promo-video-producer / promo-video-toolkit を追加

## [v0.3.0] - 2026-06-03

### Added（SEO / AIO 統合対応）
- **`seo-toolkit` Skill** を追加（Skill 数 12 → 13）
  - 成果物（営業サイト・アプリ・ブログ）を**従来の検索エンジン（Google/Bing）と生成AI検索（AI Overviews/ChatGPT/Perplexity）の両方**から発見・引用される状態にするための知識集
  - **「2つの検索」を同時最適化**：従来SEO（検索意図適合・権威性・技術健全性）と AIO/LLMO（引用されやすさ・明快な事実記述・機械可読性）を両取りする方針を中核に据える
  - テクニカルSEOは **Next.js App Router の標準機能で完結**（`generateMetadata`/`app/sitemap.ts`/`app/robots.ts`/`opengraph-image.tsx`/JSON-LD・SEOプラグイン不要）。CSR空HTML回避・canonical・noindex事故防止・hreflang を網羅
  - **AIO/LLMO**：結論先出し・自己完結段落・数値/出典による引用最適化、`llms.txt` のルート配置、AIクローラ（GPTBot/OAI-SearchBot/ClaudeBot/PerplexityBot/Google-Extended）の許可方針を体系化
  - 構造化データ（Organization/SoftwareApplication/Product/FAQPage/BlogPosting/BreadcrumbList/LocalBusiness）をページ種別 × スキーマの早見表で提示、捏造 `aggregateRating` 禁止
  - Core Web Vitals（LCP/INP/CLS）の Next.js 具体手順、Search Console + GA4 + AI可視性の定点観測による改善ループ
  - 野口Profile 連動：**Search Console + GA4 で 90% は回せる（全部無料）**、Ahrefs/SemRush 等の有料SEOツールは**クライアント費用負担が確定した Tier B 案件に限定**
  - references/: seo-strategy / technical-seo / structured-data / aio-llmo / core-web-vitals / measurement（6本）
  - **重要原則**：従来SEOだけで満足しない（AI検索流入の取りこぼし防止）／重要ページをCSRオンリーにしない／noindex事故防止／計測導線を最初から作る
  - 技術情報は**一次ソース**を基準（Google 検索セントラル / Next.js 公式 / schema.org / web.dev / 各AI検索の公式ボット仕様）。各 references 末尾に出典URLを明記
- **`seo-specialist` エージェント** を追加（エージェント数 26 → 27）
  - キーワード戦略（指名/比較/課題の3段）・検索意図設計・テクニカルSEO実装・構造化データ・AIO/LLMO・Core Web Vitals・Search Console/GA4 計測改善を横断的に担当
  - external-designer（URL設計）/ marketing-site-builder（営業サイト実装の SEO 深掘りを委譲）/ implementation-worker / test-planner・tester・e2e-usecase-tester（sitemap/robots/metadata/JSON-LD デグレ検知）/ observability-integration-specialist（CWV 計測）/ implementation-reviewer と連携
  - 成果物：`docs/15-marketing-site/seo-plan.md`（キーワードマップ・トピッククラスタ・テクニカルSEO仕様・構造化データ設計・AIO/LLMO方針・計測計画）
  - 「SEO」「検索エンジン最適化」「キーワード」「構造化データ」「サイトマップ」「AI検索対策」「AIO」「LLMO」「AI Overviews」「llms.txt」「検索流入」「Core Web Vitals」で起動
- 影響ファイル：
  - `.codex/agents/marketing-site-builder.md`：起動時ルーチンに `seo-toolkit` 参照を追加、「SEO実装」節に seo-specialist への委譲注記、「他エージェントとの連携」に seo-specialist を追加
  - `README.md`：エージェント/Skill 数を 27 / 13 に更新、バージョンを v0.3.0 に更新、「SEO / AIO（検索・生成AI検索からの集客）」節を追加
  - `templates/project-init/AGENTS.md`：Skill 早見表に `seo-toolkit` を追加

## [v0.2.0] - 2026-06-02

### Added（オブザバビリティ統合対応）
- **`observability-integration` Skill** を追加（Skill 数 11 → 12）
  - 成果物（SaaS）の障害・エラー・予兆を**目視で即座に把握できる仕組み**を組み込むための知識集。実装者（ビルド時の計装）と運用担当者（ランタイムの障害対応）の双方を支援
  - **New Relic / Datadog / Sentry の3ツール**を「競合」ではなく「役割分担」として扱う：Sentry（エラー深掘り + Seer AI 根本原因分析 + Session Replay）/ New Relic（無料枠でフルスタック APM/Infra/Logs）/ Datadog（Tier B 本格運用の統合監視）
  - **公式リモート MCP サーバー**の Codex 接続を中核に据え、本番テレメトリを自然言語で問い合わせ → 根本原因分析 → 修正の障害対応フローを実現（Sentry `mcp.sentry.dev`／Datadog `claude-plugins-official` プラグイン GA／New Relic `mcp.newrelic.com` Public Preview）
  - 「目視で即確認」を **①ダッシュボード ②アラート（Warning/Critical 2段階 + AI異常検知）③ランブック** の3層で具体化
  - 野口Profile 連動：**Tier A（Vercel+Supabase MVP）は Sentry 無料 + New Relic 無料枠でコストゼロ開始**、Datadog はホスト課金が膨らむため**クライアント費用負担の Tier B に限定**
  - 計装パターン（Next.js `instrumentation-client.ts` 現行構成・Supabase 連携・ECS Fargate サイドカー・Vercel OTel）、PII の取り込み前マスキング、公開/秘密キー分離を網羅
  - references/: tool-selection / sentry / newrelic / datadog / mcp-servers / instrumentation-patterns / alerting-and-dashboards / security-and-pii（8本）
  - **重要原則**：保存後の PII は消せない→取り込み前にマスク／本番100%サンプリング禁止／MCPキーと計装キーの混同注意（特に New Relic）／監視を入れたらランブックまで書く
  - 技術情報は**公式ドキュメントを一次ソース**とし、各 references 末尾に出典URLを明記（更新が速いため実装直前に再確認）
- **`observability-integration-specialist` エージェント** を追加（エージェント数 25 → 26）
  - 監視ツール選定（ADR）・SLO/アラート/ダッシュボード設計・計装実装支援・PII対策・**MCP 経由の本番障害調査と根本原因分析**を横断的に担当
  - tech-stack-architect / external-designer / internal-designer / implementation-worker / tester / implementation-reviewer / project-manager および payment / auth / line の各 specialist と連携
  - 「オブザバビリティ」「監視」「モニタリング」「Sentry」「Datadog」「New Relic」「APM」「アラート」「障害調査」で起動
- **README.md** に「監視 MCP サーバー（オブザバビリティ）」節を追加（3ツールの接続コマンドと役割分担、Skill/エージェントへの導線）

### Added（フロントデザイン外部プラグイン対応）
- **Anthropic 公式プラグイン `frontend-design@claude-plugins-official` を共存採用**（PR #4）
  - 調査の結果、公式 `frontend-design`（下流＝実装コードの美的品質向上／"AI slop" 回避）と本フレームワークの `visual-director` / `visual-design-toolkit`（上流＝ビジュアル方向性の決定・アセット生成）は**担当工程が異なり競合しない**と判断。どちらか採用ではなく**共存**を決定
  - 判断根拠を ADR 形式で新規作成：`docs/operations/external-plugins/frontend-design-vs-visual-director.md`（実態比較・工程マッピング Phase A〜F・優先順位ルール・出典）
  - **優先順位ルール**：`docs/15-marketing-site/visual-style-guide.md` → `docs/12-brand-design/design-system.md` を常に最優先（source of truth）とし、`frontend-design` の一般則（汎用フォント回避等）は未定義領域のみ適用。ブランドで意図的に選んだフォント/配色の上書きを防止
  - 影響ファイル：
    - `.codex/agents/marketing-site-builder.md`：起動時ルーチンに併用追加、「frontend-design プラグインの併用」節を新設（優先順位ルール含む）、実装チェックリスト・アンチパターンに追記
    - `.codex/agents/implementation-worker.md`：アプリ画面UI実装時の活用＋優先順位の注記を追加
    - `.codex/agents/page-designer.md`：**適用対象外**（コードを書かずアセット/スクショ専門）と明記し混同を防止
    - `README.md`：「推奨外部プラグイン」節を追加（インストールコマンドと判断ドキュメントへの導線）
  - 今後の検討対象：公式 `design` プラグイン（批評・UXライティング・a11y監査）を Phase 14 レビュー工程に組み込む可能性（本決定のスコープ外）

### Added（AI 通話対応）
- **`ai-calling-japan` Skill** を追加（Skill 数 9 → 10）
  - 人間と AI が電話・通話で会話する「AI 通話」システムを、**日本国内対応を前提**に設計・構築するための知識集
  - 音声 AI パイプライン（STT/LLM/TTS のカスケード型と、OpenAI Realtime・Amazon Nova Sonic などの音声対話型）の方式選定
  - サービス選定：マネージド（Vapi/Retell/Bland/ElevenLabs Agents）vs 自作（LiveKit Agents/Pipecat on ECS Fargate）、STT/TTS/LLM 各部品、Twilio/Amazon Connect 東京
  - 一般電話（PSTN）接続と日本の電話番号（0AB-J/050/フリーダイヤル）の取得、コスト試算（分課金の積み上げ）、日本語音声認識の精度と改善策（復唱確認・DTMF・カスタム辞書）
  - 法令対応：電気通信事業法、特定商取引法、個人情報保護法（**越境移転**）、録音/AI 開示
  - references/: voice-ai-architecture / service-landscape / telephony-japan / cost-and-accuracy-jp / compliance-japan / implementation-and-ops
  - **重要原則**：リアルタイム音声処理は Vercel/Supabase Edge では動かせない（常駐プロセス必須）、重要情報は必ず復唱確認、越境移転に注意
  - エージェント不要（本件は Skill のみ）。requirements-architect / tech-stack-architect / external-designer / internal-designer / test-planner / implementation-worker / implementation-reviewer から参照
- **`ai-calling-philippines` Skill** を追加（Skill 数 10 → 11）
  - 同じく「AI 通話」システムを、**フィリピン国内対応を前提**に設計・構築するための知識集
  - 音声 AI パイプライン・サービス選定は `ai-calling-japan` と同構造。**言語・電話番号制度・法令の層を差し替え**
  - 言語：英語（フィリピン英語）/タガログ語/**ビサヤ語（セブアノ語）**/**タグリッシュ・ビスリッシュ（コードスイッチング）**の音声認識精度と対策。ビサヤ語はビサヤ諸島・ミンダナオで話者人口が最大の地方言語として一級対応し、地域ベースの言語ルーティング・STT/TTS の対応範囲の要件決定を含む
  - 一般電話（PSTN）接続とフィリピンの電話番号取得、**SIM 登録法（RA 11934）**を背景にした番号と身元の紐付け、NTC
  - コスト試算に **BPO 人件費との比較**を組み込み（フィリピンは人手が安く ROI 計算がシビア）
  - 法令対応：**盗聴禁止法（RA 4200・録音は全当事者の同意が必須）**、Data Privacy Act 2012/NPC、NTC、反詐欺規制、海外クライアント向け業務のデータ越境、AI 開示
  - references/: voice-ai-architecture / service-landscape / telephony-philippines / cost-and-accuracy-ph / compliance-philippines / implementation-and-ops
- 影響ファイル：
  - `README.md`：Skill 数を 25エージェント + 11 Skill に更新
  - `templates/project-init/AGENTS.md`：「11 Skill 早見表」に 2 Skill を追加

### Added
- project-manager に PROJECT_LEARNINGS リマインダー機能（次回 v0.2.0 で正式化候補）
- **`e2e-browser-testing` Skill** を追加（v0.1.0 文書上の 7 Skill 数に整合）
  - 実ブラウザを用いた完全模擬の E2E テスト知識集
  - Playwright を主軸、Next.js + Supabase + Stripe での実装パターン
  - references/: setup-and-config / locators-and-assertions / auth-and-storage-state / network-mocking / accessibility-and-visual / stripe-e2e-pattern / ci-github-actions / playwright-mcp / troubleshooting-flakiness
  - tester / test-planner / implementation-worker / implementation-reviewer から自動参照可能
- **`e2e-usecase-tester` エージェント** を追加（エージェント数 21 → 22）
  - SaaS の業務ユースケース（新規登録・ログイン・サービス利用・会員管理・課金・退会）を起点に Playwright Test を生成・実行・分析
  - `docs/40-test-plan/e2e-scenarios.md` を直接編集してユースケース漏れを補完
  - `tests/e2e/usecases/*.spec.ts` を生成
  - 失敗時は trace を分析して「実装バグ / テストバグ / flaky」を切り分け、`docs/41-test-results/usecase-e2e-*.md` にレポート出力
  - 実装修正は行わず implementation-worker に引き渡し
  - 標準ユースケースカタログ（UC-SIGNUP / UC-LOGIN / UC-PROFILE / UC-BILLING / UC-WITHDRAW / UC-PERM）を内蔵
  - 関連 templates/project-init/AGENTS.md の「22エージェント早見表」を更新

### Changed
- **SDLC を 12 → 13 フェーズに拡張**：ユースケースE2Eテストを Phase 11 と Phase 13 の間に必須フェーズとして挿入
  - **Phase 11**：実装＋**ユニット/統合テスト**並走（implementation-worker / tester）— E2E は範囲外に
  - **Phase 12（新規・必須）**：ユースケースE2Eテスト（e2e-usecase-tester）— Phase 11 完了後、PM が自動起動
  - **Phase 13（旧 Phase 12）**：実装＋**全テスト結果**レビュー（implementation-reviewer）— Unit/Integration に加え Phase 12 のE2Eレポートも必須レビュー対象
  - 影響ファイル：
    - `.agents/skills/sdlc-toolkit/references/pm-playbook.md`：Phase 12/13 を追記、status.md テンプレ更新、デプロイGo/No-Goに E2E 必須化
    - `.agents/skills/sdlc-toolkit/references/artifact-layout.md`：`docs/41-test-results/` ディレクトリと `tests/e2e/usecases/` を追加
    - `.codex/agents/project-manager.md`：13フェーズ化、Phase 12 自動起動オーケストレーション（パターンF追加）、Phase 12 スキップ時のリスク提示テンプレ追加
    - `.codex/agents/test-planner.md`：標準ユースケース初版を e2e-scenarios.md に必ず記載するよう責務追加
    - `.codex/agents/test-plan-reviewer.md`：標準ユースケース網羅をレビュー観点として追加
    - `.codex/agents/implementation-reviewer.md`：Phase 12 レポート（`docs/41-test-results/usecase-e2e-*.md`）を必須レビュー対象に追加、未存在時は即 Block、E2E カバレッジ評価セクション G2 を新設
    - `.codex/agents/e2e-usecase-tester.md`：Phase 12 専任の明示、status.md 更新責務、Go/No-Go 判断材料セクションのレポート出力義務化
    - `templates/project-init/setup.sh`：`docs/41-test-results/` 作成、status.md 初期化テンプレを 13フェーズ化
    - `templates/project-init/AGENTS.md`：「13フェーズ進行図」を追加、Phase 12 のスキップ禁止原則を明示

- **SDLC を 13 → 14 フェーズに再拡張**：要件トレーサビリティ監査を Phase 12 と Phase 14（旧 Phase 13）の間に必須フェーズとして挿入
  - **Phase 13（新規・必須）**：要件トレーサビリティ監査（requirement-traceability-auditor）— Phase 12 完了後、PM が自動起動。`business-flow.md` × E2E、`feature-list.md` × E2E の 2 軸（機能カバレッジ / 業務フローカバレッジ）で機械的に突合し、要件定義で約束した機能・業務分岐がブラウザで本当に到達できるかを担保
  - **Phase 14（旧 Phase 13）**：実装＋全テスト結果レビュー（implementation-reviewer）— Phase 12 の E2E レポートに加え Phase 13 の監査レポート（`docs/41-test-results/traceability-audit-*.md`）も必須レビュー対象（G3 セクション新設）
  - **Block 条件**：MUST FunctionalID 未カバー / 金額・権限・退会の異常系E2E欠落 → 即 Block で Phase 12 / 9 への差し戻し
  - 影響ファイル：
    - `.codex/agents/project-manager.md`：14フェーズ化、Phase 13 自動起動を含む順序遵守ロジック更新、Phase 12/13 同時スキップ時のリスク提示テンプレ拡張
    - `.codex/agents/implementation-reviewer.md`：Phase 14 へ繰下げ、Phase 13 監査レポート必須レビュー化、G3 セクション新設、レビュー実行手順に第0.6パスと第6.6パス追加
    - `.codex/agents/e2e-usecase-tester.md`：標準UCカタログ部分を refs（usecase-catalog/）に移譲してスリム化、入力に business-flow.md / feature-list.md を明記、対応 FunctionalID 欄を必須化、Phase 13 監査との連携を明記
    - `.codex/agents/test-planner.md`：e2e-scenarios.md の各 UC に「対応 FunctionalID」欄を必須化、E2E対象外FIDの明示記載責務、チェックリストに FID トレーサビリティ追加
    - `.codex/agents/test-plan-reviewer.md`：FunctionalID トレーサビリティ宣言のレビュー観点を新設（Block / Warning 判定基準明示）
    - `.agents/skills/sdlc-toolkit/references/pm-playbook.md`：Phase 13/14 を追記、status.md テンプレ 14フェーズ化、デプロイ Go/No-Go に監査必須化
    - `.agents/skills/sdlc-toolkit/references/artifact-layout.md`：`traceability-audit-*.md` を 41-test-results/ に追加、必須性表を 3 段化
    - `templates/project-init/setup.sh`：status.md 初期化テンプレを 14フェーズ化、Phase 13 行を追加
    - `templates/project-init/AGENTS.md`：14フェーズ進行図、23エージェント早見表、Phase 12 / 13 のスキップ禁止原則を反映、話しかけ方の例に requirement-traceability-auditor 起動例を追加

### Added（v0.2.0 候補・要件トレーサビリティ強化）
- **`requirement-traceability-auditor` エージェント** を追加（エージェント数 22 → 23）
  - SDLC Phase 13 専任、Phase 12 完了後に PM が自動起動
  - 2 軸監査：機能カバレッジ（FunctionalID × E2E）+ 業務フローカバレッジ（swim laneアクター × E2E、分岐 × エラー系E2E）
  - 成果物：`docs/41-test-results/traceability-audit-YYYYMMDD-HHMM.md`（マトリクス2枚＋Go/No-Go判定）
  - Block 条件：MUST FunctionalID 未カバー、金額/権限/退会の異常系E2E欠落、Phase 12 レポート不在 等
  - 実装修正は行わず、e2e-usecase-tester（テスト追加）/ test-planner（計画修正）/ implementation-worker（実装修正）に差し戻し
- **`e2e-browser-testing` Skill の references を 3 種追加**：
  - `references/traceability-matrix.md`：要件×E2E トレーサビリティ監査の方法論（Phase 13 必読、2 軸の判定ルール・レポートテンプレ・運用ルール）
  - `references/helpers-template.md`：tests/e2e/helpers の標準コード雛形（playwright.config.ts / auth.setup.ts / users.ts / db.ts / stripe.ts / mail.ts / fixtures、`.env.test` 規約、`sk_test_*` 強制チェック実装）
  - `references/usecase-catalog/{signup,login,profile,billing,withdraw,permission}.md`：標準UCカタログを詳細化（全 31 UC で Given/When/Then、DB検証、Stripe検証、想定ロケータ、優先度、実装ファイル名、アンチパターンを完備）
- `.agents/skills/e2e-browser-testing/SKILL.md`：refs 一覧と参照タイミング表に上記 3 種を追記、e2e-usecase-tester / requirement-traceability-auditor 向け使い方ガイドを追加

### Added（モバイルアプリ開発対応）
- **`mobile-app-development` Skill** を追加（Skill 数 7 → 8）
  - Android / iOS ネイティブアプリを **Expo + React Native（TypeScript）** で高品質に開発・テスト・ストア公開するための知識集
  - 主軸スタック：Expo SDK（New Architecture）+ Expo Router + EAS Build/Submit/Update、Supabase + RevenueCat/Stripe、Jest 30 + RN Testing Library + Maestro
  - 野口さんの Web SaaS スタック（Next.js + Supabase + Stripe）の型・Zod スキーマ・ドメインロジックを再利用する 1 ソース化方針
  - references/: setup-and-tooling / architecture-patterns / supabase-stripe-mobile / native-capabilities / ui-accessibility-performance / testing-strategy / store-release
  - 実装フェーズ（Phase 11）・テストフェーズ（Phase 11-12）・本番公開で、implementation-worker / tester / e2e-usecase-tester / test-planner / tech-stack-architect / implementation-reviewer から自動参照可能
  - **IAP（アプリ内課金）規約**を要件定義段階で織り込む方針を明文化（iOS のデジタル課金を Stripe で実装すると審査落ち → RevenueCat へ）
- **`mobile-app-specialist` エージェント** を追加（エージェント数 23 → 24）
  - Expo + React Native を主軸に、モバイルアプリの設計・実装・テスト・ストア公開を横断的に支援する専門エージェント（payment / auth-integration-specialist と同列の SaaS 特化系）
  - プロジェクト構成、Expo Router、Supabase 認証、IAP/RevenueCat 課金、ネイティブ機能（プッシュ通知・ディープリンク・生体認証）、Jest/RN Testing Library/Maestro テスト、EAS、App Store / Google Play 申請を担当
  - tech-stack-architect / external-designer / internal-designer / test-planner / implementation-worker / implementation-reviewer / auth-integration-specialist / payment-integration-specialist から呼び出し可能
  - 「モバイルアプリ」「iOSアプリ」「Androidアプリ」「React Native」「Expo」「アプリストア」「EAS」で起動
- 影響ファイル：
  - `README.md`：エージェント・Skill 数を 24エージェント + 8 Skill に更新
  - `templates/project-init/AGENTS.md`：24エージェント早見表（SaaS特化系に追加）、8 Skill 早見表、話しかけ方の例に mobile-app-specialist 起動例を追加

### Added（LINE LIFF / ミニアプリ対応）
- **`line-liff-development` Skill** を追加（Skill 数 8 → 9）
  - LINE LIFF アプリ／LINE ミニアプリを **Next.js（野口さん Tier A：Vercel + Supabase + Next.js）** で高品質に開発・テスト・公開するための知識集
  - LIFF SDK（`@line/liff`）、LINE ログイン、**LINE ID トークン → Supabase Auth のブリッジ**、Messaging API（Flex Message・リッチメニュー・Webhook 署名検証）、ミニアプリのサービスメッセージ・パーマネントリンク・公開を網羅
  - references/: liff-vs-miniapp / setup-and-nextjs / liff-features / auth-and-supabase / messaging-api / mini-app-release / testing-and-security
  - 実装フェーズ（Phase 11）・テストフェーズ（Phase 11-12）・公開で、implementation-worker / auth-integration-specialist / external-designer / tester / e2e-usecase-tester から自動参照可能
  - **SSR の落とし穴**（`liff.init()` のクライアント専用化）、**トークンのサーバ検証必須**、**Webhook 署名検証必須**を重要原則として明文化
  - ROADMAP「統合拡張：LIFF統合の専用Skill」を達成
- **`line-platform-specialist` エージェント** を追加（エージェント数 24 → 25）
  - LIFF アプリ／LINE ミニアプリ／Messaging API を横断的に支援する専門エージェント（SaaS 特化系）
  - LIFF の組み込み（SSR 回避）、LINE ログイン → Supabase セッションのブリッジ、Flex Message・リッチメニュー・Webhook、ミニアプリ公開（サービスメッセージ・パーマネントリンク）を担当
  - **auth-integration-specialist と役割分担**：通常 Web の LINE ログイン（OAuth）は auth-integration-specialist、LINE 内で動く LIFF / ミニアプリのログインは line-platform-specialist。認証ブリッジは両者で共同設計
  - tech-stack-architect / external-designer / internal-designer / test-planner / implementation-worker / implementation-reviewer / payment-integration-specialist から呼び出し可能
  - 「LIFF」「LINEミニアプリ」「LINE Mini App」「Messaging API」「LINEログイン」「リッチメニュー」で起動
- 既存スキル調査：LIFF 専用の公開済み Codex Skill は存在せず、curl ベースの Messaging API 限定の第三者スキルのみ確認。本フレームワークの SDLC 統合方針に合わないため、最新仕様（LIFF v2.28.0、ミニアプリ公開審査の 2024-11 改定 等）を調査の上で自作した
- 影響ファイル：
  - `README.md`：エージェント・Skill 数を 25エージェント + 9 Skill に更新
  - `templates/project-init/AGENTS.md`：25エージェント早見表（SaaS特化系に追加）、9 Skill 早見表、話しかけ方の例に line-platform-specialist 起動例を追加
  - `ROADMAP.md`：「統合拡張：LIFF統合の専用Skill」を完了にマーク

---

## [v0.1.0] - 2026-05-16

### Added
- **21エージェント**を初期リリース
  - 設計系：requirements-architect, business-flow-designer, tech-stack-architect, brand-design-strategist, external-designer, internal-designer, test-planner
  - レビュー系：requirements-reviewer, planning-reviewer, external-design-reviewer, internal-design-reviewer, test-plan-reviewer, implementation-reviewer
  - 実装系：implementation-worker, tester, project-manager（PROJECT_LEARNINGSリマインダー組込済）
  - SaaS特化系：marketing-site-builder, payment-integration-specialist, auth-integration-specialist, visual-director, page-designer
- **7 Skill**を初期リリース
  - requirements-toolkit（要件定義テンプレ）
  - sdlc-toolkit（SDLC共通参照）
  - stripe-integration（決済統合）
  - marketing-site-playbook（営業サイト構築）
  - visual-design-toolkit（ビジュアル設計）
  - auth-integration（認証統合）
- **運用ドキュメント**
  - feedback-loop.md（還流ループ）
  - monthly-review.md（月次レビュー手順）
  - version-strategy.md（バージョニング方針）
- **テンプレート**
  - AGENTS.md（Codex コンテキスト）
  - PROJECT_LEARNINGS.md（案件知見記録）
  - setup.sh（初期セットアップ）
  - .framework-version
- **スクリプト**
  - new-project.sh（新規案件作成）
  - update-project.sh（既存案件更新）
  - collect-learnings.sh（LEARNINGS集約）
- **Issue/PRテンプレ**
  - framework-improvement.md
  - new-agent-proposal.md
  - bug-report.md
  - pull_request_template.md
- **野口さん固有の組み込み**
  - 適格請求書発行事業者対応（インボイス制度）
  - 民事再生中の財務制約への配慮
  - 1名運用前提の設計
  - Tier A（Vercel+Supabase）/ Tier B（AWS Bedrock+ECS）の使い分け
