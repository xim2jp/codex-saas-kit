# Stripe E2E Pattern

Stripe Checkout（iframe）の操作、Test Clocks による時間圧縮、Webhook 配信を E2E に組み込むパターン。

## 前提知識

- 本物の Stripe Checkout は別ドメイン（`checkout.stripe.com`）に遷移する
- カード入力欄は**iframe 内**にある（PCI DSS のため）
- テストモード（`sk_test_*`）では `4242 4242 4242 4242` 等が使える
- Webhook は外部からの POST なので、ローカル受信には `stripe listen` が必要

## 1. 価格ページ → Checkout → 課金成功

```ts
// tests/e2e/critical/checkout.spec.ts
import { test, expect } from '@playwright/test';

test('Pro プラン購入', async ({ page }) => {
  await page.goto('/pricing');

  // Checkout に遷移
  await page.getByRole('button', { name: 'Pro プランを購入' }).click();
  await page.waitForURL(/checkout\.stripe\.com/);

  // メアド入力（Customer ID を渡していない場合）
  await page.getByLabel('Email').fill('e2e-buyer@example.test');

  // === カード番号は iframe 内 ===
  const cardFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
  await cardFrame.getByPlaceholder('1234 1234 1234 1234').fill('4242424242424242');
  await cardFrame.getByPlaceholder('MM / YY').fill('12 / 30');
  await cardFrame.getByPlaceholder('CVC').fill('123');

  // 名義
  await page.getByLabel('Cardholder name').fill('TARO YAMADA');

  // 国・郵便番号
  await page.getByLabel('Country').selectOption('JP');

  // 決定
  await page.getByRole('button', { name: 'Subscribe' }).click();

  // 戻ってくる
  await page.waitForURL(/\/checkout\/success/, { timeout: 30_000 });
  await expect(page.getByText('ご購入ありがとうございます')).toBeVisible();
});
```

### iframe ロケータの落とし穴

Stripe の iframe 構造は変わりやすい。**`__privateStripeFrame` 接頭辞は安定**だが、複数あることが多い：

```ts
// すべての Stripe iframe を取得
const frames = page.frames().filter(f => f.url().includes('js.stripe.com'));

// カード番号入力欄を持つ iframe を探す
for (const frame of frames) {
  const cardInput = frame.locator('[name="cardnumber"], [placeholder*="1234"]');
  if (await cardInput.count() > 0) {
    await cardInput.fill('4242424242424242');
    break;
  }
}
```

## 2. 3DSecure チャレンジ

`4000 0027 6000 3184` などのチャレンジカードを使うと 3DS 画面が出る：

```ts
await cardFrame.getByPlaceholder('1234 1234 1234 1234').fill('4000002760003184');
// ... 残り入力 ...
await page.getByRole('button', { name: 'Subscribe' }).click();

// 3DS の iframe
const challengeFrame = page.frameLocator('iframe[name="stripe-challenge-frame"]');
await challengeFrame.getByRole('button', { name: 'Complete authentication' }).click();
```

### よく使うテストカード

| カード番号 | 挙動 |
|----------|------|
| `4242424242424242` | 成功 |
| `4000000000000002` | カード拒否（generic decline） |
| `4000000000009995` | 残高不足 |
| `4000002760003184` | 3DS 必須 |
| `4000000000000341` | Subscription 作成は OK、初回課金で fail |

完全な一覧：https://docs.stripe.com/testing#cards

## 3. Webhook を絡めたフロー

Stripe Checkout 成功後、Webhook で **Supabase に subscription を反映**する設計が一般的。E2E で「課金成功 → ユーザーが有料機能を使える」までを検証するには Webhook が必要。

### 方法 A: `stripe listen` を Playwright と並走

```ts
// playwright.config.ts
export default defineConfig({
  webServer: [
    { command: 'npm run dev', url: 'http://localhost:3000' },
    {
      // Stripe CLI で Webhook を localhost に転送
      command: 'stripe listen --forward-to localhost:3000/api/webhooks/stripe',
      url: 'http://localhost:3000/api/webhooks/stripe',
      reuseExistingServer: true,
    },
  ],
});
```

事前に `stripe login` 済みである必要がある。CI では `STRIPE_API_KEY` 環境変数 + `--api-key` で対応：

```yaml
- run: |
    stripe listen --forward-to localhost:3000/api/webhooks/stripe \
      --api-key ${{ secrets.STRIPE_TEST_API_KEY }} &
    sleep 3
```

### 方法 B: Webhook を直接 POST（最速、CI 安定）

実際の Stripe を経由せず、ペイロードを自前で組んで POST：

```ts
import Stripe from 'stripe';
import crypto from 'crypto';

async function fireWebhook(eventType: string, data: any) {
  const payload = JSON.stringify({
    id: 'evt_test',
    type: eventType,
    data: { object: data },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET!)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  await fetch('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'stripe-signature': `t=${timestamp},v1=${signature}`,
      'content-type': 'application/json',
    },
    body: payload,
  });
}

test('checkout.session.completed → アクティベーション', async ({ page }) => {
  // 課金前の状態
  await page.goto('/dashboard');
  await expect(page.getByText('Free プラン')).toBeVisible();

  // Webhook を発火
  await fireWebhook('checkout.session.completed', {
    customer: 'cus_test_xxx',
    subscription: 'sub_test_xxx',
    metadata: { user_id: 'user_test_xxx' },
  });

  // 反映を待つ
  await page.reload();
  await expect(page.getByText('Pro プラン')).toBeVisible();
});
```

## 4. Test Clocks — 時間圧縮

月跨ぎ・年跨ぎ・トライアル終了をリアルタイム待ちなしで再現。

```ts
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

test('14 日トライアル → 課金', async ({ page }) => {
  // (1) Test Clock 作成（現在時刻）
  const clock = await stripe.testHelpers.testClocks.create({
    frozen_time: Math.floor(Date.now() / 1000),
    name: 'e2e-trial-test',
  });

  // (2) Test Clock 付きで Customer 作成
  const customer = await stripe.customers.create({
    email: 'e2e-trial@example.test',
    test_clock: clock.id,
  });

  // (3) Subscription 作成（14 日トライアル）
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: process.env.PRICE_PRO! }],
    trial_period_days: 14,
  });

  // (4) UI を開く（トライアル中の表示確認）
  await page.goto('/dashboard');
  await expect(page.getByText('トライアル中')).toBeVisible();

  // (5) 時計を 15 日進める（トライアル終了をシミュレート）
  await stripe.testHelpers.testClocks.advance(clock.id, {
    frozen_time: Math.floor(Date.now() / 1000) + 15 * 86400,
  });

  // (6) Webhook がたくさん飛ぶ → 自前 listener で処理を待つ
  await waitForWebhook('invoice.payment_succeeded');

  // (7) UI を確認
  await page.reload();
  await expect(page.getByText('Pro プラン（有料）')).toBeVisible();

  // (8) Cleanup
  await stripe.testHelpers.testClocks.del(clock.id);
});
```

### Webhook 完了を待つ

Test Clock の `advance` は**非同期**に Webhook を発火する。完了を待たないと UI 反映前にアサートして fail する：

```ts
// helpers/wait-for-webhook.ts
export async function waitForWebhook(eventType: string, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // 自前で記録した webhook 受信ログをポーリング（DB or in-memory）
    const received = await db.webhookLog.findFirst({ where: { type: eventType } });
    if (received) return received;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Webhook ${eventType} not received within ${timeoutMs}ms`);
}
```

## 5. Customer Portal の E2E

```ts
test('Customer Portal で解約', async ({ page }) => {
  await page.goto('/settings/billing');
  await page.getByRole('link', { name: 'カスタマーポータルへ' }).click();
  await page.waitForURL(/billing\.stripe\.com/);

  await page.getByRole('button', { name: 'プランをキャンセル' }).click();
  await page.getByRole('button', { name: 'キャンセルを確定' }).click();

  // 戻る
  await page.getByRole('link', { name: 'アプリに戻る' }).click();
  await page.waitForURL(/\/settings\/billing/);
  await expect(page.getByText('期間終了時にキャンセル')).toBeVisible();
});
```

## 6. 適格請求書 PDF の E2E

```ts
test('請求書 PDF ダウンロード（適格請求書）', async ({ page }) => {
  await page.goto('/settings/billing/invoices');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: '請求書をダウンロード' }).first().click();
  const download = await downloadPromise;

  const path = await download.path();
  expect(path).toBeTruthy();

  // PDF 内容の検証（pdf-parse など）
  const fs = await import('fs');
  const pdfParse = (await import('pdf-parse')).default;
  const buffer = fs.readFileSync(path!);
  const data = await pdfParse(buffer);

  expect(data.text).toContain('適格請求書');
  expect(data.text).toMatch(/T\d{13}/);  // 登録番号
});
```

## 7. アンチパターン

1. **本番 Stripe キー（`sk_live_*`）を CI に設定** → 即課金事故
2. **iframe 内を CSS セレクタで取りに行く** → 変更で全 fail、`frameLocator` を使う
3. **Webhook を待たずに UI assertion** → タイミングで fail
4. **Test Clock を削除しない** → アカウント内に大量の test clock が残る
5. **テストごとに新規 Customer 作成して放置** → Stripe アカウントが汚れる
6. **本番 Webhook URL に向ける** → 本番に副作用
7. **3DS パスを無視** → 本番で fail（決済国によっては 3DS 必須）
