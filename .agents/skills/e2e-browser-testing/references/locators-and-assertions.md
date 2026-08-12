# Locators & Assertions

ロケータ選定と web-first assertion の標準パターン。**flaky の 8 割はここで防げる**。

## ロケータの優先順位

```
1. getByRole         ← 最優先（A11y ツリー経由、ユーザー視点）
2. getByLabel        ← フォーム要素
3. getByPlaceholder  ← label がない時のフォーム
4. getByText         ← 本文要素・確認用
5. getByAltText      ← 画像
6. getByTitle        ← title 属性
7. getByTestId       ← 意味付けが取れない時の最終手段
   --- 以下は避ける ---
8. page.locator('css selector')  ← UI 改修で壊れる
9. page.locator('xpath=...')     ← さらに脆い
```

## getByRole — 最強のロケータ

```ts
// ボタン
await page.getByRole('button', { name: '購入する' }).click();

// リンク（部分一致が便利）
await page.getByRole('link', { name: /利用規約/ }).click();

// 見出し（階層も指定可）
await expect(page.getByRole('heading', { level: 1 })).toHaveText('ダッシュボード');

// 入力欄（label がない時）
await page.getByRole('textbox', { name: 'メールアドレス' }).fill('user@example.com');

// チェックボックス・ラジオ
await page.getByRole('checkbox', { name: '利用規約に同意' }).check();

// ダイアログ内のみ
const dialog = page.getByRole('dialog', { name: '削除確認' });
await dialog.getByRole('button', { name: '削除' }).click();
```

### A11y を設計段階で意識する

`getByRole` を効かせるには HTML 側の正しさが必要。**実装時に以下を徹底**：

- ボタンは `<button>`（`<div onClick>` 禁止）
- リンクは `<a href>`
- フォーム要素には `<label for>`、または `aria-label`
- ダイアログには `role="dialog"` + `aria-labelledby`
- 見出しレベルを飛ばさない（h1 → h3 はダメ）

これは a11y のためでもあり、E2E のためでもある。**一石二鳥**。

## getByLabel — フォームの王道

```html
<label for="email">メールアドレス</label>
<input id="email" type="email" />
```

```ts
await page.getByLabel('メールアドレス').fill('user@example.com');
```

`<label>` で囲んだ場合も OK：

```html
<label>
  メールアドレス
  <input type="email" />
</label>
```

## getByText — アサーション中心

操作よりも**「存在確認」**で使うのが基本：

```ts
// OK: 確認
await expect(page.getByText('保存しました')).toBeVisible();

// 慎重に: クリック対象（getByRole の方が良いことが多い）
await page.getByText('続きを読む').click();
```

完全一致が必要なら `exact: true`：

```ts
await page.getByText('購入', { exact: true });   // 「購入する」にはマッチしない
```

## getByTestId — 最後の手段

意味付けが取れない要素（チャート、特殊コンポーネント）には使う：

```html
<div data-testid="revenue-chart">...</div>
```

```ts
await expect(page.getByTestId('revenue-chart')).toBeVisible();
```

ただし**乱用注意**。`getByRole` で取れる要素には test-id を付けない。

## 絞り込み（filter / scope）

ロケータが複数マッチする時は `first()` / `nth()` ではなく**絞り込み**を使う：

```ts
// NG: 位置依存
await page.getByRole('button').nth(2).click();

// OK: テキストで絞る
await page.getByRole('button', { name: '削除' }).click();

// OK: 親要素でスコープ
const row = page.getByRole('row', { name: '田中太郎' });
await row.getByRole('button', { name: '編集' }).click();

// OK: filter で絞る
const userCard = page.getByRole('article').filter({ hasText: '田中太郎' });
await userCard.getByRole('button', { name: 'フォロー' }).click();
```

## Web-first assertion（auto-retry）

**`expect(locator).toXxx()` 系は自動でリトライ**する。これが Playwright の真髄。

```ts
// ✅ auto-retry あり（推奨）
await expect(page.getByRole('alert')).toContainText('保存しました');
await expect(page.getByRole('button', { name: '送信' })).toBeEnabled();
await expect(page).toHaveURL(/\/dashboard/);
await expect(page).toHaveTitle('ダッシュボード | MyApp');

// ❌ auto-retry なし（一発で評価、flaky 化）
const text = await page.getByRole('alert').textContent();
expect(text).toBe('保存しました');
```

### よく使う web-first assertion

| アサーション | 用途 |
|------------|------|
| `toBeVisible()` | 要素が表示されている |
| `toBeHidden()` | 要素が非表示 |
| `toContainText(str)` | 部分一致 |
| `toHaveText(str)` | 完全一致 |
| `toHaveValue(val)` | input の値 |
| `toBeChecked()` | チェック済み |
| `toBeEnabled()` / `toBeDisabled()` | 操作可否 |
| `toHaveAttribute(name, val)` | 属性値 |
| `toHaveClass(/pattern/)` | クラス（正規表現可） |
| `toHaveCount(n)` | 要素数 |
| `toHaveURL(/pattern/)` | URL |
| `toHaveTitle(str)` | document.title |
| `toHaveScreenshot()` | ビジュアル回帰 |

### タイムアウトのカスタマイズ

```ts
// この expect だけタイムアウトを延長
await expect(page.getByText('集計中...')).toBeHidden({ timeout: 30_000 });
```

## 待機のパターン

### auto-wait に任せる（基本）

```ts
// auto-wait：要素が visible & stable & enabled になるまで待つ
await page.getByRole('button', { name: '保存' }).click();
```

### 明示的に待つ必要があるケース

```ts
// ネットワーク完了を待つ（API レスポンス）
await page.waitForResponse(resp =>
  resp.url().includes('/api/save') && resp.status() === 200
);

// URL 遷移を待つ
await page.waitForURL(/\/dashboard/);

// 関数評価が true になるまで待つ
await expect.poll(async () => {
  return await page.evaluate(() => window.__appReady);
}, { timeout: 10_000 }).toBe(true);
```

### 禁止パターン

```ts
// ❌ 絶対にやらない
await page.waitForTimeout(2000);
await new Promise(r => setTimeout(r, 1000));
```

## デバッグに有用なロケータ操作

```ts
// 開発時：マッチする要素を可視化（実行時にエラー）
await page.getByRole('button', { name: '購入' }).highlight();

// マッチ数の確認
console.log(await page.getByRole('button').count());

// HTML 取得
console.log(await page.getByRole('main').innerHTML());

// 全マッチ要素を配列で
const items = await page.getByRole('listitem').all();
for (const item of items) {
  console.log(await item.textContent());
}
```

## Codegen（自動生成）

```bash
# ブラウザを開いて操作 → コードが自動生成される
npx playwright codegen http://localhost:3000

# 認証済みで開始
npx playwright codegen --load-storage=playwright/.auth/user.json http://localhost:3000
```

**ただし生成コードはそのまま使わない**：
- `getByRole` ではなく CSS セレクタが選ばれることがある
- assertion が `expect` ではないことがある
- 必ず手で整える

## チェックリスト

- [ ] `getByRole` を最優先しているか
- [ ] CSS セレクタ・XPath を使っていないか
- [ ] `nth()` / `first()` ではなく filter / scope で絞っているか
- [ ] `waitForTimeout` を使っていないか
- [ ] assertion が web-first（`expect(locator).toXxx()`）か
- [ ] 実装側に label・aria 属性が付いているか
