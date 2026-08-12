# E2E ヘルパ・テンプレ集（コード雛形）

`tests/e2e/helpers/` 配下の共通ヘルパと、`playwright.config.ts` / fixtures の標準形。**プロジェクト初期化時にコピペで使える形**にしてある。

## 配置イメージ

```
tests/e2e/
├── playwright.config.ts
├── auth.setup.ts                # 各 role の storageState 生成
├── helpers/
│   ├── users.ts                 # テストユーザー作成/削除
│   ├── db.ts                    # Supabase 直接アクセス
│   ├── stripe.ts                # Stripe テスト用ヘルパ
│   └── mail.ts                  # Inbucket / Mailosaur 連携（任意）
├── fixtures/
│   └── authenticated.ts         # 認証済み page fixture
├── usecases/                    # ユースケース E2E（spec ファイル）
└── results/                     # trace / video / screenshot 出力
```

## 1. playwright.config.ts

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'tests/e2e/results/html' }]]
    : [['list'], ['html', { outputFolder: 'tests/e2e/results/html' }]],

  outputDir: 'tests/e2e/results/artifacts',

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // 認証情報を生成するセットアッププロジェクト
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // 未認証ユーザー（signup / login テスト用）
    {
      name: 'chromium-anon',
      use: { ...devices['Desktop Chrome'], storageState: { cookies: [], origins: [] } },
    },
    // 認証済み一般ユーザー
    {
      name: 'chromium-user',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // 管理者
    {
      name: 'chromium-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
```

**重要**：`playwright/.auth/` は `.gitignore` に必ず追加。セッション Cookie の漏洩を防ぐ。

```gitignore
playwright/.auth/
tests/e2e/results/
```

## 2. tests/e2e/auth.setup.ts

```ts
import { test as setup, expect } from '@playwright/test';
import { createTestUser, ensureTestUser } from './helpers/users';

const userAuthFile = 'playwright/.auth/user.json';
const adminAuthFile = 'playwright/.auth/admin.json';

setup('一般ユーザーの storageState を生成', async ({ page }) => {
  const { email, password } = await ensureTestUser('user');

  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.context().storageState({ path: userAuthFile });
});

setup('管理者の storageState を生成', async ({ page }) => {
  const { email, password } = await ensureTestUser('admin');

  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page).toHaveURL(/\/(admin|dashboard)/);

  await page.context().storageState({ path: adminAuthFile });
});
```

## 3. tests/e2e/helpers/users.ts

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const TEST_EMAIL_DOMAIN = process.env.TEST_EMAIL_DOMAIN ?? 'example.test';
const DEFAULT_PASSWORD = 'TestPass123!';

// Service Role Key を使う Admin クライアント（テスト専用）
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for E2E helpers');
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type Role = 'user' | 'admin';

interface TestUser {
  id: string;
  email: string;
  password: string;
  role: Role;
}

/**
 * 並列ワーカー固有のテストユーザーを作成。
 * 命名規約：${role}-${parallelIndex}-${Date.now()}@${TEST_EMAIL_DOMAIN}
 */
export async function createTestUser(
  role: Role = 'user',
  parallelIndex = 0,
): Promise<TestUser> {
  const supabase = adminClient();
  const email = `${role}-${parallelIndex}-${Date.now()}@${TEST_EMAIL_DOMAIN}`;
  const password = DEFAULT_PASSWORD;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
  });
  if (error || !data.user) {
    throw new Error(`createTestUser failed: ${error?.message}`);
  }

  // profiles の自動作成がトリガで動いていない場合は手動で
  await supabase.from('profiles').upsert({
    user_id: data.user.id,
    email,
    display_name: `Test ${role} ${parallelIndex}`,
  });

  return { id: data.user.id, email, password, role };
}

/**
 * 安定した「テスト固定ユーザー」を ensure する。
 * setup phase で 1 度だけ使う想定。並列テストでは createTestUser を使う。
 */
export async function ensureTestUser(role: Role): Promise<TestUser> {
  const supabase = adminClient();
  const email = `${role}@${TEST_EMAIL_DOMAIN}`;
  const password = DEFAULT_PASSWORD;

  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users.find((u) => u.email === email);
  if (found) {
    return { id: found.id, email, password, role };
  }

  return createTestUser(role);
}

/**
 * テストユーザーを完全削除（Supabase Auth + profiles + Stripe）。
 * afterEach で呼ぶ。
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const supabase = adminClient();

  // profiles から stripe_customer_id を取得（先に Stripe 側を消すため）
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (profile?.stripe_customer_id) {
    const { deleteStripeCustomer } = await import('./stripe');
    await deleteStripeCustomer(profile.stripe_customer_id);
  }

  // profiles を削除
  await supabase.from('profiles').delete().eq('user_id', userId);

  // auth.users を削除
  await supabase.auth.admin.deleteUser(userId);
}
```

## 4. tests/e2e/helpers/db.ts

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

function admin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function fetchProfile(userId: string) {
  const { data, error } = await admin()
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchSubscription(userId: string) {
  const profile = await fetchProfile(userId);
  if (!profile.subscription_id) return null;
  // subscriptions テーブルがある場合
  const { data } = await admin()
    .from('subscriptions')
    .select('*')
    .eq('id', profile.subscription_id)
    .maybeSingle();
  return data;
}

/**
 * profiles の特定フィールドが期待値に到達するまでポーリング。
 * Webhook 経由更新の待ちに使用。
 */
export async function pollProfileUntil<K extends keyof Awaited<ReturnType<typeof fetchProfile>>>(
  userId: string,
  field: K,
  expectedValue: unknown,
  timeoutMs = 30_000,
  intervalMs = 1_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const profile = await fetchProfile(userId);
    if (profile[field] === expectedValue) return profile;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `pollProfileUntil timeout: ${String(field)} did not become ${expectedValue}`,
  );
}
```

## 5. tests/e2e/helpers/stripe.ts

```ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil', // 最新版に合わせる
});

if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  throw new Error(
    'STRIPE_SECRET_KEY must be a test key (sk_test_*). E2E helpers refuse to run with live keys.',
  );
}

export async function fetchStripeCustomer(customerId: string) {
  return stripe.customers.retrieve(customerId);
}

export async function listSubscriptions(customerId: string) {
  return stripe.subscriptions.list({ customer: customerId });
}

export async function deleteStripeCustomer(customerId: string) {
  try {
    await stripe.customers.del(customerId);
  } catch (e) {
    // 既に削除されている場合は無視
    if ((e as Stripe.errors.StripeError).code !== 'resource_missing') throw e;
  }
}

/**
 * Test Clock を使った時間圧縮。月跨ぎ/年跨ぎテスト用。
 */
export async function createTestClock(frozenTime: Date = new Date()) {
  return stripe.testHelpers.testClocks.create({
    frozen_time: Math.floor(frozenTime.getTime() / 1000),
  });
}

export async function advanceTestClock(clockId: string, advanceTo: Date) {
  return stripe.testHelpers.testClocks.advance(clockId, {
    frozen_time: Math.floor(advanceTo.getTime() / 1000),
  });
}

export async function deleteTestClock(clockId: string) {
  try {
    await stripe.testHelpers.testClocks.del(clockId);
  } catch {
    // ignore
  }
}

export { stripe };
```

## 6. tests/e2e/helpers/mail.ts（Inbucket 例）

```ts
const INBUCKET_URL = process.env.INBUCKET_URL ?? 'http://localhost:54324';

interface InbucketMessage {
  id: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  body: { text: string; html: string };
}

export async function pollLatestMail(
  toAddress: string,
  matchSubject: RegExp,
  timeoutMs = 30_000,
): Promise<InbucketMessage> {
  const deadline = Date.now() + timeoutMs;
  const mailbox = toAddress.split('@')[0];

  while (Date.now() < deadline) {
    const list: Array<{ id: string; subject: string }> = await fetch(
      `${INBUCKET_URL}/api/v1/mailbox/${encodeURIComponent(mailbox)}`,
    ).then((r) => r.json());

    const hit = list.find((m) => matchSubject.test(m.subject));
    if (hit) {
      const detail: InbucketMessage = await fetch(
        `${INBUCKET_URL}/api/v1/mailbox/${encodeURIComponent(mailbox)}/${hit.id}`,
      ).then((r) => r.json());
      return detail;
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`Mail not received: to=${toAddress}, subject~=${matchSubject}`);
}

export function extractFirstUrl(body: string, pattern: RegExp): string {
  const match = body.match(pattern);
  if (!match) throw new Error(`URL not found in mail body: ${pattern}`);
  return match[0];
}
```

## 7. tests/e2e/fixtures/authenticated.ts

```ts
import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createTestUser, deleteTestUser, type TestUser } from '../helpers/users';

interface Fixtures {
  freshUser: TestUser;
  authedPage: Page;
}

/**
 * テスト毎に新規 user を発行 + ログイン状態の page を提供する fixture。
 * 退会・プロフィール変更系で storageState を使い回せないケース用。
 */
export const test = base.extend<Fixtures>({
  freshUser: async ({}, use, testInfo) => {
    const user = await createTestUser('user', testInfo.parallelIndex);
    await use(user);
    await deleteTestUser(user.id);
  },
  authedPage: async ({ page, freshUser }, use) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(freshUser.email);
    await page.getByLabel('パスワード').fill(freshUser.password);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForURL(/\/dashboard/);
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

使用例：

```ts
import { test, expect } from '../fixtures/authenticated';

test.use({ storageState: { cookies: [], origins: [] } });

test('UC-WITHDRAW-01: 退会フロー', async ({ authedPage: page, freshUser }) => {
  await page.goto('/dashboard/settings/account');
  await page.getByRole('link', { name: '退会する' }).click();
  // ... 続きは spec で
});
```

## 8. 環境変数（.env.test）

```bash
# Supabase（テスト用プロジェクト）
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey...

# Stripe（テストモードのみ）
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# E2E
E2E_BASE_URL=http://localhost:3000
TEST_EMAIL_DOMAIN=example.test
INBUCKET_URL=http://localhost:54324
```

**`.env.test` も `.gitignore` に追加**。本番キーの誤コミットを防ぐため、`helpers/stripe.ts` で `sk_test_*` 以外を検出時に throw する（上記コードに実装済み）。

## 9. package.json への scripts 追加

```json
{
  "scripts": {
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "e2e:usecases": "playwright test tests/e2e/usecases",
    "e2e:install": "playwright install --with-deps chromium",
    "e2e:report": "playwright show-report tests/e2e/results/html"
  }
}
```

## 10. アンチパターン

1. **Service Role Key をテストユーザーの fetch に常用** → RLS の検証ができない。RLS 検証時は anon key + 認証セッションで叩く
2. **テストユーザーのメアドが固定** → 並列実行で衝突。`parallelIndex` + `Date.now()` で分離
3. **afterEach のクリーンアップ漏れ** → DB / Stripe が汚染、次の実行で fail
4. **`STRIPE_SECRET_KEY` 検証なし** → 本番キーで動かして本番データ破壊
5. **storageState を git にコミット** → セッション Cookie 流出
6. **メール待機を `waitForTimeout` で固定 5 秒** → CI で flaky、`pollLatestMail` で最大 30 秒まで polling
7. **ヘルパで業務ロジックを再実装** → テストと実装が同じバグを持ち、テストが意味を成さない。ヘルパは「セットアップ・検証・クリーンアップ」のみ
