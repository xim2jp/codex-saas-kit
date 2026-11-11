# Stripe Webhook Handling

Webhook は Stripe からの非同期通知を受け取る要。**Source of Truth は Stripe**なので、Webhook の正しい実装がサブスク管理の品質を決める。

## 受信すべきイベント一覧（SaaS定額モデル）

| イベント | 用途 | 必須度 |
|---------|------|-------|
| `checkout.session.completed` | 初回購入完了 | ◎ |
| `customer.subscription.created` | サブスク作成 | ◎ |
| `customer.subscription.updated` | プラン変更、状態変化 | ◎ |
| `customer.subscription.deleted` | 解約完了 | ◎ |
| `customer.subscription.trial_will_end` | トライアル終了3日前 | ○（通知用） |
| `invoice.paid` | 請求成功 | ◎ |
| `invoice.payment_failed` | 請求失敗 | ◎ |
| `invoice.finalized` | 請求書確定 | ○ |
| `payment_intent.succeeded` | 単発決済成功 | △（サブスクのみなら不要。PayPay の期間パス等は `qr-payments-paypay.md`） |
| `customer.updated` | 顧客情報変更 | ○ |
| `payment_method.attached` | カード登録 | △ |

## 実装テンプレート（Next.js App Router）

```typescript
// src/app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe/client';
import { handleStripeEvent } from '@/lib/stripe/webhooks';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = (await headers()).get('stripe-signature');
  
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }
  
  let event: Stripe.Event;
  try {
    // ⚠️ 署名検証は絶対に省略しない
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  
  // Idempotency: 同じイベントIDを2回処理しないようDB側でロック
  try {
    await handleStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook handler failed:', err);
    // 5xxを返すとStripeがリトライする
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
}
```

## 署名検証の重要性

**署名検証なしの Webhook は脆弱性**。攻撃者が偽のイベントを送って、ユーザーをアクティブ化したり、解約状態にしたりできる。

`stripe.webhooks.constructEvent` は以下を検証：
1. Webhook secret によるHMAC署名の一致
2. タイムスタンプの妥当性（リプレイ攻撃防止、デフォルト5分以内）
3. ペイロードの改ざんなし

## Idempotency（冪等性）

Stripe は **同じイベントを複数回送る**可能性がある（ネットワークエラー、5xx応答時のリトライ）。**同じイベントIDを2回処理してはいけない**。

### 実装パターン

```typescript
// src/lib/stripe/webhooks/index.ts
import { db } from '@/lib/db';
import { stripeEventsTable } from '@/db/schema';

export async function handleStripeEvent(event: Stripe.Event) {
  // Idempotency: イベントIDで重複チェック
  const existing = await db.select()
    .from(stripeEventsTable)
    .where(eq(stripeEventsTable.id, event.id))
    .limit(1);
  
  if (existing.length > 0) {
    console.log(`Event ${event.id} already processed`);
    return;
  }
  
  // トランザクション内で「処理記録」と「実処理」を一緒に
  await db.transaction(async (tx) => {
    await tx.insert(stripeEventsTable).values({
      id: event.id,
      type: event.type,
      processed_at: new Date(),
    });
    
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(tx, event);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(tx, event);
        break;
      // ...
    }
  });
}
```

### イベントテーブル

```sql
CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY,             -- evt_XXXXX
  type TEXT NOT NULL,              -- customer.subscription.created
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  raw_payload JSONB                -- デバッグ用に保存（オプション）
);
```

## イベントごとのハンドラ例

### customer.subscription.created / updated

```typescript
async function handleSubscriptionUpdated(
  tx: TxType,
  event: Stripe.Event,
) {
  const subscription = event.data.object as Stripe.Subscription;
  
  await tx.insert(subscriptionsTable).values({
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    stripe_price_id: subscription.items.data[0].price.id,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000),
    current_period_end: new Date(subscription.current_period_end * 1000),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at 
      ? new Date(subscription.canceled_at * 1000) 
      : null,
    trial_end: subscription.trial_end 
      ? new Date(subscription.trial_end * 1000) 
      : null,
  }).onConflictDoUpdate({
    target: subscriptionsTable.stripe_subscription_id,
    set: {
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at 
        ? new Date(subscription.canceled_at * 1000) 
        : null,
      updated_at: new Date(),
    },
  });
  
  // アプリ側の機能制限・通知などの副作用
  if (subscription.status === 'active') {
    await activateOrganizationFeatures(subscription.customer as string);
  } else if (subscription.status === 'canceled') {
    await deactivateOrganizationFeatures(subscription.customer as string);
  }
}
```

### invoice.payment_failed

```typescript
async function handlePaymentFailed(tx: TxType, event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  
  // 通知送信（顧客と運営両方）
  await sendDunningEmail(invoice.customer_email!, invoice.hosted_invoice_url!);
  await alertOps('Payment failed', { 
    customerId: invoice.customer,
    amount: invoice.amount_due,
  });
  
  // attempted_count で何回目の失敗か把握できる
  if (invoice.attempt_count >= 3) {
    // 最終リトライ後の処理（機能制限など）
  }
}
```

## エラー時の挙動

### Stripe のリトライ仕様

Webhook ハンドラが **5xx応答**を返すと、Stripe は最大3日間、指数バックオフでリトライ：
- 1回目：即時
- 2回目：1時間後
- 3回目以降：徐々に間隔を広げる

### ハンドラの設計指針

- **回復可能なエラー** → 5xx を返す（Stripe がリトライ）
- **永続的なエラー（パラメータ不正等）** → 2xx を返してログだけ残す（リトライしてもムダ）

### タイムアウト対策

Webhook ハンドラは**速く返す**べき。重い処理は：

```typescript
// 速く返してから非同期で処理
export async function POST(request: NextRequest) {
  // ... 署名検証 ...
  
  // すぐに2xx を返す
  // 重い処理はキューに入れる
  await enqueue('stripe.event', event);
  
  return NextResponse.json({ received: true });
}
```

Vercel の関数実行時間制限（10秒、Pro:60秒）を超えないように。長時間処理は SQS / Cloud Tasks / Supabase Edge Functions / QStash 等のキューへ。

## Webhook エンドポイントの保護

```typescript
// middleware.ts でも追加保護
export const config = {
  matcher: ['/api/webhooks/stripe'],
};

// 必要ならIP制限（StripeのIPは公開されている）
// https://docs.stripe.com/ips#webhook-notifications
```

## デバッグ

### Stripe CLI でローカル受信

```bash
# Stripe CLIインストール
brew install stripe/stripe-cli/stripe

# ログイン
stripe login

# ローカルへフォワード
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# 表示される whsec_xxx を STRIPE_WEBHOOK_SECRET に設定
```

### イベントを手動トリガー

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.payment_failed
```

## チェックリスト

- [ ] 署名検証を実装
- [ ] Idempotency（イベントID重複処理）を実装
- [ ] 必要イベント全てにハンドラ
- [ ] DB更新はトランザクション内
- [ ] 失敗時の5xx応答（Stripeリトライを期待）
- [ ] 永続エラーは2xx返却＋ログ
- [ ] タイムアウト対策（重い処理はキュー）
- [ ] エンドポイントURLとシークレットをStripe Dashboardで設定
- [ ] ローカル開発で Stripe CLI を使ったテスト

## アンチパターン

1. **署名検証を省略**：致命的脆弱性
2. **Idempotencyを無視**：状態不整合の温床
3. **Webhookで重い処理**：タイムアウト→Stripeリトライ→重複処理
4. **失敗時に常に2xx返却**：Stripeがリトライしないので、永続障害でデータ欠損
5. **Webhookシークレットを公開リポジトリにコミット**：偽イベント送信可能に
6. **テスト環境と本番のシークレット混在**：意図しない環境で動く
