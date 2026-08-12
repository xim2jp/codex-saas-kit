# Setup & Config

Playwright を Next.js + Supabase プロジェクトに導入する初期手順と、CI/Local 両用の `playwright.config.ts` 標準形。

## 1. インストール

```bash
# 推奨：公式 init で全部入り（GitHub Actions yml も生成）
npm init playwright@latest

# 質問への回答指針（野口さんスタック）
# - TypeScript / JavaScript? → TypeScript
# - Tests directory? → tests/e2e
# - GitHub Actions workflow? → Yes
# - Install Playwright browsers? → Yes
```

導入されるもの：
- `@playwright/test`（テストランナー + アサーション）
- `playwright.config.ts`
- `tests/e2e/example.spec.ts`
- `.github/workflows/playwright.yml`
- Chromium / Firefox / WebKit のバイナリ（ローカル）

## 2. ディレクトリ構成（標準）

```
my-saas/
├── tests/
│   └── e2e/
│       ├── auth.setup.ts             # storageState を作る setup project
│       ├── fixtures/                 # 共通フィクスチャ
│       │   ├── auth.ts
│       │   └── test-users.ts
│       ├── helpers/                  # ヘルパー（DB クリーンアップなど）
│       │   └── supabase-admin.ts
│       ├── pages/                    # Page Object Model（任意）
│       │   ├── login.page.ts
│       │   └── dashboard.page.ts
│       ├── critical/                 # Critical シナリオ
│       │   ├── signup.spec.ts
│       │   ├── checkout.spec.ts
│       │   └── invoice-download.spec.ts
│       └── smoke/                    # デプロイ前 smoke
│           └── homepage.spec.ts
├── playwright/
│   └── .auth/                        # ← gitignore 必須
│       ├── user.json
│       └── admin.json
└── playwright.config.ts
```

## 3. `playwright.config.ts` 標準形

```ts
import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,                              // テストファイル内も並列
  forbidOnly: isCI,                                 // CI で .only を禁止
  retries: isCI ? 2 : 0,                            // CI のみリトライ
  workers: isCI ? 2 : undefined,                    // Supabase 接続上限考慮
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }], ['blob']]
    : [['html', { open: 'on-failure' }], ['list']],

  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL,
    trace: 'on-first-retry',                        // CI で失敗時のみ trace
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  },

  projects: [
    // --- セットアップ project（認証済み storageState を生成） ---
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // --- 認証不要のテスト（ランディング、サインアップなど） ---
    {
      name: 'chromium-anon',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/authenticated/**'],
    },
    // --- 認証済みテスト（一般ユーザー） ---
    {
      name: 'chromium-user',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      testMatch: ['**/authenticated/**'],
      dependencies: ['setup'],
    },
    // --- モバイル（任意） ---
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
      testMatch: ['**/critical/**'],
      dependencies: ['setup'],
    },
  ],

  // ローカルで dev server を自動起動（CI では事前にビルド済みを使う想定）
  webServer: {
    command: isCI ? 'npm run start' : 'npm run dev',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
```

### ポイント解説

| 設定 | 意図 |
|------|------|
| `fullyParallel: true` | テストファイル内のテストも並列実行。independence を強制 |
| `forbidOnly: isCI` | `test.only` の混入を CI で検出 |
| `retries: 2` | flaky 対策の最終手段。原因究明前提 |
| `workers: 2` (CI) | Supabase Free Tier は同時接続 60。安全圏 |
| `reporter: 'blob'` | シャーディング時に複数 CI ジョブの結果をマージする |
| `trace: 'on-first-retry'` | 失敗時のみ trace 取得、容量爆発を防ぐ |
| `timezoneId: 'Asia/Tokyo'` | 日付依存テスト（請求書発行日など）の固定 |

## 4. `.gitignore` 必須追加

```gitignore
# Playwright
node_modules/
/test-results/
/playwright-report/
/playwright/.cache/

# 認証セッション（絶対にコミットしない）
/playwright/.auth/
```

## 5. テストピラミッド指針

```
        /\
       /  \    E2E (Playwright)
      /----\   ← 10-20 ケース、Critical のみ
     /      \
    /--------\ Integration (Vitest + Supabase Local)
   /          \ ← 機能ごとに 5-15 ケース
  /------------\
 /              \ Unit (Vitest)
/----------------\ ← ロジック単位で多数
```

### 何を E2E でテストするか

**やるべき（Critical）**：
- サインアップ → メール検証 → 初回ログイン
- OAuth ログイン → ダッシュボード遷移
- 価格ページ → Stripe Checkout → 課金成功 → アクティベーション
- 退会 → Stripe 解約 → ログアウト
- 主要業務フロー 1-2 本（プロダクト固有）

**やらなくていい**：
- バリデーションエラー網羅 → Integration test の領分
- 計算ロジック → Unit test の領分
- API 単体検証 → API テストでカバー
- 全画面のスナップショット → 保守地獄

## 6. NPM scripts 推奨

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report",
    "test:e2e:trace": "playwright show-trace"
  }
}
```

- `--ui`：Playwright UI モード（タイムラインで時系列確認、最強）
- `--headed`：ブラウザを表示しながら実行（観察したいとき）
- `--debug`：Inspector を起動、ステップ実行

## 7. 動作確認

```bash
# 全テスト
npm run test:e2e

# 特定プロジェクトだけ
npx playwright test --project=chromium-user

# 特定ファイル
npx playwright test tests/e2e/critical/checkout.spec.ts

# UI モード（推奨：ローカル開発時）
npm run test:e2e:ui
```
