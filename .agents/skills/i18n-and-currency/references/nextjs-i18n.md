# Next.js App Router 多言語実装パターン（next-intl）

`next-intl` を用いた Next.js App Router（野口さんの Tier A スタック）での多言語対応実装パターン集。単一言語案件でも `app/[locale]/` 構造だけは最初から敷いておくことで、後の言語追加コストを最小化する。

## なぜ next-intl か

| 選択肢 | 評価 |
|--------|------|
| **next-intl** | App Router 公式パターンに最適化。Server/Client Component 両対応、型安全なメッセージキー、無料OSS | **採用** |
| next-i18next | Pages Router 前提の設計が色濃く残り App Router との相性が悪い | 非推奨 |
| react-intl 単体 | ルーティング統合がなく middleware・metadata 連携を自前実装する必要がある | 非推奨 |
| 自前実装（JSON + Context） | 小規模なら可能だが、SEO の hreflang・静的生成との統合を自前で作り込むコストが大きい | 特殊事情がない限り非推奨 |

> **基本方針：迷ったら next-intl。無料・OSS で野口さんの財務制約に適合し、App Router との統合が最も枯れている。**

## 1. ディレクトリ構成（`app/[locale]/`）

```
app/
├── [locale]/
│   ├── layout.tsx          # ロケール別 layout（<html lang> 設定）
│   ├── page.tsx             # トップページ
│   ├── (marketing)/
│   │   └── pricing/page.tsx
│   └── (app)/
│       └── dashboard/page.tsx
├── api/                      # API Routes はロケール外（言語非依存）
├── sitemap.ts
├── robots.ts
└── layout.tsx                 # ルート layout（ロケール非依存の共通ラッパー）
```

- ルーティングセグメントとして `[locale]` を導入することで、**全ページが自動的にロケール別URL**（`/ja/pricing`, `/en/pricing`）になる。
- API Routes・Webhook（Stripe等）はロケール概念を持たないため `app/api/` は `[locale]` の外に置く。
- 単一言語案件でも、この構造だけ作り `messages/ja.json` のみ用意しておけば、2言語目追加時はメッセージファイル追加とロケールリスト更新だけで済む。

## 2. 設定ファイル（`i18n/routing.ts` / `i18n/request.ts`）

```typescript
// i18n/routing.ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ja', 'en'],       // 対応ロケール。東南アジア展開時は 'th', 'vi', 'id' 等を追加
  defaultLocale: 'ja',
  localePrefix: 'always',      // 常に /ja, /en を付与（'as-needed' はデフォルトのみ省略）
});
```

```typescript
// i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

```typescript
// next.config.ts
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

export default withNextIntl({
  // 既存の Next.js 設定
});
```

## 3. middleware でのロケール検出・リダイレクト

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // 静的アセット・API Routes を除外
  matcher: ['/((?!api|trpc|_next|_vercel|.*\\..*).*)'],
};
```

- ロケール検出の優先順位：①URLの `[locale]` セグメント → ②Cookie（`NEXT_LOCALE`。ユーザーが手動切替した場合に保存） → ③ `Accept-Language` ヘッダー → ④ `defaultLocale`。
- 認証 middleware（Supabase Auth）と併用する場合は、`next-intl` の middleware を先に通してロケール解決を済ませてから認可チェックを行う順序にする（両者を1つの middleware 関数にまとめて呼び出しチェーンにするのが実務上簡単）。

```typescript
// middleware.ts（Supabase Auth と併用する場合の骨子）
import { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { updateSession } from '@/lib/supabase/middleware';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  return updateSession(request, response); // Supabase セッション更新をチェーン
}

export const config = {
  matcher: ['/((?!api|trpc|_next|_vercel|.*\\..*).*)'],
};
```

## 4. メッセージファイルの管理（`messages/ja.json`, `messages/en.json`）

```json
// messages/ja.json
{
  "Pricing": {
    "title": "料金プラン",
    "cta": "今すぐ始める",
    "monthlyPrice": "{price} / 月"
  },
  "Common": {
    "loading": "読み込み中...",
    "error": "エラーが発生しました"
  }
}
```

```json
// messages/en.json
{
  "Pricing": {
    "title": "Pricing",
    "cta": "Get Started",
    "monthlyPrice": "{price} / month"
  },
  "Common": {
    "loading": "Loading...",
    "error": "Something went wrong"
  }
}
```

- **名前空間（`Pricing`, `Common` 等）で機能単位に分割**する。1ファイル全体をフラットに書くとキー衝突・レビュー負荷が増える。
- 補間（`{price}`）・複数形（`plural`）・ICU MessageFormat をサポート。日付や単位が混ざる文言は決め打ち文字列にせず補間を使う。
- キーの型安全化：`next-intl` はメッセージ型を自動推論できる設定があり、存在しないキーの参照をビルド時に検出できる（`global.d.ts` で `IntlMessages` を型付け）。

```typescript
// global.d.ts
import ja from './messages/ja.json';

type Messages = typeof ja;

declare global {
  interface IntlMessages extends Messages {}
}
```

## 5. Server Component / Client Component の使い分け

| 用途 | 関数 | 使う場所 |
|------|------|---------|
| サーバーで翻訳文字列を取得 | `getTranslations` | Server Component、`generateMetadata`、Route Handler |
| クライアントで翻訳文字列を取得（インタラクティブUI） | `useTranslations` | Client Component（`'use client'`） |
| フォーマット（日付・数値・通貨） | `getFormatter`（サーバー）/ `useFormatter`（クライアント） | 両方 |

```typescript
// Server Component: app/[locale]/(marketing)/pricing/page.tsx
import { getTranslations } from 'next-intl/server';

export default async function PricingPage() {
  const t = await getTranslations('Pricing');

  return (
    <div>
      <h1>{t('title')}</h1>
      <button>{t('cta')}</button>
    </div>
  );
}
```

```typescript
// Client Component: components/LocaleSwitcher.tsx
'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation'; // next-intl のロケール対応ラッパー

export function LocaleSwitcher() {
  const t = useTranslations('Common');
  const pathname = usePathname();
  const router = useRouter();

  return (
    <select
      onChange={(e) => router.replace(pathname, { locale: e.target.value })}
      aria-label={t('loading')}
    >
      <option value="ja">日本語</option>
      <option value="en">English</option>
    </select>
  );
}
```

- `next/link` / `next/navigation` をそのまま使うとロケールプレフィックスが自動付与されないため、**`next-intl` が提供するロケール対応ラッパー（`i18n/navigation.ts` で `createNavigation` により生成）を使う**。

```typescript
// i18n/navigation.ts
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

## 6. 日付・数値のフォーマット（`useFormatter`）

```typescript
'use client';
import { useFormatter } from 'next-intl';

export function OrderSummary({ date, amount }: { date: Date; amount: number }) {
  const format = useFormatter();

  return (
    <p>
      {format.dateTime(date, { dateStyle: 'medium' })} —{' '}
      {format.number(amount, { style: 'currency', currency: 'JPY' })}
    </p>
  );
}
```

- 通貨コードはロケールに紐付けず、**実際の決済通貨（Stripe の Price 通貨）に合わせて動的に指定**する（`references/multi-currency-stripe.md` 参照）。日本語UIでも米ドル建て価格を表示するケースがあるため、ロケール＝通貨と決め打ちしない。
- `useFormatter` / `getFormatter` は `Intl.DateTimeFormat` / `Intl.NumberFormat` のラッパーであり、ロケール別の桁区切り・曜日表記・相対時間（`format.relativeTime`）も扱える。

## 7. SEO（hreflang、`generateMetadata` でのlocale別metadata）

```typescript
// app/[locale]/(marketing)/pricing/page.tsx
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Pricing' });

  return {
    title: t('title'),
    alternates: {
      canonical: `/${locale}/pricing`,
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `/${l}/pricing`])
      ),
    },
  };
}
```

- `alternates.languages` で Next.js が `<link rel="alternate" hreflang="...">` を自動出力する。**ロケールごとに canonical を個別指定し、hreflang の相互参照が欠けないようにする**（A→B はあるが B→A がない、という事故を防ぐ）。
- `x-default` を含めたい場合は `languages` に `'x-default': '/ja/pricing'` のように明示追加する。
- 多言語 sitemap（`app/sitemap.ts`）も同様にロケールごとのURLを列挙する。この節は `seo-toolkit` Skill の `technical-seo.md` と直接関係するため、**実装時は両方を突き合わせて矛盾がないか確認する**（例：`seo-toolkit` 側で canonical 方針が別途決まっている場合はそちらを優先し本Skillの例をそれに合わせる）。

```typescript
// app/sitemap.ts（抜粋）
import { routing } from '@/i18n/routing';

export default function sitemap() {
  const pages = ['', '/pricing', '/about'];
  return pages.flatMap((page) =>
    routing.locales.map((locale) => ({
      url: `https://example.com/${locale}${page}`,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `https://example.com/${l}${page}`])
        ),
      },
    }))
  );
}
```

## 8. 翻訳の量産方法（1名運用向け軽量フロー）

野口Profile（1名運用・民事再生中で翻訳会社への外注コストを避けたい）を前提に、**Claude API で翻訳ドラフトを生成し、人手は要点レビューのみ**行うフローを標準とする。

### フロー

1. **原文確定**：まず日本語（`messages/ja.json`）を確定させる。原文が揺れると全言語に波及するため、原文の完成度を最優先する。
2. **AIドラフト生成**：Claude API に `ja.json` 全体（または差分キーのみ）を渡し、対象言語への翻訳とキー構造を維持したJSONを生成させる。
3. **機械的検証**：生成結果に対して、キーの過不足（`ja.json` とキー集合が一致するか）を CI やスクリプトで検証する。
4. **人手レビュー（軽量）**：野口さんは全文を読むのではなく、**CTA・料金文言・エラーメッセージなど「事業影響が大きい文言」のみ**重点レビューする。UI補助文言（ラベル等）は機械翻訳のまま許容する運用でも実害は小さい。
5. **ネイティブチェック（任意・低頻度）**：本格展開する言語のみ、初回リリース時に限りネイティブスピーカーへのスポットチェックを検討する（継続的な外注はしない）。

```typescript
// scripts/translate-messages.ts（骨子）
import Anthropic from '@anthropic-ai/sdk';
import ja from '../messages/ja.json';
import fs from 'node:fs';

const anthropic = new Anthropic();

async function translate(targetLocale: string, targetLanguageName: string) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5-5',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `以下のJSONをキー構造を完全に維持したまま${targetLanguageName}に翻訳してください。JSON以外の説明文は出力しないでください。\n\n${JSON.stringify(ja, null, 2)}`,
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  fs.writeFileSync(`messages/${targetLocale}.json`, text);
}

// 例: 英語ドラフト生成
translate('en', 'English');
```

- キー欠落検出スクリプト（差分検証）を CI に組み込み、**翻訳漏れがマージ前に機械的に検出される**ようにするのが1名運用での品質担保の要。
- 東南アジア展開を見据える場合、タイ語・ベトナム語・インドネシア語・マレー語のドラフトもこの同じフローで生成できる。電話・音声チャネルでの現地言語対応（特にフィリピンのタガログ語/ビサヤ語）は `ai-calling-philippines` Skill の守備範囲であり、本Skillのテキスト翻訳フローとは別に検討する。

## 出典

- next-intl 公式ドキュメント: https://next-intl.dev/
- Next.js Internationalization (i18n) Routing: https://nextjs.org/docs/app/building-your-application/routing/internationalization
- Next.js Metadata API（`alternates.languages`）: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- MDN Intl（`Intl.NumberFormat` / `Intl.DateTimeFormat`）: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl

実装直前に上記URLで API・設定オプションの最新仕様を再確認すること（`next-intl` は破壊的変更を伴うメジャーアップデートが定期的に入る）。
