# QR 決済（PayPay）の組み込み

Stripe は日本の QR コード決済 **PayPay** に対応している。ただし **単発決済専用**で、サブスク（継続課金）には使えない。月額定額 SaaS にそのまま足せる決済手段ではないため、「どの課金に PayPay を当てるか」を先に決める。

> 確認日：2026-11-11（Stripe 公式ドキュメント・料金ページ）。決済手段の仕様と料率は更新が速い。採用を決める前に末尾の出典で再確認する。

## 仕様の要点

| 項目 | 内容 |
|------|------|
| 対象アカウント | 日本拠点の Stripe アカウントのみ。PayPay 側の加盟店審査あり |
| 顧客・通貨 | 日本国内の顧客、JPY のみ（越境不可） |
| 金額 | 1 回 50 円〜1,000,000 円 |
| 継続課金 | **不可**（Subscriptions・Billing・Invoicing・Customer Portal・Setup Intents・`setup_future_usage`・off-session すべて非対応） |
| Checkout | `mode: 'payment'` のみ。`subscription` / `setup` は不可 |
| 使える UI | Checkout（ホスト型・埋め込み）、Payment Links、Payment Element。Express Checkout Element は不可 |
| 決済確定 | 即時（顧客が PayPay アプリで承認した時点で成否が確定。コンビニ決済のような後日入金待ちはない） |
| 承認期限 | PayPay 側の承認はリダイレクト後 5 分。Stripe の決済試行は作成から 1 時間で失効 |
| キャプチャ | 手動キャプチャ・部分キャプチャ不可（オーソリ＝即売上） |
| 返金 | 全額・部分とも可、決済から 365 日以内。即時実行で取り消し不可 |
| チャージバック | なし（顧客は不審請求を申請できない） |
| 入金 | 標準の入金スケジュール（目安：4 営業日後に利用可能残高） |
| 手数料 | 3.98%／デジタルコンテンツ事業は **9.48%** |
| API バージョン | `paypay` は `2026-09-30.endive` で追加。これより古い固定バージョンでは使えない |
| Connect | 公式ドキュメント内で記載が割れている（非対応の表記と、承認済みプラットフォームのみ可の表記）。Connect 案件は Stripe に確認する |

顧客の操作：PC では QR コードが表示されスマホの PayPay アプリで読み取る。スマホでは PayPay アプリ（またはブラウザ）に遷移して承認し、自動で元のサイトへ戻る。

## 月額 SaaS での使いどころ

サブスクに使えないので、PayPay は次の 3 パターンに限って採用する。

| パターン | 内容 | 向く場面 |
|---------|------|---------|
| **A. 期間パス（前払い）** | 「30 日パス」「年間パス」を単発決済で販売し、期限まで利用権を付与。自動更新なし | カードを持たない・登録したくない個人向け B2C |
| **B. 買い切り・チケット** | クレジットパック、回数券、従量分のプリペイド | AI 機能などの従量部分 |
| **C. 単発の付帯料金** | 初期費用、オプション、単発の講座・イベント | サブスク本体はカード、付帯だけ PayPay |

既定は従来どおり**カードの自動更新サブスク**。PayPay は「カードが理由で離脱している層がいる」根拠（ターゲット層・問い合わせ・広告流入の属性）があるときに A〜C で足す。

### A を採るときの設計上の注意

- **自動更新されない**。期限切れ＝無断解約と同じ結果になるので、期限 7 日前・前日・当日のリマインドメールと、ワンクリックで再購入できる導線を必ず設計する。継続率はサブスクより下がる前提で KPI を置く
- 月次パスより**年間パスや 3〜6 か月パスを主力にする**。再購入の回数が減り、手数料負けと失効離脱の両方を抑えられる
- 利用権は Stripe の Subscription ではなく自社 DB で管理する。カードのサブスクと併存させるため、権限判定は「サブスクが active」または「パスの期限内」の OR で 1 か所に集約する
- 同一ユーザーがサブスクとパスを二重に持つケース（切り替え時）の扱いを決めておく。例：サブスク契約中はパス購入ボタンを出さない
- 返金は即時・取り消し不可。返金時に利用権をどう縮めるか（即時失効か期限維持か）を規約と実装で一致させる

### 手数料の確認

SaaS の利用料が PayPay の区分で「標準（3.98%）」と「デジタルコンテンツ（9.48%）」のどちらになるかは、有効化時の申告と PayPay の審査で決まる。公式の例示は電子書籍・音楽・ゲーム・動画。9.48% になると粗利が大きく変わるので、価格設計の前に区分を確定させ、pricing-strategist と cost-guardian に渡す。

## 有効化の手順

1. Stripe Dashboard の「決済手段」で PayPay を有効化し、商材の種類（デジタルコンテンツ／標準）を申告する
2. PayPay の審査を受ける。見られるのは事業サイト、**特定商取引法に基づく表記**、法人情報（国税庁の法人番号公表サイトとの一致）、商品・サービスと決済の流れが明確か
3. 審査は通常数日。差し戻しが重なると数週間かかるので、リリース日から逆算して早めに申請する
4. 特商法ページは legal-docs-generator の成果物を公開してから申請する

暗号資産取引所・ウォレット（MCC 6051）は禁止業種。

## 実装（Checkout・パターン A の例）

決済手段は Dashboard で管理し、コードでは `payment_method_types` を渡さない。Stripe が金額・通貨・顧客の所在から出し分ける（JPY の `mode: 'payment'` で PayPay が表示される）。

```typescript
// lib/stripe/checkout.ts — 期間パスの購入
const session = await stripe.checkout.sessions.create({
  mode: 'payment',                       // PayPay は payment モードのみ
  line_items: [{ price: PASS_PRICE_ID, quantity: 1 }],  // one-time の Price
  customer: stripeCustomerId,
  client_reference_id: userId,
  metadata: { kind: 'pass', pass_days: '365' },
  success_url: `${origin}/billing/complete?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/pricing`,
}, { idempotencyKey: `pass_${userId}_${orderId}` });
```

- one-time の Price を月額サブスクの Price とは別に作る（同じ Product の下でよい）
- `lib/stripe/client.ts` の `apiVersion` を `2026-09-30.endive` 以降に上げる。上げる際は既存のサブスク処理への影響を変更履歴で確認する
- Payment Element を使う場合は `confirmPayment` に `return_url` が必須（無いと `payment_intent_redirect_confirmation_without_return_url`）

### Webhook と利用権の付与

```typescript
// lib/stripe/webhooks/payment.ts
case 'checkout.session.completed': {
  const s = event.data.object;
  if (s.mode !== 'payment' || s.payment_status !== 'paid') break;
  // payment_intent を一意キーにして二重付与を防ぐ
  await grantPass({
    userId: s.client_reference_id!,
    paymentIntentId: s.payment_intent as string,
    days: Number(s.metadata?.pass_days),
  });
  break;
}
```

- 利用権の付与は成功ページではなく **Webhook を起点**にする（顧客が戻る前にブラウザを閉じても付与される）。原則は `webhook-handling.md` と同じ
- PayPay は即時確定なので、コンビニ決済のような `checkout.session.async_payment_succeeded` 待ちは要らない。ただし同じ Checkout でコンビニ決済・銀行振込も有効にしているなら `payment_status` の分岐は必須
- 返金は `refund.updated` / `refund.failed` を受けて利用権を調整する。返金失敗時は資金が Stripe 残高に戻る
- 期限切れ（5 分・1 時間）は失敗として扱い、再度 Checkout を開けるようにする

### 自社 DB

```sql
create table passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  stripe_payment_intent_id text not null unique,  -- 冪等性
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  refunded_at timestamptz
);
```

延長購入は「現在の `expires_at` と現在時刻の遅い方」を起点に日数を足す。RLS は本人の参照のみ許可し、書き込みは service role（Webhook）に限る。

## 適格請求書・領収書

PayPay は Stripe Invoicing に対応していないため、サブスクの請求書と同じ経路では適格請求書が出ない。単発決済で登録番号入りの書類が必要な B2B 顧客がいる案件は、Checkout の領収書・単発決済向け請求書作成（`invoice_creation`）が PayPay 決済で使えるかをテスト環境で確かめ、使えなければ自社で適格簡易請求書相当の領収書を発行する。記載要件は `tax-compliance-jp.md` を参照。

B2B 中心で請求書払いの要望が多い案件は、PayPay より銀行振込・カードを優先する。

## テスト

- サンドボックスで PayPay を選ぶと、承認／拒否を選べるテスト用ページに遷移する。成功・拒否・期限切れ（放置）の 3 系統を E2E に入れる
- 失敗系は `payment_intent_authentication_failure` を確認する
- 追加するテストケース：二重 Webhook で利用権が二重付与されない／延長購入の期限計算／返金後の利用権／サブスク契約中のパス購入制御／金額上下限（50 円未満・100 万円超の商品で PayPay が出ない）
- 本番では承認／拒否の選択肢は出ず、実際の PayPay 画面に遷移する。本番確認は少額の実決済＋返金で行う

## チェックリスト

- [ ] PayPay を当てる課金がパターン A〜C のいずれかで、サブスク本体をカードから置き換えていない
- [ ] 手数料区分（3.98% / 9.48%）を確認し、価格とユニットエコノミクスに反映した
- [ ] 特商法ページ公開後に審査を申請し、リリースまでの日数に余裕がある
- [ ] `apiVersion` が `2026-09-30.endive` 以降
- [ ] 利用権付与が Webhook 起点で、`payment_intent` による冪等性がある
- [ ] 期間パスに期限前リマインドと再購入導線がある
- [ ] 返金時の利用権の扱いが規約と実装で一致している
- [ ] 価格ページ・FAQ に「PayPay は自動更新されない」旨が書かれている

## 海外の QR 決済

PayNow（シンガポール）、PromptPay（タイ）など海外の QR 決済は `i18n-and-currency` Skill の `references/multi-currency-stripe.md` を参照。いずれも単発決済が基本で、継続課金の可否は手段ごとに確認が要る点は PayPay と同じ。

## 出典

- https://docs.stripe.com/payments/paypay
- https://docs.stripe.com/payments/paypay/accept-a-payment
- https://docs.stripe.com/changelog/endive/2026-09-30/paypay-payments-japan
- https://support.stripe.com/questions/accept-paypay-payments-with-a-japan-based-stripe-account
- https://stripe.com/jp/pricing/local-payment-methods
