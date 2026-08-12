# Supabase Auth + Next.js App Router セットアップ

野口さんのTier Aスタック標準。`@supabase/ssr` パッケージで Server Components / Route Handlers / Middleware すべてに対応。

## パッケージ

```bash
npm install @supabase/supabase-js @supabase/ssr
```

**重要**：`@supabase/auth-helpers-nextjs` は deprecated。新規プロジェクトでは使わない。

## 環境変数

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SECRET_KEY=sb_secret_xxx
```

**重要**：
- 2026年末で旧 `anon` / `service_role` キーが廃止予定
- 新規プロジェクトでは **sb_publishable_xxx / sb_secret_xxx** を使う
- `SUPABASE_SECRET_KEY` は **絶対にクライアントに露出させない**

## クライアント構成（3種類）

### 1. Browser Client（Client Component用）

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

### 2. Server Client（Server Component / Route Handler / Server Action用）

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component からは set 不可。middleware で更新される
          }
        },
      },
    },
  );
}
```

### 3. Service Role Client（管理者操作・サーバー専用）

```typescript
// src/lib/supabase/admin.ts
// ⚠️ 絶対にクライアントから呼ばない
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,  // RLS をバイパスする強力なキー
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
```

## Middleware（必須）

**重要**：Server Components は cookie を書けないため、Middleware で token refresh する必要がある。これがないと、トークン期限切れ時に突然ログアウトされる。

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => 
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  
  // ⚠️ getUser() を必ず呼ぶ。これがトークンリフレッシュをトリガー
  const { data: { user } } = await supabase.auth.getUser();
  
  // 保護ルートのチェック
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/(marketing)')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * 以下を除外してマッチ：
     * - _next/static, _next/image, favicon.ico
     * - 静的ファイル
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

## OAuth サインイン（共通フロー）

### Client Component から

```typescript
// src/components/auth/SignInButton.tsx
'use client';

import { createClient } from '@/lib/supabase/client';

export function GoogleSignInButton() {
  const supabase = createClient();
  
  async function handleSignIn() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    
    if (error) {
      console.error('OAuth error:', error);
    }
  }
  
  return (
    <button onClick={handleSignIn}>
      Googleで続行
    </button>
  );
}
```

### OAuth Callback Route Handler

```typescript
// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // 成功：profile 作成・更新（後述）
      // Stripe Customer 作成（payment-integration-specialistと連携）
      
      // forwardedHost に応じて遷移先を決定
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }
  
  return NextResponse.redirect(`${origin}/auth/auth-error`);
}
```

## Profile テーブル設計

`auth.users` は Supabase が管理するが、追加情報を持つために `profiles` テーブルを作る。

```sql
-- supabase/migrations/00000000000001_create_profiles.sql

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  
  -- OAuth プロバイダ情報
  primary_provider TEXT,  -- 'google', 'apple', 'github', 'line', 'facebook', 'twitter', 'email'
  
  -- Stripe 連携用
  stripe_customer_id TEXT UNIQUE,
  
  -- ビジネス情報（適格請求書発行に必要）
  organization_name TEXT,
  
  -- メタデータ
  raw_user_meta_data JSONB,  -- OAuth から取得した生データ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- auth.users 作成時に profile も自動作成するトリガー
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    display_name, 
    avatar_url,
    primary_provider,
    raw_user_meta_data
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    NEW.raw_user_meta_data
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## ユーザー情報の取得

### Server Component から

```typescript
// src/app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createClient();
  
  // ⚠️ getUser() を使う。getSession() は Cookie から読むだけで検証されない
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    redirect('/login');
  }
  
  // profile 取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  return <div>こんにちは、{profile?.display_name}さん</div>;
}
```

### Client Component から

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
    
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  return { user, loading };
}
```

## サインアウト

```typescript
// src/app/auth/signout/route.ts
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  return NextResponse.redirect(new URL('/login', req.url), { status: 302 });
}
```

## ディレクトリ構造

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── auth/
│   │   ├── callback/route.ts        # OAuth callback
│   │   ├── signout/route.ts
│   │   ├── confirm/route.ts          # メアド確認
│   │   └── auth-error/page.tsx
│   └── (app)/                        # 認証必須エリア
│       └── dashboard/page.tsx
├── components/
│   ├── auth/
│   │   ├── SignInButton.tsx          # 各プロバイダごと
│   │   ├── OAuthButtons.tsx          # 集約コンポーネント
│   │   └── ...
│   └── ...
├── lib/
│   └── supabase/
│       ├── client.ts                 # Browser client
│       ├── server.ts                 # Server client
│       └── admin.ts                  # Admin client (使用最小限)
├── hooks/
│   └── useUser.ts
├── middleware.ts                     # 必須
└── types/
    └── database.types.ts             # Supabase が自動生成
```

## 型生成

```bash
npx supabase gen types typescript --project-id <project-ref> --schema public > src/types/database.types.ts
```

## 起動時のチェックリスト

- [ ] `@supabase/ssr` 最新版インストール
- [ ] `@supabase/auth-helpers-nextjs` を使っていない
- [ ] 環境変数3つ設定（URL、PUBLISHABLE_KEY、SECRET_KEY）
- [ ] middleware.ts で getUser() 呼び出し
- [ ] profiles テーブル + RLS + トリガー作成
- [ ] OAuth callback route 実装
- [ ] サインアウト route 実装

## トラブルシューティング

### 「突然ログアウトされる」
→ middleware が動いていない / getUser() を呼んでいない

### 「Server Component で cookie set エラー」
→ 想定動作。try-catch で握りつぶす（middlewareが更新する）

### 「getSession() と getUser() の違い」
→ getSession は cookie 読むだけ（検証なし、軽量だが偽装可能）。getUser は Supabase Auth サーバーに問い合わせて検証する（信頼できる）。**Server側では必ず getUser()**。

### 「OAuth redirect 後にユーザー作成されない」
→ callback route で exchangeCodeForSession を呼んでいない / トリガーが動いていない

## アンチパターン

1. `@supabase/auth-helpers-nextjs` を使う（deprecated）
2. middleware なし運用
3. Server Component で getSession() を使う（getUser を使う）
4. service_role key をクライアントで使う
5. profiles テーブルなしで auth.users だけ使う（拡張性なし）
6. OAuth callback で next パラメータを検証しない（オープンリダイレクト）
7. SUPABASE_SECRET_KEY を NEXT_PUBLIC_ prefix で公開
