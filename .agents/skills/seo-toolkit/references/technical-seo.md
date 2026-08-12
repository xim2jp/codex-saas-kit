# テクニカルSEO：Next.js App Router 実装

クローラと生成AIが**サイトを正しく発見・解釈・インデックスできる**ための技術基盤。野口さんスタックの中心 Next.js App Router の**標準機能で完結**させる（SEOプラグインは原則不要）。

## 0. 大原則：レンダリングが渡すHTMLにコンテンツがあること

クローラと一部のAIクローラは JS を実行しないか限定的。**重要ページは SSR/SSG/ISR でHTMLに本文を含める**。CSRオンリー（クライアントfetchで初めて中身が出る）は原則SEO対象外。

| ページ性質 | 戦略 | Next.js |
|-----------|------|---------|
| 営業サイト・LP・法定ページ | SSG（静的） | デフォルト（動的関数なし） |
| ブログ・記事（更新あり） | ISR | `export const revalidate = 3600` |
| 料金・機能（CMS連動） | ISR or SSG | `generateStaticParams` + revalidate |
| ユーザー固有のダッシュボード | CSR/SSR（`noindex`） | SEO対象外でよい |

## 1. メタデータ（Metadata API）

ハードコードせず `generateMetadata` でページ別に。重複 title/description はランキングを下げる。

```tsx
// app/(marketing)/pricing/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '料金プラン｜シフト管理SaaS ○○',          // 各ページ固有・60字以内目安
  description: '月額980円から。14日間無料トライアル...', // 120字前後、CTRを意識した訴求
  alternates: { canonical: 'https://example.com/pricing' }, // 自己参照canonical
  openGraph: {
    title: '料金プラン｜○○',
    description: '...',
    url: 'https://example.com/pricing',
    siteName: '○○',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
};
```

ルート `layout.tsx` で `metadataBase` を必ず設定（OG画像の相対パス解決に必須）：

```tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://example.com'),
  title: { default: '○○ - シフト作成を3時間から10分に', template: '%s｜○○' },
};
```

動的ページは関数版で：

```tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.slug);
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `https://example.com/blog/${post.slug}` },
  };
}
```

## 2. サイトマップ（app/sitemap.ts）

```tsx
// app/sitemap.ts
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://example.com';
  const posts = await getAllPosts();

  const staticPages = ['', '/features', '/pricing', '/faq', '/about'].map((p) => ({
    url: `${base}${p}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: p === '' ? 1 : 0.8,
  }));

  const blogPages = posts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...blogPages];
}
```

- 5万URL/50MB を超えるならサイトマップを分割（`sitemap.ts` で複数生成）
- 生成後 Search Console に `https://example.com/sitemap.xml` を送信

## 3. robots（app/robots.ts）

```tsx
// app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/dashboard/', '/api/', '/admin/'] },
    ],
    sitemap: 'https://example.com/sitemap.xml',
    host: 'https://example.com',
  };
}
```

> **AIクローラの扱いは方針判断**：`GPTBot`/`ClaudeBot`/`PerplexityBot` 等を許可するとAI検索に引用されやすくなる一方、学習利用を嫌う場合は disallow する。SaaS 集客が目的なら**許可推奨**（`aio-llmo.md`）。

## 4. noindex の正しい扱い（事故が多い）

```tsx
// インデックスさせないページ（ログイン後・検索結果・薄いページ）
export const metadata: Metadata = { robots: { index: false, follow: true } };
```

- **ステージング全体を noindex** にし、本番デプロイ時に**確実に外す**（環境変数で出し分け）
- 逆に、本番で重要ページに noindex が残る事故に注意（レビュー必須）
- `robots.txt` の disallow と meta `noindex` は別物：disallow は**クロール禁止**（noindexタグも読まれない）、noindex は**インデックス禁止**。インデックスから消したいページは disallow せず noindex にする

```tsx
// 環境による出し分け例
const isProd = process.env.VERCEL_ENV === 'production';
export const metadata: Metadata = {
  robots: isProd ? undefined : { index: false, follow: false },
};
```

## 5. 正規化（canonical / 重複対策）

- **自己参照 canonical** を全ページに（上記 `alternates.canonical`）
- www/非www、http/https、トレイリングスラッシュを**1つに統一**（Next.js `redirects` or ホスティングのリダイレクト）
- URLパラメータ違い（`?utm=...`）が別ページ扱いされないよう canonical で正規URLを指す
- ページネーションは各ページが自己参照 canonical（rel next/prev は現在Google非使用）

## 6. OG画像の動的生成（next/og）

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }) {
  const post = await getPost(params.slug);
  return new ImageResponse(
    <div style={{ display: 'flex', /* ... */ }}>{post.title}</div>,
    { ...size },
  );
}
```

## 7. 国際化（hreflang・多言語が必要な場合のみ）

```tsx
export const metadata: Metadata = {
  alternates: {
    canonical: 'https://example.com/ja/pricing',
    languages: {
      'ja-JP': 'https://example.com/ja/pricing',
      'en-US': 'https://example.com/en/pricing',
      'x-default': 'https://example.com/pricing',
    },
  },
};
```

- 言語ごとに別URL（サブパス `/ja` `/en` 推奨）。自動言語切替のみで同一URLにしない
- 各言語版が相互に hreflang で参照し合う（双方向必須）

## 8. その他の技術要件

- **HTTPS 必須**（Vercel/ホスティングで自動）
- **見出し構造**：`h1` は1ページ1つ、`h2`→`h3` の階層を飛ばさない
- **画像**：`next/image` で最適化＋意味のある `alt`（装飾画像は `alt=""`）
- **内部リンク**：`<Link>` で実リンク（JSの onClick 遷移はクロールされない）
- **404/410**：存在しないページは正しいステータスを返す（`not-found.tsx`）
- **リダイレクト**：URL変更時は 301 で旧→新（`next.config.js` の `redirects`）

## チェックリスト

- [ ] 重要ページが SSR/SSG/ISR で本文入りHTMLを返す（CSR空HTMLでない）
- [ ] `metadataBase` 設定済み、全ページ固有の title/description
- [ ] 自己参照 canonical が全ページにある
- [ ] `sitemap.ts` / `robots.ts` が 200 を返し、Search Console に送信済み
- [ ] noindex が本番の重要ページに誤って付いていない／ステージングには付いている
- [ ] www/非www・トレイリングスラッシュが統一されている
- [ ] OG画像が各ページで表示される
- [ ] AIクローラの許可/拒否方針を決めた（`robots.ts`）

## 出典・一次ソース

- Next.js Metadata API: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- Next.js sitemap.ts: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
- Next.js robots.ts: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
- Google「robots meta タグ」: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- Google「正規 URL の指定」: https://developers.google.com/search/docs/crawling-indexing/canonicalization
