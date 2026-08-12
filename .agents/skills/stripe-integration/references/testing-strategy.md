# Stripe Testing Strategy

決済テストは**ミスが致命的**なので、戦略的に網羅。

## テストモードの活用

Stripe には2つの完全に分離されたモード：

| モード | API Key | 用途 |
|-------|---------|------|
| Test mode | `sk_test_*` / `pk_test_*` | 開発・テスト |
| Live mode | `sk_live_*` / `pk_live_*` | 本番 |

**鉄則**：本番デプロイ前にKey の prefix を必ず確認。CI/CD で誤デプロイ防止。

```typescript
// 環境チェック
if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') && 
    process.env.NODE_ENV !== 'production') {
  throw new Error('Live key in non-production environment!');
}
```

## Stripe テストカード

公式テストカード一覧：https://stripe.com/docs/testing

### 主要パターン

| カード番号 | 挙動 |
|----------|------|
| `4242 4242 4242 4242` | 成功（Visa） |
| `5555 5555 5555 4444` | 成功（Mastercard） |
| `4000 0027 6000 3184` | 3D Secure 要求 |
| `4000 0000 0000 0002` | 拒否：generic_decline |
| `4000 0000 0000 0119` | 処理エラー |
| `4000 0000 0000 9995` | 残高不足 |
| `4000 0000 0000 9987` | 紛失届出済み |
| `4000 0000 0000 0341` | カード登録は成功、初回課金で失敗 |

CVV: 任意の3桁、有効期限: 未来の任意の日付

### 日本特有のカード（JCB等）

| カード番号 | 種類 |
|----------|------|
| `3566 0020 2036 0505` | JCB 成功 |

## ローカル開発での Webhook テスト

### Stripe CLI セットアップ

```bash
# インストール（Mac）
brew install stripe/stripe-cli/stripe

# ログイン
stripe login

# 確認
stripe --version
```

### Webhook フォワーディング

```bash
# ローカルへ転送
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# 表示される signing secret を環境変数に設定
# STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
```

### イベントの手動トリガー

```bash
# サブスク作成イベント
stripe trigger checkout.session.completed

# サブスク状態変更
stripe trigger customer.subscription.updated

# 課金失敗
stripe trigger invoice.payment_failed

# トライアル終了
stripe trigger customer.subscription.trial_will_end
```

## テスト計画への落とし込み

### Unit Tests（Vitest）

ロジック層は Stripe SDKをモック：

```typescript
// src/lib/stripe/subscription.service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { upgradeSubscription } from './subscription.service';

vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    subscriptions: {
      update: vi.fn(),
    },
  },
}));

describe('upgradeSubscription', () => {
  it('TC-PAY-001: プラン変更時はprorationを作成', async () => {
    const mockStripe = vi.mocked(stripe);
    mockStripe.subscriptions.update.mockResolvedValue({ /* mock */ });
    
    await upgradeSubscription('sub_test', 'price_new');
    
    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
      'sub_test',
      expect.objectContaining({
        proration_behavior: 'create_prorations',
      })
    );
  });
});
```

### Integration Tests（Vitest + Stripe Test Mode）

実際の Stripe API（テストモード）を使ってテスト：

```typescript
// test/integration/stripe-checkout.test.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY!);

describe('Stripe Checkout', () => {
  it('TC-PAY-010: Checkout Session を作成できる', async () => {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        price: process.env.STRIPE_TEST_PRICE_ID,
        quantity: 1,
      }],
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
    });
    
    expect(session.url).toContain('checkout.stripe.com');
    expect(session.mode).toBe('subscription');
  });
});
```

### E2E Tests（Playwright）

実ブラウザでテストカード入力までシミュレート：

```typescript
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';

test('SCN-PAY-001: 月額プランを契約できる', async ({ page }) => {
  // 価格ページから Checkout へ
  await page.goto('/pricing');
  await page.getByRole('button', { name: 'プロプランで始める' }).click();
  
  // Stripe Checkout（外部ドメイン）
  await page.waitForURL(/checkout\.stripe\.com/);
  
  // テストカード入力
  await page.fill('[name="cardNumber"]', '4242 4242 4242 4242');
  await page.fill('[name="cardExpiry"]', '12 / 30');
  await page.fill('[name="cardCvc"]', '123');
  await page.fill('[name="billingName"]', 'Test User');
  
  // 決済実行
  await page.getByRole('button', { name: /Pay|決済|Subscribe/ }).click();
  
  // 自社サイトへリダイレクト
  await page.waitForURL(/\/success/);
  await expect(page.getByText('ご契約ありがとうございます')).toBeVisible();
  
  // Webhook 処理完了を少し待つ（テスト環境では数秒で完了）
  await page.waitForTimeout(3000);
  
  // ダッシュボードでアクティブステータス確認
  await page.goto('/dashboard');
  await expect(page.getByText('プロプラン')).toBeVisible();
});
```

### Webhook Tests

Stripe CLI で発火 → 自社ハンドラの挙動を検証：

```typescript
// test/integration/webhook.test.ts
import { handleStripeEvent } from '@/lib/stripe/webhooks';
import { mockStripeEvent } from './fixtures/stripe-events';

describe('Stripe Webhook Handler', () => {
  it('TC-PAY-WH-001: customer.subscription.created を処理できる', async () => {
    const event = mockStripeEvent('customer.subscription.created', {
      id: 'sub_test_123',
      customer: 'cus_test_456',
      status: 'active',
      // ...
    });
    
    await handleStripeEvent(event);
    
    // DBに記録されていることを確認
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripe_subscription_id, 'sub_test_123'),
    });
    expect(sub).toBeDefined();
    expect(sub?.status).toBe('active');
  });
  
  it('TC-PAY-WH-002: 同じイベントを2回処理しない（冪等性）', async () => {
    const event = mockStripeEvent(/*...*/);
    
    await handleStripeEvent(event);
    await handleStripeEvent(event);  // 2回目
    
    const subs = await db.query.subscriptions.findMany({
      where: eq(subscriptions.stripe_subscription_id, 'sub_test_123'),
    });
    expect(subs).toHaveLength(1);  // 重複していない
  });
});
```

## 必須テストシナリオ

### Critical（必ずテスト）

- [ ] 月額プラン契約成功
- [ ] 月額プラン契約失敗（カード拒否）
- [ ] 3DSecure 要求 → 認証成功
- [ ] 3DSecure 要求 → 認証失敗
- [ ] サブスク状態変更が Webhook で正しく反映
- [ ] 同じイベントの2回受信で重複しない（冪等性）
- [ ] Webhook 署名検証（偽イベントは拒否）
- [ ] 解約 → 期間終了まで利用可能 → 期間終了で機能制限
- [ ] 課金失敗 → past_due → リトライ成功 → active

### Major（推奨）

- [ ] プランアップグレード（proration 計算）
- [ ] プランダウングレード
- [ ] トライアル期間中の機能利用
- [ ] トライアル → 自動課金
- [ ] トライアル → カード未登録で自動解約
- [ ] Customer Portal で解約
- [ ] Customer Portal でカード変更
- [ ] 適格請求書PDF生成
- [ ] B2B顧客の Tax ID 登録
- [ ] 多通貨対応（必要なら）

### Minor

- [ ] メール通知のテキスト
- [ ] エラーメッセージのローカライズ
- [ ] 領収書PDF の見た目

## CI/CD 統合

```yaml
# .github/workflows/test.yml
- name: Run Stripe Integration Tests
  env:
    STRIPE_TEST_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
    STRIPE_TEST_PRICE_ID: ${{ secrets.STRIPE_TEST_PRICE_ID }}
  run: npm run test:integration
```

## 本番デプロイ前のチェック

- [ ] Live mode の API key を環境変数に設定
- [ ] Webhook エンドポイントが Live mode のURL に対応
- [ ] Webhook シークレットも Live 用に設定
- [ ] テストモードのデータが本番DBに混入していない
- [ ] 価格・税設定の最終確認（特に内税/外税）
- [ ] 適格請求書発行事業者の登録番号設定
- [ ] Customer Portal の設定完了
- [ ] Dunning（督促）設定完了
- [ ] 通知メールテンプレートの日本語化

## アンチパターン

1. **Live keyで開発・テスト**：実際のお金が動く
2. **Webhook シークレットの混同**：テスト用と本番用を間違える
3. **テストデータを本番に混入**：清掃漏れ
4. **3DSecure 必須シナリオを未テスト**：日本のカードで失敗
5. **Stripe CLI を使わない Webhook 開発**：エンドポイントが孤立してテスト不能
6. **モックだけでテスト完了**：実 Stripe API の挙動を検証していない
