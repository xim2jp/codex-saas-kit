# 実装パターン（Next.js App Router）

PostHog / GA4 / Vercel Analytics を Next.js 15 (App Router) の野口さんスタックに組み込む標準パターン。量産テンプレ化のため、案件をまたいでこのまま流用できる形にしている。

## 1. PostHog Provider のセットアップ

### インストール

```bash
npm install posthog-js posthog-node
```

### Client Provider（`app/providers.tsx`）

```typescript
'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    person_profiles: 'identified_only', // 匿名イベントでプロファイルを作らずコスト抑制
    capture_pageview: false, // App Router では手動送信（下記 PageviewTracker で対応）
    // PIIを自動収集させない（詳細は本ファイル 4章）
  });
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
```

### ページビュー計測（App Router はルート遷移をフックする必要がある）

```typescript
// app/posthog-pageview.tsx
'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';

export function PostHogPageview(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (!pathname || !posthog) return;
    const url = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams, posthog]);

  return null;
}
```

### `app/layout.tsx` への組み込み

```typescript
import { PostHogProvider } from './providers';
import { PostHogPageview } from './posthog-pageview';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <PostHogProvider>
          <PostHogPageview />
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
```

### サーバーサイドイベント送信（Server Action / Webhook から）

Stripe Webhook 等、サーバー側で確定するイベント（`subscription_started` 等）は `posthog-node` で送る。

```typescript
// lib/posthog-server.ts
import { PostHog } from 'posthog-node';

let client: PostHog | null = null;

export function getPostHogServerClient(): PostHog {
  if (!client) {
    client = new PostHog(process.env.POSTHOG_PROJECT_API_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      flushAt: 1, // サーバーレス環境ではリクエストごとに即flush
      flushInterval: 0,
    });
  }
  return client;
}

// Stripe Webhookハンドラ内での使用例
export async function trackSubscriptionStarted(userId: string, planId: string, amountJpy: number) {
  const posthog = getPostHogServerClient();
  posthog.capture({
    distinctId: userId, // クライアント側と同じdistinct_idで紐付け
    event: 'subscription_started',
    properties: { plan_id: planId, amount_jpy: amountJpy },
  });
  await posthog.shutdown(); // サーバーレスでは明示的にflushして終了
}
```

## 2. GA4 (gtag.js) の組み込み

### `app/layout.tsx` へのタグ挿入（`next/script` 使用）

```typescript
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="ja">
      <body>
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}', { anonymize_ip: true });
              `}
            </Script>
          </>
        )}
        {children}
      </body>
    </html>
  );
}
```

- `anonymize_ip: true` で IP を切り詰めて保存（PII対策の一環）。
- App Router のルート遷移を GA4 に送りたい場合は PostHog と同様に `usePathname` を監視するクライアントコンポーネントで `gtag('event', 'page_view', ...)` を発火する（SPA遷移は自動計測されないため）。

### イベント送信ヘルパー

```typescript
// lib/gtag.ts
export function gaEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, params);
}
```

## 3. Vercel Analytics の導入

```bash
npm install @vercel/analytics @vercel/speed-insights
```

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

- `Analytics`（Web Analytics：訪問数・ページ別集計）と `SpeedInsights`（Core Web Vitals）は別パッケージ。両方入れて良い。
- 追加の環境変数設定は不要（Vercel デプロイ環境で自動有効化）。ローカル開発では計測されない。
- カスタムイベントも送れるが（`track()` 関数）、詳細なファネル分析は PostHog に寄せ、Vercel Analytics は簡易指標に留める（`tool-selection.md` の役割分担）。

## 4. PIIマスキング設計（observability-integration と方針統一）

`observability-integration/references/security-and-pii.md` は「保存後は消せない → 取り込み前にマスクする」を大原則としている。アナリティクス側でもこの**「取り込み前マスキング」の考え方をそのまま踏襲**する。

### 大原則

> **イベントプロパティに生の個人情報（メールアドレス・氏名・電話番号・住所）を絶対に載せない。ユーザー識別は Supabase の `user.id`（UUID）等の匿名化・仮名化されたIDのみを使う。**

### 実装ルール

| 項目 | ルール |
|------|--------|
| ユーザー識別 | PostHog `distinct_id` / GA4 `user_id` は Supabase の `auth.users.id`（UUID）を使う。メールを識別子にしない |
| イベントプロパティ | `email` / `name` / `phone` / `address` 等のキーを**送信前に除去**するユーティリティを共通化する |
| フォーム系イベント | 入力値そのもの（`value`）を送らず、`field_name` や `step` 等のメタ情報のみ送る |
| Session Replay（PostHog） | `maskAllInputs: true`（デフォルト）を維持。入力欄は自動マスクされる設定のまま変更しない |
| URLクエリ | `email=` 等のPIIを含むクエリパラメータをイベントの `$current_url` から除去する（PostHogの `sanitize_properties` 等で対応） |

### 共通サニタイズユーティリティ（実装例）

```typescript
// lib/analytics-sanitize.ts
const PII_KEYS = ['email', 'name', 'phone', 'address', 'password'] as const;

export function sanitizeEventProperties<T extends Record<string, unknown>>(
  properties: T
): Omit<T, (typeof PII_KEYS)[number]> {
  const clone = { ...properties };
  for (const key of PII_KEYS) {
    delete (clone as Record<string, unknown>)[key];
  }
  return clone;
}

// 使用例
posthog.capture('user_signed_up', sanitizeEventProperties({
  plan_id: 'starter',
  source: 'organic',
  email: user.email, // ← ここで自動的に除去される
}));
```

- PostHog の `posthog.init` に `before_send` フックを設定し、`sanitizeEventProperties` をグローバル適用するとより堅牢（実装者の入れ忘れを防げる）。

```typescript
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  // ...
  before_send: (event) => {
    if (event?.properties) {
      event.properties = sanitizeEventProperties(event.properties);
    }
    return event;
  },
});
```

## 5. 環境変数一覧（`.env.example` に列挙）

| 変数名 | 区分 | 用途 |
|--------|------|------|
| `NEXT_PUBLIC_POSTHOG_KEY` | 公開 | PostHog クライアントSDK |
| `NEXT_PUBLIC_POSTHOG_HOST` | 公開 | PostHog リージョン指定（`us`/`eu`） |
| `POSTHOG_PROJECT_API_KEY` | 公開相当（サーバー用途） | サーバーサイドイベント送信 |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | 公開 | GA4 測定ID（`G-XXXXXXX`） |

- Vercel Analytics / Speed Insights は環境変数不要（デプロイ環境で自動検出）。
- 秘密情報を要するキーはこの3ツールには基本的に存在しない（GA4/PostHogクライアントキーはブラウザに出る前提の公開値）。

## 6. レビュー用チェックリスト（implementation-reviewer）

- [ ] `distinct_id` / GA4 `user_id` にメール等の生PIIを使っていない
- [ ] イベントプロパティに `email` / `name` / `phone` 等が混入していない（`sanitizeEventProperties` 等で防御済み）
- [ ] PostHog Session Replay の入力マスクが無効化されていない
- [ ] サーバーサイドイベントとクライアントサイドイベントで同一イベントの二重送信がない
- [ ] イベント命名規則（`funnel-and-kpi.md` 参照）に準拠している
- [ ] `.env.example` に必要な環境変数が漏れなく列挙されている
- [ ] Vercel Analytics / SpeedInsights がルートレイアウトに導入されている

## 出典（一次ソース）

- PostHog Next.js SDK: https://posthog.com/docs/libraries/next-js
- PostHog before_send / データマスキング: https://posthog.com/docs/product-analytics/data-management
- PostHog Session Replay privacy: https://posthog.com/docs/session-replay/privacy
- GA4 gtag.js 実装ガイド: https://developers.google.com/analytics/devguides/collection/ga4
- GA4 データ保持・匿名化: https://support.google.com/analytics/answer/9713013
- Vercel Analytics 導入手順: https://vercel.com/docs/analytics/quickstart
- Vercel Speed Insights: https://vercel.com/docs/speed-insights
