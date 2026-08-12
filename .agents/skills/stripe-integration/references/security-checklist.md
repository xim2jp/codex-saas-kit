# Stripe Security Checklist

決済セキュリティは妥協できない。実装・レビュー時の必須チェック。

## API キーの管理

- [ ] `STRIPE_SECRET_KEY` をクライアントサイドで使わない（Publishable Keyとの区別）
- [ ] `STRIPE_SECRET_KEY` を Git にコミットしない
- [ ] `.env.local` を `.gitignore` に記載
- [ ] CI/CD では Vercel / GitHub Secrets / AWS Secrets Manager を使用
- [ ] テストキー（`sk_test_*`）と本番キー（`sk_live_*`）を環境変数で厳密分離
- [ ] 起動時にキーのprefixを検証する
- [ ] キーのローテーション手順を文書化（漏洩時の対応）

## Webhook セキュリティ

- [ ] **署名検証は絶対に省略しない**（`stripe.webhooks.constructEvent`）
- [ ] Webhook secret は環境変数で管理
- [ ] テスト環境と本番環境で異なる Webhook secret を使用
- [ ] Webhook エンドポイントは認証なしで公開（ただし署名検証で保護）
- [ ] **イベントID重複処理を防ぐ Idempotency 実装**
- [ ] エンドポイントURLを推測されにくくする（例：`/api/webhooks/stripe/<random>`）

## PCI DSS 対応

- [ ] **カード情報を自社サーバーに保存・処理しない**
- [ ] Stripe Checkout または Stripe Elements を使用（Raw Payment Intent は避ける）
- [ ] カード番号・CVV をログに出力しない
- [ ] フォームを HTTPS のみで提供
- [ ] CSP (Content Security Policy) で Stripe ドメインを許可

```
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' https://js.stripe.com; 
  frame-src 'self' https://js.stripe.com https://hooks.stripe.com;
  connect-src 'self' https://api.stripe.com;
```

## 認証・認可

- [ ] Checkout Session 作成 API は**認証必須**
- [ ] Customer Portal Session 作成 API は**認証必須**
- [ ] 他ユーザーの Subscription を操作できない（IDOR対策）

```typescript
// 悪い例：他人のsubscriptionを操作可能
export async function cancelSubscription(req: Request) {
  const { subscriptionId } = await req.json();
  await stripe.subscriptions.cancel(subscriptionId);  // ❌ 他人のIDでも通る
}

// 良い例：認可チェック
export async function cancelSubscription(req: Request) {
  const session = await auth();
  if (!session) return unauthorized();
  
  const { subscriptionId } = await req.json();
  const sub = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.stripe_subscription_id, subscriptionId),
      eq(subscriptions.user_id, session.user.id),
    ),
  });
  if (!sub) return forbidden();
  
  await stripe.subscriptions.cancel(subscriptionId);
}
```

## Idempotency Key

- [ ] サブスク作成・支払い処理に Idempotency Key を付ける
- [ ] キーは予測不能（user_id + timestamp + random）
- [ ] リトライ時は同じキーを使う

```typescript
const idempotencyKey = `checkout_${userId}_${planId}_${nonce}`;
const session = await stripe.checkout.sessions.create({
  // ...
}, {
  idempotencyKey,
});
```

## ログ・監査

- [ ] 機微情報をログに残さない（カード番号、CVV、Stripe Secret Key）
- [ ] 重要イベントは構造化ログで残す（サブスク作成・解約・課金成功失敗）
- [ ] ログ保存期間が法規制に適合
- [ ] 異常検知（短時間に大量の課金失敗、Webhook失敗、etc.）

```typescript
// ログ出力時のマスキング例
function maskCardNumber(num: string): string {
  return num.replace(/\d(?=\d{4})/g, '*');  // 最後4桁以外をマスク
}

// セキュアなログ
logger.info('Payment processed', {
  userId: user.id,
  amount: invoice.amount_paid,
  status: 'success',
  // ❌ card: payment.card,  // 出さない
  // ❌ cvv: ...,
});
```

## レート制限

- [ ] Checkout Session 作成 API にレート制限（同一ユーザーから短時間多発攻撃防止）
- [ ] Webhook エンドポイントは Stripe 専用なのでレート制限緩めでOK（ただし署名検証は必須）

## 不正利用検出

Stripe Radar の活用：

- [ ] Radar Rules で日本以外のIPからの大量決済を検出
- [ ] 短時間に複数カードで決済試行をブロック
- [ ] 既知のフラウドカードリストを参照

## エラーハンドリング

- [ ] 詳細なエラーをユーザーに見せない（攻撃者への情報提供を避ける）
- [ ] エラーログに full detail を残す
- [ ] エラー発生時のアラート（決済失敗、Webhook失敗、Stripe API down）

```typescript
// 悪い例
catch (err) {
  return Response.json({ 
    error: err.message,  // ❌ Stripeの内部詳細が漏れる
    stack: err.stack,    // ❌
  });
}

// 良い例
catch (err) {
  logger.error('Stripe operation failed', { 
    error: err, 
    userId: session.user.id 
  });
  return Response.json({ 
    error: '決済処理に失敗しました。しばらくお待ちください。' 
  }, { status: 500 });
}
```

## データ保護・GDPR / 個情法

- [ ] ユーザー削除リクエスト時に Stripe Customer の削除も実行
- [ ] データ保持期間を文書化
- [ ] Stripe にも個人情報が渡ることを利用規約・プライバシーポリシーに明示
- [ ] DPA（データ処理契約）を Stripe と確認（必要に応じ）

```typescript
// ユーザー削除フロー
async function deleteUser(userId: string) {
  const customer = await db.query.customers.findFirst({
    where: eq(customers.user_id, userId),
  });
  
  // Stripe Customer 削除
  if (customer?.stripe_customer_id) {
    await stripe.customers.del(customer.stripe_customer_id);
  }
  
  // 自社DB 削除
  await db.delete(users).where(eq(users.id, userId));
}
```

## デプロイ前最終チェック

- [ ] Live mode の API key が正しく設定されている
- [ ] Webhook エンドポイント URL が公開アクセス可能
- [ ] Webhook secret が Live mode の値
- [ ] テストデータが本番DBに混入していない
- [ ] エラー通知（Sentry等）が機能している
- [ ] ロールバック手順が確認済み
- [ ] サポート問い合わせ窓口が決まっている（顧客の決済トラブル対応）

## インシデント対応

### Stripe Secret Key 漏洩時

1. **即時に Stripe Dashboard で該当キーをローテーション**
2. 新キーを環境変数に設定し再デプロイ
3. ログを確認して不正利用がないか確認
4. 必要なら法人決済停止
5. インシデントレポート作成

### Webhook シークレット漏洩時

1. Stripe Dashboard で Webhook エンドポイント再生成
2. 新シークレットを設定
3. 旧シークレットを使った偽イベントは署名検証で弾かれているか確認

### 不正決済発覚時

1. Stripe Dashboard で該当決済を確認
2. 必要なら返金処理
3. Radar Rules を強化
4. 影響顧客へ通知

## アンチパターン（再掲）

1. **Webhook 署名検証を省略**
2. **Idempotency Keyを使わない**
3. **Live keyを.env.localにコミット**
4. **クライアント側で Secret Key を使う**
5. **エラー詳細をユーザーに表示**
6. **ログにカード番号やCVVを残す**
7. **他ユーザーの Subscription を操作できる API**
8. **ローテーション手順なし**
