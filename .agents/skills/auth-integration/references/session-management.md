# Session Management

Supabase Auth のセッション・トークン管理、Next.js Middleware、SSR でのパターン。

## セッションの仕組み

Supabase Auth は JWT ベース：

- **Access Token**: 短期（デフォルト1時間）、API リクエストで送信
- **Refresh Token**: 長期、Access Token の再発行に使用
- 両方を **Cookie に保存**（HttpOnly、Secure、SameSite=Lax）

`@supabase/ssr` が cookie 管理を自動化する。

## Token Refresh の流れ

```
1. Browser リクエスト → Server
2. Middleware で getUser() 呼び出し
3. Supabase Auth サーバーが Access Token を検証
4. 期限切れなら Refresh Token で新Access Tokenを取得
5. 新トークンを Cookie にセット
6. Response として返す
```

**重要**：これは `middleware.ts` がないと動かない。Server Component は Cookie を書けないため。

## getUser() vs getSession()

| メソッド | 動作 | 信頼度 |
|---------|------|-------|
| `getSession()` | Cookie 読むだけ、検証なし | **低**（偽装可能） |
| `getUser()` | Supabase Auth サーバーに問い合わせ | **高**（信頼可能） |

### 使い分け

- **クライアント側で「ログイン中か」だけ知りたい**：`getSession()` で十分（軽量）
- **サーバー側でユーザーを特定する**：必ず `getUser()`
- **権限チェック**：必ず `getUser()`
- **データ取得の主体特定**：必ず `getUser()`

```typescript
// ❌ サーバーで getSession() を信用する
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  // session.user は偽装されている可能性がある！
}

// ✅ サーバーでは getUser()
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  // user は検証済み、信頼できる
}
```

## Server Component でのパターン

### 認証必須ページ

```typescript
// src/app/(app)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }
  
  // 認証済みユーザー向けコンテンツ
  return <div>こんにちは、{user.email}さん</div>;
}
```

### Server Action

```typescript
// src/app/actions/profile.ts
'use server';

import { createClient } from '@/lib/supabase/server';

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  const displayName = formData.get('displayName') as string;
  
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', user.id);
  
  if (error) throw error;
}
```

### Route Handler

```typescript
// src/app/api/me/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  return NextResponse.json({ user, profile });
}
```

## Client Component でのパターン

### Hook 化

```typescript
// src/hooks/useUser.ts
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const supabase = createClient();
    
    // 初回取得
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
    
    // 状態変化を購読
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );
    
    return () => subscription.unsubscribe();
  }, []);
  
  return { user, loading };
}
```

### onAuthStateChange イベント

| イベント | 発生タイミング |
|---------|-------------|
| `INITIAL_SESSION` | 初回ロード時のセッション復元 |
| `SIGNED_IN` | サインイン成功 |
| `SIGNED_OUT` | サインアウト |
| `TOKEN_REFRESHED` | トークン更新 |
| `USER_UPDATED` | ユーザー情報変更 |
| `PASSWORD_RECOVERY` | パスワードリセットモード |

## Middleware の詳細設計

### 全ページに認証要求しない場合

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/signup', '/auth', '/'];
const MARKETING_PATHS = ['/pricing', '/features', '/faq', '/about', '/contact', '/blog', '/legal'];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return true;
  if (MARKETING_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return true;
  if (pathname.startsWith('/_next')) return true;
  if (pathname.startsWith('/api/webhooks/')) return true;  // Webhook は認証不要
  return false;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  
  // ⚠️ getUser() を必ず呼ぶ
  const { data: { user } } = await supabase.auth.getUser();
  
  const { pathname } = request.nextUrl;
  
  // 認証必須ルートで未ログインなら login へ
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  
  // ログイン済みで /login や /signup に来たら dashboard へ
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

## セッション期限・更新の設定

Supabase Dashboard > Authentication > Settings：

| 設定 | 推奨値 | 理由 |
|------|-------|------|
| JWT expiry | 3600 (1時間) | 標準 |
| Refresh Token Rotation | Enabled | セキュリティ向上 |
| Refresh Token Reuse Interval | 10秒 | 並行リクエスト許容 |
| Inactivity Timeout | 30日 | UX/セキュリティのバランス |

## 複数タブ・複数デバイス

`onAuthStateChange` は同じブラウザの別タブとも連動（BroadcastChannel）：

- タブAでログアウト → タブBも自動ログアウト
- タブAでログイン → タブBも自動ログイン
- タブAでトークンリフレッシュ → タブBも反映

別デバイス（PCとスマホ）は連動しない。各デバイスで個別セッション。

## セッション失効・強制ログアウト

セキュリティインシデント時など、全セッションを強制終了したい場合：

```typescript
// 全セッション無効化（admin client）
const supabase = createAdminClient();
await supabase.auth.admin.signOut(userId, 'global');
```

ユーザーが「すべてのデバイスからログアウト」したい時：

```typescript
await supabase.auth.signOut({ scope: 'global' });
```

## RLS（Row Level Security）との連携

Supabase の RLS は JWT 内の `auth.uid()` を使う：

```sql
CREATE POLICY "Users can view own data" ON public.invoices
  FOR SELECT USING (auth.uid() = user_id);
```

`@supabase/ssr` の client から呼ぶ場合、自動で JWT がリクエストヘッダーに付与される。

**注意**：`SUPABASE_SECRET_KEY` を使うと RLS を**バイパス**する。誤って公開しないこと。

## チェックリスト

- [ ] middleware.ts で getUser() 呼び出し
- [ ] Server Component で getUser() 使用（getSession() ではない）
- [ ] Client Component で onAuthStateChange を購読
- [ ] 認証必須ルートの保護
- [ ] /login にログイン済みユーザーをリダイレクト
- [ ] サインアウトの実装（HTTPS POST 推奨）
- [ ] RLS で auth.uid() を活用
- [ ] Refresh Token Rotation を有効化
- [ ] /api/webhooks/ は認証から除外

## アンチパターン

1. **Server Component で getSession()**：偽装可能、信頼不可
2. **middleware なし**：突然ログアウト
3. **getUser() を呼ばない**：トークンリフレッシュされない
4. **service_role key をクライアント露出**：RLS バイパスで全データ漏えい
5. **Webhook を middleware で認証要求**：Stripe等の Webhook が動かない
6. **localStorage で token 管理**：XSS で漏えい（Cookie HttpOnly が標準）
7. **複数 BrowserClient インスタンス**：状態不整合
