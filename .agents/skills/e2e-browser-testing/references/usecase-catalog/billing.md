# UC-BILLING 標準ユースケースカタログ（課金・プラン管理）

**売上直結フロー**。Critical 度が全カタログ中で最も高い。**全件 Critical**として扱う。

## 目次

- UC-BILLING-01: Free → Pro アップグレード（Stripe Checkout）
- UC-BILLING-02: プラン変更（Pro → Enterprise）
- UC-BILLING-03: Customer Portal で支払方法変更
- UC-BILLING-04: 請求書ダウンロード（適格請求書要件確認）
- UC-BILLING-05: 決済失敗 → 復旧 → 自動課金
- UC-BILLING-06: トライアル終了 → 自動課金（Test Clock）

---

## UC-BILLING-01: Free → Pro アップグレード（Stripe Checkout）

**業務的意義**：**MRR 発生の瞬間**。CV から Activation までの最重要パス。これが壊れる＝売上 0。

**対応 FunctionalID**：`F-BILL-002` (Checkout 起動)、`F-BILL-003` (Webhook 受信)、`F-BILL-004` (プラン更新)

**対応 swim lane**：認証済みユーザー / Stripe Checkout / Stripe Webhook / Supabase Database

**前提**：
- ログイン済みユーザー（Free プラン）
- profiles.stripe_customer_id が存在
- Stripe Pro プランの price_id がテスト環境に存在（`price_test_pro_monthly`）
- Stripe CLI `stripe listen --forward-to localhost:3000/api/webhooks/stripe` を起動済み（ローカル）または GitHub Actions では Webhook 受信用の forwarder を別途用意

**シナリオ**：

```
Given: ログイン済みユーザー、Free プラン
When:  1. /pricing を開く
       2. Pro プランの「アップグレード」をクリック
       3. Stripe Checkout（外部 URL）にリダイレクト
       4. Stripe Checkout のフォーム（iframe）で以下を入力：
          - カード番号: 4242 4242 4242 4242（テスト用成功カード）
          - 有効期限: 12/34
          - CVC: 123
          - 郵便番号: 12345
       5. 「申し込む」ボタンをクリック
       6. /billing/success にリダイレクト
Then:  - URL が `/billing/success?session_id=cs_test_...` で始まる
       - 画面に「Pro プランへようこそ」表示
       - expect.poll（最大 30 秒）で以下を待機検証：
         * stripe.subscriptions.list({ customer }) で status='active' の subscription が 1 件
         * profiles.plan === 'pro' （Webhook 経由で更新）
         * profiles.subscription_id === sub_xxx
       - Stripe Dashboard（API）で Invoice が 1 件、paid 状態
```

**Stripe Checkout iframe の扱い**：
```ts
// Checkout は別ドメイン（checkout.stripe.com）にリダイレクトされる
await page.goto('/pricing');
await page.getByRole('button', { name: /Pro.*アップグレード/ }).click();

// Checkout ページに遷移を待つ
await page.waitForURL(/checkout\.stripe\.com/);

// カード入力フィールドは iframe 内
const cardFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
await cardFrame.getByPlaceholder('1234 1234 1234 1234').fill('4242424242424242');
// もしくは getByLabel('Card number') を試す（Stripe の i18n に注意）

await page.getByRole('button', { name: /Subscribe|申し込む/ }).click();
await page.waitForURL(/\/billing\/success/);
```

**Webhook 受信の待ち方**：
- Webhook は非同期。`waitForTimeout(5000)` は flaky 化 → `expect.poll` で DB ポーリング
- ローカル：Stripe CLI `stripe listen`
- CI：Stripe Test Helper の `confirmIntent` を直接呼ぶ、または Webhook を mock せず Stripe → ngrok 等で本物受信
- **Webhook 署名検証**は必ず実装側で実施（テストでも本物署名を通す）

**DB 検証ポイント**：
- `profiles.plan = 'pro'`
- `profiles.subscription_id` NOT NULL
- `profiles.current_period_end` 設定
- `subscriptions` テーブル（あれば）：status='active'、interval='month'

**Stripe API 検証ポイント**：
- `stripe.subscriptions.retrieve(sub_id).status === 'active'`
- `stripe.invoices.list({ customer, limit: 1 })` で最新が paid

**Critical な実装ミス**：
- Webhook 署名検証を省略 → 偽 Webhook で勝手にプラン昇格される
- Webhook 受信失敗時のリトライ未実装 → DB と Stripe の状態が永続的に不整合
- Customer Portal / Checkout の戻り URL の検証不足 → オープンリダイレクト脆弱性

**優先度**：🔴 Critical（**最重要**）

**実装ファイル**：`tests/e2e/usecases/billing-upgrade.spec.ts`

---

## UC-BILLING-02: プラン変更（Pro → Enterprise）

**業務的意義**：拡張売上の経路。プラン変更時の按分計算（proration）が正しいことが重要。

**対応 FunctionalID**：`F-BILL-005` (プラン変更)、`F-BILL-006` (按分計算)

**シナリオ**：

```
Given: ログイン済み、Pro プラン active、月の半ば
When:  1. /dashboard/billing を開く
       2. 「Enterprise にアップグレード」をクリック
       3. プラン変更確認モーダル：差額表示「今月の追加請求: ¥XXX」
       4. 「変更」をクリック
Then:  - subscription.items[0].price = price_test_enterprise_monthly
       - 当月分の差額 invoice が即時発行（または次回請求にまとめ）
       - profiles.plan === 'enterprise'
       - 機能制限が緩和される（例：データ件数上限が上がる）
```

**按分計算の検証**：
- 月の半ば (15日経過) でアップグレードした場合、差額 ≒ (Enterprise - Pro) / 2
- proration_behavior='create_prorations' になっているか

**優先度**：🔴 Critical

**実装ファイル**：`tests/e2e/usecases/billing-change-plan.spec.ts`

---

## UC-BILLING-03: Customer Portal で支払方法変更

**業務的意義**：カード期限切れ・カード変更時のユーザー自己対応。これが無いとサポート対応で運用負荷増。

**対応 FunctionalID**：`F-BILL-007` (Customer Portal 起動)

**シナリオ**：

```
Given: ログイン済み、Pro プラン、登録カード末尾 "4242"
When:  1. /dashboard/billing で「カード情報を変更」をクリック
       2. Stripe Customer Portal にリダイレクト（billing.stripe.com）
       3. 「Payment methods」→「Add payment method」
       4. 新カード "5555 5555 5555 4444"（Mastercard テスト）を追加
       5. デフォルトに設定
       6. アプリに戻る（Return URL）
Then:  - stripe.customers.retrieve(customer).invoice_settings.default_payment_method
         が新カードを指している
       - 旧カードは payment_methods に残る or 削除（要件次第）
       - 次回請求が新カードに対して実施される
```

**Customer Portal の制限**：
- カスタマイズ不可、Stripe Dashboard の Settings で項目 ON/OFF のみ
- ロケータが Stripe 側依存になるため、**最小限のスモーク**に留める
- 「Portal に到達できる」「戻れる」が担保できれば OK

**優先度**：🟡 Major（実機能は Stripe が担保）

**実装ファイル**：`tests/e2e/usecases/billing-portal-payment.spec.ts`

---

## UC-BILLING-04: 請求書ダウンロード（適格請求書要件確認）

**業務的意義**：**インボイス制度対応の法的要件**。野口さんの登録番号 T... が請求書 PDF に印字されていることを E2E で担保。

**対応 FunctionalID**：`F-BILL-008` (請求書一覧)、`F-BILL-009` (PDF ダウンロード)、`F-LEGAL-002` (適格請求書要件)

**シナリオ**：

```
Given: ログイン済み、過去に課金履歴あり（少なくとも 1 invoice paid）
When:  1. /dashboard/billing/invoices を開く
       2. 一覧から最新の invoice 行の「PDFダウンロード」をクリック
       3. ブラウザのダウンロードを待つ
Then:  - ダウンロードされた PDF ファイルが存在
       - PDF ファイル名が `invoice-${invoice_number}.pdf` 形式
       - PDF テキスト抽出（pdf-parse 等）で以下を検証：
         * 適格請求書発行事業者登録番号「T...」が記載
         * 発行者名（野口さんの事業者名）
         * 受領者名（profiles.company_name または display_name）
         * 税率別の合計額（10% / 8% / 0%）
         * 税抜額・消費税額・税込額
         * 発行日 / インボイス番号
       - HTTP 200、Content-Type が application/pdf
       - レスポンスサイズが 1KB 以上（空 PDF 防止）
```

**Playwright のダウンロード処理**：
```ts
const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: 'PDFダウンロード' }).click();
const download = await downloadPromise;
const path = await download.path();
// pdf-parse で内容検証
const pdfText = (await pdfParse(fs.readFileSync(path))).text;
expect(pdfText).toMatch(/T\d{13}/);  // 適格請求書発行事業者登録番号
expect(pdfText).toContain('野口さんの事業者名');
```

**Critical な実装ミス**：
- 適格請求書要件の項目漏れ（登録番号、税率別表示）→ 顧客側で仕入税額控除不可、法的問題
- PDF が画像 PDF（OCR 必要）になっている → 検索性低下

**優先度**：🔴 Critical

**実装ファイル**：`tests/e2e/usecases/billing-invoice-download.spec.ts`

---

## UC-BILLING-05: 決済失敗 → 復旧 → 自動課金

**業務的意義**：dunning（督促）フロー。失敗を放置すると解約に直結。

**対応 FunctionalID**：`F-BILL-011` (決済失敗ハンドリング)、`F-MAIL-004` (失敗通知)、`F-BILL-012` (Smart Retry)

**シナリオ**：

```
Given: ログイン済み、Pro 契約中、登録カードが "4000 0000 0000 0341"
       （Stripe テスト用「翌月の自動課金で失敗するカード」）
When:  1. 月初の自動課金タイミングが到来（Test Clock で時間圧縮）
       2. Stripe が課金試行 → 失敗
       3. profiles.plan は 'pro' のまま、ただし profiles.payment_status = 'past_due'
       4. ユーザーに「お支払いに失敗しました」メールが届く
       5. /dashboard を開くと警告バナー「お支払い情報をご確認ください」
       6. ユーザーが Customer Portal でカードを "4242..." に変更
       7. Stripe の Smart Retry または手動 retry で課金成功
Then:  - subscription.status === 'active' に戻る
       - profiles.payment_status = 'active'
       - 警告バナーが消える
       - invoice.status === 'paid'
```

**Test Clock の使い方**：
```ts
// テスト開始時に Customer を Test Clock で作成
const testClock = await stripe.testHelpers.testClocks.create({
  frozen_time: Math.floor(Date.now() / 1000),
});
// この Test Clock 上で Customer / Subscription を作成
// 月跨ぎを advance で再現
await stripe.testHelpers.testClocks.advance(testClock.id, {
  frozen_time: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
});
```

**優先度**：🔴 Critical（**売上維持の要**）

**実装ファイル**：`tests/e2e/usecases/billing-payment-failure.spec.ts`

---

## UC-BILLING-06: トライアル終了 → 自動課金（Test Clock）

**業務的意義**：トライアルの Conversion 計測の前提。トライアル終了時の自動課金が動かない＝CV 計測不可。

**対応 FunctionalID**：`F-BILL-013` (トライアル管理)

**シナリオ**：

```
Given: 新規登録、14 日トライアル開始
       subscription.status === 'trialing'
       subscription.trial_end が今日 + 14 日
When:  1. Test Clock で 14 日 + 1 時間進める
       2. Stripe が自動的にトライアル終了処理 → 課金試行
       3. Webhook で customer.subscription.updated イベント受信
Then:  - subscription.status === 'active'
       - invoice が 1 件発行 / paid
       - profiles.plan === 'pro'
       - profiles.trial_ends_at が過去日時
       - ユーザーに「トライアルが終了し、Pro プランに移行しました」メール
```

**優先度**：🔴 Critical（トライアル機能がある場合）

**実装ファイル**：`tests/e2e/usecases/billing-trial-conversion.spec.ts`

---

## カタログ全体の運用ルール

1. **必ず Stripe テストモード**：`sk_live_*` の使用は絶対禁止（自動チェック必須）
2. **Webhook は本物署名で**：`stripe.webhooks.constructEvent` の署名検証を mock しない
3. **Test Clock は時間操作の標準手段**：`waitForTimeout` で月跨ぎを待つのは不可能
4. **expect.poll で DB を見る**：Webhook は非同期、UI に出る前に DB を直接 poll
5. **適格請求書要件は法的要件**：UC-BILLING-04 のテストは PDF 内容まで検証
6. **Block 条件**：UC-BILLING-01 / -04 / -05 のいずれかが fail で実装バグ起因なら**即 No-Go**。デプロイ禁止
7. **Customer Portal のテスト範囲は最小限**：Stripe 側の UI に依存しないこと
