# 要件 ⇄ E2E トレーサビリティマトリクス

requirement-traceability-auditor が **Phase 13** で使用する突合の方法論。「業務フロー / 機能一覧で宣言したことが、本当にブラウザで再現できるか」を担保する。

## なぜ必要か

実装フェーズで「機能を作った／テスト書いた／ユニット緑」までは進んでも、以下が起きやすい：

- 機能一覧で宣言した FunctionalID のうち、**ユーザーがブラウザから到達できない機能**がある
- 業務フロー上の **swim lane アクター**（管理者・一般ユーザー・外部システム）のうち、一部がテストに登場しない
- 業務フローの**分岐**（承認/差戻し、成功/失敗、初回/再訪）のうち、**異常系・例外系の E2E が抜けている**

これらは Unit / Integration / 標準UCカタログ E2E のいずれでも検出しにくい。**「要件と現実のギャップ」を構造的に突合**するのが本書の役割。

## 2 軸の監査

### 軸1: 機能カバレッジ（FunctionalID × E2E）

`docs/10-business-design/feature-list.md` の全 FunctionalID（F-CATEGORY-NNN）について、対応する E2E テストが少なくとも 1 つ存在するかを表で突合。

#### マトリクス形式

```markdown
| FunctionalID | 機能名 | 優先度 | 対応 E2E ファイル | UC ID | 判定 |
|---|---|---|---|---|---|
| F-AUTH-001 | OAuthログイン | MUST | tests/e2e/usecases/login-oauth-existing.spec.ts | UC-LOGIN-01 | ✅ |
| F-AUTH-002 | Email/Password登録 | MUST | tests/e2e/usecases/signup-email.spec.ts | UC-SIGNUP-02 | ✅ |
| F-BILL-001 | Stripe Customer 自動作成 | MUST | tests/e2e/usecases/signup-stripe-customer.spec.ts | UC-SIGNUP-05 | ✅ |
| F-PROF-010 | プロバイダ追加 | SHOULD | - | - | ❌ 未カバー |
| F-DATA-005 | CSV エクスポート | MUST | - | - | ⛔ Critical 未カバー |
```

#### 判定ルール

| 状態 | アイコン | 説明 | 対応 |
|------|---------|------|------|
| ✅ | カバー | 少なくとも 1 つの E2E あり | OK |
| ⚠️ | 部分カバー | 正常系のみで異常系欠落 | Warning |
| ❌ | 未カバー | E2E 無し（優先度 SHOULD/COULD） | Warning |
| ⛔ | Critical 未カバー | MUST なのに E2E 無し | **Block** |

#### Block 条件

優先度 MUST かつ次のいずれかなら Block：
- 対応 E2E が `tests/e2e/` 配下に 1 つも存在しない
- 対応 E2E が存在するが、最新 Phase 12 実行で fail / skip 状態

### 軸2: 業務フローカバレッジ（business-flow.md × E2E）

`docs/10-business-design/business-flow.md` の To-Be フロー図から、以下を抽出：

1. **登場アクター**（swim lane）：未認証ユーザー、認証済みユーザー、管理者、システム、外部 API（Stripe / Google OAuth / メール配信）等
2. **分岐ポイント**：承認/差戻、決済成功/失敗、初回/再訪、権限あり/なし、トライアル中/契約後、退会前/退会後 等

これらが E2E でカバーされているかを突合。

#### アクターマトリクス

```markdown
| アクター | 対応 storageState | 代表 UC | 判定 |
|---------|------------------|---------|------|
| 未認証ユーザー | （cookies: []） | UC-SIGNUP-01, UC-LOGIN-05 | ✅ |
| 認証済み一般ユーザー | playwright/.auth/user.json | UC-PROFILE-01, UC-BILLING-01 | ✅ |
| 管理者 | playwright/.auth/admin.json | UC-PERM-02 | ✅ |
| Stripe Webhook（システム） | API テスト | UC-BILLING-01, UC-WITHDRAW-02 | ✅ |
| 外部 OAuth プロバイダ | admin 代替 | UC-SIGNUP-01 | ⚠️ admin 代替で flaky 回避 |
| メール配信（Inbucket） | helpers/mail.ts | UC-LOGIN-04, UC-PROFILE-02 | ✅ |
```

#### 分岐マトリクス

```markdown
| 業務フロー分岐 | 正常系 E2E | 異常系 E2E | 判定 |
|---------------|----------|----------|------|
| ログイン正誤 | UC-LOGIN-02 | UC-LOGIN-03 | ✅ |
| 利用規約同意 | UC-SIGNUP-02 | UC-SIGNUP-04 | ✅ |
| 決済成功/失敗 | UC-BILLING-01 | UC-BILLING-05 | ✅ |
| 退会即時/期末 | UC-WITHDRAW-02（即時） | （期末未対応） | ⚠️ |
| 権限あり/なし | （admin） | UC-PERM-01, UC-PERM-02 | ✅ |
| トライアル → 契約 | UC-BILLING-06 | （課金失敗時の扱い未対応） | ⚠️ |
| 退会後の再ログイン | - | UC-WITHDRAW-04 | ✅ |
```

#### Block 条件

「金額・権限・退会」系分岐で**異常系 E2E が欠落している**場合は Block：
- 決済失敗のリトライ経路（UC-BILLING-05 系）
- 権限境界の侵害試行（UC-PERM-01 / -02）
- 退会後のアクセス制御（UC-WITHDRAW-04）

## 監査の手順

requirement-traceability-auditor が以下の順序で実施：

```
1. feature-list.md を Read
   → 全 FunctionalID と優先度を抽出（テーブルパースまたは Grep）

2. business-flow.md を Read
   → swim lane と分岐を抽出（Mermaid から目視 or 構造解析）

3. e2e-scenarios.md を Read
   → 全 UC-XXX-NN とその対応 FunctionalID を抽出

4. tests/e2e/usecases/*.spec.ts を Glob → Grep
   → 実装済み E2E ファイルを把握
   → 各 spec ファイル内の test.describe / test ブロックを抽出

5. 直近 Phase 12 レポート docs/41-test-results/usecase-e2e-*.md を Read
   → pass / fail / skip ステータスを抽出

6. 突合
   - FunctionalID → E2E 対応関係マトリクス生成
   - 業務フロー swim lane / 分岐 → E2E 対応関係マトリクス生成
   - Block 条件に該当するものをリストアップ

7. レポート生成
   docs/41-test-results/traceability-audit-YYYYMMDD-HHMM.md
```

## レポートテンプレート

```markdown
# 要件トレーサビリティ監査レポート YYYY-MM-DD HH:MM

## 1. サマリー

| 項目 | 値 |
|------|---|
| 監査対象 FunctionalID 数 | NN |
| ✅ カバー | XX |
| ⚠️ 部分カバー / 未カバー（Should） | YY |
| ⛔ Critical 未カバー（Must） | ZZ |
| 監査対象 swim lane | N |
| swim lane カバー率 | XX / N |
| 業務フロー分岐 | M |
| 分岐の正常系カバー率 | XX / M |
| 分岐の異常系カバー率 | YY / M |

## 2. 機能カバレッジマトリクス

（FunctionalID × E2E の全件表）

## 3. 業務フローカバレッジマトリクス

### アクター
（アクターマトリクス）

### 分岐
（分岐マトリクス）

## 4. ⛔ Block 項目

1. F-DATA-005 (CSV エクスポート) - Critical 未カバー
   → e2e-usecase-tester に「`tests/e2e/usecases/data-export.spec.ts` を追加」を依頼
2. 分岐「退会期末解約」が異常系含めて未カバー
   → business-flow.md を確認、要件として「即時のみ」なら OK、両方なら e2e 追加

## 5. ⚠️ Warning 項目

（同様）

## 6. アクションアイテム

| ID | 内容 | 担当 | 期限目安 |
|----|------|-----|---------|
| ACT-001 | F-DATA-005 の E2E 追加 | e2e-usecase-tester | Phase 12 再実行前 |
| ACT-002 | F-PROF-010 の E2E 追加 | e2e-usecase-tester | 次イテレーション |

## 7. Go/No-Go 判断

### 判定: 🟢 Go / 🟡 Conditional / 🔴 No-Go

### 根拠
- 全 MUST 機能がカバー済み（または）
- Critical 1件未カバー → No-Go、Phase 11/12 差し戻し

### Phase 14（implementation-reviewer）への申し送り
- 重点レビュー観点
- 既知の限界
```

## アンチパターン

1. **マトリクス作成だけして Block 判定を出さない** → ただの一覧、ゲートとして機能しない
2. **未実装機能をカバレッジに含める** → MVP スコープ外なら feature-list.md 側で除外マーク
3. **FunctionalID と UC を 1:1 で対応させようとする** → 1 UC が複数 F をカバーする / 1 F が複数 UC で部分検証される、は普通
4. **業務フローのアクター抽出を Mermaid からの目視に頼る** → セルフチェックリストで補完、可能なら Mermaid CLI でパース
5. **Phase 12 レポート未存在で実行する** → Phase 12 を待つ、または「Phase 12 未完了のため監査不可」とレポートして Block

## requirement-traceability-auditor 以外のエージェントとの連携

| 相手 | 連携内容 |
|-----|---------|
| test-planner | カタログ初版段階で `e2e-scenarios.md` に FunctionalID 列を含めるよう責務追加 |
| test-plan-reviewer | レビュー観点に「全 MUST FunctionalID が UC として宣言されているか」を追加 |
| e2e-usecase-tester | 監査結果のアクション項目を受け取り、追加 UC を生成・実行 |
| implementation-reviewer | Phase 14 のレビュー対象に traceability-audit-*.md を必ず含める |
| project-manager | Block 時に Phase 11 / 12 への差し戻しを判断 |

## 軸③④（画面・APIカバレッジ）について

本書では**スコープ外**。将来拡張時は本ファイル末尾に節を追加：

- ③ 画面カバレッジ：screen-list.md × Playwright trace 解析（URL 集計）
- ④ APIカバレッジ：openapi.yaml × Playwright trace 解析（リクエスト URL 集計）

これらは trace から自動抽出可能だが、Playwright trace の構造を解析するスクリプトが必要なため、現バージョンでは見送り。
