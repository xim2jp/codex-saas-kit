# AIO / LLMO：生成AI検索対策

2026年、検索流入の一部は **Google AI Overviews・ChatGPT（検索）・Perplexity・Gemini・Copilot** など生成AIの回答経由になっている。これらに**引用・推薦される**ための最適化を AIO（AI Optimization）/ LLMO（LLM Optimization）/ GEO（Generative Engine Optimization）と呼ぶ。従来SEOと土台は共通だが、狙いどころが一部異なる。

## 0. 従来SEOとの違い（要点）

| 観点 | 従来SEO | AIO/LLMO |
|------|---------|----------|
| ゴール | 検索結果で**クリックされる** | AI回答に**引用・言及される** |
| 評価単位 | ページ全体の順位 | **文・段落単位**の抜き出しやすさ |
| 勝ち筋 | 権威性・網羅性 | 明快な事実・出典・構造の機械可読性 |
| 流入 | リンククリック | 回答内の出典リンク＋指名検索の増加 |

> **重要**：AIに引用されても直接クリックが減る「ゼロクリック」化が進む。だからこそ**ブランド名を回答内に出させる**（指名想起→後で指名検索/直接訪問）ことが価値になる。

## 1. 引用されるコンテンツの作り方（最重要）

AIは「明快で・自己完結し・検証可能な」記述を抜き出す。`seo-strategy.md` のコンテンツ原則を AI 向けに先鋭化する：

```
✅ 結論を段落の冒頭に1文で（AIはこの1文を抜く）
✅ 1段落1事実。前後の文脈なしで読んでも意味が通る自己完結性
✅ 具体的な数値・固有名詞・日付・出典（「2026年時点で」「導入店舗の82%」）
✅ 質問をそのまま見出しに（「○○とは？」「○○の料金は？」）→ 直下に簡潔な答え
✅ 比較・手順・定義は表/番号リストで構造化
✅ 「○○（プロダクト名）は〜」と主語にブランド名を置く文を要所に
❌ 曖昧な修飾（「業界最高クラス」）、出典なしの主張、長い前置き
```

## 2. llms.txt（AIクローラ向けの道案内）

`llms.txt` は、サイトの重要コンテンツへの導線を Markdown でAIに提示する提案仕様。ルートに配置する。

```
# /public/llms.txt として配置 → https://example.com/llms.txt
# ○○（シフト管理SaaS）

> 飲食・小売店舗向けに、AIが最適なシフトを自動生成するクラウドサービス。月額980円〜、14日間無料。

## 製品
- [機能一覧](https://example.com/features): 自動シフト生成・希望提出・労務チェック
- [料金プラン](https://example.com/pricing): Starter 980円 / Pro 2,980円
- [導入事例](https://example.com/cases): 飲食チェーン等の活用例

## 知見・ガイド
- [シフト作成の効率化ガイド](https://example.com/blog/shift): 課題と解決手順
- [よくある質問](https://example.com/faq)

## 会社・問い合わせ
- [運営会社](https://example.com/about)
- [お問い合わせ](https://example.com/contact)
```

- `llms.txt`：サイトの地図（必須採用推奨）
- `llms-full.txt`：主要コンテンツの全文を1ファイルにまとめる任意拡張
- まだ全AIが対応する確定仕様ではないが**低コストで先行実装する価値がある**

## 3. AIクローラの許可（robots.ts と整合）

AI回答に引用されるには、原則として該当ボットのクロールを**許可**する必要がある。SaaS 集客目的なら許可を推奨。

| ボット | 用途 | 推奨（集客目的） |
|--------|------|----------------|
| `GPTBot` | OpenAI 学習 | 許可（ChatGPT露出を取るなら） |
| `OAI-SearchBot` | ChatGPT 検索の表示 | 許可 |
| `ChatGPT-User` | ChatGPT のユーザー起点取得 | 許可 |
| `ClaudeBot` / `Claude-User` | Anthropic | 許可 |
| `PerplexityBot` | Perplexity 検索 | 許可 |
| `Google-Extended` | Gemini 学習（検索順位とは別軸） | 方針判断 |

```tsx
// app/robots.ts（集客目的でAI検索に出したい場合：明示許可）
export default function robots() {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/dashboard/', '/api/'] },
      { userAgent: ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot'], allow: '/' },
    ],
    sitemap: 'https://example.com/sitemap.xml',
  };
}
```

> 学習利用を避けたい機微コンテンツがある場合のみ、該当ボットを `disallow`。営業サイトは基本許可でよい。

## 4. 構造化データはAIにも効く

`structured-data.md` の JSON-LD は、AIがエンティティ（製品名・価格・FAQ）を**誤りなく抽出**する助けになる。特に：
- `FAQPage` → AIのQ&A回答にそのまま使われやすい
- `Product`/`SoftwareApplication` の `offers` → 価格を正確に言及させる
- `Organization` の `sameAs` → ブランドのエンティティ認識を強化

## 5. ブランドのエンティティ確立（指名想起の土台）

AIは「知っているエンティティ」を引用しやすい。第三者からの言及を増やす：
- 比較サイト・レビューサイト・業界メディアへの掲載
- Wikipedia/Wikidata 該当があれば整備（権威エンティティ）
- 一貫した名称・説明文をすべての媒体で使う（NAP同様、ブランド記述を統一）
- プレスリリース・登壇・寄稿で言及を獲得

## 6. 計測（AI可視性）

従来の順位計測に加え、AI回答での露出を定点観測する（`measurement.md` と連携）：
- 主要な質問を ChatGPT / Perplexity / Google（AI Overviews）に投げ、**自社が言及・引用されるか**を定期確認
- Search Console でAIクローラ由来の参照や、AI Overviews 表示クエリの傾向を見る
- Perplexity 等の参照元リンクからの流入を GA4 で確認

## チェックリスト

- [ ] 各ページが「結論先出し・自己完結の段落・数値/出典」で書かれている
- [ ] 質問形の見出し直下に簡潔な答えがある（FAQ/PAA対応）
- [ ] `llms.txt` をルートに配置した
- [ ] AIクローラの許可/拒否方針を robots.ts に反映した（集客目的なら許可）
- [ ] FAQPage / Product 等の構造化データでエンティティを正確化した
- [ ] ブランド名を主語にした記述・第三者言及を増やす施策がある
- [ ] AI回答での自社言及を定点観測する運用を決めた

## 出典・一次ソース

- llms.txt 提案仕様: https://llmstxt.org
- OpenAI クローラ（GPTBot/OAI-SearchBot/ChatGPT-User）: https://platform.openai.com/docs/bots
- Google「AI による概要（AI Overviews）と検索」: https://developers.google.com/search/docs/appearance/ai-features
- Perplexity クローラ: https://docs.perplexity.ai/guides/bots
- ※ AI検索の仕様は更新が速い。実装直前に各社の最新ボット名・仕様を再確認すること
