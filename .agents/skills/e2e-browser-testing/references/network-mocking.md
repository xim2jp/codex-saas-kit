# Network Mocking

外部 API への依存を切って**決定論的な E2E**を作るパターン。Playwright ネイティブの `page.route()` を基本とする。MSW との併用は注意点あり。

## なぜモックするか

| シナリオ | 理由 |
|---------|------|
| 外部 API レート制限 | Stripe / OpenAI / 天気 API などをテストで叩くと制限 |
| 課金が発生する | OpenAI など従量課金の API |
| 非決定性 | 為替・天気・ニュース等は時刻で変わる |
| エラーパスのテスト | 500 や timeout を意図的に再現したい |
| 速度 | 外部 API は遅い |
| プロバイダ障害 | 外部側がダウンしても CI を回したい |

**逆にモックしない方がいいもの**：
- Supabase（自前 DB だから本物が高速・無料）
- Stripe Checkout のリダイレクト先（テストモード Stripe は本物を使う）
- 自社の API

## 1. 基本：`page.route()`

```ts
test('在庫切れの表示', async ({ page }) => {
  // /api/inventory への GET を全部モック
  await page.route('**/api/inventory*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ stock: 0 }),
    });
  });

  await page.goto('/products/123');
  await expect(page.getByText('在庫切れ')).toBeVisible();
});
```

### URL パターン

```ts
// glob
await page.route('**/api/users/*', handler);

// 正規表現
await page.route(/\/api\/users\/\d+/, handler);

// 関数（最も柔軟）
await page.route(url => url.pathname.startsWith('/api/'), handler);
```

### HTTP メソッド絞り込み

```ts
await page.route('**/api/users', async (route) => {
  if (route.request().method() !== 'POST') {
    await route.fallback();  // 他のハンドラに任せる
    return;
  }
  await route.fulfill({ status: 201, body: JSON.stringify({ id: 1 }) });
});
```

## 2. リクエストの加工・透過

```ts
// (a) リクエストヘッダを書き換えて通す
await page.route('**/api/**', async (route) => {
  const headers = { ...route.request().headers(), 'x-test': '1' };
  await route.continue({ headers });
});

// (b) レスポンスを取得して書き換え
await page.route('**/api/users', async (route) => {
  const response = await route.fetch();
  const json = await response.json();
  json.users = json.users.slice(0, 1);  // 1 件だけに
  await route.fulfill({ response, json });
});

// (c) ネットワーク失敗をシミュレート
await page.route('**/api/save', route => route.abort('failed'));

// (d) タイムアウトをシミュレート
await page.route('**/api/slow', async (route) => {
  await new Promise(r => setTimeout(r, 60_000));
  await route.fulfill({ status: 408 });
});
```

## 3. テスト全体でのモック適用

```ts
test.beforeEach(async ({ context }) => {
  // context 全体に適用
  await context.route('**/api/feature-flags', route =>
    route.fulfill({ body: JSON.stringify({ newUi: true }) })
  );
});
```

## 4. レスポンスを記録（HAR）して再生

実 API に依存しないテスト**自動生成**：

```ts
// 記録モード
test('記録', async ({ page }) => {
  await page.routeFromHAR('tests/e2e/har/inventory.har', {
    update: true,
  });
  await page.goto('/inventory');
});

// 再生モード（update を外す）
test('再生', async ({ page }) => {
  await page.routeFromHAR('tests/e2e/har/inventory.har');
  await page.goto('/inventory');
  // ↑ 実 API は呼ばれない、HAR から応答
});
```

## 5. ネットワーク監視（モックではなく検証）

```ts
test('保存 API が呼ばれる', async ({ page }) => {
  const requestPromise = page.waitForRequest(req =>
    req.url().includes('/api/save') && req.method() === 'POST'
  );

  await page.getByRole('button', { name: '保存' }).click();
  const request = await requestPromise;

  expect(request.postDataJSON()).toEqual({ title: 'foo' });
});

test('保存 API の応答内容', async ({ page }) => {
  const responsePromise = page.waitForResponse('**/api/save');
  await page.getByRole('button', { name: '保存' }).click();
  const response = await responsePromise;

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ id: expect.any(String) });
});
```

## 6. WebSocket / SSE のモック

```ts
// WebSocket
await page.routeWebSocket('wss://**/ws', ws => {
  ws.onMessage(msg => {
    ws.send(JSON.stringify({ echo: msg.toString() }));
  });
});

// SSE は通常の page.route で stream を返す
await page.route('**/api/events', async (route) => {
  await route.fulfill({
    contentType: 'text/event-stream',
    body: 'data: {"event":"foo"}\n\n',
  });
});
```

## 7. MSW との併用 — 注意点

**結論：併用しないのが無難**。

- MSW は Service Worker でリクエストを横取りする
- Playwright の `page.route()` も Service Worker を経由する設計
- **MSW が先に動くと Playwright からは見えない** → ネットワーク検証ができなくなる

### 例外：Next.js のサーバサイドコード（SSR / API Routes）

- ブラウザの Service Worker は使えない（サーバ側だから）
- Node 側で MSW（`setupServer`）を立てれば SSR のフェッチをモック可能
- Playwright と競合しないので OK

```ts
// tests/e2e/global-setup.ts
import { setupServer } from 'msw/node';
import { handlers } from './msw-handlers';

let server;

export default async function globalSetup() {
  server = setupServer(...handlers);
  server.listen();
}

export async function globalTeardown() {
  server?.close();
}
```

## 8. Next.js 15 の test proxy（参考）

Next.js 15 から experimental の test proxy があり、SSR で発生する `fetch` を MSW で横取りできる。これを使うと**ブラウザ→Next.js→外部 API** の流れで、外部 API 部分だけモック可能。

```ts
// next.config.ts
export default {
  experimental: {
    testProxy: true,
  },
};
```

```ts
// e2e で
test('外部 API を MSW でモック', async ({ next, page }) => {
  await next.onFetch((request) => {
    if (request.url.includes('api.stripe.com')) {
      return new Response(JSON.stringify({ id: 'cus_test' }));
    }
  });
  await page.goto('/checkout');
});
```

## 9. パターン早見表

| やりたいこと | やり方 |
|------------|-------|
| ブラウザ→外部 API をモック | `page.route()` |
| ブラウザ→自社 API をモック | `page.route()` |
| SSR→外部 API をモック | MSW (`setupServer`) or Next.js test proxy |
| API 呼び出しの検証 | `waitForRequest` / `waitForResponse` |
| ネットワーク失敗 | `route.abort('failed')` |
| HAR 記録・再生 | `routeFromHAR({ update: true })` |
| WebSocket | `routeWebSocket` |

## 10. アンチパターン

1. **本物の外部 API を毎テストで叩く** → 遅い・課金・flaky
2. **MSW をブラウザ側で起動した上で `page.route` も使う** → MSW が勝つ
3. **モックを一箇所に書きすぎる** → どこで何が起きてるか不明
4. **モックを忘れて本番 API を叩く** → 課金・データ破壊
5. **`route.continue()` で書き換えなしに通すだけ** → そもそも route 不要
