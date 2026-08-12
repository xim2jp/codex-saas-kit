# Stripe による多通貨・地域別決済対応

Stripe で SaaS の月額課金を**複数通貨・複数地域の決済手段**に対応させる実装パターン集。`stripe-integration` Skill（サブスク設計・Webhook・日本の税務）を土台としつつ、本ファイルは**海外展開時の多通貨・地域対応**に特化する。

## 野口Profile財務制約との整合性

民事再生中・一括払いのみ・1名運用という制約下では、ランニングコストが積み上がる専用ツール（為替APIサービス、地域別決済ゲートウェイの個別契約等）は避けたい。

> **基本方針：Stripe の多通貨対応（Multi-currency Prices / Adaptive Pricing / Stripe Tax）は Stripe の決済手数料の範囲内で使え、追加の月額契約が不要。海外展開の第一候補として優先する。**

- 通貨追加・Payment Element の決済手段追加に**基本料金や月額固定費はかからない**（決済手数料は通常決済と同様に発生。Adaptive Pricing 利用時は追加手数料が乗る点に注意 → 後述）。
- 為替レート取得・価格換算のための外部APIを自前運用する必要がない（Stripe が内部で処理）。

## 1. Stripe Tax 連携（自動税額計算・地域別税率）

Stripe Tax は登録国・地域の税率（消費税・VAT・GST等）を自動計算し、Checkout/Invoice に反映する機能。

```typescript
// lib/stripe/checkout.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function createCheckoutSession(priceId: string, customerId: string) {
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    automatic_tax: { enabled: true }, // Stripe Tax を有効化
    tax_id_collection: { enabled: true }, // B2B向け：税ID（VAT番号等）収集
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
  });
}
```

- 前提として **Stripe Dashboard で「Tax registrations」に事業を展開する国・地域を登録**する必要がある（日本の消費税は `stripe-integration` Skill の `tax-compliance-jp.md` を参照。適格請求書の登録番号もそちらで扱う）。
- 海外の税制（EU VAT、シンガポールGST、タイVAT等）は国ごとに登録閾値・要否が異なる。**売上が一定額を超えるまで登録不要な国も多い**ため、進出直後から全地域登録する必要はなく、実売上が発生してから追加登録する運用でよい。
- `automatic_tax.enabled: true` にすると、顧客の請求先住所（Checkoutで収集）に基づき税率が自動適用される。地域別税率テーブルを自前で持つ必要がない。

## 2. 通貨別価格設定（Multi-currency Prices）

Stripe の Price オブジェクトは、1つの Product に対して**複数通貨の Price を個別作成**する方式と、**単一 Price に `currency_options` を設定**する方式の2通りがある。

### 方式A：通貨ごとに個別 Price を作成（明示的な価格設計）

```typescript
// scripts/create-multi-currency-prices.ts
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const product = await stripe.products.create({ name: 'Pro Plan' });

const prices = await Promise.all([
  stripe.prices.create({
    product: product.id,
    currency: 'jpy',
    unit_amount: 2980, // JPY は最小単位が円（小数なし）
    recurring: { interval: 'month' },
  }),
  stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: 1980, // USD は cent 単位。$19.80
    recurring: { interval: 'month' },
  }),
  stripe.prices.create({
    product: product.id,
    currency: 'sgd',
    unit_amount: 2680, // SGD 26.80（シンガポール展開）
    recurring: { interval: 'month' },
  }),
]);
```

- **単純な為替レート換算をそのまま価格にしない**。$19.80 のような「日本の¥2,980を機械的に割っただけ」の価格は不自然に見える。現地の類似SaaSの価格帯を踏まえた**心理的価格設定（$19, $29 のようなキリのよい数字）**に丸める。
- 通貨ごとに `unit_amount` の最小単位が異なる点に注意（JPY・KRW等はゼロ小数通貨で `unit_amount` がそのまま金額、USD・SGD等は cent 単位で100倍する）。

### 方式B：`currency_options` で単一 Price に複数通貨を紐付け（Adaptive Pricing 併用時）

```typescript
const price = await stripe.prices.create({
  product: product.id,
  currency: 'usd', // デフォルト通貨
  unit_amount: 1980,
  recurring: { interval: 'month' },
  currency_options: {
    jpy: { unit_amount: 2980 },
    sgd: { unit_amount: 2680 },
    thb: { unit_amount: 69000 }, // タイバーツ展開時
  },
});
```

- Checkout / Payment Links で **Adaptive Pricing** を有効にすると、`currency_options` に定義した通貨か、未定義の場合は Stripe が自動換算した価格を、**顧客のロケーション（IPベース）に応じて自動表示**する。
- Adaptive Pricing は**設定済み通貨がない国では自動換算＋追加手数料**が発生する点に注意。主要展開国は方式Aで明示的に価格を作り、それ以外はAdaptive Pricingの自動換算に任せる、というハイブリッド運用が実務的。

```typescript
// Checkout Session で Adaptive Pricing を使う場合
await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: price.id, quantity: 1 }],
  adaptive_pricing: { enabled: true },
  // ...
});
```

## 3. 決済導線の地域対応（Payment Element）

Stripe Elements の Payment Element を使うと、**顧客のロケーション・通貨に応じて利用可能な決済手段が自動的に出し分けられる**。

```typescript
// components/CheckoutForm.tsx
'use client';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function CheckoutForm({ clientSecret }: { clientSecret: string }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm />
    </Elements>
  );
}

function PaymentForm() {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/complete`,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement /> {/* 決済手段は自動的に地域・通貨に応じて出し分けられる */}
      <button disabled={!stripe}>支払う</button>
    </form>
  );
}
```

- 有効化する決済手段は **Stripe Dashboard の「Payment methods」で通貨・国ごとにON/OFF設定**する。コードでの個別分岐は基本不要（Payment Element が自動判定）。
- 日本国内：クレジットカード、コンビニ決済（Konbini）、銀行振込（Bank Transfers）、PayPay 等。
- 東南アジア主要決済手段（Stripe が対応地域で提供、案件の展開国に応じて有効化を検討）：

| 決済手段 | 主な地域 | 備考 |
|---------|---------|------|
| **GrabPay** | シンガポール・マレーシア | 東南アジアで広く使われるウォレット決済 |
| **PayNow** | シンガポール | 銀行連携のリアルタイム送金、QR決済 |
| **PromptPay** | タイ | タイの国民的QR決済網 |
| **FPX** | マレーシア | オンラインバンキング振込 |
| **クレジットカード（国際ブランド）** | 全域 | 依然として東南アジアでも主要手段 |

- サブスク（継続課金）の場合、**現地決済手段が継続課金（off-session決済）に対応しているか個別確認が必要**。ウォレット系決済手段は一括払いのみ対応でサブスク非対応のケースがあるため、Stripe公式ドキュメントで対応可否を確認してから有効化する。

## 4. 為替レート・価格丸めの実務上の注意点

- **Stripe の自動換算（Adaptive Pricing / Currency Conversion）はリアルタイム為替レートに追加スプレッドが乗る**。明示的に `currency_options` で価格を作った通貨にはこのスプレッドはかからない。主要展開国は明示価格を作ることでコストと表示価格の予測可能性を高める。
- サブスクリプションの更新請求（Invoice）でも通貨は Price 作成時点の通貨に固定される。**為替変動によって都度金額が変わることはない**（Adaptive Pricingで自動換算された場合を除く）。
- 価格改定（値上げ等）を行う場合、**通貨ごとに個別に Price を再作成し、既存顧客には旧 Price を維持するか移行するかを個別に設計**する（`stripe-integration` Skill の `subscription-design.md` のプラン変更パターンと合わせて設計）。
- 表示価格の丸めルールをドキュメント化しておく（例：「現地価格は日本円価格を基準為替レートで換算し、キリの良い数字に切り上げる」）。**都度の裁量判断にしない**ことで、後から価格を追加する際の一貫性を保つ。

## 5. サブスクリプションの通貨変更時の注意

- **Stripe は稼働中のサブスクリプションの通貨を直接変更できない**。顧客のサブスク通貨を変えたい場合（例：顧客が国をまたいで移住した等）は、旧サブスクをキャンセルし、新しい通貨の Price で新規サブスクを作成する必要がある。
- 顧客が Checkout / Payment Links で **最初に選択した通貨がそのままサブスク通貨として固定**される。UI上で「通貨を後から変更できない」旨を明示し、契約前に正しい通貨を選ばせる導線にする（誤った通貨での契約→解約→再契約という手戻りを防ぐ）。
- 同一 Customer オブジェクトに異なる通貨のサブスクリプションを複数持たせることは技術的には可能だが、請求書・レポーティングが複雑化するため、**1顧客1通貨を原則とする**運用ルールを推奨する。

## 実装チェックリスト

- [ ] Stripe Dashboard で展開国の Tax registration を登録済みか（売上発生前提、先回り登録は不要）
- [ ] 主要展開国の Price を `currency_options` または個別 Price として明示的に作成しているか
- [ ] Adaptive Pricing を有効化する場合、未設定通貨での自動換算スプレッドを許容できるか確認したか
- [ ] Payment Element の決済手段を通貨・国ごとに Dashboard で有効化したか
- [ ] 有効化した決済手段がサブスク（継続課金）に対応しているか確認したか
- [ ] 価格の丸めルールをドキュメント化したか（機械的な為替換算のままにしていないか）
- [ ] サブスク通貨は契約時に固定される旨をUI上で顧客に明示しているか

## 出典

- Stripe Currencies（対応通貨一覧）: https://stripe.com/docs/currencies
- Stripe Tax: https://stripe.com/docs/tax
- Stripe Multi-currency prices: https://stripe.com/docs/products-prices/pricing-models#multi-currency-prices
- Stripe Adaptive Pricing: https://stripe.com/docs/payments/checkout/adaptive-pricing
- Stripe Payment methods（地域別対応表）: https://stripe.com/docs/payments/payment-methods/overview
- Stripe Payment Element: https://stripe.com/docs/payments/payment-element

実装直前に上記URLで対応通貨・対応決済手段・料金体系（Adaptive Pricing の追加手数料率等）の最新情報を再確認すること。日本国内の税務・インボイス制度対応は `stripe-integration` Skill の `references/tax-compliance-jp.md` を参照。
