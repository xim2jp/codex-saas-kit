# Auth Testing Strategy

認証は失敗が致命的。網羅的にテストする。

## テストモード

### Supabase ローカル開発

```bash
# Supabase CLI でローカル環境
npx supabase start

# テスト用のローカル Supabase が起動
# URL: http://localhost:54321
# Studio: http://localhost:54323
```

ローカル環境は本番と完全分離。テストデータを自由に作成・破棄可能。

### Auth プロバイダのテスト

| プロバイダ | テスト方法 |
|----------|----------|
| Google | テストアカウント作成、OAuth consent screen を development モードに |
| Apple | Apple Developer の Sandbox |
| Facebook | Test Users（App Roles > Test Users） |
| X | API Tier の制約上、本番アカウントでテスト |
| GitHub | テスト用 GitHub アカウント |
| LINE | LINE Developers の チャネルで Sandbox |

## テスト計画への落とし込み

### Critical（必ずテスト）

- [ ] **各 OAuth プロバイダで正常サインイン**
- [ ] **同じメアドで2つのプロバイダ → 統合される**（戦略A の場合）
- [ ] **OAuth後の profile 自動作成**
- [ ] **Stripe Customer 自動作成**（payment-integration-specialist と連携）
- [ ] **セッション期限切れ → トークン自動リフレッシュ**
- [ ] **サインアウト → 全 Cookie クリア**
- [ ] **未認証で保護ページ → /login へリダイレクト**
- [ ] **認証済みで /login → /dashboard へリダイレクト**
- [ ] **RLS: 自分のデータのみ取得**
- [ ] **RLS: 他人のデータは取得不可**

### Major（推奨）

- [ ] アカウント連携（既存ユーザーが追加プロバイダ連携）
- [ ] アカウント解除
- [ ] 最後の identities 解除を防止
- [ ] メアド変更フロー
- [ ] 退会フロー（論理削除）
- [ ] 退会後の Stripe Subscription 解約
- [ ] 再ログイン時のセッション復元

### Minor

- [ ] エラー画面の表示
- [ ] ロケール対応
- [ ] OAuthキャンセル時の挙動

## Unit Tests

### Auth Helper のロジック

```typescript
// src/lib/supabase/__tests__/server.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createClient } from '../server';

describe('createClient (server)', () => {
  it('should create client with environment variables', async () => {
    const client = await createClient();
    expect(client).toBeDefined();
    // ...
  });
});
```

### Profile 作成ロジック

```typescript
describe('handle_new_user trigger', () => {
  it('should create profile when auth user is created', async () => {
    const supabase = createAdminClient();
    
    // Given: テストユーザー作成
    const { data: { user } } = await supabase.auth.admin.createUser({
      email: 'test@example.com',
      user_metadata: { full_name: 'Test User' },
    });
    
    // When: profile 取得
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user!.id)
      .single();
    
    // Then
    expect(profile).toBeDefined();
    expect(profile.email).toBe('test@example.com');
    expect(profile.display_name).toBe('Test User');
    
    // Cleanup
    await supabase.auth.admin.deleteUser(user!.id);
  });
});
```

## Integration Tests

### RLS テスト

```typescript
// test/integration/rls.test.ts
describe('Row Level Security', () => {
  let userA: User;
  let userB: User;
  
  beforeAll(async () => {
    userA = await createTestUser('a@test.local');
    userB = await createTestUser('b@test.local');
  });
  
  afterAll(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });
  
  it('TC-RLS-001: ユーザーAは自分のデータのみ見える', async () => {
    const supabaseA = createClientAsUser(userA);
    const supabaseB = createClientAsUser(userB);
    
    // userA がデータ作成
    await supabaseA.from('invoices').insert({ 
      user_id: userA.id, 
      amount: 1000 
    });
    
    // userB から見えないことを確認
    const { data } = await supabaseB.from('invoices').select('*');
    expect(data?.find(i => i.user_id === userA.id)).toBeUndefined();
  });
});
```

### Auth Callback テスト

```typescript
describe('Auth Callback', () => {
  it('TC-AUTH-CB-001: code を受け取って session 確立', async () => {
    // モックの auth code を準備
    const mockCode = 'test_code_xxx';
    
    // callback route を呼ぶ
    const response = await fetch(`http://localhost:3000/auth/callback?code=${mockCode}`);
    
    // リダイレクトされていることを確認
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toMatch(/\/dashboard/);
    
    // Cookie が設定されていることを確認
    const cookies = response.headers.get('Set-Cookie');
    expect(cookies).toContain('sb-');
  });
});
```

## E2E Tests（Playwright）

### Google OAuth フロー

```typescript
// e2e/auth-google.spec.ts
import { test, expect } from '@playwright/test';

test('SCN-AUTH-001: Google OAuth でサインアップ', async ({ page }) => {
  // ログインページ
  await page.goto('/login');
  
  // Google ボタンクリック
  const [googlePage] = await Promise.all([
    page.context().waitForEvent('page'),
    page.getByRole('button', { name: /Googleで続行/ }).click(),
  ]);
  
  // Google OAuth 画面でテストアカウントでログイン
  await googlePage.fill('input[type="email"]', process.env.TEST_GOOGLE_EMAIL!);
  await googlePage.click('button:has-text("次へ")');
  await googlePage.fill('input[type="password"]', process.env.TEST_GOOGLE_PASSWORD!);
  await googlePage.click('button:has-text("次へ")');
  
  // 同意画面
  await googlePage.click('button:has-text("許可")');
  
  // 自社サイトにリダイレクトされる
  await page.waitForURL(/\/dashboard/);
  
  // ダッシュボードでメールアドレスが表示されている
  await expect(page.getByText(process.env.TEST_GOOGLE_EMAIL!)).toBeVisible();
});
```

### セッション期限切れシナリオ

```typescript
test('TC-AUTH-SESSION-001: トークン期限切れ後の自動リフレッシュ', async ({ page, context }) => {
  // ログイン状態
  await loginAs(page, 'test@example.com');
  
  // Cookie の expires を強制的に短くする
  const cookies = await context.cookies();
  const authCookie = cookies.find(c => c.name.startsWith('sb-'));
  
  // 待機（または時間を進める）
  await page.waitForTimeout(2000);
  
  // ページ遷移 → middleware が refresh するはず
  await page.goto('/dashboard');
  
  // ログアウトされていないことを確認
  await expect(page).toHaveURL(/\/dashboard/);
});
```

### 退会フロー

```typescript
test('SCN-AUTH-DELETE-001: 退会フロー', async ({ page }) => {
  await loginAs(page, 'delete-test@example.com');
  
  // 設定 > アカウント
  await page.goto('/settings/account');
  
  // 退会ボタン
  await page.getByRole('button', { name: /退会する/ }).click();
  
  // 確認ダイアログ
  await page.getByRole('textbox', { name: /確認のため/ }).fill('退会する');
  await page.getByRole('button', { name: /退会を確定/ }).click();
  
  // ログアウトされ、トップページへ
  await page.waitForURL('/');
  
  // 再度同じメールでログインしようとすると「再アクティブ化」が出る
  await page.goto('/login');
  // ...
});
```

## RLS の網羅テスト

各テーブルについて：

```typescript
describe('Table: invoices RLS', () => {
  it('owner can SELECT', async () => { /* ... */ });
  it('owner can INSERT', async () => { /* ... */ });
  it('owner can UPDATE', async () => { /* ... */ });
  it('owner can DELETE', async () => { /* ... */ });
  it('non-owner cannot SELECT', async () => { /* ... */ });
  it('non-owner cannot INSERT (with other user_id)', async () => { /* ... */ });
  it('non-owner cannot UPDATE', async () => { /* ... */ });
  it('non-owner cannot DELETE', async () => { /* ... */ });
  it('anon cannot access', async () => { /* ... */ });
});
```

## モック戦略

### Supabase クライアントのモック

```typescript
// src/test/mocks/supabase.ts
import { vi } from 'vitest';

export const mockSupabaseClient = () => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null,
    }),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: {}, error: null }),
  }),
});
```

### OAuth プロバイダの応答モック

```typescript
// msw でモック
import { http, HttpResponse } from 'msw';

export const authHandlers = [
  http.post('https://*.supabase.co/auth/v1/token', () => {
    return HttpResponse.json({
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      user: { id: 'mock_user_id', email: 'mock@example.com' },
    });
  }),
];
```

## CI/CD 統合

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      
      - name: Start Supabase
        run: supabase start
      
      - name: Run migrations
        run: supabase db reset
      
      - name: Run tests
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.SUPABASE_LOCAL_ANON_KEY }}
          SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_LOCAL_SERVICE_ROLE_KEY }}
        run: npm test
```

## 必須テストシナリオ（一覧）

| ID | シナリオ | 重要度 |
|----|---------|--------|
| TC-AUTH-001 | Google OAuth サインアップ | Critical |
| TC-AUTH-002 | Apple OAuth サインアップ | Critical（採用時） |
| TC-AUTH-003 | LINE OAuth サインアップ | Critical（採用時） |
| TC-AUTH-004 | 同メアドで別プロバイダ → 統合 | Critical |
| TC-AUTH-005 | サインアウト | Critical |
| TC-AUTH-006 | 未認証で保護ページ → リダイレクト | Critical |
| TC-AUTH-007 | 認証済みで login → リダイレクト | Major |
| TC-AUTH-008 | トークンリフレッシュ | Critical |
| TC-AUTH-009 | アカウント連携 | Major |
| TC-AUTH-010 | アカウント解除（最後のは不可） | Major |
| TC-AUTH-011 | メアド変更 + Stripe 同期 | Major |
| TC-AUTH-012 | 退会フロー | Critical |
| TC-AUTH-013 | RLS: 自分のデータのみ | Critical |
| TC-AUTH-014 | RLS: 他人のデータ不可 | Critical |
| TC-AUTH-015 | エラーメッセージで情報漏えいなし | Major |

## チェックリスト

- [ ] ローカル Supabase 環境を構築
- [ ] テストユーザー作成・削除ヘルパー
- [ ] RLS テスト全テーブルで実装
- [ ] 各 OAuth プロバイダで E2Eテスト
- [ ] セッション期限切れシナリオ
- [ ] 退会フローのE2E
- [ ] CI/CD で自動実行
- [ ] テストカバレッジ：認証関連 90%以上

## アンチパターン

1. **本番 Supabase でテスト**：データ汚染、コスト発生
2. **モックだけで完了**：実際の Supabase Auth 挙動を検証していない
3. **RLS テスト未実施**：本番で「他人のデータ見える」発覚
4. **OAuth プロバイダのE2Eテストなし**：プロバイダ側変更で動かない
5. **退会後の Stripe 解約テストなし**：継続課金クレーム
6. **エラーメッセージのテストなし**：情報漏えい見落とし
