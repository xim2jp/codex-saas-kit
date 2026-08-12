# SDLC 文書カタログと HTML 公開文書体系（document-catalog）

各エージェントが SDLC の各フェーズで出力すべき文書の**正本カタログ**、案件ごとの**文書セット選択制（document-set.md）**、人間（非エンジニア含む）向けの **HTML 公開文書体系（`htmldocs/`）** の定義。

## 0. 二層構造の原則

| 層 | 場所 | 形式 | 読者 | 役割 |
|----|------|------|------|------|
| 正本層 | `docs/` | Markdown | AI エージェント・Git | Single Source of Truth。差分レビュー・トレーサビリティの基盤 |
| 公開層 | `htmldocs/` | HTML | 人間（発注者・非エンジニア・レビュー担当者） | 整形済み・リンク済みの読み物。`docs/` から**機械的に生成** |

- **Markdown が常に正本**。HTML は生成物であり、HTML を直接編集してはならない（次回生成で消える）。
- HTML の生成は同梱スクリプトで行う：`node .agents/skills/sdlc-toolkit/scripts/build-htmldocs.mjs`
- 生成物である `htmldocs/` も Git 管理する（発注者にそのまま zip / GitHub Pages / Vercel で渡せる状態を保つ）。
- **文書カタログの全文書が必須なのではない**。案件ごとに `docs/99-pm/document-set.md`（§3）で採否を確定し、採用した文書だけを作る。

## 1. ID・相互参照体系

文書間の参照は必ず **ID＋名称の併記**で行い、HTML 生成時にリンク化する。ID 単独（記号だけ）の参照は禁止（例：「F-023 を参照」ではなく「F-023（CSV エクスポート）を参照」）。

| ID 形式 | 対象 | 発番する正本 | 例 |
|---------|------|-------------|-----|
| `BZ-NNN` | 業務要件 | `00-requirements/business-requirements.md` | BZ-003（月次の会費請求業務） |
| `F-NNN` | 機能要件（FunctionalID） | `10-business-design/feature-list.md` | F-023（CSV エクスポート） |
| `NFR-<CAT>-NN` | 非機能要件（6カテゴリ） | `00-requirements/non-functional.md` | NFR-SEC-01（多要素認証） |
| `UC-<KEY>-NN` | ユースケース | `00-requirements/use-cases.md`（初版）→ `40-test-plan/e2e-scenarios.md`（テスト対応） | UC-BILLING-05 |
| `US-NNN` | ユーザーストーリー | `00-requirements/user-stories.md` | US-012 |
| `ROLE-NN` | ロール | `00-requirements/permissions-matrix.md` | ROLE-02（一般会員） |
| `PS-NNN` | 業務処理仕様（案件固有） | `10-business-design/business-rules/PS-NNN-<slug>.md` | PS-001（年度更新処理） |
| `JOB-NNN` | バッチ・定期処理 | `10-business-design/batch-jobs.md` | JOB-002（毎月1日の請求生成） |
| `NTF-NNN` | 通知（メール/プッシュ/LINE） | `10-business-design/notifications.md` | NTF-005（支払い失敗通知） |
| `EXT-NNN` | 外部サービス連携 | `10-business-design/external-integrations.md` | EXT-001（Stripe） |
| `S-XXX-NNN` | 画面 | `20-external-design/screen-list.md` | S-MBR-002（会員詳細画面） |
| `API-NNN` | API エンドポイント | `20-external-design/api-spec.md` | API-014 |
| `ENT-NNN` | エンティティ（データモデル） | `20-external-design/data-model.md` | ENT-004（membership） |
| `ERR-NNN` | エラー・例外 | `20-external-design/error-catalog.md` | ERR-021（決済失敗） |
| `ADR NNNN` | 技術決定 | `11-tech-stack/adr/NNNN-title.md` | ADR 0003 |
| `RSK-NNN` | リスク | `99-pm/risk-register.md` | RSK-004 |
| `OQ-NNN` | 要確認事項 | `00-requirements/open-questions.md` | OQ-007 |
| `MK-NNN` | 営業ポータルモックページ | `15-marketing-site/mockups/` | MK-001（トップ） |
| `CR-NNN` | 変更要求（軽量サイクル） | `60-operations/changes/CR-NNN.md` | CR-002 |
| `BUG-NNN` | バグ台帳エントリ | `41-test-results/bug-escape-ledger.md` | BUG-003 |

**トレーサビリティの背骨**：BZ →（実現手段）→ F →（画面/API/データ/処理）→ S / API / ENT / PS →（検証）→ UC / テストケース。各正本は自分の ID 表に「上流 ID」「下流 ID」列を持ち、双方向にたどれる状態を保つ。

正本文書が存在しない ID（その案件で文書を採用しなかった、または既存案件で未作成）は、HTML 生成時に**リンク化されずプレーンテキストのまま残る**。これはエラーではない。

## 2. フェーズ別文書カタログ

凡例：◎=既定で採用 ○=該当がある案件では採用 △=オンデマンド 【新設】=v0.17.0 で追加する文書

**◎ でも絶対必須ではない**。採否は §3 の document-set.md が正。ただし `requirements.md` / `feature-list.md` / `decision-log.md` / テスト計画・テスト結果一式は全プロファイル共通の最小必須（除外不可）。

### Phase 1-2 要件定義（`docs/00-requirements/`）

| 文書 | ファイル | 既定 | 主読者 | 内容 |
|------|---------|------|--------|------|
| 要件定義書（正本） | `requirements.md` | ◎（除外不可） | 全員 | プロダクト概要・ビジョン・機能スコープ（MVP / 将来 / やらないこと）・制約・ビジネスモデル・成功指標と撤退条件・リスク初出し。既存テンプレート（requirements-toolkit）準拠 |
| 業務要件一覧【新設】 | `business-requirements.md` | ◎ | 発注者・業務担当 | BZ-NNN。業務の目的・現状（As-Is）の課題・あるべき姿（To-Be）を業務言語で列挙。機能要件（F）の親になる |
| 非機能要件一覧【新設・分離】 | `non-functional.md` | ◎ | 発注者・設計者 | NFR-<CAT>-NN。6カテゴリ（性能/可用性/セキュリティ/運用保守/拡張性/UX・アクセシビリティ、v0.15.0 必須化）を独立ファイル化し、検証方法（どのテストで確認するか）を各項目に併記 |
| ユースケース一覧【新設・分離】 | `use-cases.md` | ◎ | 全員 | UC-。アクター×目的×基本フロー概要×主な例外。Phase 12 の E2E カタログの源流 |
| ユーザーストーリー | `user-stories.md` | ○ | 発注者・設計者 | US-NNN。「<ロール>として<目的>のために<機能>が欲しい」＋受け入れ条件。B2C・UX 重視案件では採用 |
| ロール・権限マトリクス（初版） | `permissions-matrix.md` | ◎ | 発注者・設計者 | ROLE-NN × 機能・データの CRUD。Phase 5 の auth-design.md で確定版に昇格 |
| 用語集【新設】 | `glossary.md` | ◎ | 全員 | 業務用語・略語・本プロジェクト固有の呼称の定義。**指示代名詞・曖昧参照を潰す基盤**。全文書は用語の初出でここへリンク |
| 要確認事項一覧【新設・分離】 | `open-questions.md` | ◎ | 発注者・PM | OQ-NNN。未確定事項＋確認先＋期限＋ステータス（open / answered → decision-log へ転記）。requirements.md §10 から独立ファイル化 |
| 決定ログ | `decision-log.md` | ◎（除外不可） | 全員 | 既存。OQ の回答・仕様判断の記録 |
| レビュー記録 | `reviews/` | ◎ | PM | 既存（rework-loop 準拠） |

### Phase 3-4 企画（`docs/10-business-design/` `11-tech-stack/` `12-brand-design/`）

| 文書 | ファイル | 既定 | 主読者 | 内容 |
|------|---------|------|--------|------|
| 業務フロー | `10-business-design/business-flow.md` | ◎ | 発注者・業務担当 | 既存。As-Is / To-Be の swim lane（Mermaid）。分岐・例外は ERR / PS へリンク |
| 機能一覧 | `10-business-design/feature-list.md` | ◎（除外不可） | 全員 | 既存。F-NNN。各行に上流（BZ）・下流（S / API / UC）の ID 列を持つ |
| **業務処理仕様書群【新設・案件固有】** | `10-business-design/business-rules/PS-NNN-<slug>.md` | ○ | 発注者・業務担当・実装者 | **案件固有の複雑な業務処理を 1 件 1 文書で仕様化**（例：年度更新処理・役員交代処理・データ引継ぎ処理・締め処理・按分計算など、その業務ドメイン特有のもの）。トリガー／事前条件／入力／処理ステップ（業務言語＋擬似フロー）／例外と救済／影響エンティティ（ENT）／関連画面（S）・バッチ（JOB）。**business-flow-designer が Phase 3 で候補を必ず列挙**し（0 件なら「対象なしと判断した理由」を business-flow.md に明記）、詳細は Phase 5 と並行して確定させる |
| バッチ・定期処理一覧【新設】 | `10-business-design/batch-jobs.md` | ○ | 実装者・運用者 | JOB-NNN。スケジュール・処理概要・失敗時の挙動・リラン可否。該当処理が 1 件でもあれば採用 |
| 通知一覧【新設】 | `10-business-design/notifications.md` | ○ | 発注者・実装者 | NTF-NNN。トリガー・チャネル（メール/プッシュ/LINE）・宛先・文言概要・オプトアウト可否 |
| 外部サービス連携一覧【新設】 | `10-business-design/external-integrations.md` | ◎ | 全員 | EXT-NNN。連携先・用途・認証方式・障害時のフォールバック（resilience-testing の対象宣言を兼ねる）・コスト（cost-estimate へリンク） |
| 価格戦略 | `10-business-design/pricing-strategy.md` | △ | 発注者 | 既存（pricing-strategist） |
| 技術スタック / ADR / コスト見積り | `11-tech-stack/` | ◎/△ | 発注者・実装者 | 既存 |
| ブランド戦略 / デザインシステム | `12-brand-design/` | ◎ | デザイン関係 | 既存。**社内ツール・CLI プロファイルでは除外可** |

### Phase 5-6 外部設計（`docs/20-external-design/` `15-marketing-site/`）

| 文書 | ファイル | 既定 | 主読者 | 内容 |
|------|---------|------|--------|------|
| 画面一覧 | `screen-list.md` | ◎ | 全員 | 既存。S-XXX-NNN。各行から画面仕様書・モックへリンク。**画面を持たない案件（API/MCP/CLI）では除外可** |
| 画面遷移【新設・分離】 | `screen-transitions.md` | ◎ | 発注者・設計者 | Mermaid flowchart による遷移図の元情報＋遷移条件（ガード：ログイン要否・ロール）。ノードは S の ID |
| **画面仕様書群【新設】** | `screen-specs/S-XXX-NNN.md` | ◎ | 発注者・実装者・テスター | **1 画面 1 文書**。入力項目（型・必須・バリデーション → ERR リンク）／表示項目（データ源 → ENT・API リンク）／操作（ボタン・アクション → F・API リンク）／状態（空・ロード・エラー）／権限（ROLE 別の表示差）。モック HTML と相互リンク |
| API 仕様 | `api-spec.md` | ◎ | 実装者 | 既存。API-NNN（OpenAPI 骨子）。各エンドポイントに利用画面（S）・エラー（ERR）リンク |
| データモデル | `data-model.md` | ◎ | 実装者・発注者 | 既存。ENT-NNN＋Mermaid erDiagram。各エンティティに**属性レベルのデータ項目定義**（項目名・型・必須・初期値・説明・個人情報区分。データ項目定義書／データディクショナリを兼ねる）と保持期間・削除ポリシー（退会時の扱い）を必須記載 |
| エラー・例外カタログ【明文化】 | `error-catalog.md` | ◎ | 全員 | ERR-NNN。発生条件／ユーザー向けメッセージ文言／システム挙動（リトライ・ロールバック）／ログ・通知。従来レビュー対象だった error-handling を正式にカタログ化 |
| 認証・認可設計【明文化】 | `auth-design.md` | ◎ | 実装者・監査 | 認証方式・セッション・permissions-matrix の**確定版**（ROLE × S × API × ENT） |
| AI エージェント向けインターフェース | `agent-interface.md` | △ | 実装者 | 既存（MCP 提供案件のみ。**API・MCP プロファイルでは◎に昇格**） |
| オンボーディング設計 | `onboarding-flow.md` | △ | 発注者 | 既存 |
| 画面モック | `mockups/` | ◎ | 発注者 | 既存（自己完結 HTML。htmldocs からリンクされる） |
| 営業ポータルモック・SEO ほか | `15-marketing-site/` | ◎/△ | 発注者 | 既存（v0.9.0）。**社内ツール・CLI / API・MCP プロファイルでは除外可**（document-set.md での除外＝v0.9.0 が要求する「明示承認＋記録」を満たす） |

### Phase 7-8 内部設計（`docs/30-internal-design/`）

既存 4 文書（`module-design.md` / `class-design.md` / `sequence.md` / `infra-design.md`＝インフラ構成図の正本）を維持。追加ルール：

- `sequence.md` の各シーケンスは起点のユースケース（UC）・API（API-NNN）を明記する
- 状態遷移・トランザクション境界・ロギング設計は `class-design.md` 内の必須節とする（独立ファイル化しない）
- 主読者はエンジニアのため、HTML 化はするが平易化サマリーは不要（§5 執筆ルールの適用は「この文書について」冒頭節のみ）

| 文書 | ファイル | 既定 | 主読者 | 内容 |
|------|---------|------|--------|------|
| セキュリティ設計書【新設】 | `security-design.md` | ○ | 実装者・監査・発注者 | 脅威と対策の**設計**（データ分類・暗号化（保存時/転送時）・監査ログ設計・シークレット管理・RLS 方針・レート制限）。非機能要件（NFR-SEC）と実装の橋渡しで、auth-design.md（認可）を補完し、security-auditor の監査・security-compliance-sheet の裏付けになる。Tier B/C・機微情報・B2B 納品案件で採用 |
| データ移行手順書【新設】 | `data-migration.md` | ○ | 実装者・運用者・発注者 | 既存システムからの移行がある案件のみ。移行対象データと ENT へのマッピング／変換ルール／手順／リハーサル計画／検証方法／切戻し手順。実行結果は release-log.md に記録 |

### Phase 9-10 テスト計画（`docs/40-test-plan/`）

既存セット（v0.12.0 のテスト重厚化）を維持：`test-strategy.md` / `test-cases.md` / `case-derivation-matrix.md`（=テスト観点の正本） / `adversarial-cases.md` / `case-reconciliation.md` / `e2e-scenarios.md` / `test-data.md` / `non-functional-tests.md`。全プロファイル共通の最小必須（除外不可。ただし画面を持たない案件の e2e-scenarios は API/CLI レベルの通しシナリオに読み替え）。

追加ルール：各テストケースは検証対象の ID（F / UC / NFR / ERR / PS）を必ず持つ（トレーサビリティ監査の突合キー）。

### Phase 11-14 実装・テスト・監査（`docs/41-test-results/`）

既存セットを維持（local-env-verification / unit-integration / mutation / usecase-e2e / exploratory / bug-escape-ledger / traceability-audit / security-audit）。除外不可。

追加ルール：bug-escape-ledger の各行に BUG-NNN を発番し、修正コミット・再現テスト・反映先チェックリストへリンクする。

### 法務（`docs/50-legal/`）

既存セットを維持（利用規約・プライバシーポリシー・特商法表記・外部送信規律・セキュリティチェックシート）。**一般公開しない社内ツール・CLI プロファイルでは除外可**。htmldocs では「公開文書」セクションとして扱う（発注者が最終的に一般公開する文書のため）。

| 文書 | ファイル | 既定 | 主読者 | 内容 |
|------|---------|------|--------|------|
| 利用ライブラリ・ライセンス一覧【新設】 | `third-party-licenses.md` | ○ | 発注者・監査 | 依存パッケージのライセンス一覧（`npx license-checker` 等で機械生成して整形）。コピーレフト（GPL 系）混入チェックの結果を明記。**B2B 納品・受託案件では必須** |
| SBOM【新設】 | `sbom.cdx.json` | ○ | 発注者・監査 | ソフトウェア部品表（CycloneDX 形式、`npm sbom --sbom-format cyclonedx` で機械生成。Markdown ではないため htmldocs 変換対象外・ファイルとして納品）。security-compliance-sheet と対で顧客のサプライチェーン確認に回答。B2B 納品案件で採用 |

### Phase 15-17 運用（`docs/60-operations/`）

| 文書 | ファイル | 既定 | 主読者 | 内容 |
|------|---------|------|--------|------|
| リリース記録 / KPI ベースライン / 運用レビュー / ふりかえり / 改善バックログ / ループ計測 / CR | 既存一式 | ◎ | PM・発注者 | 既存（v0.13.0）。KPI ベースラインは社内ツールでは「利用実績・処理成功率」等に読み替え |
| 運用手順書【新設】 | `runbook.md` | ◎ | 運用者（＝将来の自分・引継ぎ先） | Phase 15 で PM＋observability-integration-specialist が作成。**必須節**：①環境情報（URL・ダッシュボード・**環境変数一覧の所在**（正本はコメント付き `.env.local.example`＋本番はホスティング側管理）→ EXT リンク）②デプロイ手順・ロールバック手順（CI/CD 化済みならワークフローへリンク。cicd-pipeline Skill 準拠）③定常運用（バッチ確認 → JOB リンク）④**障害対応初動**（切り分けフロー・エスカレーション基準。障害対応手順書を兼ねる）⑤**バックアップ・リストア手順**（Supabase PITR / ダンプの取得と復旧確認。バックアップ・復旧手順書を兼ねる）⑥連絡先。**デプロイ Go チェックリストの「ロールバック手順が確認済み」の正本** |

### 操作マニュアル（`docs/70-manuals/`、Phase 14 通過後〜15）【新設】

画面・挙動が確定してから（Phase 14 の Approve 後〜Phase 15）作成する。担当は implementation-worker または PM（customer-support-toolkit Skill 参照。ヘルプセンター自動生成の原稿を兼ねる）。

| 文書 | ファイル | 既定 | 主読者 | 内容 |
|------|---------|------|--------|------|
| 利用者向け操作マニュアル【新設】 | `user-manual.md` | ○ | エンドユーザー・発注者 | 主要ユースケース（UC）単位の操作手順（登録〜基本操作〜退会）。スクリーンショットは実画面（`docs/15-marketing-site/screenshots/` 等の実体へリンク）。業務言語で記述（§5 執筆ルール適用） |
| 管理者向け操作マニュアル【新設】 | `admin-manual.md` | ○ | 管理者・運用担当 | 管理画面の操作（会員管理・課金対応・お知らせ配信等）、問い合わせ対応手順、権限（ROLE）別にできることの一覧。runbook.md（システム運用）とは分離：こちらは**業務操作**の手順 |

### PM（`docs/99-pm/`）

既存（`roadmap.md` / `risk-register.md` / `status.md` / `status-log.md`）＋ **`document-set.md`【新設】（§3）**。risk-register は RSK-NNN を発番し、要件定義のリスク初出し（requirements.md §8）から転記・一元管理する。

## 3. 文書セット選択制（`docs/99-pm/document-set.md`）

全カタログ文書を全案件で作るのは過剰である（例：管理者だけが使う CLI ツールに営業ポータル・ブランド戦略・SEO は不要）。案件ごとに**採用する文書セットを確定し、ユーザーの承認を得て記録する**。

### 運用フロー（PM の責務）

1. **プロジェクト開始時（Phase 1 のヒアリングで案件の性格が見えた時点）**、PM がプロファイル（下表）を初期値として文書ごとの採否案を作成する
2. **ユーザーに「作成する文書セットはこれでいいですか」と一覧で提示**し（追加・削除の指定を受け付ける）、承認を得る
3. 承認結果を `docs/99-pm/document-set.md` に記録し、status.md にも「文書セット確定」を記録する
4. 以後、**producer は document-set.md で「採用」の文書だけを作成**し、**レビュワーは「除外」文書の不存在を指摘しない**
5. 案件の性格が変わったら（例：社内ツールを外販することになった）、PM が document-set.md を改訂して再承認を得る

### プロファイル（初期値）

| プロファイル | 想定案件 | 既定から除外するもの |
|-------------|---------|---------------------|
| `full-saas` | 一般公開する SaaS（標準） | なし（カタログの既定通り） |
| `internal-tool` | 社内ツール・管理者専用 CLI / 画面 | `12-brand-design/`・`15-marketing-site/` 一式・`pricing-strategy.md`・`50-legal/` 一式・`user-stories.md`・`onboarding-flow.md`・SEO/広告/ブログ/動画系 |
| `api-mcp` | ヘッドレス API / MCP サーバー提供 | 画面系（`screen-list` / `screen-transitions` / `screen-specs/` / `mockups/`）・`15-marketing-site/` 一式（外販時は残す）・`70-manuals/`（agent-interface.md と MCP ツール説明で代替）。`agent-interface.md` を◎に昇格 |
| `minimal` | 使い捨てに近い最小構成（PoC 等） | 除外不可文書（requirements / feature-list / decision-log / テスト計画・結果一式）＋ runbook 以外すべて |

### document-set.md のフォーマット

```markdown
# 文書セット定義

- **プロファイル**: internal-tool
- **確定日**: YYYY-MM-DD（ユーザー承認済み）
- **改訂履歴**: （改訂時に追記）

| 文書 | 正本パス | 既定 | 採否 | 理由（除外・追加時のみ） |
|------|---------|------|------|------------------------|
| 業務要件一覧 | docs/00-requirements/business-requirements.md | ◎ | 採用 | |
| ブランド戦略 | docs/12-brand-design/brand-strategy.md | ◎ | 除外 | 管理者専用ツールのため |
| ... | | | | |
```

除外には理由を必ず書く（後から「なぜ無いのか」が分かる状態にする）。除外の記録は、pm-playbook の各種スキップルール（営業ポータルモック等）が要求する「リスク提示＋明示承認＋記録」を兼ねる。

## 4. `htmldocs/` ツリー構造

プロジェクトルート直下に `htmldocs/` を置き、`docs/` の番号体系をミラーする。**ツリーは docs/ に実在する Markdown から機械生成される**ため、文書セットの採否・既存案件の文書充足度がそのまま反映される（無い文書のページは作られない）。

```
<project-root>/
└── htmldocs/
    ├── index.html                  # ポータル：プロジェクト概要・全文書ツリー・更新日
    ├── assets/
    │   ├── style.css               # 共通スタイル（生成時に配置）
    │   └── mermaid.min.js          # Mermaid ローカル同梱（初回生成時にダウンロード。失敗時はコード表示にフォールバック）
    ├── id-index.html               # ID 逆引き索引（全 ID → 定義箇所・参照箇所一覧）
    ├── 00-requirements/
    │   ├── index.html              # フェーズ表紙：文書一覧＋レビュー記録一覧
    │   ├── requirements.html
    │   ├── glossary.html
    │   └── …（docs/00-requirements/ の .md と 1:1）
    ├── 10-business-design/ …       # business-rules/ サブツリー含む
    ├── 11-tech-stack/ …            # adr/ サブツリー含む
    ├── 12-brand-design/ …
    ├── 15-marketing-site/ …        # モックは docs/ 内の HTML へ相対リンク（コピーしない）
    ├── 20-external-design/ …       # screen-specs/ サブツリー含む
    ├── 30-internal-design/ …
    ├── 40-test-plan/ …
    ├── 41-test-results/ …
    ├── 50-legal/ …
    ├── 60-operations/ …
    ├── 70-manuals/ …               # 操作マニュアル（利用者向け・管理者向け）
    └── 99-pm/ …                    # status.html はルート index からもリンク
```

### 生成・リンク規則（build-htmldocs.mjs の仕様）

1. **1 Markdown = 1 HTML**。`docs/**/X.md` → `htmldocs/**/X.html`。`reviews/` 配下も変換し、フェーズ表紙（index.html）に「レビュー記録」として一覧化する
2. **ID 自動リンク**：本文中の ID パターン（§1 の表）を検出し、正本文書の該当アンカー（例：`feature-list.html#F-023`）へのリンクに変換。正本文書内の初出箇所にはアンカーを付与。正本が存在しない ID はプレーンテキストのまま
3. **Mermaid はブラウザレンダリング**（同梱 mermaid.min.js）。同梱に失敗した環境ではコードブロックとして表示
4. **画面モック・スクショ・PNG**：docs/ 内の実体へ相対リンク。htmldocs へ複製しない
5. **ナビゲーション**：全ページ共通で「パンくず（index → フェーズ表紙 → 文書）／id-index・用語集へのリンク」を持つ
6. **鮮度表示**：各 HTML に生成日時と元 Markdown の最終更新日を表示。生成は常に全量再生成（増分にしない）

## 5. 執筆ルール（人間可読性・全 producer 共通）

HTML 化しても文章が読めなければ意味がない。全 producer エージェントは Markdown 執筆時に以下を守る。**レビュワーはこのルール違反を指摘対象とする**（review-protocol 参照）。

1. **指示代名詞の禁止**：「あれ」「それ」「これ」「上記の」「先述の」で文書内・文書間を指さない。必ず**名称＋ID**で指す（例：「その処理が失敗した場合」→「年度更新処理（PS-001）が失敗した場合」）
2. **ID は名称併記**：ID 単独の記号参照禁止。「F-023（CSV エクスポート）」の形式
3. **冒頭に「この文書について」節を必須化**：目的（何を決める文書か）／想定読者／3 行サマリー／上流・下流の関連文書リンク
4. **用語は glossary に一元定義**：文書ごとに独自定義しない。初出で glossary へリンク。略語は初出でフルスペル併記
5. **業務文書（00 / 10 番台）は業務言語で書く**：技術用語（RLS・Webhook 等）を使う場合は括弧で平易な補足を付ける。技術文書（30 番台以降）は対象外
6. **結論先出し**：各節は結論・決定事項を先頭に、理由・経緯を後ろに
7. **表の説明はプロセで**：表のセルに長文を詰めない。判断理由は表の前後の本文に書く

このルールは**新規に書く・改訂する文書に適用**する。既存案件の過去文書への遡及適用はしない（§7）。

## 6. 生成タイミングと責務

| タイミング | 実行者 | 動作 |
|-----------|--------|------|
| 各フェーズのレビュー Approve 時 | PM（project-manager） | `node .agents/skills/sdlc-toolkit/scripts/build-htmldocs.mjs` を実行し全量再生成 |
| デプロイ Go 判断時 | PM | 最終再生成。Go チェックリストに「htmldocs が最新」を含める（pm-playbook 参照） |
| 運用サイクル（Phase 16 月次） | operations-analyst | ops-review 作成後に再生成 |

- 生成は**スクリプトによる機械変換**とし、エージェントに HTML を手書きさせない（トークン節約・一貫性・冪等性）
- producer エージェントは Markdown だけに責任を持つ。HTML の見た目の問題はスクリプト側の修正で解決する
- スクリプトは `.agents/` 配下に同梱されるため、`new-project.sh` / `update-project.sh` の通常の配布フローで全案件に行き渡る（追加のセットアップ不要）

## 7. 既存案件への導入（追記型・非破壊）

`new-project.sh` で過去に展開済みの案件へ本カタログ（v0.17.0）を `update-project.sh` で取り込んだ場合の動作原則。**既存の docs/ を作り直さないこと**が最優先。

1. **即時にできること**：`node .agents/skills/sdlc-toolkit/scripts/build-htmldocs.mjs` を一度実行するだけで、**既存の Markdown がそのまま HTML 化され `htmldocs/` が立ち上がる**。docs/ への変更はゼロ
2. **既存文書の分割・改名・再構成は禁止**：本カタログの【新設・分離】文書（non-functional.md 等）が既存案件の requirements.md 内の節と重複していても、既存ファイルから切り出さない。既存構成のまま HTML 化する（ID リンクは正本が無い分だけ張られないが、生成は成立する）
3. **新設文書の後追い一括生成はしない**：不足文書は「**次にそのフェーズを触るとき**」（機能追加・軽量チェンジサイクル・次サイクルの Phase 1 など）に、**新規ファイルの追加のみ**で埋める。既存ファイルの改変を伴う埋め方はしない
4. **document-set.md は次に PM が起動されたときに作成**：既存 docs/ の実態を「採用済み」として反映し、不足分の採否だけをユーザーに確認する（既存分の再確認はしない）
5. **執筆ルール（§5）は改訂・新規分から適用**：過去文書の文体修正だけを目的とした書き換えはしない（差分ノイズと再レビューコストの方が大きい）

これから新規作成する案件は、初回から document-set.md を確定して docs/ と htmldocs/ の両方をフルバージョンで持つ。

## 8. ウォーターフォール標準文書との対応表

| 一般的なウォーターフォール文書 | 本フレームワークでの正本 | フェーズ |
|------------------------------|------------------------|---------|
| 要件定義書 | `00-requirements/requirements.md` | 1 |
| 業務要件一覧 | `00-requirements/business-requirements.md`【新設】 | 1 |
| 機能要件一覧 | `10-business-design/feature-list.md` | 3 |
| 非機能要件一覧 | `00-requirements/non-functional.md`【新設・分離】 | 1 |
| ユースケース一覧 | `00-requirements/use-cases.md`【新設・分離】 | 1 |
| ユーザーストーリー | `00-requirements/user-stories.md` | 1 |
| 画面一覧 | `20-external-design/screen-list.md` | 5 |
| 画面遷移図の元情報 | `20-external-design/screen-transitions.md`【新設・分離】 | 5 |
| 各画面の入力・表示・操作 | `20-external-design/screen-specs/S-XXX-NNN.md`【新設】 | 5 |
| ロール・権限マトリクス | `00-requirements/permissions-matrix.md`（初版）→ `20-external-design/auth-design.md`（確定） | 1 → 5 |
| 業務処理仕様（案件固有。例：年度更新・役員交代・引継ぎ） | `10-business-design/business-rules/PS-NNN-*.md`【新設】 | 3 → 5 |
| データモデル / ER 図の元情報 | `20-external-design/data-model.md` | 5 |
| API 一覧 | `20-external-design/api-spec.md` | 5 |
| バッチ・通知処理一覧 | `10-business-design/batch-jobs.md`＋`notifications.md`【新設】 | 3 |
| 外部サービス連携一覧 | `10-business-design/external-integrations.md`【新設】 | 3 |
| エラー・例外処理一覧 | `20-external-design/error-catalog.md`【明文化】 | 5 |
| セキュリティ要件 | `00-requirements/non-functional.md`（NFR-SEC）＋`50-legal/security-compliance-sheet.md` | 1 / 法務 |
| テスト観点 | `40-test-plan/case-derivation-matrix.md`（＋adversarial-cases） | 9 |
| MVP と将来機能の区分 | `requirements.md` §3（機能スコープ） | 1 |
| 業務上のリスク | `requirements.md` §8 → `99-pm/risk-register.md`（RSK 一元管理） | 1 → PM |
| 要確認事項一覧 | `00-requirements/open-questions.md`【新設・分離】 | 1 |
| ワイヤーフレーム | `20-external-design/mockups/`（自己完結 HTML モック＝ワイヤーの上位互換） | 5 |
| UI デザイン | `12-brand-design/design-system.md`＋`20-external-design/mockups/` | 3 → 5 |
| データ項目定義書 | `20-external-design/data-model.md` の属性表（データディクショナリ節） | 5 |
| セキュリティ設計書 | `30-internal-design/security-design.md`【新設】＋`20-external-design/auth-design.md` | 5 → 7 |
| インフラ構成図 | `30-internal-design/infra-design.md` | 7 |
| テスト計画書 / テスト仕様書 | `40-test-plan/test-strategy.md` / `test-cases.md` | 9 |
| テスト結果報告書 | `41-test-results/` 一式 | 11-14 |
| 運用手順書 / 障害対応手順書 / バックアップ・復旧手順書 / デプロイ手順 | `60-operations/runbook.md`【新設】の必須節①〜⑤（CI/CD 詳細は cicd-pipeline Skill） | 15 |
| データ移行手順書 | `30-internal-design/data-migration.md`【新設】 | 7 →（実行は 15） |
| 環境変数一覧 | `.env.local.example`（コメント付き正本）＋ runbook.md 環境情報節 | 11 |
| 利用ライブラリ・ライセンス一覧 | `50-legal/third-party-licenses.md`【新設】 | 法務 |
| SBOM | `50-legal/sbom.cdx.json`【新設・機械生成】 | 法務 |
| 利用者向け / 管理者向け操作マニュアル | `70-manuals/user-manual.md` / `admin-manual.md`【新設】 | 14 → 15 |
| ソースコード / デプロイ物 | リポジトリ本体（docs/ 外。tests/・supabase/・scripts/ 含む） | 11 |
| （本カタログでの追加）用語集 | `00-requirements/glossary.md`【新設】 | 1 |
| （本カタログでの追加）運用手順書 | `60-operations/runbook.md`【新設】 | 15 |
