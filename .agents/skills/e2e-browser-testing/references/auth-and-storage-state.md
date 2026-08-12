# Auth & Storage State

ログインを毎回やらない設計。`storageState` でセッションを再利用するのが標準。Supabase Auth + `@supabase/ssr` を前提とする。

## なぜ storageState か

毎テストで `/login` を踏むと：
- 1 テスト 3-5 秒のオーバーヘッド × ケース数
- ログイン UI 改修で全テスト落ちる
- Supabase の認証レートリミットに引っかかる
- OAuth プロバイダ依存だと CI で詰む

**`storageState` パターン**：
1. setup project で**一度だけ**ログインし、Cookie / localStorage を JSON に保存
2. 各テストはその JSON を起動時に読み込む
3. 初期状態から認証済み

## 1. ファイル配置

```
tests/e2e/
├── auth.setup.ts          # setup project
└── authenticated/
    └── dashboard.spec.ts  # 認証済みテスト

playwright/.auth/
└── user.json              # 生成される（gitignore）
```

## 2. `auth.setup.ts`

### パターン A: Supabase Email/Password（推奨：CI で安定）

```ts
// tests/e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // (1) テストユーザーを事前作成（admin API）
  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // テスト環境のみ
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const email = `e2e-${Date.now()}@example.test`;
  const password = 'TestPassword!23';

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,  // メアド検証スキップ
  });
  if (error) throw error;

  // (2) UI からログイン（実フローを通すことが重要）
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'ログイン' }).click();

  // (3) ログイン完了を検出
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();

  // (4) storageState を保存
  await page.context().storageState({ path: authFile });

  // ユーザーIDをメタデータに残してもよい（teardown 用）
  // ※ 本番では teardown で必ず削除する
});
```

### パターン B: API 直接ログイン（最速、UI を経由しない）

```ts
setup('authenticate via API', async ({ page, request }) => {
  // Supabase の sign-in endpoint を直叩き
  const res = await request.post(
    `${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: { apikey: process.env.SUPABASE_ANON_KEY! },
      data: { email, password },
    }
  );
  const { access_token, refresh_token } = await res.json();

  // localStorage / Cookie に注入（@supabase/ssr の保存形式に合わせる）
  await page.addInitScript(({ at, rt }) => {
    const key = `sb-${location.hostname}-auth-token`;
    localStorage.setItem(key, JSON.stringify({
      access_token: at,
      refresh_token: rt,
    }));
  }, { at: access_token, rt: refresh_token });

  await page.goto('/dashboard');
  await page.context().storageState({ path: authFile });
});
```

> パターン A の方が**実フローを検証できるので推奨**。パターン B は超大量テストで時間が問題になる時のみ。

## 3. `playwright.config.ts` での連携

```ts
projects: [
  {
    name: 'setup',
    testMatch: /.*\.setup\.ts/,
  },
  {
    name: 'chromium-user',
    use: {
      ...devices['Desktop Chrome'],
      storageState: 'playwright/.auth/user.json',
    },
    testMatch: ['**/authenticated/**'],
    dependencies: ['setup'],  // ← 先に setup を実行
  },
],
```

## 4. ロール別の認証（管理者・一般ユーザー）

```ts
// auth.setup.ts
setup('authenticate as user', async ({ page }) => {
  await loginAs(page, 'user@example.test');
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
});

setup('authenticate as admin', async ({ page }) => {
  await loginAs(page, 'admin@example.test');
  await page.context().storageState({ path: 'playwright/.auth/admin.json' });
});
```

```ts
// playwright.config.ts
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  {
    name: 'user',
    use: { storageState: 'playwright/.auth/user.json' },
    testMatch: ['**/user/**'],
    dependencies: ['setup'],
  },
  {
    name: 'admin',
    use: { storageState: 'playwright/.auth/admin.json' },
    testMatch: ['**/admin/**'],
    dependencies: ['setup'],
  },
],
```

## 5. ワーカーごとに別ユーザー（並列でデータ競合を防ぐ）

```ts
import { test as base } from '@playwright/test';

export const test = base.extend<{}, { workerStorageState: string }>({
  storageState: ({ workerStorageState }, use) => use(workerStorageState),

  workerStorageState: [async ({ browser }, use) => {
    const id = test.info().parallelIndex;
    const fileName = `playwright/.auth/worker-${id}.json`;

    if (!fs.existsSync(fileName)) {
      const page = await browser.newPage({ storageState: undefined });
      await loginAs(page, `worker-${id}@example.test`);
      await page.context().storageState({ path: fileName });
      await page.close();
    }
    await use(fileName);
  }, { scope: 'worker' }],
});
```

## 6. OAuth プロバイダのテスト

**E2E で実 OAuth を踏むのはほぼ不可能**（reCAPTCHA、デバイスチェック、レートリミット）。以下のいずれかで回避：

### a. Supabase の Email/Password で代用

OAuth コールバック後と同じ「ログイン済み状態」になるので、業務フローのテストは Email/Password で代替可能。

### b. OAuth コールバックを mock

```ts
await page.route('**/auth/v1/callback*', async (route) => {
  await route.fulfill({
    status: 302,
    headers: {
      'set-cookie': `sb-access-token=...`,
      'location': '/dashboard',
    },
  });
});
```

### c. プロバイダ別の Sandbox

| プロバイダ | テスト方法 |
|----------|----------|
| Google | OAuth consent screen を Testing モードに、テストアカウントを許可リスト追加 |
| GitHub | テスト用 GitHub アカウント＋ Personal Access Token |
| LINE | LINE Developers の Sandbox チャネル |
| Apple | Apple Developer の Sandbox（Web は厳しい） |
| Facebook | App Roles > Test Users |

ただし**いずれも CI で flaky**。Critical シナリオの 1 本だけ実 OAuth、残りは Email/Password 代替がベター。

## 7. テストデータのクリーンアップ

```ts
// tests/e2e/global-teardown.ts
import { createClient } from '@supabase/supabase-js';

export default async function globalTeardown() {
  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // e2e-* で作ったユーザーを全削除
  const { data: { users } } = await admin.auth.admin.listUsers();
  for (const u of users) {
    if (u.email?.startsWith('e2e-')) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}
```

```ts
// playwright.config.ts
export default defineConfig({
  globalTeardown: './tests/e2e/global-teardown.ts',
  // ...
});
```

## 8. セキュリティ

- **`playwright/.auth/` は必ず `.gitignore`**。中身は本物のセッション Cookie
- **`SUPABASE_SERVICE_ROLE_KEY` は CI でのみ設定**、テスト環境（本番と別 project）のキーを使う
- **テストユーザーのメアド**は `*.test` ドメインや実在しないドメインを使う
- Supabase の **テスト用 project** を本番とは別に作る（Free Tier で十分）

## 9. よくあるトラブル

### `storageState` が効かない

- `playwright.config.ts` で `dependencies: ['setup']` が付いているか
- setup が成功しているか（`npx playwright test --project=setup` で単独実行）
- ストレージキーが `@supabase/ssr` の最新バージョンに合っているか

### setup が認証成功しているのに dashboard で未認証

- middleware がリダイレクトしている可能性
- Cookie のドメイン・パス確認（`localhost` vs `127.0.0.1` で別 Cookie）
- `baseURL` を `playwright.config.ts` で固定

### セッションが期限切れ

- setup の頻度を上げる（`reuseExistingServer` を false に）
- refresh token も含めて保存できているか確認
