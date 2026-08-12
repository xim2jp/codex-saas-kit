# Accessibility & Visual Regression

A11y チェック（axe-core）とビジュアル回帰（`toHaveScreenshot`）を E2E に組み込むパターン。

## A11y — axe-core 統合

自動チェックで取れるのは WCAG 違反の**30-40%**だが、CI で継続的に回せば**回帰防止**として極めて有効。

### インストール

```bash
npm i -D @axe-core/playwright
```

### 基本パターン

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('ダッシュボードに A11y 違反がない', async ({ page }) => {
  await page.goto('/dashboard');

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

### スコープ絞り込み・タグ指定

```ts
test('フォームの A11y チェック（WCAG 2.1 AA）', async ({ page }) => {
  await page.goto('/signup');

  const results = await new AxeBuilder({ page })
    .include('form')                             // フォームのみ
    .exclude('.legal-footer')                    // フッターは除外
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']) // 適用ルール
    .analyze();

  expect(results.violations).toEqual([]);
});
```

### 既知の違反を一時的に許容

```ts
const knownViolations = ['color-contrast'];  // 改修予定の項目

const results = await new AxeBuilder({ page })
  .disableRules(knownViolations)
  .analyze();
expect(results.violations).toEqual([]);
```

### CI で見やすい違反レポート

```ts
import { createHtmlReport } from 'axe-html-reporter';

test('A11y', async ({ page }, testInfo) => {
  await page.goto('/dashboard');
  const results = await new AxeBuilder({ page }).analyze();

  if (results.violations.length > 0) {
    const html = createHtmlReport({ results, options: { projectKey: 'app' } });
    await testInfo.attach('a11y-report.html', { body: html, contentType: 'text/html' });
  }
  expect(results.violations).toEqual([]);
});
```

### 何を絶対に守るか（野口さんスタック）

- [ ] フォーム要素に label or aria-label（getByLabel が効くため）
- [ ] ボタンに識別可能なテキスト or aria-label
- [ ] 画像に alt
- [ ] ヘッディング階層（h1 → h2 → h3）
- [ ] カラーコントラスト（4.5:1 以上）
- [ ] フォーカスインジケータ（キーボード操作可能）

これらは**ユーザビリティ向上 + SEO + E2E 容易化**の三重メリット。

## ビジュアル回帰 — `toHaveScreenshot`

ピクセル比較で UI 崩れを検出。**やりすぎると保守地獄**なので、重要画面に絞る。

### 基本パターン

```ts
test('ランディングページの見た目', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('landing.png');
});

test('価格セクションのみ', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByRole('region', { name: '料金' })).toHaveScreenshot('pricing.png');
});
```

### 初回実行

```bash
# 初回はスナップショットが無いので失敗する → 同時に生成される
npx playwright test --update-snapshots
```

### 差分の許容

```ts
await expect(page).toHaveScreenshot('landing.png', {
  maxDiffPixels: 100,                  // 100px までの差分は OK
  maxDiffPixelRatio: 0.01,             // または 1% まで
  threshold: 0.2,                      // 色差の閾値（0-1）
  fullPage: true,                      // ページ全体
  animations: 'disabled',              // CSS アニメ無効化
  mask: [page.getByTestId('date')],    // 日時など可変要素をマスク
  scale: 'device',                     // Retina 等の DPR
});
```

### マスク（可変要素）

```ts
await expect(page).toHaveScreenshot({
  mask: [
    page.getByTestId('current-date'),
    page.getByTestId('user-avatar'),
    page.locator('.ads'),
  ],
  maskColor: '#ff00ff',  // マスク色（差分判定で無視される）
});
```

### ビュー固定・状態固定

```ts
test.beforeEach(async ({ page }) => {
  // フォントロード完了を待つ
  await page.evaluate(() => document.fonts.ready);

  // アニメ無効
  await page.addStyleTag({
    content: `*, *::before, *::after { animation: none !important; transition: none !important; }`,
  });

  // 日時固定
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
});
```

### CI と OS 差

- スクリーンショットは**OS ごとに別ファイル**になる（Linux / macOS / Windows）
- **CI（Linux）の結果を正とする**運用が現実的
- ローカル更新→CI で再生成→PR で commit、の流れ

```bash
# CI で生成された snapshot を取り込み（fail 時に CI artifact からダウンロード）
npx playwright test --update-snapshots
git add tests/e2e/**/*-snapshots/
```

### Docker でローカルも CI と同じ環境に

```bash
docker run --rm -v $(pwd):/work -w /work \
  mcr.microsoft.com/playwright:v1.50.0-jammy \
  npx playwright test --update-snapshots
```

## どこにビジュアル回帰を入れるか

| 対象 | 入れる？ |
|------|---------|
| ランディングページ | ✅ ブランド毀損は致命的 |
| 価格表 | ✅ 価格の誤表示は売上直撃 |
| メールテンプレ | ✅ 印象に直結 |
| 請求書 PDF | ✅ 適格請求書要件 |
| ダッシュボード | ❌ データ可変、保守不能 |
| 一覧画面 | ❌ データ次第 |
| フォーム単体 | ❌ A11y で代替可 |

## A11y + Visual の組み合わせ Tips

- A11y は**全 Critical ページに必須**、ビジュアルは**ブランドページのみ**
- A11y は CI で fail させる、ビジュアルは最初 warning にして馴染ませる
- どちらも `test-results/` に artifact 出力すると debug 容易

## アンチパターン

1. **全画面にビジュアル回帰** → snapshot 更新地獄、PR レビュー時間が爆発
2. **A11y チェックを実装後にまとめてやる** → 違反が大量で手が付けられない、最初から組み込む
3. **OS 違いを無視** → ローカル macOS と CI Linux で snapshot 不一致、永遠に通らない
4. **アニメーションを止めない** → 撮影タイミングで pixel ズレ
5. **動的データをマスクしない** → 日時違いで全 fail

## ビジュアルリグレッション（モック vs 実装）

v0.5.0 で外部設計フェーズが生成する `docs/20-external-design/mockups/screenshots/*.png`（確定モックのスクショ）と、実装後に Playwright で撮影する実装画面のスクショを比較し、**「設計と実装の乖離」**を検出する。`toHaveScreenshot` によるモック同士の差分比較（反復ループ内の変化検出）とは目的が異なり、こちらは**確定した設計と、出来上がった実装の一致度**を見る。

### 使い分け：`toHaveScreenshot` vs 手動目視比較

| 比較対象 | 手法 | 理由 |
|---------|------|------|
| モック（HTML）↔ 実装（実アプリ） | **手動目視比較**（Read で両画像を確認） | レイアウトエンジン・フォントレンダリング・実データの有無が異なり、ピクセル完全一致はそもそも成立しない |
| 実装 ↔ 実装（リグレッション検出、同一画面の前後比較） | `toHaveScreenshot` | 同一レンダリング環境同士の比較なので pixel diff が意味を持つ |

**モック vs 実装は`toHaveScreenshot`のpixel diffではなく目視比較が基本**。ただし、価格表・LPヒーロー等ブランド毀損が致命的な画面に限り、実装確定後の基準スクショを`toHaveScreenshot`のベースラインとして登録し、以降のリグレッション検出には機械比較を使う（＝「モック vs 実装」の初回照合は目視、「実装 vs 実装」の以降の回帰検出は機械比較、という二段構え）。

### 比較手順

```bash
# 1. モック確定スクショの場所を確認
ls docs/20-external-design/mockups/screenshots/*.png

# 2. 対応する実装画面を同一ビューポートで撮影
npx playwright screenshot --viewport-size=1280,800 --full-page \
  http://localhost:3000/dashboard tests/e2e/screenshots/impl-S-DASH-001.png
```

```ts
// 実装確定後、ブランド毀損が致命的な画面のみ toHaveScreenshot のベースラインとして登録
test('ダッシュボードの見た目（モック確定後の基準）', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('S-DASH-001-baseline.png', {
    maxDiffPixelRatio: 0.02,
    mask: [page.getByTestId('current-date'), page.getByTestId('user-avatar')],
  });
});
```

### 目視比較で見るポイント

- [ ] 主要表示要素（screen-list.md で定義されたもの）が実装にすべて存在するか
- [ ] レイアウト構造（配置・階層）がモックと大きくズレていないか（多少の余白差はブラウザ/実データ起因で許容）
- [ ] カラー・タイポグラフィが design-system.md のトークンから逸脱していないか
- [ ] モックにあった主要CTAが実装で埋もれていないか、消えていないか
- [ ] 空状態・エラー状態のモックがある画面は、対応する実装状態も再現して比較する

### 許容差分の考え方

- **構造的な乖離**（要素の欠落・配置の大幅なズレ・CTAの喪失）→ 乖離として記録、実装バグ扱い
- **軽微な差分**（実データによる文字量差、フォントレンダリングの微差、余白の数px差）→ 許容し記録不要
- 迷う場合は「ユーザーが違和感を持つレベルか」を基準にする

### 更新フロー

1. 実装完了後、対象画面のスクショを撮影
2. 対応するモックスクショと目視比較（乖離チェックリストに沿って）
3. 乖離を検出したら「設計と実装の乖離」としてレポートに記載し、実装バグとして implementation-worker に差し戻す候補にする（意図的な実装時の設計変更であれば、その旨と根拠を記録し乖離扱いにしない）
4. ブランド毀損が致命的な画面（LP・価格表等）は、乖離解消後のスクショを `toHaveScreenshot` のベースラインとして `--update-snapshots` で登録し、以降は自動リグレッション検出に切り替える

## axe-core による a11y 自動チェック

Phase 12（e2e-usecase-tester）の E2E に `@axe-core/playwright` を組み込み、主要画面の a11y 違反を自動検出する。手動テスト（キーボード操作、スクリーンリーダー）を代替するものではないが、**回帰防止**として毎回のテスト実行で効く。

### Phase 12 への具体的な組み込みコード

```ts
// tests/e2e/usecases/a11y-critical-pages.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const criticalPages = [
  { path: '/', name: 'ランディングページ' },
  { path: '/pricing', name: '価格ページ' },
  { path: '/signup', name: '新規登録' },
  { path: '/dashboard', name: 'ダッシュボード' },
];

for (const { path, name } of criticalPages) {
  test(`${name}（${path}）に a11y Critical violation がない`, async ({ page }) => {
    await page.goto(path);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (critical.length > 0) {
      // CI で追跡できるよう詳細を出力（HTML report 添付は基本パターン参照）
      console.error(JSON.stringify(critical, null, 2));
    }

    expect(critical, `${name} に Critical/Serious な a11y 違反`).toEqual([]);
  });
}
```

既存の「基本パターン」（本ファイル冒頭）を各ユースケース spec に個別導入するのではなく、上記のように**主要画面横断の a11y スイート**を Phase 12 のユースケースE2Eと並べて1ファイルにまとめるのが実務的（画面追加のたびに配列に足すだけで済む）。

### Critical violation の扱い

- **WCAG 2.2 AA** を基準タグ（`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`）として採用する。日本国内向け SaaS では **JIS X 8341-3**（高齢者・障害者等配慮設計指針、WCAG 2.0 と技術的に整合）にも触れる場面があるが、WCAG 2.2 AA 準拠であれば実質的に JIS X 8341-3 の要求も満たす
- axe の `impact` が `critical` / `serious` の violation は**リリースブロッカー**として扱う（Phase 14 の implementation-reviewer / security-auditor に引き継ぐ判断材料にする）
- `impact: moderate` / `minor` は記録した上で Warning 扱い（即ブロックしない）
- 既知の違反で改修が別途計画されているものは `disableRules` で明示的に一時許容し、レポートにその理由と改修予定を記載する（黙って握りつぶさない）

### レポートへの記載

`docs/41-test-results/usecase-e2e-*.md` に a11y スキャン結果セクションを設け、対象画面ごとの violation 件数（Critical/Serious/Moderate/Minor）と、Critical/Serious があれば具体的な違反内容を記載する。
