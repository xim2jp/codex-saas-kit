---
name: seo-toolkit
description: SaaS の営業サイト・アプリ・ブログを、検索エンジン（Google/Bing）と生成 AI 検索（AI Overviews/ChatGPT/Perplexity）の両方から発見・引用されるようにする知識集。キーワード戦略（指名/比較/課題の3段）、Next.js App Router のテクニカル SEO（sitemap/robots/metadata/レンダリング）、構造化データ（JSON-LD）、AIO/LLMO・llms.txt・AI クローラ許可方針、Core Web Vitals、Search Console/GA4 計測を収録する。公開ページの設計・実装・テスト・レビューと公開後の改善で参照する。「SEO」「キーワード」「構造化データ」「AI検索対策」「AIO」「LLMO」「AI Overviews」「llms.txt」「検索流入」「Core Web Vitals」で参照。
---

# SEO Toolkit Skill

成果物（SaaS の営業サイト・アプリ・ブログ）を **検索エンジンと生成AI検索の両方から発見・引用される状態**にするための知識集。キーワード戦略・テクニカルSEO（Next.js App Router）・構造化データ・**AIO/LLMO（生成AI検索対策）**・Core Web Vitals・計測改善を一気通貫で扱う。

> **このSkillのゴール**：野口さんが量産する月額 SaaS の営業サイトが、①Google 検索で対象キーワードに表示され、②AI Overviews / ChatGPT / Perplexity に**引用・推薦され**、③CTR とコンバージョンにつながる状態を、**1名運用で回せる手順**として作る。

SEO は**横断的関心事**であり、URL 設計から公開後の運用まで続く。

## 重要原則

### 1. 「2つの検索」を同時に最適化する（2026年の前提）

検索流入はもはや Google だけではない。**従来の検索エンジン**と**生成AI検索**は最適化対象が一部異なる。両方を狙う。

| 対象 | 何で勝つか | 主な打ち手 |
|------|-----------|-----------|
| **従来SEO（Google/Bing）** | 検索意図への適合・権威性・技術健全性 | キーワード設計・テクニカルSEO・構造化データ・被リンク |
| **AIO/LLMO（AI Overviews/ChatGPT/Perplexity）** | **引用されやすさ**・明快な事実記述・構造の機械可読性 | 結論先出し・Q&A構造・統計/出典の明記・llms.txt・schema |

両者の土台（クロール可能・高速・構造化）は共通。詳細は `aio-llmo.md`。

### 2. テクニカルSEOは Next.js のネイティブ機能で完結させる

野口さんスタックの中心は **Next.js App Router**。SEO の技術要件はサードパーティ製プラグインではなく**フレームワーク標準で実装する**のが基本：

- メタデータ → `generateMetadata` / Metadata API
- サイトマップ → `app/sitemap.ts`（動的生成）
- robots → `app/robots.ts`
- 構造化データ → `<script type="application/ld+json">` をサーバーコンポーネントで出力
- OG画像 → `opengraph-image.tsx`（`next/og` で動的生成）
- レンダリング → SSR/SSG/ISR を**ページ性質ごとに**使い分け（CSRオンリーは原則SEO対象外）

詳細は `technical-seo.md`。

### 3. SEO は「公開して終わり」ではない＝計測と改善が本体

順位もAI引用も**結果が出るまで数週間〜数ヶ月**かかり、出た後も変動する。**最初から計測導線を作る**：

1. **Search Console**：登録・サイトマップ送信・インデックス監視・クエリ別CTR（無料・必須）
2. **GA4**：オーガニック流入とCV相関（無料・必須）
3. **順位/AI可視性の定点観測**：主要キーワードとAI回答での言及を定期チェック

`measurement.md` を公開前のチェックに必ず含める。

### 4. コンテンツの質がすべての上流にある（E-E-A-T）

技術が完璧でも、**検索意図に応える中身**がなければ順位もAI引用も得られない。Google の E-E-A-T（経験・専門性・権威性・信頼性）と、AI が引用したくなる「明快さ」は同じ方向を向く：

> **1ページ1意図。結論を先に、根拠を具体的に（数値・出典）、専門性の出どころ（著者・実績）を明示。** 詳細は `seo-strategy.md`。

### 5. 野口さん財務制約：無料ツールで完結、有料は費用負担が確定してから

民事再生中・1名運用。SEOは**追加コストをかけずに成果が出せる領域**。

> **基本方針：Search Console + GA4 + サイト内施策（全部無料）で開始。Ahrefs/SemRush 等の有料SEOツールは、クライアントが費用負担する案件 or 成果が見込める段階に限定。**

- 無料で十分できること：キーワード調査（Search Console / Google サジェスト / People Also Ask）、技術監査（Lighthouse / Search Console）、構造化データ検証（Rich Results Test）
- 有料が効く場面：競合の被リンク分析・大規模キーワード調査・順位自動追跡（Tier B 案件で計上）

## 参照ファイル

| ファイル | 内容 | いつ読むか |
|---------|------|-----------|
| `references/seo-strategy.md` | キーワード調査・検索意図・トピッククラスタ・E-E-A-T・ローカル SEO | キーワード／コンテンツ戦略（最初に読む） |
| `references/technical-seo.md` | Next.js App Router でのテクニカル SEO 実装（sitemap/robots/metadata/レンダリング） | URL 設計・サイト構造の決定時、実装時 |
| `references/structured-data.md` | JSON-LD 構造化データ体系（Organization/Product/FAQ/Article/Breadcrumb 等） | JSON-LD 実装時 |
| `references/aio-llmo.md` | 生成 AI 検索対策（AI Overviews/ChatGPT/Perplexity・llms.txt・引用最適化） | AI 検索対策の設計時 |
| `references/core-web-vitals.md` | LCP/INP/CLS の SEO 最適化（Next.js 具体手順） | 性能最適化時 |
| `references/measurement.md` | Search Console/GA4/順位・AI 可視性の計測と改善ループ | 公開前チェック、公開後の運用時 |

## フェーズ別の観点

### 情報設計（`docs/20-external-design/screen-list.md` に追記、または `docs/15-marketing-site/seo-plan.md`）

- URL 命名規則（短く・意味のある・日本語 URL を避けるか統一）
- サイト階層（トップ → カテゴリ → 詳細の 3 クリック以内）
- 正規化方針（canonical、www/非 www、トレイリングスラッシュ、index させない領域）
- 国際化が必要なら hreflang 設計

### 実装

- 営業サイト：`generateMetadata` でページ別 title/description/OG、`sitemap.ts` / `robots.ts`、JSON-LD（Organization / SoftwareApplication / FAQ / BreadcrumbList）、ブログのトピッククラスタ、llms.txt の配置（`aio-llmo.md`）
- アプリ側の公開ページ（ランディング・ヘルプ・公開プロフィール等）にも metadata と構造化データを適用し、SEO 対象ページでは SSG/ISR を選ぶ。画像は `next/image`、内部リンクを張る

### テスト

- `sitemap.xml` / `robots.txt` が 200 で返り、想定 URL を含むか
- 主要ページの `<title>` / meta description / canonical / JSON-LD が出力されるかを E2E で確認する
- Lighthouse SEO スコア・CWV のしきい値チェックを CI に組み込む

### レビュー

- `noindex` の付け忘れ／誤付与、canonical の自己参照、重複 title、構造化データの必須プロパティ欠落
- CSR オンリーで重要ページが空 HTML になっていないか

## 野口さん固有のチェック

- [ ] 無料ツール（Search Console + GA4）だけで計測・改善ループが回る構成になっているか
- [ ] 有料SEOツールを安易に選んでいないか（費用負担者が確定しているか）
- [ ] Next.js 標準機能でテクニカルSEOが完結しているか（不要なSEOプラグインを足していないか）
- [ ] AI Overviews / ChatGPT 等の生成AI検索に**引用される**設計になっているか（従来SEOだけで満足していないか）
- [ ] 営業サイトの法定ページ（特商法・プライバシー）が `noindex` 不要なら適切にインデックスされ、不要ならされない設計か
- [ ] B2B SaaS のキーワードは「指名検索」「課題検索」「比較検索」の3段で設計されているか

## アンチパターン（よくある失敗）

1. **キーワード戦略なしに実装から入る**：誰の何の検索に応えるか未定義のまま作ると流入しない
2. **従来SEOだけ対策しAIO/LLMOを無視**：2026年は AI 検索からの流入を取りこぼす
3. **重要ページを CSR オンリーで実装**：クローラに空HTMLが渡りインデックスされない
4. **`noindex` の事故**：ステージングの設定を本番に持ち込む／逆に消し忘れる
5. **title/description の重複・自動生成放置**：ページ別に最適化しないと CTR が出ない
6. **構造化データの必須プロパティ欠落**：Rich Results Test で検証せず公開しエラー
7. **キーワードカニバリゼーション**：同一意図のページを乱立させ自社内で順位を食い合う
8. **計測導線を作らず公開**：Search Console 未登録で、何が効いたか分からない
9. **CWV を無視した重いサイト**：LCP/INP 悪化で順位とCVを同時に落とす
10. **被リンク目的の質の低い相互リンク/購入**：ペナルティリスク。コンテンツで自然に獲得する

## 出典・一次ソース方針

このSkillの技術情報は**一次ソース**を基準とする（Google 検索セントラル `developers.google.com/search`、Next.js 公式 `nextjs.org/docs`、schema.org、web.dev）。AI Overviews / llms.txt / 各AI検索の仕様は更新が速いため、実装直前に各 references の出典URLで最新を再確認すること。各 references ファイル末尾に出典URLを明記している。
