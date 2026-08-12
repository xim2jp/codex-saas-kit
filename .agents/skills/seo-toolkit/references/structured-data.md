# 構造化データ（JSON-LD / schema.org）

検索エンジンとAIに**ページの意味を機械可読で伝える**。リッチリザルト（FAQ展開・パンくず・評価★・サイトリンク検索）に必要で、AI検索の引用精度も上げる。

## 基本方針

- **形式は JSON-LD**（Google 推奨。HTMLと分離でき保守しやすい）
- **サーバーコンポーネントで `<script type="application/ld+json">` を出力**（CSRで後付けしない）
- **本文に存在する内容だけ**を記述（本文にない情報の構造化データはスパム扱い・ペナルティ）
- 公開前に必ず **Rich Results Test** と **Schema Markup Validator** で検証

## 共通の出力ヘルパー

```tsx
// components/JsonLd.tsx
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // 値はサーバー側の信頼できるデータのみ。ユーザー入力を入れる場合は要サニタイズ
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

## 1. Organization（運営者・全ページ or トップ）

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "株式会社○○",
  "url": "https://example.com",
  "logo": "https://example.com/logo.png",
  "sameAs": [
    "https://twitter.com/example",
    "https://www.facebook.com/example"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "email": "support@example.com"
  }
}
```

## 2. SoftwareApplication / Product（SaaS本体・料金ページ）

SaaS の価値と価格をAIと検索に伝える。レビューがあれば `aggregateRating` を**実データのみ**で。

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "シフト管理SaaS ○○",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "AIが店舗の状況を理解し最適なシフトを自動生成するクラウドサービス",
  "offers": {
    "@type": "Offer",
    "price": "980",
    "priceCurrency": "JPY"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "127"
  }
}
```

> **注意**：`aggregateRating` は実在の収集済みレビューが前提。捏造は手動対策の対象。レビューが無いなら省く。

## 3. FAQPage（FAQページ・記事末のQ&A）

AI Overviews と PAA に最も効く構造の一つ。本文に同じQ&Aが見える形であること。

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "無料トライアルにクレジットカードは必要ですか？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "不要です。14日間、カード登録なしで全機能をお試しいただけます。"
      }
    }
  ]
}
```

## 4. Article / BlogPosting（ブログ・知見記事）

E-E-A-T の著者・日付を機械可読に。

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "飲食店のシフト作成を効率化する5つの方法",
  "image": "https://example.com/blog/shift/cover.png",
  "datePublished": "2026-05-01T09:00:00+09:00",
  "dateModified": "2026-06-01T09:00:00+09:00",
  "author": {
    "@type": "Person",
    "name": "野口 慎一",
    "url": "https://example.com/about"
  },
  "publisher": {
    "@type": "Organization",
    "name": "株式会社○○",
    "logo": { "@type": "ImageObject", "url": "https://example.com/logo.png" }
  }
}
```

## 5. BreadcrumbList（パンくず・全階層ページ）

検索結果のURL表示をパンくず化し、サイト構造をAIに伝える。

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "ホーム", "item": "https://example.com" },
    { "@type": "ListItem", "position": 2, "name": "ブログ", "item": "https://example.com/blog" },
    { "@type": "ListItem", "position": 3, "name": "シフト作成の効率化", "item": "https://example.com/blog/shift" }
  ]
}
```

## 6. LocalBusiness（店舗・地域型・ローカルSEO）

クライアントが店舗の場合、または店舗向け公開ページに。

```json
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "居酒屋 ○○ 渋谷店",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "渋谷1-1-1",
    "addressLocality": "渋谷区",
    "addressRegion": "東京都",
    "postalCode": "150-0002",
    "addressCountry": "JP"
  },
  "telephone": "+81-3-1234-5678",
  "openingHours": "Mo-Su 17:00-23:00",
  "geo": { "@type": "GeoCoordinates", "latitude": 35.659, "longitude": 139.700 }
}
```

## 7. WebSite + SearchAction（サイトリンク検索ボックス）

サイト内検索があれば、検索結果に検索窓を出せる可能性。

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://example.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://example.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

## ページ種別 × 推奨スキーマ早見表

| ページ | 推奨スキーマ |
|--------|-------------|
| トップ | Organization + WebSite |
| 料金 | SoftwareApplication / Product + Offer |
| 機能 | SoftwareApplication |
| FAQ | FAQPage |
| ブログ記事 | BlogPosting + BreadcrumbList（+ 末尾Q&AにFAQPage） |
| 導入事例 | Article + BreadcrumbList |
| 店舗ページ | LocalBusiness（適切なサブタイプ） |

## チェックリスト

- [ ] JSON-LD をサーバー出力している（CSR後付けでない）
- [ ] 構造化データの内容が本文に実在する（捏造なし）
- [ ] `aggregateRating` は実レビューに基づく（無ければ省く）
- [ ] Rich Results Test / Schema Markup Validator でエラー0
- [ ] 必須プロパティ欠落がない（type別の required を確認）
- [ ] Search Console の「拡張」レポートでエラー/警告を監視

## 出典・一次ソース

- Google「構造化データの仕組み」: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- Rich Results Test: https://search.google.com/test/rich-results
- schema.org: https://schema.org
- Schema Markup Validator: https://validator.schema.org
