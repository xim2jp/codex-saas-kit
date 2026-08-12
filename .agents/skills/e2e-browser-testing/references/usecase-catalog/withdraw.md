# UC-WITHDRAW 標準ユースケースカタログ（退会）

**法務・データ保護・売上停止の交差点**。退会フローが壊れていると個人情報保護法・解約クレームの両面でリスク。

## 目次

- UC-WITHDRAW-01: 退会フォーム → 確認 → 退会実行
- UC-WITHDRAW-02: 退会時に Stripe Subscription が解約される
- UC-WITHDRAW-03: 退会後にデータが論理削除されている
- UC-WITHDRAW-04: 退会済みメアドで再ログイン → 不可表示
- UC-WITHDRAW-05: 退会済みメアドで再登録 → 新規アカウントとして可（または不可、要件次第）

---

## UC-WITHDRAW-01: 退会フォーム → 確認 → 退会実行

**業務的意義**：自己解約経路。これが無いとサポート対応コストが跳ねる。

**対応 FunctionalID**：`F-WITHDRAW-001` (退会フォーム)、`F-WITHDRAW-002` (退会確認)、`F-WITHDRAW-003` (退会実行)

**対応 swim lane**：認証済みユーザー / Supabase Database / Stripe API / メール配信

**前提**：
- ログイン済みユーザー
- 有料プラン中 or 無料プラン
- 退会フォームに reason (理由選択) と feedback (フリーテキスト) がある

**シナリオ**：

```
Given: ログイン済みユーザー、Pro プラン active
When:  1. /dashboard/settings/account を開く
       2. 「退会する」リンクをクリック
       3. /dashboard/withdraw に遷移
       4. 退会理由を選択（「機能が足りない」等）
       5. フリーコメント記入（任意）
       6. 「退会を確認」をクリック
       7. 確認モーダル「本当に退会しますか？データは復元できません」表示
       8. 「退会する」を再クリック
Then:  - /withdraw/completed に遷移、「ご利用ありがとうございました」表示
       - ブラウザのセッションが破棄される（Cookie 削除）
       - 退会理由が DB に保存（withdraw_reasons テーブル等、改善材料）
       - 退会完了メールが送信される
       - 後続テスト前提：このユーザーは退会済み
```

**UI 観点の Critical 要素**：
- **2 ステップ（フォーム → 確認モーダル）**：誤クリック防止
- **確認モーダルの文言が明確**：「データは復元できません」を必ず明記
- **退会理由は任意で良いが、内訳分析のため記録は必須**

**Test Setup の注意**：
- **storageState を使い回さない**：退会後はログアウト状態を検証する必要
- このテストは**専用テストユーザー**で実行（共有 storageState 汚染防止）
- `test.use({ storageState: { cookies: [], origins: [] } })` で空状態スタート、テスト内でログイン → 退会

**優先度**：🔴 Critical

**実装ファイル**：`tests/e2e/usecases/withdraw-flow.spec.ts`

---

## UC-WITHDRAW-02: 退会時に Stripe Subscription が解約される

**業務的意義**：**請求停止の責務**。これが漏れると退会後も課金が続いてクレーム → 返金対応 → 信用毀損。

**対応 FunctionalID**：`F-WITHDRAW-004` (Stripe 解約)、`F-BILL-014` (即時解約 or 期末解約)

**対応 swim lane**：システム / Stripe API

**前提**：
- ログイン済みユーザー、Pro プラン active
- subscription.status === 'active'、cancel_at_period_end === false

**シナリオ**：

```
Given: 上記前提
When:  UC-WITHDRAW-01 のフローで退会実行
Then:  expect.poll で最大 30 秒、以下を待機検証：
       - stripe.subscriptions.retrieve(sub_id) で：
         * status === 'canceled'（即時解約の場合）
           or cancel_at_period_end === true（期末解約の場合）
         * canceled_at が NOT NULL
       - profiles.plan === 'free' or 'canceled'
       - profiles.subscription_id === NULL（または canceled 状態）
       - 当月分の残期間料金が按分返金されている（要件次第）
         stripe.refunds.list({ customer }) で確認
```

**実装パターン**：
- **即時解約**：`stripe.subscriptions.cancel(sub_id)` → 即 canceled
- **期末解約**：`stripe.subscriptions.update(sub_id, { cancel_at_period_end: true })` → 課金期間終了で canceled
- どちらを採用するかは要件次第。両方対応する場合は分岐テスト

**Critical な実装ミス**：
- Stripe 解約 API の呼び忘れ
- API エラー時のリトライ未実装
- DB 退会更新だけ成功して Stripe 解約が漏れる → **退会後も継続課金**

**優先度**：🔴 Critical（**最重要**、これが壊れると深刻な顧客トラブル）

**実装ファイル**：`tests/e2e/usecases/withdraw-stripe-cancel.spec.ts`

---

## UC-WITHDRAW-03: 退会後にデータが論理削除されている

**業務的意義**：データ保護法（GDPR / 個人情報保護法）対応。物理削除 or 論理削除＋一定期間後物理削除のいずれか。

**対応 FunctionalID**：`F-WITHDRAW-005` (データ削除)、`F-LEGAL-003` (保持期間)

**シナリオ**：

```
Given: UC-WITHDRAW-01 後の状態
When:  退会完了後、admin API で profiles テーブルを直接確認
Then:  - profiles.deleted_at が NOT NULL（論理削除）
         or profiles から物理削除されている（要件次第）
       - profiles.email が anonymize されている（個人情報マスキング）
         例：deleted-{user_id}@anonymized.local
       - profiles.display_name = '退会済みユーザー' or NULL
       - 関連データ（ユーザー生成物）の扱いが要件通り：
         * 完全削除パターン
         * 匿名化パターン（user_id を NULL or 'anonymous' に置換）
         * 保持パターン（請求関連は税法で 7 年保持）
       - auth.users から削除（Supabase Auth、`supabase.auth.admin.deleteUser`）
       - storage に user_id 紐付けファイルがあれば削除
```

**論理削除を選んだ場合の検証**：
- 削除後の SELECT で deleted_at IS NULL のフィルタが効いている（RLS）
- アプリ側のクエリ全部に `WHERE deleted_at IS NULL` が入っている

**監査ログの保持**：
- 退会の事実とタイミングは保持（誰がいつ退会したかは法務監査で必要）
- ただし個人情報自体は削除/匿名化

**優先度**：🔴 Critical

**実装ファイル**：`tests/e2e/usecases/withdraw-data-deletion.spec.ts`

---

## UC-WITHDRAW-04: 退会済みメアドで再ログイン → 不可表示

**業務的意義**：UX 上の誠実さ。「ログインできない原因が分からない」は最悪。

**対応 FunctionalID**：`F-AUTH-002`、`F-WITHDRAW-006` (退会済み判定)

**シナリオ**：

```
Given: UC-WITHDRAW-01 後の状態、メアド deleted@example.test
When:  /login で deleted@example.test と元のパスワードでログイン試行
Then:  - エラー表示「このアカウントは退会済みです」または「ログイン情報が正しくありません」
       - /dashboard に遷移しない
       - 404 / 500 にならない（適切なエラーハンドリング）
```

**実装パターン**：
- **論理削除＋auth.users 残存**：ログイン時に profiles.deleted_at で弾く
- **物理削除**：auth.users 自体が無いので通常のログイン失敗エラー

**Critical な実装ミス**：
- 退会判定漏れ → 退会後もログインできてしまい、データが見える / 操作できる

**優先度**：🟡 Major

**実装ファイル**：`tests/e2e/usecases/withdraw-relogin-blocked.spec.ts`

---

## UC-WITHDRAW-05: 退会済みメアドで再登録 → 新規アカウントとして可（または不可、要件次第）

**業務的意義**：再利用許可ポリシーを E2E で固定。要件で「再登録可」「クールダウン期間あり」「再登録不可」を選択。

**対応 FunctionalID**：`F-AUTH-002`、`F-WITHDRAW-007` (再登録ポリシー)

**シナリオ A: 再登録可（最も一般的）**：

```
Given: UC-WITHDRAW-01 後の状態
When:  /signup で同じメアド deleted@example.test で登録
Then:  - 新規ユーザーとして登録成功
       - 別の user_id で profiles レコード作成
       - 旧データには一切アクセスできない
       - 新しい Stripe Customer が作成される（旧 Customer は再利用しない）
```

**シナリオ B: クールダウン期間あり**：

```
Given: 退会から 30 日未満
When:  /signup で同じメアドで登録
Then:  - エラー「退会から 30 日経過後にご利用ください」
```

**シナリオ C: 再登録不可**：

```
Given: 退会済みメアド
When:  /signup で同じメアドで登録
Then:  - エラー「このメアドはご利用いただけません」
```

**優先度**：🟢 Minor（要件次第で Major 昇格）

**実装ファイル**：`tests/e2e/usecases/withdraw-resignup.spec.ts`

---

## カタログ全体の運用ルール

1. **storageState を使い回さない**：退会前後の状態遷移を見るため、専用テストユーザーで毎回新規ログイン
2. **Stripe 解約は Critical 中の Critical**：UC-WITHDRAW-02 が落ちたら**絶対デプロイ禁止**
3. **論理削除 vs 物理削除の要件確認**：実装方針を `auth-design.md` または `data-model.md` で固定してから E2E 化
4. **再登録ポリシー要件**：A / B / C のどれを採用するかを `business-flow.md` で明示してから E2E 化
5. **Test Helper でクリーンアップ**：テスト後に Stripe Customer / Supabase User を完全削除
6. **個人情報マスキングの検証**：UC-WITHDRAW-03 で deleted-${user_id}@anonymized.local 形式になっているか正規表現で確認
7. **Block 条件**：UC-WITHDRAW-02 / -03 のいずれかが fail かつ実装バグ起因なら**即 No-Go**
