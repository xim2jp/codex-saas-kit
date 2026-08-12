# Core Web Vitals：SEO観点の性能最適化

ページ体験はランキング要因であり、遅いサイトは順位もコンバージョンも同時に落とす。**実ユーザーの体感指標（CWV）**を Next.js で改善する。

## 1. 3つの指標（2026年現行）

| 指標 | 測るもの | Good | 主因 |
|------|---------|------|------|
| **LCP**（Largest Contentful Paint） | 最大要素の表示速度 | ≤ 2.5s | 重い画像・遅いサーバー応答・レンダリングブロック |
| **INP**（Interaction to Next Paint） | 操作への応答性（FID後継） | ≤ 200ms | 重いJS・メインスレッド長時間ブロック |
| **CLS**（Cumulative Layout Shift） | レイアウトのガタつき | ≤ 0.1 | サイズ未指定の画像/広告・後から差し込む要素 |

> **評価はフィールドデータ（実ユーザー＝CrUX）が本番**。Lighthouse（ラボ）は目安。Search Console の「ウェブに関する主な指標」レポートでフィールド値を監視する。

## 2. LCP 改善（Next.js）

- **ヒーロー画像に `priority`**：`<Image priority />` で最優先読み込み、`fetchpriority="high"`
- **`next/image` で最適化**：自動 WebP/AVIF・適切な `sizes`・遅延読み込み（折りたたみ下）
- **サーバー応答を速く**：SSG/ISR でTTFB短縮。動的データはストリーミング（Suspense）
- **フォント**：`next/font` でセルフホスト＋`display: swap`、サブセット化（日本語は重いので必要字形のみ/`subsets` 指定）
- **レンダリングブロック排除**：クリティカルCSSはインライン化（Next.js が自動処理）、サードパーティJSは `next/script` の `strategy="lazyOnload"`/`afterInteractive`

```tsx
import Image from 'next/image';
// ヒーロー（LCP要素）
<Image src="/hero.png" alt="" width={1200} height={630} priority sizes="100vw" />
```

## 3. INP 改善

- **JSを減らす**：不要な client component を server component に（`"use client"` を最小化）
- **重い処理を分割**：長いタスクを分割、`useTransition`/`startTransition` で優先度制御
- **サードパーティスクリプトを遅延**：分析・チャット・広告は `next/script` で後ろ倒し
- **ハイドレーション負荷を下げる**：インタラクション不要な部分はサーバー側で完結
- **イベントハンドラを軽く**：デバウンス/スロットル、重い同期処理を避ける

## 4. CLS 改善

- **画像・動画・iframe に明示サイズ**（`next/image` は width/height 必須なので自然に防げる）
- **フォントの FOUT/FOIT 対策**：`next/font` で事前読み込み、`size-adjust` 自動調整
- **動的挿入要素に領域を予約**：広告/バナー/Cookie同意は高さを確保してから表示
- **`@font-face` の遅延差し替えでガタつかせない**

## 5. 計測フロー

1. **ラボ（開発時）**：Lighthouse（Chrome DevTools / PageSpeed Insights）でボトルネック特定
2. **フィールド（本番）**：Search Console「ウェブに関する主な指標」＝実ユーザーのCrUX
3. **継続監視**：Vercel Speed Insights / Vercel Analytics（野口さんスタックなら導入容易）でRUM
4. **CI ゲート**：Lighthouse CI を GitHub Actions に組み込み、しきい値割れでPRを止める（任意）

```yaml
# 例：lighthouse をCIで（しきい値割れで失敗）
- run: npx @lhci/cli autorun
  # lighthouserc.json で performance/seo の minScore を設定
```

## 6. その他の体験要因

- **モバイルファースト**：Google はモバイル版を評価（モバイルインデックス）。レスポンシブ必須
- **HTTPS**・**広告/ポップアップの抑制**（インタースティシャルの過度な使用は減点）
- **タップ領域・文字サイズ**：モバイルで操作しやすく

## チェックリスト

- [ ] LCP ≤ 2.5s（ヒーロー画像 priority、SSG/ISR、フォント最適化）
- [ ] INP ≤ 200ms（client component 最小化、サードパーティJS遅延）
- [ ] CLS ≤ 0.1（画像サイズ明示、フォント・動的要素のガタつき対策）
- [ ] `next/image` と `next/font` を使っている
- [ ] Search Console「ウェブに関する主な指標」が緑（フィールド値）
- [ ] モバイルで Good（モバイルインデックス対応）
- [ ] （任意）Lighthouse CI でしきい値ゲートを設定

## 出典・一次ソース

- web.dev「Core Web Vitals」: https://web.dev/articles/vitals
- web.dev INP: https://web.dev/articles/inp
- Next.js パフォーマンス最適化: https://nextjs.org/docs/app/building-your-application/optimizing
- PageSpeed Insights: https://pagespeed.web.dev
- Google「ページ エクスペリエンス」: https://developers.google.com/search/docs/appearance/page-experience
