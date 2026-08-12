# Troubleshooting Flakiness

E2E が不安定（flaky）になる原因と対処を症状別にまとめる。**「retry を増やして隠す」のは最後の手段**。

## まずやること

```bash
# 1. ローカルで UI モード（タイムライン可視化）
npx playwright test --ui

# 2. CI と同じ環境で再現
docker run --rm -v $(pwd):/work -w /work \
  mcr.microsoft.com/playwright:v1.50.0-jammy \
  npx playwright test <ファイル>

# 3. 連続実行で flaky 検出
npx playwright test <ファイル> --repeat-each=20 --retries=0

# 4. trace を見る
npx playwright test --trace=on
npx playwright show-trace test-results/.../trace.zip
```

## 症状 1: ローカルは通るが CI で fail

**原因の上位**：
1. タイムアウトが短い（CI は遅い）
2. ローカルの dev server が hot reload で待ち時間を吸収していた
3. 環境変数の差異
4. フォントロード待ち
5. アニメーション完了待ち
6. ロケール / タイムゾーン違い

**対処**：

```ts
// playwright.config.ts
use: {
  actionTimeout: 15_000,         // CI 用に延長
  navigationTimeout: 30_000,
  locale: 'ja-JP',               // CI も日本語
  timezoneId: 'Asia/Tokyo',
},

// テスト内
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);  // フォント
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important}',
  });
});
```

## 症状 2: 「element is not visible」「element is detached」

**原因**：
- React の再レンダリングで要素が一瞬で消えて再描画される
- アニメーションで要素位置が動いている最中にクリック
- スクロール対象外
- 親要素に overlay

**対処**：

```ts
// (a) auto-wait に任せる（waitForSelector は不要）
await page.getByRole('button', { name: '保存' }).click();

// (b) スクロール
await element.scrollIntoViewIfNeeded();
await element.click();

// (c) force click（最終手段、root cause を隠すので注意）
await element.click({ force: true });

// (d) より精密なロケータ
await page.getByRole('dialog', { name: '確認' })
  .getByRole('button', { name: '保存' }).click();
```

## 症状 3: race condition（タイミング依存）

**典型例**：

```ts
// ❌ ボタンクリック後の API レスポンス待ちなし
await page.getByRole('button', { name: '保存' }).click();
await expect(page.getByText('保存しました')).toBeVisible();  // たまに fail
```

**対処 A: web-first assertion に任せる**

```ts
// expect は auto-retry なので、API 完了→トースト表示まで待つ
await page.getByRole('button', { name: '保存' }).click();
await expect(page.getByText('保存しました')).toBeVisible({ timeout: 10_000 });
```

**対処 B: API 完了を明示的に待つ**

```ts
const responsePromise = page.waitForResponse(
  resp => resp.url().includes('/api/save') && resp.status() === 200
);
await page.getByRole('button', { name: '保存' }).click();
await responsePromise;
await expect(page.getByText('保存しました')).toBeVisible();
```

## 症状 4: 並列実行で時々 fail

**原因**：
- 同じテストユーザーを複数テストで共有
- 同じデータレコードを更新
- DB 接続上限

**対処**：

```ts
// ワーカーごとに固有のテストユーザー
const test = base.extend<{}, { workerUser: User }>({
  workerUser: [async ({}, use, testInfo) => {
    const id = testInfo.parallelIndex;
    const user = await createUser(`worker-${id}@example.test`);
    await use(user);
    await deleteUser(user.id);
  }, { scope: 'worker' }],
});

// または workers 制限
// playwright.config.ts
workers: process.env.CI ? 2 : undefined,
```

## 症状 5: ネットワーク絡みの flaky

**原因**：
- 外部 API（Stripe, OpenAI）のレートリミット・遅延
- Supabase の cold start
- Webhook 配信タイミング

**対処**：

```ts
// (a) 外部 API はモック
await page.route('**/api.openai.com/**', route => route.fulfill({
  status: 200, body: JSON.stringify({ choices: [{ text: 'mock' }] }),
}));

// (b) リトライありのポーリング
await expect.poll(
  async () => (await fetch('/api/status')).json(),
  { timeout: 30_000, intervals: [1_000, 2_000, 5_000] }
).toMatchObject({ status: 'ready' });

// (c) Webhook 待ち（DB ポーリング）
await expect.poll(async () =>
  await db.subscription.findFirst({ where: { user_id } })
).not.toBeNull();
```

## 症状 6: 「strict mode violation: multiple elements」

**原因**：ロケータが複数要素にマッチ

**対処**：

```ts
// ❌ first() / nth() は位置依存で flaky
await page.getByRole('button').first().click();

// ✅ 絞り込む
await page.getByRole('button', { name: '削除' }).click();

// ✅ 親でスコープ
await page.getByRole('row', { name: '田中' })
  .getByRole('button', { name: '削除' }).click();

// ✅ filter
await page.getByRole('listitem').filter({ hasText: '完了' }).first().click();
```

## 症状 7: モーダル・ダイアログが閉じない / 開かない

**原因**：
- アニメーションが完了する前に次の操作
- バックドロップが要素を覆っている
- フォーカストラップ

**対処**：

```ts
// ダイアログが完全に開ききるまで待つ
const dialog = page.getByRole('dialog', { name: '確認' });
await expect(dialog).toBeVisible();

// 入力
await dialog.getByRole('button', { name: '削除' }).click();

// 閉じきるまで待つ
await expect(dialog).toBeHidden();
```

## 症状 8: スクリーンショットが毎回違う

**原因**：
- アニメーション
- 日時表示
- アバター / OG 画像
- スクロールバー
- OS 間のフォントレンダリング差

**対処**：

```ts
await expect(page).toHaveScreenshot({
  animations: 'disabled',
  mask: [page.getByTestId('date'), page.getByTestId('avatar')],
  maxDiffPixelRatio: 0.01,
});
```

詳細は `accessibility-and-visual.md` 参照。

## 症状 9: storageState が効かない

**原因**：
- `dependencies: ['setup']` が漏れている
- setup が fail している
- Cookie のドメイン違い（localhost vs 127.0.0.1）
- @supabase/ssr のバージョン差で保存形式が変わった

**対処**：

```bash
# setup を単独実行
npx playwright test --project=setup

# 中身を確認
cat playwright/.auth/user.json | jq

# 単一テストを認証済みで実行
npx playwright test --project=chromium-user tests/e2e/authenticated/dashboard.spec.ts
```

## 症状 10: メモリリーク・OOM

**原因**：
- ブラウザコンテキストを閉じていない
- 大量のスクリーンショット保持
- video が大きい

**対処**：

```ts
test.afterEach(async ({ context }) => {
  await context.close();  // 通常は自動だが、複雑な fixture では明示
});

// playwright.config.ts
use: {
  video: { mode: 'retain-on-failure', size: { width: 800, height: 600 } },
},
```

## デバッグツール早見表

| ツール | 用途 |
|-------|------|
| `--ui` | UI モード（タイムライン、watch、step） |
| `--headed` | ヘッドありで観察 |
| `--debug` | Inspector でステップ実行 |
| `--trace=on` | trace 強制取得 |
| `show-trace <zip>` | trace を見る |
| `--repeat-each=N` | N 回繰り返し |
| `--retries=0` | リトライ無効化（flaky 検出） |
| `page.pause()` | 実行を一時停止して Inspector |
| `await page.screenshot({ path: 'debug.png' })` | デバッグスクショ |
| `DEBUG=pw:api` | API レベルの詳細ログ |

## 「最終手段」リスト（使う前に root cause 探る）

- `retries: 3` 以上
- `test.use({ actionTimeout: 60_000 })`
- `force: true` のクリック
- `waitForTimeout(2000)`（**禁止推奨**）
- `test.skip()` で問題を回避

これらは**チケットを起票してから**使う。フレームワークが flaky を吸収しても、本番ユーザーは吸収してくれない。

## アンチパターン総括

1. **flaky を retry で隠す** → 本番障害の温床
2. **`waitForTimeout` で「とりあえず待つ」** → CI で遅くなる + flaky
3. **テスト間でデータ共有** → 並列実行で確実に壊れる
4. **ローカルで通ったから OK** → CI が真実
5. **trace を出さない設定で CI 運用** → 失敗時に詰む
6. **assertion を `expect(await x.textContent()).toBe(...)` で書く** → auto-retry が効かない
7. **ロケータを CSS / XPath で書く** → UI 改修で全 fail
