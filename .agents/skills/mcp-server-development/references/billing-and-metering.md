# Billing and Metering（AI向け従量課金）

MCP 経由のツール呼び出しを Stripe Billing Meters で従量課金し、人間向けの月額サブスク（stripe-integration Skill）とハイブリッドで価格設計するための指針。

> **役割分担**：サブスクの基本設計（Product/Price構造、Webhook処理、インボイス制度対応、PCI DSS等）は既存の **stripe-integration Skill** が土台。本ファイルはその上に **「AIエージェントからの呼び出し量に応じた従量課金」という MCP 固有の文脈を追加**する位置づけ。サブスク設計の一般論はそちらを必ず参照すること。

## 1. なぜ従量課金が必要か

MCP 経由の利用は、ブラウザ操作と負荷特性が異なる。

- AIエージェントは自動化されたワークフローの中で**高頻度・バースト的**にツールを呼び出しうる
- 1ユーザーが人間として使う分には軽い操作でも、AIエージェントに自動化されると呼び出し回数が数十〜数百倍になりうる
- 定額サブスクだけでは、ヘビーユーザー（自動化を進めた顧客ほど）のコストを回収できない、あるいは軽量ユーザーに対して過剰な価格になる

> **野口さんの結論**：**人間向けサブスク（基本料金）+ MCPツール呼び出しの従量課金**をハイブリッドにする。サブスクにはツール呼び出しの無料枠（例：月1,000回）を含め、超過分を Stripe Billing Meters で計測・課金する。

## 2. Stripe Billing Meters の基本概念

Meters API（2024年導入・GA）が従量課金の正式な実装方法。旧来の `subscriptionItems.createUsageRecord`（レガシー）は置き換えられた。

```
Meter（追跡するイベントと集計ルールを定義）
  └─ Price（Meterに紐づき単価を設定）
       └─ Subscription（顧客とPriceを紐付け）
            └─ Meter Events（課金対象の生の利用データ、都度送信）
```

- **Meter**：「何を数えるか」を定義するカウンターのようなもの（例：`mcp_tool_calls`）。集計方法（合計・最大値等）を指定
- **Price**：Meter に紐づく単価（例：呼び出し1回あたり ¥1、または段階的な tiered pricing）
- **Subscription**：顧客が Meter付き Price を含むプランに加入している状態
- **Meter Events**：実際の利用が発生するたびに Stripe に送る生データ。`event_name`、`timestamp`、`payload`（`stripe_customer_id`, `value` を含む）を持つ

## 3. Meter Event 送信パターン：自社DB経由の非同期同期（推奨）

MCP ツールが呼ばれるたびに Stripe API を同期的に呼ぶのは避ける。

```
❌ 避けるパターン：ツール実行のたびにインラインでStripe API呼び出し
  → 遅い（ツールのレイテンシにStripe API呼び出しが乗る）
  → 壊れやすい（Stripeダウン時にツール実行自体が失敗する/課金データを失う）

✅ 推奨パターン：自社DB書き込み → 非同期でStripeに同期
  1. ツール実行時、自社DB（Supabase）の usage_events テーブルに即座に記録
  2. バックグラウンドジョブ（Vercel Cron 等）が未同期レコードを定期的にまとめて
     Stripe Meter Event として送信
  3. Stripeがダウンしていても利用データは自社DBに残り、次回実行時にリトライできる
```

### 実装例：ツール実行時の記録

```ts
// lib/mcp/metering.ts
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function recordToolCall(params: {
  tenantId: string;
  stripeCustomerId: string;
  toolName: string;
}) {
  await supabaseAdmin.from('usage_events').insert({
    tenant_id: params.tenantId,
    stripe_customer_id: params.stripeCustomerId,
    event_name: 'mcp_tool_call',
    tool_name: params.toolName,
    occurred_at: new Date().toISOString(),
    synced_to_stripe: false,
  });
}
```

```ts
// app/api/mcp/route.ts（ツール実行のラッパー内で呼ぶ）
server.tool('myapp_records_create', '...', schema, async (input, { authInfo }) => {
  const allowed = await checkFreeQuota(authInfo);
  if (!allowed) {
    return {
      content: [
        {
          type: 'text',
          text:
            'Monthly free quota (1,000 calls) exceeded. ' +
            'Additional calls are billed at ¥1/call, or upgrade your plan: ' +
            'https://myapp.example.com/billing',
        },
      ],
      isError: true,
    };
  }

  const result = await createRecord(input);
  await recordToolCall({
    tenantId: authInfo.tenantId,
    stripeCustomerId: authInfo.stripeCustomerId,
    toolName: 'myapp_records_create',
  });
  return result;
});
```

### 実装例：Vercel Cron でのバッチ同期

```ts
// app/api/cron/sync-meter-events/route.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(req: Request) {
  // Vercel Cron からの呼び出しであることを検証（Authorization header等）
  const unsynced = await fetchUnsyncedUsageEvents(); // usage_events から synced_to_stripe=false を取得

  for (const event of unsynced) {
    try {
      await stripe.billing.meterEvents.create({
        event_name: 'mcp_tool_call',
        payload: {
          stripe_customer_id: event.stripeCustomerId,
          value: '1',
        },
        timestamp: Math.floor(new Date(event.occurredAt).getTime() / 1000),
      });
      await markSynced(event.id);
    } catch (err) {
      // 失敗したレコードは synced_to_stripe=false のまま残す → 次回リトライ
      console.error('Meter event sync failed', event.id, err);
    }
  }

  return Response.json({ synced: unsynced.length });
}
```

```jsonc
// vercel.json
{
  "crons": [{ "path": "/api/cron/sync-meter-events", "schedule": "*/15 * * * *" }],
}
```

15分おきなど、リアルタイム性より信頼性・実装のシンプルさを優先する（無料枠のCronジョブ実行回数にも配慮）。

## 4. 無料枠の実装（自社DBでカウント）

無料枠の判定は Stripe に問い合わせず、**自社DB側で完結**させる（レイテンシとコストの両方の理由）。

```ts
// lib/mcp/quota.ts
export async function checkFreeQuota(authInfo: { tenantId: string }): Promise<boolean> {
  const periodStart = getCurrentBillingPeriodStart(); // サブスクの current_period_start に揃える
  const { count } = await supabaseAdmin
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', authInfo.tenantId)
    .gte('occurred_at', periodStart.toISOString());

  const FREE_QUOTA = 1000;
  return (count ?? 0) < FREE_QUOTA;
}
```

- 無料枠を超えた場合の挙動は2択：**従量課金で継続許可**（Meters課金に自然に移行）か、**ツール呼び出しを拒否してアップセルメッセージを返す**か
- 野口さんの財務制約（想定外コストを避けたい）を踏まえると、**プラン別にどちらの挙動にするかを明示的に設計する**（例：無料プランは拒否＋アップセル、有料プランは従量課金で継続）

```ts
// プラン別の挙動分岐イメージ
if (!allowed) {
  if (plan === 'free') {
    return {
      content: [{ type: 'text', text: 'Free quota exceeded. Upgrade: https://.../billing' }],
      isError: true,
    };
  }
  // 有料プランは従量課金で継続許可（Meter Eventは通常どおり記録）
}
```

## 5. レート制限との併用

従量課金と別に、**レート制限**（例：1分あたり60回まで）を設けて異常なバースト（バグのある自動化・悪意ある利用）から保護する。Vercel Firewall のレート制限機能、または `lib/mcp/rate-limit.ts` で Supabase/Upstash 等を使った簡易実装を用意する。従量課金は「コストの回収」、レート制限は「システム保護」という異なる目的であることを区別する。

## 6. Stripe Price 設定例（tiered pricing）

```ts
const meter = await stripe.billing.meters.create({
  display_name: 'MCP Tool Calls',
  event_name: 'mcp_tool_call',
  default_aggregation: { formula: 'sum' },
});

const price = await stripe.prices.create({
  currency: 'jpy',
  billing_scheme: 'tiered',
  tiers_mode: 'graduated',
  tiers: [
    { up_to: 1000, unit_amount: 0 }, // 無料枠相当（サブスク側で吸収する場合は省略も可）
    { up_to: 10000, unit_amount: 1 }, // 1回あたり¥1
    { up_to: 'inf', unit_amount: 0.5 }, // 大口は単価を下げる
  ],
  recurring: { interval: 'month', usage_type: 'metered', meter: meter.id },
  product: productId,
});
```

無料枠をサブスク基本料金側の説明にとどめ、Stripe Price 自体は超過分のみを課金する設計（tier の `up_to: 1000` を無料枠と一致させない）でも構わない。**自社DBでの無料枠判定とStripeの課金開始点は必ず一致させる**（ズレるとユーザーの不信を招く）。

## 7. 野口さん財務制約との整合

- 従量課金の実装自体は Stripe 標準機能の範囲で完結し、追加の有料ミドルウェアを導入しない
- Vercel Cron の無料枠内（実行回数・実行時間）で同期ジョブが収まるよう、バッチ頻度と処理件数を設計する
- 想定外の高額請求を顧客に発生させないため、**プランごとに上限（ハードキャップ）を設ける選択肢**も検討する（従量課金でも一定回数で拒否に切り替える）。民事再生中の立場として、顧客とのトラブル（想定外請求のクレーム）を避ける設計を優先する

## 野口さん固有のチェック

- [ ] サブスク基本設計は stripe-integration Skill に従っているか（本ファイルはMCP従量課金の追加分のみ）
- [ ] Meter Event 送信を自社DB経由の非同期同期にしているか（インライン同期呼び出しにしていないか）
- [ ] 無料枠判定を自社DBで完結させているか（Stripe問い合わせなし）
- [ ] プランごとに無料枠超過時の挙動（従量課金継続 or 拒否+アップセル）を明示的に設計しているか
- [ ] レート制限と従量課金の目的を混同していないか
- [ ] 顧客への想定外請求を避けるハードキャップの要否を検討したか
- [ ] Meter Event 同期ジョブがVercel Cronの無料枠内で収まるか

## アンチパターン

1. **ツール実行のたびに同期でStripe API呼び出し**：レイテンシ増・Stripe障害時にデータ損失
2. **レガシーな `createUsageRecord` を新規実装で使う**：Meters APIに置き換え済み
3. **無料枠判定のたびにStripeに問い合わせる**：不要なコストとレイテンシ
4. **無料枠の閾値を自社DBとStripe Priceでズラす**：顧客への説明と実際の請求が食い違う
5. **レート制限を実装せず従量課金だけに頼る**：バグや悪意ある自動化で異常な呼び出し量が発生しうる
6. **ハードキャップなしで無制限課金を許可する**：顧客の想定外請求トラブルにつながる

## 出典・参照した一次ソース

- Stripe「Billing Meter」API リファレンス: https://docs.stripe.com/api/billing/meter
- Stripe「Usage-based billing analytics」: https://docs.stripe.com/billing/subscriptions/usage-based/analytics
- Stripe「Usage-based billing migration guide」（レガシーからの移行）: https://docs.stripe.com/billing/subscriptions/usage-based-legacy/migration-guide
- 既存の stripe-integration Skill（サブスク・Webhook・税務の一般論）: `.agents/skills/stripe-integration/`

※ Meters API・tiered pricing の詳細仕様・料金体系は変更されうるため、実装直前に Stripe 公式ドキュメントで最新の Meter/Price 作成パラメータを再確認すること。
