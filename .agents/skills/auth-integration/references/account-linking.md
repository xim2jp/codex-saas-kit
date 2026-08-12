# Account Linking Strategy

複数の認証プロバイダで登録した同一人物のアカウントをどう扱うかの設計指針。SaaSでよくトラブルになる領域。

## 中核の問題

シナリオ：
1. 山田さんが `yamada@gmail.com` で **Google** ログインして登録
2. 後日、同じメアド（Google経由で同じ）で **Apple** からログインしようとする
3. または、別メアド（私用と仕事用）の Facebook で登録される

これをどう扱うか。

## 3つの戦略

### 戦略A: メアド一致で同一アカウント（標準・推奨）

メアドが一致すれば同一人物と見なす。Supabase Auth のデフォルト動作に近い。

**Pros**:
- シンプル
- ユーザーの認知と一致しやすい
- 実装容易

**Cons**:
- 異なるメアドでの登録は別アカウント扱い（手動マージ必要）
- メアド spoofing リスク（プロバイダが検証していれば問題なし）

**実装**:
Supabase の標準動作。新しいプロバイダで初回ログイン時、既存メアドと一致すれば既存ユーザーに紐づく。

### 戦略B: 別アカウント扱い（厳密）

プロバイダごとに別アカウント。後から手動マージ機能を提供。

**Pros**:
- 厳密。プロバイダ偽装リスク回避
- 監査要件のある業界向け

**Cons**:
- ユーザー体験が悪い
- マージ機能の実装が重い

**採用すべき業界**:
- 金融（高セキュリティ要件）
- 医療（個人特定の厳密性）

### 戦略C: メアド一致 + 後からマージ可能

戦略Aをベースに、別アカウントになってしまった場合の手動マージを提供。

**Pros**:
- 柔軟
- ユーザー親和性高い

**Cons**:
- 実装複雑（特にデータマージ）
- マージ取り消しは不可

**実装**:
- 通常時は戦略A
- ユーザー設定画面で「他アカウントと統合」ボタン
- マージ実行時はメール認証等で本人確認

## 野口さんSaaS向け推奨

**戦略A（メアド一致で同一）** をデフォルト。理由：

- SaaS量産戦略では実装シンプルさが重要
- B2B SaaS では1ユーザー1メアドが基本
- 必要なら個別案件で戦略B/Cに変更

## 同一メアド・別プロバイダの挙動（Supabase 標準）

### ケース1: Google でメアド検証済み → Apple で同メアド

```
1. Google で yamada@gmail.com 登録（auth.users 作成、provider: google）
2. Apple で同メアドでログイン試行
   - メアド検証済み同士 → 同一 user.id に紐づく
   - identities テーブルに google と apple の両方が記録される
3. 以降、Google でも Apple でもログイン可能
```

### ケース2: メアド検証なしのプロバイダ

メアド検証が緩いプロバイダがあると、なりすましリスク。Supabase の Dashboard で：

- Authentication > Settings > 「Allow new users to sign up」
- 「Enable email confirmations」を有効化

検証なしの場合の挙動は要設定確認。

## Profile テーブルでの管理

```sql
-- auth.users は Supabase 管理
-- identities テーブル（Supabase 管理）でプロバイダ別の認証情報

-- profiles テーブル（自社管理、auth.users と 1:1）
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  
  -- どのプロバイダで「最初に」登録されたか
  primary_provider TEXT,
  
  -- 連携済みプロバイダ一覧
  linked_providers TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- ...
);
```

連携済みプロバイダの追跡：

```typescript
// 新しいプロバイダで sign in した後の処理（callback で実行）
async function trackLinkedProvider(userId: string, provider: string) {
  const supabase = createAdminClient();  // SECURITY DEFINER 推奨
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('linked_providers')
    .eq('id', userId)
    .single();
  
  if (profile && !profile.linked_providers.includes(provider)) {
    await supabase
      .from('profiles')
      .update({
        linked_providers: [...profile.linked_providers, provider],
      })
      .eq('id', userId);
  }
}
```

## アカウント連携画面の実装

ログイン済みユーザーが追加のプロバイダを紐づける画面。

```typescript
// src/app/(app)/settings/accounts/page.tsx
'use client';

import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { useEffect, useState } from 'react';

export default function AccountSettingsPage() {
  const { user } = useUser();
  const [identities, setIdentities] = useState<any[]>([]);
  const supabase = createClient();
  
  useEffect(() => {
    if (user) {
      setIdentities(user.identities || []);
    }
  }, [user]);
  
  async function handleLink(provider: string) {
    const { error } = await supabase.auth.linkIdentity({
      provider: provider as any,
    });
    if (error) console.error(error);
  }
  
  async function handleUnlink(identity: any) {
    // ⚠️ 全identitiesを削除させない（ロックアウト防止）
    if (identities.length <= 1) {
      alert('最後の認証方法は解除できません');
      return;
    }
    
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) console.error(error);
  }
  
  return (
    <div>
      <h1>連携済みアカウント</h1>
      
      <ul>
        {identities.map(id => (
          <li key={id.identity_id}>
            {id.provider}
            <button onClick={() => handleUnlink(id)}>解除</button>
          </li>
        ))}
      </ul>
      
      <h2>連携を追加</h2>
      {['google', 'apple', 'github', 'line_oidc']
        .filter(p => !identities.find(id => id.provider === p))
        .map(p => (
          <button key={p} onClick={() => handleLink(p)}>
            {p} を連携
          </button>
        ))}
    </div>
  );
}
```

## メアド変更の取り扱い

OAuth プロバイダ側でメアドが変わった場合：

1. Supabase Auth は新メアドで auth.users.email を更新
2. profiles.email も同期（トリガー or 明示更新）
3. **Stripe Customer.email も同期必須**（payment-integration-specialist と連携）

```typescript
// auth state change で同期
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'USER_UPDATED' && session) {
    // profile 更新
    await supabase.from('profiles')
      .update({ email: session.user.email })
      .eq('id', session.user.id);
    
    // Stripe 同期（サーバー側 API 経由）
    await fetch('/api/account/sync-stripe', { method: 'POST' });
  }
});
```

## 退会・再登録の挙動

**前提**：戦略A（メアド一致）採用時。

### 退会時の選択

| 方式 | 説明 | データ |
|------|------|------|
| **論理削除** | profiles.deleted_at を設定、auth.users は残す | 復活可能 |
| **完全削除** | auth.users から削除（profile はCASCADE） | 復活不可、新規扱い |
| **匿名化** | profile を匿名化、データは残す | 統計用、再登録は新規 |

野口さん推奨：**論理削除 + 6ヶ月後に完全削除**（GDPR/個情法対応で「忘れられる権利」を満たしつつ、誤操作からの復元期間を設ける）

### 再登録時の挙動

- 論理削除中（6ヶ月以内）：「再アクティブ化しますか？」と表示
- 完全削除後：通常の新規登録扱い、Stripe Customer も新規

```typescript
// 退会フロー
async function deleteAccount(userId: string) {
  const supabase = createAdminClient();
  
  // 1. profiles を論理削除
  await supabase.from('profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', userId);
  
  // 2. Stripe Subscription を解約
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();
  
  if (profile?.stripe_customer_id) {
    // payment-integration-specialist の処理を呼ぶ
    await cancelStripeSubscriptions(profile.stripe_customer_id);
  }
  
  // 3. サインアウト
  await supabase.auth.signOut();
  
  // 4. バッチで6ヶ月後に物理削除（cron / scheduled function）
}
```

## アカウントロックアウト対策

ユーザーが最後の認証方法を解除してロックアウトされないように：

1. **identities が1個の時の unlink を禁止**
2. **email/password を持っているかチェック**してから OAuth unlink を許可
3. **緊急時のサポート問い合わせ窓口**を用意

## 監査ログ

セキュリティ要件のある案件向け：

```sql
CREATE TABLE auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,  -- 'login', 'logout', 'link', 'unlink', 'delete'
  provider TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## チェックリスト

- [ ] 戦略を決定（A/B/C）
- [ ] profiles テーブルに `primary_provider` と `linked_providers`
- [ ] callback route で profile 作成・更新
- [ ] アカウント連携画面の実装
- [ ] 最後の identities 解除の防止
- [ ] メアド変更時の Stripe 同期
- [ ] 退会フロー（論理削除 + バッチ完全削除）
- [ ] 監査ログ（必要なら）

## アンチパターン

1. **戦略を決めずに実装開始**：後で大変
2. **最後の identity の unlink を許可**：ロックアウト発生
3. **メアド変更時の Stripe 同期忘れ**：請求書が古いメアドに送信
4. **退会即物理削除**：誤操作からの復旧不能
5. **profile を作らずに auth.users だけ運用**：拡張困難
6. **identities テーブルを直接いじる**：Supabase 管理領域
