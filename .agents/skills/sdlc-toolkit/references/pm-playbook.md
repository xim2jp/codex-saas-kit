# PM オーケストレーション・プレイブック

project-manager エージェントが他エージェントを呼び出して進行管理を行うための実行手順集。

## エージェント呼び出しコマンド

Claude Code では `@agent-name` で明示的にエージェントを起動できる。PM は以下のコマンドを取りまとめてユーザーに提示する。

### Phase別エージェント呼び出し

#### Phase 1: 要件定義
```
@requirements-architect
```

#### Phase 2: 要件レビュー
```
@requirements-reviewer
```

#### Phase 3: 企画（業務・技術・ブランド）
並列実行を推奨：
```
@business-flow-designer
@tech-stack-architect
@brand-design-strategist
```

#### Phase 4: 企画レビュー
```
@planning-reviewer
```

#### Phase 5: 外部設計（アプリ画面＋営業ポータルモック並列）
```
@external-designer          … アプリの外部設計（文書＋画面HTMLモック）
@marketing-site-builder     … 営業ポータル（LP兼営業サイト）モックアップ【v0.9.0 必須】
```

external-designer の成果物には文書（screen-list / api-spec / data-model / error-handling / auth-design）に加えて、**画面HTMLモック（`docs/20-external-design/mockups/`）が必須**：
- 主要画面ごとの自己完結 HTML モック（`S-XXX-NNN.html`）
- Playwright による全画面スクリーンショット（`mockups/screenshots/`）
- バリエーション反復ログ（`mockups/iteration-log.md`）— 再生成時の「酷似モック量産」を防ぐ

**【v0.9.0】営業ポータルモックアップ（必須・並列）**：marketing-site-builder を**モックアップモード**で並列起動し、営業用兼LPのポータルサイトのモックを作成する：
- 成果物：`docs/15-marketing-site/mockups/`（`MK-NNN-<slug>.html` の自己完結HTML、`screenshots/`、`iteration-log.md`、`index.html`）
- サイトは**8ページ構成**（トップ／機能紹介／運営者紹介／スクリーンショット集／料金表／FAQ／お問い合わせ／法務）。モック必須は5ページ（トップ・機能紹介・スクリーンショット集・料金表・FAQ）、残り3ページは簡易モック/プレースホルダ可。pricing-strategy.md があれば料金表に反映
- ビジュアルの傾向（厳格ルールではない）：幾何学・抽象イラストより**写実的画像・実画面スクリーンショットを極力多用**（モック段階ではアプリ画面モックのスクショを流用可）。運営者紹介は https://shinichi.noguchi.jp.net から写真含め引用
- visual-director はモック段階では**任意（推奨）**。未実施なら `design-system.md` ベースで作成してよい（本実装前には visual-director が必須のまま）
- **スキップは、要件定義に「営業サイト／ポータル不要」が明記されている場合のみ**。PM がリスク（集客導線の未検証・営業開始遅延）を提示し、ユーザーの明示承認を得て status.md に記録する。**特に言及がなければ必須**

#### Phase 6: 外部設計レビュー（2レビュワー並列）
```
@external-design-reviewer   … 文書整合（画面×機能マッピング、API、ERD、エラー、認証）
@ui-mockup-reviewer         … 画面モック＋営業ポータルモックのビジュアル品質（design-system整合、状態網羅、反復ごとの実質的変化）
```

ui-mockup-reviewer は `docs/20-external-design/mockups/`（アプリ画面）と `docs/15-marketing-site/mockups/`（営業ポータル、v0.9.0）の**両方**をレビューする。

**両方のレビュワーが Approve で Phase 6 通過**。Block 時の差し戻し先はモック種別で分岐（ループカウントはレビュワーごとに独立）：
- 文書・アプリ画面モックの指摘 → external-designer
- 営業ポータルモックの指摘 → marketing-site-builder

#### Phase 7: 内部設計
```
@internal-designer
```

#### Phase 8: 内部設計レビュー
```
@internal-design-reviewer
```

#### Phase 9: テスト計画（2エージェント並列、v0.12.0）
```
@test-planner            … テスト戦略・テストケース・導出技法マトリクス
@test-case-adversary     … 独立テストケース抽出（test-planner の成果物を見ない）
```

**【v0.12.0】テストケース抽出の二重化（test-hardening.md 原則1）**：test-case-adversary は test-planner と**並列起動**し、`docs/40-test-plan/` を一切 Read せずに要件・機能一覧・外部設計のみから独立にケース抽出する（`adversarial-cases.md`）。**両者の初版完了後**、test-planner が突合（`case-reconciliation.md`）を行い、片方にしかないケースを原則全件採用して test-cases.md / e2e-scenarios.md に反映する。PM は起動順に注意：**並列起動 → 両者完了 → test-planner を突合モードで再起動**。

**【v0.9.0】test-strategy.md に「ローカル完結テスト環境要件」節が必須**：`local-dev-environment` Skill を参照し、何をローカル実体で動かし（Supabase ローカルスタック等）、何をモックにするか（AI API・Stripe の方式A/B/C）、シードデータ方針を宣言する。この宣言が Phase 11 タスク0（環境構築）の仕様になる。

#### Phase 10: テスト計画レビュー
```
@test-plan-reviewer
```

#### Phase 11: 実装＋ユニット/統合テスト並走
```
@implementation-worker
@tester
```

**【v0.9.0】タスク0＝ローカル開発環境構築（必須・スキップ禁止）**：Phase 11 の最初のタスクとして、implementation-worker が `local-dev-environment` Skill に従い **Docker ベースのローカル完結開発環境**を構築する（機能実装より先）：
- 成果物：`docker-compose.yml` / `supabase/`（config・migrations・seed.sql）/ `scripts/dev-setup.sh`・`dev-check.sh` / `.env.local.example`
- 検証レポート：**`docs/41-test-results/local-env-verification-YYYYMMDD-HHMM.md`（必須）**。アプリ・**営業ポータル8ページ**・認証（Mailpit）・Stripe・AIモック・テスト実行がすべてローカルのみで動くことを確認して記録
- Phase 9 の「ローカル完結テスト環境要件」宣言に従う。宣言が無い場合は test-planner に差し戻すか、PM 判断で Skill の既定構成を適用して宣言を追記
- tester は環境検証後にテスト実装へ入る。**環境が起動しない・検証レポートが無いままのテスト実装は禁止**

tester は **Unit / Integration テスト**を担当（ローカル環境上で実行）。E2E ユースケーステストは Phase 12 で別エージェントが担当する（責務分離）。

#### Phase 12: ユースケースE2Eテスト（必須・スキップ禁止）
```
@e2e-usecase-tester
```

**Phase 11 が Approve されてから必ず実施**。SaaS の業務ユースケース（新規登録・ログイン・サービス利用・会員管理・課金・退会）を実ブラウザで通しテストし、`docs/40-test-plan/e2e-scenarios.md` の不足を補い、`tests/e2e/usecases/*.spec.ts` を生成して `npx playwright test` で実行する。

**【v0.9.0】前提条件**：`docs/41-test-results/local-env-verification-*.md`（Phase 11 タスク0の検証レポート）が存在し、ブロッカーが無いこと。E2E は**ローカル開発環境上で実行**する（`bash scripts/dev-setup.sh` → 実行）。レポートが無い／環境が起動しない場合は implementation-worker に差し戻す。

成果物：
- `docs/40-test-plan/e2e-scenarios.md`（追記）
- `tests/e2e/usecases/*.spec.ts`（生成）
- `docs/41-test-results/usecase-e2e-YYYYMMDD-HHMM.md`（レポート、必須）

完了条件：
- 標準ユースケースカタログ（UC-SIGNUP / UC-LOGIN / UC-PROFILE / UC-BILLING / UC-WITHDRAW / UC-PERM）と案件固有ユースケースが全て生成・実行されている
- 全 Critical ユースケースが pass
- レポートに「ブロッカー有無」が明示されている

失敗時の扱い：
- 実装バグ検出 → Phase 11 に戻す（implementation-worker 再起動）
- テスト側の問題 → e2e-usecase-tester が自分で修正・再実行
- flaky → 待機戦略・データ独立性を見直して再実行

#### Phase 12.5: 探索的・敵対的テスト（必須・スキップ禁止、v0.12.0 新規。Phase 13 と並列可）
```
@exploratory-tester
```

**Phase 12 完了後に必ず実施**（Phase 13 と並列でよい）。台本化された E2E が「予測できたこと」しか証明しないのに対し、攻撃カタログ7分類（操作順序攪乱・二重送信・ブラウザナビゲーション・セッション攪乱・境界/異常入力・権限横断=IDOR・中断再開）で**台本外の操作**を実ブラウザで試行する。詳細は `test-hardening.md` 原則4。

成果物：
- `docs/41-test-results/exploratory-YYYYMMDD-HHMM.md`（**必須**。試行全件＋発見バグ一覧＋ブロッカー有無）
- 発見バグの再現テスト（`tests/e2e/exploratory/` 等に恒久追加）
- `docs/41-test-results/bug-escape-ledger.md` への記録

失敗時の扱い：
- Critical 発見（金額不整合・権限突破・データ喪失・登録/退会不能）→ VERDICT: BLOCK。implementation-worker を修正モードで起動 → 修正後に該当攻撃を再実行（rework-loop 準拠、上限5回）
- レポートが無いまま Phase 14 に進むことは不可（implementation-reviewer が Block する）

#### Phase 13: 要件トレーサビリティ監査（必須・スキップ禁止、v0.2.0 新規）
```
@requirement-traceability-auditor
```

**Phase 12 が完了したら必ず実施**。`feature-list.md` の全 MUST FunctionalID が E2E でカバーされているか、`business-flow.md` の swim lane / 分岐（特に金額・権限・退会の異常系）が E2E で再現されているかを、機械的に突合する。

成果物：
- `docs/41-test-results/traceability-audit-YYYYMMDD-HHMM.md`（監査レポート、必須）

Block 条件（必ず Block）：
- MUST FunctionalID で対応 E2E が 1 つも無い
- 金額系分岐の異常系 E2E（UC-BILLING-05 系）欠落
- 権限境界 E2E（UC-PERM-01 / -02）欠落
- 退会後アクセス制御 E2E（UC-WITHDRAW-04）欠落
- Phase 12 レポートが存在しない、または 7 日以上前

失敗時の扱い：
- MUST 未カバー → Phase 12 に差し戻し（e2e-usecase-tester で追加 UC 生成・実行）
- テスト計画段階の宣言不足 → Phase 9 に差し戻し（test-planner で e2e-scenarios.md 修正）

#### Phase 14: 実装＋テスト結果レビュー（Unit/Integration/E2E 全て + 要件監査）
```
@implementation-reviewer
```

implementation-reviewer は Phase 11 の Unit/Integration テスト結果に加え、**Phase 12 のユースケースE2Eレポート（`docs/41-test-results/usecase-e2e-*.md`）と Phase 13 の要件トレーサビリティ監査レポート（`docs/41-test-results/traceability-audit-*.md`）を必ずレビュー対象に含める**。いずれかのレポートが存在しない、またはブロッカー / Block 項目が残っていれば Block Verdict を出す。

#### Phase 15: リリース・計測開始（v0.13.0）
```
（PM 自身が主導）+ @observability-integration-specialist
```

デプロイ Go の直後に実施。`docs/60-operations/release-log.md` と `kpi-baseline.md`（KPI 初期値と目標値）を作成し、監視・アラート・アナリティクスが**計測できる状態**であることを確認する。**kpi-baseline.md が無ければ Phase 16 に進めない**（計測なき運用は Check 不能）。

#### Phase 16: 運用サイクル（常設・繰り返し、v0.13.0）
```
@operations-analyst
```

月次（成長期は週次）で起動。`docs/60-operations/ops-review-YYYY-MM.md`（KPI 実績・エラー/障害・問い合わせ/解約分類・コスト・課題リスト）を作成する。cost-guardian の月次コスト監視と同じタイミングでまとめて起動するのが効率的。

#### Phase 17: 改善サイクル起票（v0.13.0）
```
@retrospective-facilitator
```

ops-review 完了後に起動。ふりかえり（`retrospective-YYYY-MM.md`）と優先度付き改善バックログ（`improvement-backlog.md`、各項目にサイクル種別判定付き）を作成し、PROJECT_LEARNINGS への還流候補を転記する。**バックログ上位の着手判断はユーザー承認事項**。承認後：
- フルサイクル → Phase 1 から次サイクルを開始（既存 docs への差分追記）
- 軽量サイクル → `docs/60-operations/changes/CR-NNN.md` を起票し、軽量チェンジサイクル（lifecycle-loop.md の5ステップ）で実施

**円環の原則**：Phase 14 完了・デプロイ Go は「案件終了」ではなく Phase 15 の開始。SDLC は 15 → 16 → 17 → （1 または軽量サイクル）→ … と回り続ける。詳細・軽量チェンジサイクルの判定表は `lifecycle-loop.md` が正本。

## ステータスファイル

PM は `docs/99-pm/status.md` でプロジェクト進捗を管理する。

### status.md のフォーマット

```markdown
# プロジェクト進捗

- **プロジェクト名**: 
- **開始日**: 
- **最終更新**: 
- **現在フェーズ**: Phase X / 14
- **次のアクション**: 

## フェーズ別ステータス

| Phase | 名称 | ステータス | 担当エージェント | 成果物 | レビューVerdict | ループ | 完了日 |
|-------|------|----------|----------------|--------|----------------|-------|--------|
| 1 | 要件定義 | ✅ 完了 | requirements-architect | docs/00-requirements/requirements.md | 🟢 Approve | - | 2026-05-12 |
| 2 | 要件レビュー | ✅ 完了 | requirements-reviewer | docs/00-requirements/reviews/... | 🟢 Approve | 2/5 | 2026-05-13 |
| 3 | 企画 | 🚧 進行中 | business-flow-designer 等 | docs/10-business-design/ | - | - | - |
| 4 | 企画レビュー | ⏳ 待機 | planning-reviewer | - | - | - | - |
| 5 | 外部設計（文書＋画面モック＋営業ポータルモック） | ⏳ 待機 | external-designer + marketing-site-builder | docs/20-external-design/（mockups/ 含む）+ docs/15-marketing-site/mockups/ | - | - | - |
| 6 | 外部設計レビュー（2レビュワー並列） | ⏳ 待機 | external-design-reviewer + ui-mockup-reviewer | - | - | - | - |
| 7 | 内部設計 | ⏳ 待機 | internal-designer | - | - | - | - |
| 8 | 内部設計レビュー | ⏳ 待機 | internal-design-reviewer | - | - | - | - |
| 9 | テスト計画（＋敵対的ケース抽出並列） | ⏳ 待機 | test-planner + test-case-adversary | docs/40-test-plan/（case-derivation-matrix / adversarial-cases / case-reconciliation 含む） | - | - | - |
| 10 | テスト計画レビュー | ⏳ 待機 | test-plan-reviewer | - | - | - | - |
| 11 | 実装＋ユニット/統合テスト（タスク0＝ローカル開発環境構築） | ⏳ 待機 | implementation-worker / tester | docs/41-test-results/local-env-verification-*.md ほか | - | - | - |
| 12 | ユースケースE2Eテスト | ⏳ 待機 | e2e-usecase-tester | docs/41-test-results/usecase-e2e-*.md | - | - | - |
| 12.5 | 探索的・敵対的テスト | ⏳ 待機 | exploratory-tester | docs/41-test-results/exploratory-*.md | - | - | - |
| 13 | 要件トレーサビリティ監査 | ⏳ 待機 | requirement-traceability-auditor | docs/41-test-results/traceability-audit-*.md | - | - | - |
| 14 | 実装＋全テスト結果レビュー（+セキュリティ監査並列） | ⏳ 待機 | implementation-reviewer + security-auditor | docs/41-test-results/security-audit-*.md | - | - | - |

※「ループ」列 = レビュー実行回数 / 上限5回（Phase 6・14 は複数レビュワー独立カウント。例: `文書2/5・モック3/5`）

## オンデマンド系エージェント（v0.6.0、任意行）

固定フェーズを持たない8エージェントは、起動した案件でのみ status.md に行を追加する（起動しなければ記載不要）：

```markdown
## オンデマンド系ステータス

| エージェント | ステータス | 成果物 | Verdict | ループ | 完了日 |
|--------------|----------|--------|---------|-------|--------|
| mcp-server-specialist | ⏳ | docs/20-external-design/agent-interface.md | - | - | - |
| pricing-strategist | ⏳ | docs/10-business-design/pricing-strategy.md | - | - | - |
| legal-docs-generator | ⏳ | docs/50-legal/ | - | - | - |
| cost-guardian | ⏳ | docs/11-tech-stack/cost-estimate.md | - | - | - |
| onboarding-designer | ⏳ | docs/20-external-design/onboarding-flow.md | - | - | - |
| blog-content-producer | ⏳ | content/blog/, docs/15-marketing-site/content-calendar.md | - | - | - |
| ad-strategy-specialist | ⏳ | docs/15-marketing-site/ad-strategy.md | - | - | - |
```

## 凡例
- ⏳ 待機（未着手）
- 🚧 進行中
- 🔄 レビュー中
- 🔁 再レビュー中
- ⛔ Block中（修正待ち）
- ✅ 完了
- ⚠️ エスカレーション

## エスカレーション履歴

（修正ループ上限5回到達など、PM判断が必要だった事象を記録）

## リスク・課題

| ID | 内容 | 発生Phase | 影響 | 対応状況 |
|----|------|----------|------|---------|

## 意思決定ログ

PM が独自に行った判断を記録。
```

## 進行ルール

### 1. 順序

基本順序：1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → **12** → **12.5 / 13（並列可）** → **14** → デプロイ → **15 → 16 → 17 →（次サイクル：1 または軽量チェンジサイクル）**（v0.13.0 円環化）

**並列可能**：Phase 3の3エージェント（業務フロー・技術・ブランド）、Phase 5の2エージェント（外部設計・営業ポータルモック、v0.9.0）、Phase 9の2エージェント（テスト計画・敵対的ケース抽出、v0.12.0）、Phase 11の2エージェント（実装・テスター）、Phase 12.5 と 13（v0.12.0）

**Phase 12.5 のスキップ禁止（v0.12.0）**：探索的・敵対的テストのスキップ＝「台本外の操作（二重送信・ブラウザバック・セッション攪乱・IDOR）による本番バグ」の未検証。スキップを希望される場合のみ、PM はこのリスクを提示し、明示的承認を得て status.md に記録する。

**営業ポータルモック（Phase 5）のスキップ禁止（v0.9.0）**：営業ポータル（LP兼営業サイト）のモックアップは、**要件定義に「営業サイト／ポータル不要」が明記されている場合を除き必須**。スキップを希望される場合のみ、PM はリスク（集客導線が実装直前まで未検証・営業開始の遅延・後付けでのブランド不整合）を提示し、明示的承認を得て status.md に記録する。

**Phase 12 / 13 のスキップ禁止**：Phase 11 → 14 への直接遷移は不可。
- Phase 12 スキップ＝新規登録・課金・退会といった売上直結フローの動作未検証
- Phase 13 スキップ＝要件定義で約束した機能のうち、ブラウザから到達できないものが残存する可能性放置

**例外なく Phase 12 → 13 を経由**する。スキップを希望される場合のみ、PM はユーザーに上記リスクを提示し、明示的に承認を得る。

### 2. Verdict による分岐（rework-loop.md が正本）

各レビュー Phase 後：

- 🟢 Approve → 次フェーズへ
- 🟡 Warning → ユーザーに確認：「修正してループ」or「受容して進行（Defer 記録）」
- 🔴 Block → **PM が自動で修正ループを起動**（ユーザー確認不要）。担当エージェントを修正モードで再起動 → 対応表作成 → レビュワー再起動

**絶対禁止**：Block レビューの結果をユーザーに報告するだけで停止すること。Block はループ起動のトリガーであって終着点ではない。

### 3. 修正ループ管理（上限5回・詳細は rework-loop.md）

ループカウント（= 同一フェーズのレビュー実行回数）を status.md の「ループ」列に `N/5` 形式で記録。

- 1回目：通常レビュー
- 2回目以降：対応表（`reviews/*-response-loopN.md`）と成果物を照合。対応表なし・無変更再提出は即 Block
- **5回目でも Block のまま**：PM がエスカレーション。以下を提案：
  - 上流フェーズに戻る
  - ユーザーによる approve 強制（Defer 記録付き）
  - 要件・スコープの見直し

レビュワーの完了報告に含まれる機械可読 Verdict ブロック（`VERDICT:` / `LOOP:` / `RETURN_TO:` / `REPORT:`）をパースして、次のアクションを**自動実行**する。

### 4. 横断的な判断

以下は PM の判断領域：

- リスクの全体評価
- 上流と下流の矛盾発見時の対応方針
- スケジュール・予算への影響評価
- ユーザーへの状況サマリー報告
- 各エージェント間の責任範囲の調整

## ユーザーとのコミュニケーション

### 定例報告フォーマット

```
## 進捗報告 YYYY-MM-DD

### 完了
- Phase X: <成果物名>（Verdict: Approve）

### 進行中
- Phase Y: <担当エージェント>

### 次のアクション
- <具体的なコマンドとエージェント名>

### リスク
- （あれば）

### 判断が必要な事項
- （あれば）
```

### エスカレーション時のフォーマット

```
## ⚠️ エスカレーション

### 状況
- Phase X が3回のレビューループを経ても Block 状態

### 主な未解決指摘
- <具体的内容>

### 提案する選択肢
1. 上流フェーズ（Phase Y）に戻り <内容> を見直す
2. 該当指摘を Defer として記録し進行する
3. スコープ縮小を検討

### 推奨
- （PM の推奨案）

ご判断をお願いします。
```

## デプロイ判断

Phase 14 完了後、PM がデプロイ可否を判断：

### Go/No-Go チェックリスト

- [ ] 全 Critical Issue が解消
- [ ] **ローカル開発環境の検証レポートが存在しブロッカー無し（Phase 11 タスク0、v0.9.0）** — `docs/41-test-results/local-env-verification-*.md`
- [ ] 全 Unit / Integration テストが緑（Phase 11）
- [ ] **全ユースケースE2Eが緑（Phase 12）** — `docs/41-test-results/usecase-e2e-*.md` でブロッカー無し
- [ ] **標準ユースケース（新規登録・ログイン・サービス利用・会員管理・課金・退会）全てが pass**
- [ ] **探索的・敵対的テスト（Phase 12.5、v0.12.0）が完了し Critical 全解消** — `docs/41-test-results/exploratory-*.md` が存在し、発見バグ全件に再現テスト＋台帳記録
- [ ] **E2E が 3 回連続 Green（flaky ゼロまたは原因記録済み、v0.12.0）**
- [ ] **ミューテーションスコアがクリティカルモジュールで目標達成（80%、v0.12.0）** — `docs/41-test-results/mutation-*.md`
- [ ] **bug-escape-ledger.md の全行が「チェックリスト反映」済み（v0.12.0）**
- [ ] **要件トレーサビリティ監査（Phase 13）が 🟢 Go** — `docs/41-test-results/traceability-audit-*.md` で Block 項目無し
- [ ] **MUST FunctionalID が全てカバー、業務フロー異常系も全てカバー**
- [ ] 実装＋全テスト結果レビュー（Phase 14）が 🟢 Approve
- [ ] **セキュリティ監査（security-auditor、v0.6.0）が 🟢 Approve** — `docs/41-test-results/security-audit-*.md` で Critical 無し（RLS欠落・認可バイパス・シークレット露出・Webhook未検証は即 Block 対象）
- [ ] npm audit 等の依存関係監査が緑
- [ ] カバレッジが目標達成
- [ ] ドキュメントが最新
- [ ] **法務文書一式が揃っている**（legal-docs-generator 対応案件のみ：利用規約・プライバシーポリシー・特商法表記・外部送信規律。`docs/50-legal/`）
- [ ] ロールバック手順が確認済み（`docs/60-operations/runbook.md` を採用している案件はそれが正本、v0.17.0）
- [ ] **htmldocs/ が最新（v0.17.0）** — `node .agents/skills/sdlc-toolkit/scripts/build-htmldocs.mjs` を最終実行済み
- [ ] ステークホルダーへの通知準備

すべて ✅ なら Go、1つでも未達なら No-Go の根拠を提示。

**特に重要**：以下のいずれかの状態でのデプロイは**禁止**：
- ユースケースE2Eのレポートが存在しない、またはブロッカー有り
- **探索的テストレポートが存在しない、または Critical 未解消（v0.12.0）**
- 要件トレーサビリティ監査レポートが存在しない、または Block 項目有り
- **セキュリティ監査レポートが存在しない、または Critical 項目有り（v0.6.0）**

PM はこれを検出した時点でデプロイを止め、Phase 12 / 13 / security-auditor への差し戻しを判断する。

## 野口さん固有の運用ルール

- **クライアント案件**：レビュー結果と decision-log を提案書に組み込めるよう整理
- **自社プロダクト**：MVP優先、Phase 2機能の保留判断を明示
- **補助金案件**：マイルストーン・検収日を意識した進行
- **コンプライアンス要件**：Critical な指摘は確実に解消（妥協なし）
- **1名体制**：運用負荷を意識し、過剰な機能・テストを抑制

## 文書セット選択制と htmldocs 生成（v0.17.0、document-catalog.md が正本）

### 文書セットの確定（プロジェクト開始時）

Phase 1 のヒアリングで案件の性格（一般公開 SaaS / 社内ツール・CLI / API・MCP / PoC）が見えた時点で、PM は：

1. `document-catalog.md` §3 のプロファイルを初期値として文書ごとの採否案を作成
2. **ユーザーに「作成する文書セットはこれでいいですか」と一覧で提示**し、承認を得る（AskUserQuestion 等で選択肢を提示。追加・削除の指定を受け付ける）
3. 結果を `docs/99-pm/document-set.md` に記録（除外には理由必須）、status.md にも「文書セット確定」を記録
4. 以後の producer 起動時は document-set.md で「採用」の文書だけを依頼し、レビュワーには「除外」文書の不存在を指摘させない
5. document-set.md での除外記録は、営業ポータルモック（v0.9.0）等の各スキップルールが要求する「リスク提示＋明示承認＋記録」を兼ねる

### htmldocs の再生成（PM の定常タスク）

各フェーズのレビュー Approve 時・デプロイ Go 判断時・Phase 16 の ops-review 後に実行する：

```
node .agents/skills/sdlc-toolkit/scripts/build-htmldocs.mjs
```

- HTML は手書き・手修正しない（全量再生成で消える）。見た目の問題はスクリプト改修で対応
- 既存案件（v0.17.0 より前に展開した案件）では、初回実行だけで既存 Markdown がそのまま HTML 化される。**既存 docs/ の分割・改名はしない**（document-catalog.md §7 の追記型導入ルール）
