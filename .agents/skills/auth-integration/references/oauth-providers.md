# OAuth Providers 設定ガイド

野口さんが対応する6プロバイダ（Google / Apple / Facebook / X / GitHub / LINE）それぞれの設定手順と注意点。

## プロバイダ選定マトリクス

各プロバイダの **フィット業界・実装難易度・KYC要件** をまとめたもの。案件ごとに **2-3個に絞る** ことを推奨。

| プロバイダ | フィット業界 | 設定難易度 | 主な注意点 |
|----------|------------|----------|----------|
| **Google** | あらゆるB2B/B2C | 低 | scope最小化、組織アカウント対応 |
| **Apple** | iOSアプリ・B2C | 中 | iOS必須要件、private email対応 |
| **Facebook** | B2C消費者向け | 中 | レビュー審査、最近下火 |
| **X (Twitter)** | クリエイター・SNS | 中 | API v2、Basicプラン($100/月)必要 |
| **GitHub** | 開発者向けSaaS | 低 | デベロッパー以外には不適 |
| **LINE** | 日本国内B2C | 中〜高 | LIFF統合、日本特化で強力 |

## 案件タイプ別の推奨組み合わせ

### B2B SaaS（中小企業向け）
```
推奨: Google + Microsoft（必要なら）
不要: Facebook、X
任意: Apple、LINE（個人事業主向けなら）
```

### B2C SaaS（消費者向け）
```
推奨: Google + Apple + LINE
任意: Facebook（ターゲットが該当する場合）
不要: GitHub
```

### 開発者向けSaaS
```
推奨: GitHub + Google
任意: その他
```

### 日本特化型 SaaS
```
推奨: Google + LINE
任意: Apple
```

## 共通の Supabase 側設定

すべてのプロバイダで、Supabase Dashboard の **Authentication > Providers** で：

1. プロバイダを有効化
2. Client ID / Client Secret を入力
3. Redirect URL を確認・コピー：
   - 形式：`https://<your-project>.supabase.co/auth/v1/callback`
   - これをプロバイダ側のコンソールに登録

## プロバイダ別設定

### 1. Google

**コンソール**: https://console.cloud.google.com/

**手順**:
1. プロジェクト作成（or 既存選択）
2. APIs & Services > Credentials
3. OAuth consent screen 設定
   - User Type: External
   - アプリ名・サポートメール・ロゴ等
   - Scopes: `openid`、`email`、`profile` のみ（最小化）
   - テストユーザー追加（公開前）
4. Credentials > Create > OAuth client ID
   - Application type: Web application
   - Authorized redirect URIs: Supabase の Redirect URL を貼り付け
5. Client ID と Client Secret を Supabase Dashboard に登録

**取得できる情報**:
- email（検証済み）
- name（フルネーム）
- given_name / family_name
- picture（アバター）
- locale
- sub（Google ID、永続）

**注意点**:
- 本番リリース前に「Production」ステータスに変更が必要（テストユーザー以外も利用可に）
- スコープを増やすと審査が必要になる
- Workspace 組織アカウントでも使える（hd パラメータで制限可）
- **PII最小化**：profile.picture は不要なら scope から外す

**Next.js 実装**:
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: {
      access_type: 'offline',  // refresh token を要求
      prompt: 'consent',       // 毎回同意画面（必要なら）
    },
    scopes: 'openid email profile',
  },
});
```

### 2. Apple

**コンソール**: https://developer.apple.com/account

**前提**: Apple Developer Program 加入（年額 $99）

**手順**:
1. Certificates, Identifiers & Profiles
2. Identifiers > Services IDs > 作成
   - Identifier: `com.example.myapp.signin`（reverse DNS）
   - Sign in with Apple を有効化
   - Configure: Domain と Return URLs に Supabase redirect 登録
3. Keys > 新規キー作成
   - Sign in with Apple を有効化
   - .p8 ファイルをダウンロード（**1回しかDLできない**）
4. Supabase 側で：
   - Service ID
   - Apple Team ID
   - Key ID
   - Private Key (.p8 の中身) を登録

**取得できる情報**:
- email（検証済み、ただし「メール非公開」を選ぶとプロキシメアド）
- name（**初回のみ**取得可能、後から取れない）
- sub（Apple ID、永続）

**注意点**:
- **iOS アプリで他社ログイン提供する場合、Apple Sign in が App Store で必須**
- 「メール非公開」を選ぶと `relay@privaterelay.appleid.com` 形式のプロキシメアド
- 名前は**初回サインイン時のみ取得可能**。取りこぼすと永久に取れない（DB に保存必須）
- iOS で動作確認は ASWebAuthenticationSession 等が必要

**Next.js 実装**:
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'apple',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    scopes: 'name email',
  },
});
```

### 3. Facebook

**コンソール**: https://developers.facebook.com/

**手順**:
1. アプリ作成（Business タイプ）
2. プロダクトに「Facebook Login」追加
3. Settings > Basic
   - App Domains
   - Privacy Policy URL（必須）
   - Terms of Service URL
4. Facebook Login > Settings
   - Valid OAuth Redirect URIs に Supabase URL
5. Settings > Basic から App ID と App Secret を Supabase に登録

**取得できる情報**:
- email
- name
- picture
- id（Facebook ID）

**注意点**:
- **App Review** プロセスがある（`email` scope は基本承認、それ以上は審査）
- 利用が下火傾向。新規SaaSでは推奨度低
- ターゲットが Facebook 主要利用者の場合のみ採用

**Next.js 実装**:
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'facebook',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    scopes: 'email,public_profile',
  },
});
```

### 4. X (Twitter)

**コンソール**: https://developer.x.com/

**重要**：X API は **Free tier では OAuth 利用不可**。**Basic プラン（$100/月）以上が必要**。これは大きな採用障壁。

**手順**:
1. Developer Portal > Project 作成
2. App 作成
3. User authentication settings
   - OAuth 2.0 を有効化
   - Type: Web App
   - Callback URI: Supabase URL
4. Keys and tokens > OAuth 2.0 Client ID と Client Secret を取得

**取得できる情報**:
- username
- name
- profile_image_url
- email（要追加リクエスト・承認）

**注意点**:
- **API料金が高い**（Basic $100/月、メール取得は要承認）
- API v1.1 → v2 へのマイグレーション必要
- SaaS で X 認証を採用する場合は ROI を慎重に計算

**Next.js 実装**:
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'twitter',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

### 5. GitHub

**コンソール**: https://github.com/settings/developers

**手順**:
1. Settings > Developer settings > OAuth Apps > New OAuth App
2. Application details
   - Application name
   - Homepage URL
   - Authorization callback URL: Supabase URL
3. Client ID と Client Secret を取得
4. Supabase に登録

**取得できる情報**:
- email（プライマリ、検証済み）
- name
- avatar_url
- login (GitHub username)

**注意点**:
- 設定が最もシンプル
- ただし**デベロッパー以外には不適**
- 開発者向けSaaSでは最強

**Next.js 実装**:
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    scopes: 'user:email read:user',
  },
});
```

### 6. LINE Login

**コンソール**: https://developers.line.biz/

**手順**:
1. プロバイダー作成 → チャネル作成（LINE Login）
2. チャネル設定
   - チャネル名・説明
   - リージョン: Japan
   - Email address permission: 申請して取得
3. LINE Login設定タブ
   - Callback URL: Supabase URL
4. Channel ID と Channel Secret を取得
5. Supabase に登録

**取得できる情報**:
- email（**事前申請承認が必要**）
- name
- picture
- userId（LINE 内部ID、永続）

**注意点**:
- **メール取得は事前申請が必要**（数日かかる）
- LIFFアプリと別物：LIFF は LINE 内ブラウザでの統合
- 日本のB2C SaaSでは最強の選択肢
- スマホ利用前提のターゲットなら必須レベル

**LIFF との関係**:
- LINE Login: 任意のブラウザから LINE で認証してログイン
- LIFF: LINE 内ブラウザで動くWebアプリ
- 両方とも併用可能（要件次第）

**Next.js 実装**:
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'line_oidc',  // Supabase での provider 名（要確認）
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

**確認事項**：Supabase の LINE 対応状況は時期によって変動。`oidc` 形式での generic OIDC として設定が必要な場合あり。実装時に Supabase ドキュメントを最新確認。

## OAuthボタン UI の実装

```typescript
// src/components/auth/OAuthButtons.tsx
'use client';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

type Provider = 'google' | 'apple' | 'facebook' | 'twitter' | 'github' | 'line_oidc';

const providers: { id: Provider; label: string; icon: string }[] = [
  { id: 'google',   label: 'Googleで続行',   icon: '/icons/google.svg' },
  { id: 'apple',    label: 'Appleで続行',    icon: '/icons/apple.svg' },
  { id: 'line_oidc', label: 'LINEで続行',    icon: '/icons/line.svg' },
  { id: 'github',   label: 'GitHubで続行',   icon: '/icons/github.svg' },
  { id: 'facebook', label: 'Facebookで続行', icon: '/icons/facebook.svg' },
  { id: 'twitter',  label: 'Xで続行',        icon: '/icons/x.svg' },
];

export function OAuthButtons({ enabledProviders }: { enabledProviders: Provider[] }) {
  const [loading, setLoading] = useState<Provider | null>(null);
  const supabase = createClient();
  
  async function handleOAuth(provider: Provider) {
    setLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as any,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    
    if (error) {
      console.error('OAuth error:', error);
      setLoading(null);
    }
    // 成功時はリダイレクトされるので setLoading 不要
  }
  
  return (
    <div className="space-y-3">
      {providers
        .filter(p => enabledProviders.includes(p.id))
        .map(p => (
          <Button
            key={p.id}
            variant="outline"
            className="w-full"
            onClick={() => handleOAuth(p.id)}
            disabled={loading !== null}
          >
            <img src={p.icon} alt="" className="mr-2 h-5 w-5" />
            {loading === p.id ? '接続中...' : p.label}
          </Button>
        ))}
    </div>
  );
}
```

## プロバイダ選択の指針（UI/UX）

### 個数：2-3個が最適

Hick's Law（選択肢が多いほど決定が遅くなる）に従い：

- **3個まで**：選択疲れなく、CV最大化
- **4-5個**：ターゲットが幅広い場合のみ
- **6個以上**：選択疲れでCV低下、推奨しない

### 並び順

1. **最もよく使われるであろうものを最上位**：ターゲット顧客の使用率を考慮
2. **B2B案件 → Google を最初に**
3. **B2C日本 → LINE を最初に**
4. **開発者向け → GitHub を最初に**

### ボタンデザイン

各社のブランドガイドラインに従う：

- Google: https://developers.google.com/identity/branding-guidelines
- Apple: https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple
- LINE: https://developers.line.biz/ja/docs/line-login/login-button/
- 他も同様

ロゴの改変・色違いは規約違反になる場合あり。**公式のアイコンSVGを使う**こと。

## redirectTo の動的構築

開発・ステージング・本番でドメインが違うため：

```typescript
const redirectTo = `${window.location.origin}/auth/callback`;
// または環境変数を使う場合
const redirectTo = process.env.NEXT_PUBLIC_SITE_URL 
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
  : `${window.location.origin}/auth/callback`;
```

Supabase 側で「Redirect URLs」にすべての環境のURLを登録：

- `http://localhost:3000/auth/callback`
- `https://staging.example.com/auth/callback`
- `https://www.example.com/auth/callback`

## チェックリスト

プロバイダ追加時：

- [ ] ターゲット顧客への適合性確認
- [ ] プロバイダ側コンソールでアプリ作成
- [ ] Redirect URL を Supabase の値で登録
- [ ] Client ID / Secret を Supabase Dashboard に登録
- [ ] 取得 scope を最小化（PII最小限）
- [ ] 公式アイコンを `public/icons/` に配置
- [ ] OAuthButtons コンポーネントの enabledProviders に追加
- [ ] テストモードでサインイン確認
- [ ] callback route で profile 作成確認
- [ ] 本番モードに切り替え（必要時）

## アンチパターン

1. **全プロバイダを並べる**：選択疲れでCV低下
2. **scope を過剰に要求**：プライバシー懸念、審査リスク
3. **Apple の名前取得を1回目で保存し忘れる**：永久取得不能
4. **X (Twitter) を Free プランで設定**：そもそも動かない
5. **LINE Email を申請せず実装**：メアド取れずアカウント統合不能
6. **公式アイコン以外を使う**：規約違反、ブランドガイドライン抵触
7. **redirect URLs を本番だけ登録**：開発でログイン不能
