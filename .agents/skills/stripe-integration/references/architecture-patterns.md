# Stripe Architecture Patterns

Stripe の統合方式は複数あり、要件によって選び分ける。野口さんのSaaS量産戦略では「**実装コスト最小・保守コスト最小**」を優先するため、Stripe Checkout + Customer Portal が基本軸。

## 統合方式の比較

| 方式 | 実装コスト | カスタマイズ性 | PCI DSS | 3DS対応 | 推奨用途 |
|------|----------|--------------|---------|---------|---------|
| **Stripe Checkout** | ◎ 最低 | △ 限定的 | ◎ 自動 | ◎ 自動 | **野口さん標準** |
| Stripe Elements | △ 中 | ◎ 高い | ○ SAQ-A | ○ Manual | UIを統一したい場合 |
| Payment Intent (Raw) | × 高 | ◎ 最高 | × SAQ-D | × Manual | 推奨しない |
| Stripe Billing | ◎ Checkoutと併用 | △ 限定的 | ◎ 自動 | ◎ 自動 | **サブスク必須** |
| Customer Portal | ◎ 最低 | △ 限定的 | ◎ 自動 | ◎ 自動 | **野口さん標準** |

## 野口さんSaaS量産パターン（推奨）

### 構成

```
[ユーザー]
    ↓ サイトの「申し込む」ボタン
[Next.js API Route]
    ↓ stripe.checkout.sessions.create()
[Stripe Checkout (Hosted)]  ← Stripeのドメインで決済
    ↓ 決済完了
[Webhook] → [Next.js API Route]
    ↓ ユーザーをアクティブ化
[Customer Portal]  ← Stripeのドメインで顧客管理
    ↓ 解約・カード変更・領収書ダウンロード
```

### 採用理由

1. **PCI DSS が自動**：カード情報がアプリケーションサーバーを通らない
2. **3DSecure 自動対応**：日本の本人認証強化に対応
3. **多言語・多通貨が自動**：将来の海外展開時
4. **解約フローが標準提供**：Customer Portal で完結
5. **領収書発行が自動**：適格請求書対応も Stripe Tax で

## いつ Elements を採用するか

以下の要件がある場合のみ：

- ブランド統一のため決済UIをサイト内で完結したい
- 既存サイトのデザインからの離脱を最小化したい
- 決済前後のフロー（カード登録→使用同意→課金）を細かく制御したい

**判断基準**：「Stripe Hosted への遷移」がコンバージョン率に明確に悪影響する根拠がある場合のみ。それ以外は Checkout 推奨。

## アーキテクチャ図（Next.js App Router 採用時）

```
src/
├── app/
│   ├── (marketing)/
│   │   └── pricing/page.tsx          # 価格表（marketing-site-builderが担当）
│   ├── api/
│   │   ├── checkout/route.ts         # Checkout Session作成
│   │   ├── portal/route.ts           # Customer Portal Session作成
│   │   └── webhooks/stripe/route.ts  # Webhook受信
│   └── (app)/
│       ├── billing/page.tsx          # Customer Portalへのリンク
│       └── subscription/page.tsx     # 自社のサブスク状況表示
├── lib/
│   └── stripe/
│       ├── client.ts                 # Stripe SDK初期化
│       ├── checkout.ts               # Checkout Session生成
│       ├── portal.ts                 # Portal Session生成
│       ├── webhooks/
│       │   ├── index.ts              # ルーター
│       │   ├── customer.ts           # customer.* イベント
│       │   ├── subscription.ts       # customer.subscription.* イベント
│       │   ├── invoice.ts            # invoice.* イベント
│       │   └── payment.ts            # payment_intent.* イベント
│       └── types.ts
└── server/
    ├── repositories/
    │   └── subscription.repo.ts     # 自社DB側のサブスク管理
    └── services/
        └── subscription.service.ts   # ビジネスロジック
```

## Stripe Object と 自社DB の対応

| Stripe Object | 自社DB | 同期方向 |
|--------------|--------|---------|
| Customer | `customers` テーブル | Stripe → 自社（Webhookで） |
| Subscription | `subscriptions` テーブル | Stripe → 自社（Webhookで） |
| Invoice | `invoices` テーブル | Stripe → 自社（Webhookで） |
| Product / Price | `plans` テーブル（任意） | Stripe → 自社（管理画面で表示用） |
| PaymentMethod | （自社で持たない） | - |

**重要**：Subscription の状態（active / past_due / canceled）の **Source of Truth は Stripe**。自社DBは「キャッシュ」と考える。

## Stripe Hosted の制約と対応

| 制約 | 対応 |
|------|------|
| URLが stripe.com 系になる | カスタムドメイン設定可（Stripe Pro以上） |
| デザインカスタマイズが限定的 | ロゴ・カラー・フォントは設定可。それ以上は Elements 検討 |
| 言語切り替えが必要 | `locale` パラメータで指定可（日本語 OK） |
| 領収書PDF生成 | 自動。`receipt_email` を設定すれば自動送信 |

## エラーハンドリングの基本パターン

```typescript
import Stripe from 'stripe';

try {
  const session = await stripe.checkout.sessions.create({
    // ...
  }, {
    idempotencyKey: `checkout_${userId}_${planId}_${Date.now()}`,
  });
} catch (err) {
  if (err instanceof Stripe.errors.StripeCardError) {
    // カード拒否：ユーザーに表示
  } else if (err instanceof Stripe.errors.StripeRateLimitError) {
    // レート制限：指数バックオフでリトライ
  } else if (err instanceof Stripe.errors.StripeInvalidRequestError) {
    // パラメータエラー：ログ＋アラート
  } else if (err instanceof Stripe.errors.StripeAPIError) {
    // Stripe API側のエラー：リトライ
  } else if (err instanceof Stripe.errors.StripeConnectionError) {
    // ネットワーク：リトライ
  } else if (err instanceof Stripe.errors.StripeAuthenticationError) {
    // APIキー誤り：即停止＋アラート
  }
  throw err;
}
```

## API バージョン固定

```typescript
// lib/stripe/client.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.acacia',  // 明示固定
  typescript: true,
});
```

API バージョンを固定することで、Stripe 側の破壊的変更でも自社コードが影響を受けない。アップグレードは計画的に。
