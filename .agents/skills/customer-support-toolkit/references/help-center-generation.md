# ヘルプセンター自動生成（docs/ → app/help/）

要件定義書・機能一覧・画面設計（`docs/`）を単一の情報源とし、Next.js App Router 上にヘルプセンターを**自動生成・自動同期**する手法。1名運用・複数SaaS量産を前提に、手書きコストを最小化する。

## 基本方針：docs/ が正、ヘルプ記事は生成物

野口さんスタックでは `docs/03-requirements/` や `docs/20-external-design/screen-list.md` に機能一覧・画面仕様が既に存在する。ヘルプセンターをゼロから書くのではなく、**これらを入力にAI（Claude API）で記事ドラフトを生成し、野口さんが最終確認して公開**するフローにする。

```
docs/03-requirements/requirements.md ─┐
docs/20-external-design/screen-list.md ─┼─→ Claude API（記事生成） ─→ Markdown/MDX下書き ─→ 野口さんレビュー ─→ 公開
docs/20-external-design/feature-list.md ┘
```

- 機能一覧の1行（FunctionalID・機能名・概要）を1つのヘルプ記事の種にする
- 画面設計から実際のUI文言・操作手順を拾い、実態と乖離しない記事にする
- 生成プロンプトはSaaS間で共通化し、プロダクト名・機能名だけ差し替える（テンプレ化）

## コンテンツ管理方式の選定

1名運用・無料枠優先の観点で2方式を比較する。

| 方式 | 向いているケース | 理由 |
|------|-----------------|------|
| **MDX（`content/help/*.mdx` をリポジトリ管理）** | 記事更新頻度が低い、Gitでバージョン管理したい、追加コスト0円が最優先 | ビルド時に静的生成でき、Supabaseテーブル不要。デプロイ＝公開なので運用がシンプル |
| **Supabaseテーブル（`help_articles`）** | 検索ログ分析や「役に立った」評価などの動的機能を持たせたい、野口さん自身がGit操作なしで記事編集したい | 既存Supabaseインフラ（Tier A）を流用でき追加コストなし。管理画面から更新可能 |

> **野口Profile推奨：立ち上げ初期はMDX（ゼロコスト・Git管理・シンプル）。問い合わせ件数が増え検索改善や評価機能が要る段階でSupabaseテーブルへ移行。** どちらもVercel/Supabaseの無料枠内で完結する。

## 実装パターン（App Router）

### ディレクトリ構成（MDX方式）

```
app/
└── help/
    ├── page.tsx                 # ヘルプトップ（カテゴリ一覧・検索窓）
    ├── search/
    │   └── page.tsx              # 検索結果
    └── [category]/
        ├── page.tsx               # カテゴリ内記事一覧
        └── [slug]/
            └── page.tsx           # 記事詳細（generateStaticParamsで静的生成）
content/
└── help/
    ├── getting-started/
    │   ├── account-setup.mdx
    │   └── first-login.mdx
    └── billing/
        └── change-plan.mdx
```

### 記事メタデータとfrontmatter

```mdx
---
title: "プラン変更の手順"
category: "billing"
functionalId: "F-042"        # 機能一覧のIDと紐付け、docs/との乖離を検知しやすくする
updatedAt: "2026-06-20"
relatedScreens: ["/settings/billing"]
---

プランのアップグレード・ダウングレードは設定画面から...
```

`functionalId` を機能一覧の ID と揃えておくと、機能一覧が更新されたのにヘルプ記事が古いまま、という乖離をスクリプトで検知できる（後述）。

### 記事一覧・詳細ページの実装骨子

```tsx
// app/help/[category]/[slug]/page.tsx
import { getHelpArticle, getAllHelpSlugs } from "@/lib/help/content";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  return getAllHelpSlugs(); // content/help/**/*.mdx を走査
}

export async function generateMetadata({ params }: { params: { category: string; slug: string } }) {
  const article = await getHelpArticle(params.category, params.slug);
  if (!article) return {};
  return { title: `${article.title} | ヘルプセンター`, description: article.excerpt };
}

export default async function HelpArticlePage({
  params,
}: {
  params: { category: string; slug: string };
}) {
  const article = await getHelpArticle(params.category, params.slug);
  if (!article) notFound();
  return <ArticleBody article={article} />;
}
```

### Supabaseテーブル方式を使う場合のスキーマ例

```sql
create table help_articles (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null,       -- 複数SaaS運用のためプロダクトを識別
  category text not null,
  slug text not null,
  title text not null,
  body_markdown text not null,
  functional_id text,               -- 機能一覧IDと紐付け
  updated_at timestamptz not null default now(),
  is_published boolean not null default false,
  unique (product_slug, category, slug)
);

-- RLS: 公開記事は誰でも読めるが、書き込みはサービスロールのみ
alter table help_articles enable row level security;
create policy "public can read published articles"
  on help_articles for select
  using (is_published = true);
```

`product_slug` を持たせることで、**複数SaaSのヘルプ記事を1つのSupabaseプロジェクト（or 共通スキーマ）に集約**でき、管理コストを下げられる。

## 検索機能

1名運用・無料枠優先では以下の順で検討する。

1. **静的全文検索（クライアントサイド、追加インフラ0円）**：記事数が数十〜百程度なら `Fuse.js` 等でビルド時に検索インデックスを生成し、クライアントであいまい検索。追加コストなし
2. **Postgres全文検索（Supabase方式時）**：`tsvector` + GINインデックスで `to_tsquery` 検索。Supabaseの無料枠内で完結
3. **専用検索SaaS（Algolia等）は原則不使用**：ランニングコストが積み上がるため、記事数が数百を超え体感速度が問題になった場合のみ検討し、費用負担者を明確にしてから導入

```sql
-- Supabase方式での全文検索カラム例
alter table help_articles add column search_vector tsvector
  generated always as (to_tsvector('simple', title || ' ' || body_markdown)) stored;
create index help_articles_search_idx on help_articles using gin (search_vector);
```

## カテゴリ構成の標準テンプレート

SaaS間で使い回せる標準カテゴリ（プロダクトごとに機能カテゴリだけ追加）：

| カテゴリ | 内容 |
|---------|------|
| `getting-started` | 初回登録・初期設定・基本操作 |
| `billing` | プラン・支払い・請求書（Stripe連携部分） |
| `account` | アカウント設定・退会・データエクスポート |
| `<プロダクト固有機能>` | 機能一覧から自動生成される機能別カテゴリ |
| `troubleshooting` | エラー・不具合時の対処 |
| `faq` | よくある質問（`faq-maintenance.md` で自動更新） |

## docs/ とヘルプ記事の乖離検知（CIスクリプト案）

機能一覧（`docs/20-external-design/feature-list.md`）に記載の `FunctionalID` のうち、対応するヘルプ記事（`functionalId` frontmatter）が存在しないものを検出するスクリプトをCIに組み込む。

```ts
// scripts/check-help-coverage.ts（骨子）
// 1. feature-list.md から FunctionalID 一覧を抽出
// 2. content/help/**/*.mdx の functionalId frontmatter を収集
// 3. 差分があれば警告（Block はしない。ヘルプ記事が後追いになるのは許容）
```

1名運用でこの手のチェックを手動でやると必ず漏れるため、**軽量な自動検知で「後で書く」を可視化**しておく。

## 野口Profile上の注意

- MDX方式・Supabase方式いずれも追加のランニングコストが発生しない構成を優先する
- 検索は静的検索/Postgres全文検索で完結させ、有料検索SaaSは費用負担者が確定するまで導入しない
- 複数SaaSでヘルプセンターのUIコンポーネント（記事レイアウト・検索窓・カテゴリナビ）を共通パッケージ化し、新規SaaS立ち上げ時はコンテンツ（MDX/レコード）だけ差し替えれば済む状態を目指す

## 出典

- Next.js App Router routing / generateStaticParams: https://nextjs.org/docs/app/building-your-application/routing
- Next.js Metadata API（generateMetadata）: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
- Next.js MDX 利用ガイド: https://nextjs.org/docs/app/building-your-application/configuring/mdx
- Supabase Full Text Search: https://supabase.com/docs/guides/database/full-text-search
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
