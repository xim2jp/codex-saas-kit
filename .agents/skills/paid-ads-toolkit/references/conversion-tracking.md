# コンバージョン計測（Pixel/Conversions API・GA4連携）

広告の成果測定は、iOSのプライバシー強化やブラウザの計測制限により**単一のPixelだけでは信号が欠落しやすい**。サーバーサイド計測を含めた冗長化された計測設計を行う。

## 2026年時点の計測環境の前提

- iOS 14以降のApp Tracking Transparency（ATT）以降、ブラウザ・OSレベルでの計測制限が常態化しており、**クライアントサイドのPixelのみに依存すると信号が欠落する**
- Metaは2026年にピクセルとConversions API（CAPI）の連携を強化し、ピクセルタグが設置されていれば管理画面の設定からAIが自動的にページ情報・商品情報をシグナルとして取得・CAPI経由で送信する仕組みへ移行しつつある（詳細は出稿直前に公式ヘルプで確認）
- サーバー経由の計測（Conversions API）は広告ブロッカーやOSのプライバシー制限の影響を受けにくく、**2026年の運用では前提条件**になっている

## 計測アーキテクチャの基本方針

1. **クライアントサイド（Pixel/タグ）とサーバーサイド（Conversions API）を併用**し、重複排除ID（Event ID）で名寄せする
2. Next.js実装では、クライアントサイドのPixel発火はブラウザイベント（ページビュー・フォーム送信等）に紐づけ、サーバーサイドはStripeのWebhookやSupabaseのDB書き込みイベント（新規登録・課金確定等）をトリガーに送信する
3. **本当に重要なコンバージョン（新規登録・課金）はサーバーサイドを正とする**。クライアントサイドの計測欠落があっても事実に基づいた計測ができる

## 媒体別の実装ポイント

| 媒体 | クライアント計測 | サーバーサイド計測 |
|------|------------------|---------------------|
| Meta | Metaピクセル（`fbq`） | Conversions API（Graph API経由でサーバーから送信） |
| TikTok | TikTok Pixel | TikTok Events API |
| X | X Pixel（Conversion Tracking） | Conversion API for Web |
| LINE広告 | LINE Tag | LINE Conversion API |
| Google/YouTube | Google Tag（gtag.js） | Google Ads Enhanced Conversions / Server-side Google Tag Manager |

いずれも実装詳細・エンドポイント仕様は各媒体の公式ドキュメントを実装直前に確認する（更新が速い領域）。

## GA4との連携

- `analytics-integration` Skill の実装パターンと重複させないため、**GA4はファネル分析・KPIダッシュボードの主軸**、本Skillが扱う各媒体のPixel/APIは**広告最適化アルゴリズムへのフィードバック用**という役割分担にする
- UTMパラメータ（`utm_source` / `utm_medium` / `utm_campaign`）を全広告リンクに付与し、GA4側で媒体別のコンバージョンを正確に切り分ける
- Stripeの決済完了イベントをGA4のeコマースイベント（purchase）としても送信し、広告経由の売上を追跡する

## Next.js実装パターン（概要）

```typescript
// app/api/track/conversion/route.ts（サーバーサイド計測の例）
export async function POST(req: Request) {
  const { eventName, eventId, userData, customData } = await req.json();

  // Meta Conversions API へ送信（例）
  await fetch(`https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [{
        event_name: eventName,
        event_id: eventId, // クライアントサイドPixelと重複排除するための共通ID
        event_time: Math.floor(Date.now() / 1000),
        user_data: userData, // メールアドレス等はハッシュ化必須
        custom_data: customData,
      }],
      access_token: META_CAPI_ACCESS_TOKEN,
    }),
  });

  return Response.json({ ok: true });
}
```

- **PII（メールアドレス・電話番号）は必ずハッシュ化（SHA-256）してから送信する**（`observability-integration` Skill のPII対策原則と同様の考え方）
- アクセストークン等の機微情報はサーバー環境変数で管理し、クライアントに露出させない

## StripeのWebhookとの連携

課金確定を「真のコンバージョン」として計測する場合、Stripeの `checkout.session.completed` や `invoice.paid` のWebhookハンドラから各媒体のConversion APIを呼び出す（`stripe-integration` Skill のWebhook実装パターンと統合）。無料トライアル登録と有料転換を別イベントとして計測し、広告の最適化目標（トライアル獲得 vs 有料転換）を明確に分ける。

## 他エージェントとの連携

- **analytics-integration Skill**：GA4のファネル定義・KPIダッシュボードとの役割分担を保つ
- **payment-integration-specialist**：StripeのWebhookイベントから広告コンバージョンAPIを呼び出す実装を協業
- **implementation-worker**：計測コードの実装を担当

## チェックリスト

- [ ] クライアントサイドとサーバーサイドの計測が併用され、重複排除IDで名寄せされているか
- [ ] 真のコンバージョン（課金確定）はサーバーサイド（Webhook起点）で計測されているか
- [ ] PIIはハッシュ化してから送信しているか
- [ ] UTMパラメータが全広告リンクに付与されているか
- [ ] GA4との役割分担（広告最適化用 vs 分析用）が明確か

## アンチパターン

- クライアントサイドPixelのみに依存し、iOSユーザーの計測欠落に気づかない
- PIIを平文のまま送信する
- 重複排除IDを設定せず、同一コンバージョンが二重計上される
- 全てのコンバージョンイベントを同列に扱い、トライアル登録と課金確定の区別をしない

## 出典・一次ソース

- [Meta Conversions API ドキュメント](https://developers.facebook.com/docs/marketing-api/conversions-api)
- [Google Ads Enhanced Conversions](https://support.google.com/google-ads/answer/9888656)
- [TikTok Events API](https://ads.tiktok.com/marketing_api/docs)

計測APIの仕様・認証方式は頻繁に更新されるため、実装直前に各公式ドキュメントで最新のエンドポイント・パラメータを確認すること。
