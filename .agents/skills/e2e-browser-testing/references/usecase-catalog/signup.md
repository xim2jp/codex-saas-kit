# UC-SIGNUP 標準ユースケースカタログ（新規登録）

SaaS の **CV 経路の主導線**。ここが壊れると新規ユーザーが入れない＝売上 0。**全件 Critical**。

## 目次

- UC-SIGNUP-01: OAuth 新規登録 → ダッシュボード初期表示
- UC-SIGNUP-02: Email/Password 新規登録 → メアド検証 → 初回ログイン
- UC-SIGNUP-03: 既存メアドで登録 → エラー表示・ログイン誘導
- UC-SIGNUP-04: 利用規約未同意で送信 → バリデーション
- UC-SIGNUP-05: 登録直後に Stripe Customer が作成されている（DB 検証）

---

## UC-SIGNUP-01: OAuth 新規登録 → ダッシュボード初期表示

**業務的意義**：CV 経路の主導線。ここが壊れると新規ユーザーが入れない＝売上 0。

**対応 FunctionalID**：`F-AUTH-001` (OAuthログイン)、`F-AUTH-010` (プロビジョニング)、`F-BILL-001` (Stripe Customer 自動作成)

**対応 swim lane**：未認証ユーザー / システム / Supabase Auth / Stripe API

**前提**：
- Google OAuth が設定済み（テスト環境のクライアント ID / Secret）
- Supabase Auth で google プロバイダが有効
- Stripe テストモード接続済み（`sk_test_*`）
- DB が空、または該当テストユーザーが存在しないこと（`afterEach` でクリーンアップ）

**シナリオ（Given/When/Then）**：

```
Given: 未登録のテストユーザー（テスト用 Google アカウント）
       かつ ブラウザに有効セッション無し
When:  1. ランディングページ `/` を開く
       2. 「Google で登録」ボタンをクリック
       3. Google OAuth 同意画面で承認（または Supabase admin で代替）
       4. アプリの /auth/callback にリダイレクト
       5. /dashboard へ遷移
Then:  - URL が `/dashboard` で終わっている
       - profiles テーブルに該当 user_id のレコードが作成されている
       - profiles.email が Google アカウントのメアドと一致
       - profiles.stripe_customer_id が NOT NULL
       - Stripe Customer API で取得した customer.email が profiles.email と一致
       - 画面に「ようこそ、{name} さん」が表示される
       - セッション Cookie が HttpOnly / Secure / SameSite=Lax で発行されている
```

**DB 検証ポイント**：
- `profiles` テーブル：`user_id`, `email`, `display_name`, `stripe_customer_id`, `created_at`
- `auth.users`（Supabase）：`email`, `email_confirmed_at`（OAuth は即時 confirmed）
- `auth.identities`：provider='google'、identity_data に Google sub

**Stripe 検証ポイント**：
- `stripe.customers.retrieve(stripe_customer_id)` で取得可能
- `customer.email === profiles.email`
- `customer.metadata.supabase_user_id === user_id`

**想定ロケータ案**：
```ts
page.getByRole('link', { name: '無料で始める' })          // CTA
page.getByRole('button', { name: /Google.*で.*(登録|始める)/ })
page.getByRole('heading', { name: 'ダッシュボード' })     // 遷移後の見出し
page.getByText(/ようこそ/)                                // ウェルカム
```

**OAuth E2E の現実的扱い**：実プロバイダで E2E すると Google 側の reCAPTCHA / 異常検知で flaky 化するため、`supabase.auth.admin.createUser({ email_confirm: true, app_metadata: { provider: 'google' } })` で代替し、storageState を生成。**テストコードのコメントで「OAuth は Supabase admin で代替」と明示**する。

**優先度**：🔴 Critical

**実装ファイル**：`tests/e2e/usecases/signup-oauth.spec.ts`

---

## UC-SIGNUP-02: Email/Password 新規登録 → メアド検証 → 初回ログイン

**業務的意義**：OAuth に頼れない法人ユーザー・社内アカウントの登録経路。

**対応 FunctionalID**：`F-AUTH-002` (Email/Password 登録)、`F-AUTH-003` (メアド検証)、`F-MAIL-001` (検証メール送信)

**対応 swim lane**：未認証ユーザー / システム / Supabase Auth / メール配信（Resend / SendGrid 等）

**前提**：
- Supabase Auth で email プロバイダが有効、`Confirm email = true`
- メール送信は **Inbucket（Supabase ローカル）** または **Mailosaur** を使用してテスト
- パスワード強度ポリシー（最低 8 文字、英数字混在等）の要件確認

**シナリオ**：

```
Given: 未登録のメアド ${email = `test+${parallelIndex}-${Date.now()}@example.test`}
When:  1. /signup を開く
       2. メアドとパスワードを入力、利用規約に同意
       3. 「登録」をクリック
       4. 「メールを確認してください」画面が表示される
       5. Inbucket / Mailosaur API でメール本文から検証 URL を取得
       6. 検証 URL を別タブで開く
       7. 「メアド確認完了」画面が表示される
       8. 「ログインへ」をクリック → /login
       9. 同じメアド・パスワードでログイン
Then:  - /dashboard に遷移
       - auth.users.email_confirmed_at が NOT NULL
       - profiles レコードが作成されている
       - 検証メールが 1 通だけ送られている（再送ボタン未押下）
```

**DB 検証ポイント**：
- `auth.users.email_confirmed_at` が NOT NULL
- `auth.users.confirmation_sent_at` < `email_confirmed_at`
- `profiles` がトリガまたは Server Action で作成済み

**メール検証ポイント**：
- 送信元アドレスが noreply@${domain}
- 件名に「メアド確認」「Verify」等の業務文言
- 本文の URL が `${SITE_URL}/auth/confirm?token_hash=...` 形式

**想定ロケータ案**：
```ts
page.getByLabel('メールアドレス')
page.getByLabel('パスワード')
page.getByRole('checkbox', { name: /利用規約.*同意/ })
page.getByRole('button', { name: '登録' })
page.getByText(/メールを確認/)
```

**優先度**：🔴 Critical

**実装ファイル**：`tests/e2e/usecases/signup-email.spec.ts`

---

## UC-SIGNUP-03: 既存メアドで登録 → エラー表示・ログイン誘導

**業務的意義**：UX 上の正しさ。エラー表示が乱雑だと離脱率が跳ねる。情報漏洩リスクも（メアドの存在有無が分かるためタイミング攻撃）。

**対応 FunctionalID**：`F-AUTH-002`、`F-AUTH-020` (重複検出)

**対応 swim lane**：未認証ユーザー / Supabase Auth

**前提**：
- `existing@example.test` が既に登録済み（`beforeEach` で `supabase.auth.admin.createUser`）

**シナリオ**：

```
Given: 既存ユーザー existing@example.test が登録済み
When:  /signup で同じメアドを入力して送信
Then:  - エラーメッセージ「このメアドは既に登録されています」が表示される
       - 「ログインへ」ボタン or リンクが提示される
       - サーバーレスポンス時間が ${通常登録時の応答時間} ± 200ms に収まる
         （タイミング攻撃対策、登録/重複で大きく時間差が出ないこと）
       - auth.users / profiles に新規レコードが作成されていない
```

**セキュリティ観点**：
- エラーメッセージは「メアドまたはパスワードが正しくありません」のような曖昧表現にする要件があるならそちらを優先（要件次第）
- 一般的な SaaS は「既に登録されています」を表示してログイン誘導を優先する（UX > 厳密なセキュリティ）

**想定ロケータ案**：
```ts
page.getByRole('alert')                                   // エラー領域
page.getByText(/既に登録/)
page.getByRole('link', { name: /ログイン/ })
```

**優先度**：🟡 Major

**実装ファイル**：`tests/e2e/usecases/signup-duplicate-email.spec.ts`

---

## UC-SIGNUP-04: 利用規約未同意で送信 → バリデーション

**業務的意義**：法的要件（利用規約・プライバシーポリシー同意の明示取得）。法務監査時に E2E で証跡が出せる。

**対応 FunctionalID**：`F-AUTH-002`、`F-LEGAL-001` (規約同意)

**前提**：
- 利用規約・プライバシーポリシーのチェックボックスが /signup に存在

**シナリオ**：

```
Given: /signup を開いた状態
When:  メアド・パスワード入力するが、利用規約のチェックボックスは未チェックのまま「登録」ボタンをクリック
Then:  - 「登録」ボタンが disabled、または
         クリック時に「利用規約に同意してください」エラーが表示される
       - API リクエストが送信されていない（page.on('request') で監視）
       - auth.users / profiles にレコードが作成されていない
```

**想定ロケータ案**：
```ts
page.getByRole('button', { name: '登録' }).isDisabled()
page.getByRole('checkbox', { name: /利用規約/ })
page.getByText(/同意してください/)
```

**優先度**：🟡 Major

**実装ファイル**：`tests/e2e/usecases/signup-tos-validation.spec.ts`

---

## UC-SIGNUP-05: 登録直後に Stripe Customer が作成されている（DB 検証）

**業務的意義**：登録直後の課金導線を成立させるためのデータ整合性。Stripe Customer が無いと後続の Checkout / Customer Portal が動かない。

**対応 FunctionalID**：`F-BILL-001` (Stripe Customer 自動作成)、`F-AUTH-010` (プロビジョニング)

**対応 swim lane**：システム / Supabase Database / Stripe API

**前提**：
- UC-SIGNUP-01 または UC-SIGNUP-02 の登録直後の状態
- 実装が「DB トリガで作成」「Server Action で同期作成」「Webhook で非同期作成」のいずれかを把握しておく

**シナリオ**：

```
Given: UC-SIGNUP-01 / UC-SIGNUP-02 と同じ前提
When:  登録完了 → /dashboard 到達
Then:  expect.poll で最大 10 秒間以下を待機・検証
       - profiles.stripe_customer_id が NOT NULL になる
       - stripe.customers.retrieve(profiles.stripe_customer_id) が成功
       - customer.email === profiles.email
       - customer.metadata.supabase_user_id === user.id
       - customer.metadata.signup_source === 'web' (or 期待値)
```

**非同期作成（Webhook 経由）の場合の注意**：
- 即時検証だと race condition で fail する → `expect.poll` で最大 10 秒待つ
- Webhook が Stripe → Supabase Edge Function 経由なら、Stripe CLI `stripe listen` をローカルで起動

**Stripe テストモードの掃除**：
- `afterEach` で `stripe.customers.del(customer.id)` を呼び、テストデータを残さない
- 並列実行時は `testInfo.parallelIndex` でメアドを分けて衝突回避

**優先度**：🔴 Critical（課金経路の前提条件）

**実装ファイル**：`tests/e2e/usecases/signup-stripe-customer.spec.ts`

---

## カタログ全体の運用ルール

1. **案件で要らないものは省略可**：例えば「Email/Password を使わず OAuth のみ」なら UC-SIGNUP-02 はスキップ。ただし `e2e-scenarios.md` に**スキップ理由を明記**する。
2. **追加 UC は同じテンプレ**：プロジェクト固有の登録経路（招待リンク経由、SSO 経由、LINE 経由等）は UC-SIGNUP-10 以降を採番。
3. **Critical の Block 条件**：UC-SIGNUP-01 / -02 / -05 のいずれかが fail かつ実装バグ起因なら、即 No-Go → Phase 11 差し戻し。
4. **テストユーザーの命名規約**：`signup-${parallelIndex}-${Date.now()}@${TEST_EMAIL_DOMAIN}` で衝突回避（`helpers/users.ts` 参照）。
