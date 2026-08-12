# Auth Security Checklist

認証は最も狙われる領域。設計・実装・レビュー時の必須チェック。

## API キーの管理

- [ ] `SUPABASE_SECRET_KEY`（旧 service_role）を**絶対にクライアントで使わない**
- [ ] `SUPABASE_SECRET_KEY` を `NEXT_PUBLIC_` prefix にしない
- [ ] `.env.local` を `.gitignore` に記載
- [ ] CI/CD では Vercel / GitHub Secrets で管理
- [ ] テスト用と本番用で異なる Supabase プロジェクトを使用
- [ ] 起動時に prefix を検証

```typescript
// 環境チェック
function validateEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const sec = process.env.SUPABASE_SECRET_KEY;
  
  if (!url?.startsWith('https://')) throw new Error('Invalid SUPABASE_URL');
  if (!pub?.startsWith('sb_publishable_') && !pub?.startsWith('eyJ')) {
    throw new Error('Invalid publishable key');
  }
  if (sec && (sec.startsWith('NEXT_PUBLIC_') || sec === pub)) {
    throw new Error('SECRET_KEY misconfigured');
  }
}
```

## OAuth セキュリティ

### Redirect URI 検証

- [ ] Supabase Dashboard の「Redirect URLs」に必要なURLのみ登録
- [ ] **ワイルドカードを使わない**（オープンリダイレクト）
- [ ] 本番・ステージング・開発で異なる URL
- [ ] localhost を本番Dashboardから削除

### State パラメータ

Supabase が自動で state パラメータを処理（CSRF対策）。手動で OAuth を実装しない限り問題なし。

### Scope 最小化

- [ ] 各プロバイダで取得 scope を最小限に
- [ ] 不要な scope（友達リスト、投稿等）を要求しない
- [ ] スコープ追加時はその理由を明文化（プライバシーポリシー）

### Email 検証

- [ ] Supabase Dashboard で「Enable email confirmations」有効化
- [ ] OAuth プロバイダの `email_verified` を信頼する設計
- [ ] 検証なしメアドでの登録を制限

## Session セキュリティ

### Cookie 設定

`@supabase/ssr` がデフォルトで安全な設定：

- [ ] HttpOnly: ✅（JavaScriptから読めない）
- [ ] Secure: ✅（HTTPS のみ）
- [ ] SameSite: Lax（CSRF 緩和）
- [ ] localStorage を使わない（XSS脆弱性）

### Token Rotation

- [ ] Refresh Token Rotation を有効化（Supabase Dashboard）
- [ ] Reuse Interval を 10-30秒に設定（並行リクエスト用）

### Server-Side 検証

- [ ] Server Component で `getUser()` 使用（`getSession()` ではない）
- [ ] Route Handler で `getUser()` 使用
- [ ] Server Action で `getUser()` 使用
- [ ] 認可チェックを必ず実装

```typescript
// ❌ 不十分
async function deleteInvoice(id: string) {
  const supabase = await createClient();
  await supabase.from('invoices').delete().eq('id', id);  // 他人のも消せる
}

// ✅ 認可チェック
async function deleteInvoice(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  // RLS で守られるが、明示的にも確認
  await supabase.from('invoices').delete()
    .eq('id', id)
    .eq('user_id', user.id);  // 念のため
}
```

## RLS（Row Level Security）

- [ ] **全ての** public スキーマのテーブルで RLS 有効化
- [ ] テーブル作成時にデフォルトで RLS 有効化のルール
- [ ] SELECT / INSERT / UPDATE / DELETE すべてにポリシー
- [ ] `auth.uid()` を使ったポリシー
- [ ] テストで RLS が機能することを確認

```sql
-- 必ず RLS を有効化
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 自分のデータのみ読める
CREATE POLICY "Users view own invoices" ON public.invoices
  FOR SELECT USING (auth.uid() = user_id);

-- 自分のデータのみ作成
CREATE POLICY "Users create own invoices" ON public.invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 自分のデータのみ更新
CREATE POLICY "Users update own invoices" ON public.invoices
  FOR UPDATE USING (auth.uid() = user_id);

-- 自分のデータのみ削除
CREATE POLICY "Users delete own invoices" ON public.invoices
  FOR DELETE USING (auth.uid() = user_id);
```

## パスワード関連（OAuth以外のフォールバック）

OAuth だけでなく email/password も提供する場合：

- [ ] パスワード最小12文字（Supabase Dashboard）
- [ ] パスワード強度チェック有効化
- [ ] HIBP（Have I Been Pwned）連携有効化
- [ ] パスワードリセット link の有効期限（デフォルト1時間）

## ブルートフォース・レート制限

- [ ] Supabase Auth の rate limit を活用（デフォルトで一部有効）
- [ ] Cloudflare / Vercel Edge での Layer 7 防御
- [ ] CAPTCHA（hCaptcha 等）を必要に応じて

## OAuth プロバイダ別の脆弱性

### Google
- [ ] hd パラメータで組織ドメイン制限（必要なら）
- [ ] アクセストークン暗号化保存

### Apple
- [ ] 初回サインインで name 取得・保存（後から取れない）
- [ ] private email でも対応できる UI

### Facebook
- [ ] App Review 承認済みの scope のみ使用
- [ ] アクセストークンの有効期限管理

### X (Twitter)
- [ ] OAuth 2.0 を使用（OAuth 1.0a 廃止傾向）
- [ ] tier に応じたレート制限対策

### GitHub
- [ ] read:user / user:email 以上は不要なら要求しない

### LINE
- [ ] state パラメータ検証
- [ ] LIFF と LINE Login の使い分け

## アカウント連携・解除

- [ ] 最後の identities の解除を防止
- [ ] 連携・解除時の本人確認（パスワード or メール認証）
- [ ] 監査ログ記録

## サインアウト

- [ ] サインアウトは POST メソッド（GET だと CSRF）
- [ ] サインアウト時に全 Cookie クリア
- [ ] 「全デバイスからログアウト」オプション
- [ ] サインアウト後の遷移先を明示

## メアド変更

- [ ] 旧メアドへの通知
- [ ] 新メアドの検証
- [ ] Stripe Customer.email の同期（payment-integration-specialist と連携）

## 退会・データ削除

- [ ] 本人確認（パスワード入力 or メール確認）
- [ ] 論理削除 → 6ヶ月後 → 物理削除
- [ ] Stripe Subscription の解約
- [ ] Stripe Customer の削除
- [ ] 削除予定の通知メール
- [ ] 復元期間の明示

## ログ・監査

- [ ] 重要イベントのログ：
  - サインアップ
  - サインイン（成功・失敗）
  - パスワードリセット
  - メアド変更
  - アカウント連携・解除
  - 退会
- [ ] ログにパスワード・トークンを残さない
- [ ] 不正アクセス検知（短時間に多数の失敗）
- [ ] IPアドレス・User-Agent 記録

## エラーハンドリング

- [ ] エラーメッセージで内部詳細を露出しない

```typescript
// ❌ 詳細を露出
catch (err) {
  return Response.json({ error: err.message, stack: err.stack });
}

// ✅ 一般化
catch (err) {
  logger.error('Auth error', { error: err, userId });
  return Response.json({ error: 'ログインに失敗しました' });
}
```

- [ ] 「ユーザーが存在しません」と「パスワードが違います」を区別しない（ユーザー列挙攻撃防止）
  - Supabase Auth はデフォルトでこれを実装
- [ ] レート制限超過のメッセージを工夫

## CSP（Content Security Policy）

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://accounts.google.com https://appleid.cdn-apple.com;
  frame-src 'self' https://accounts.google.com https://appleid.apple.com;
  connect-src 'self' https://*.supabase.co;
```

OAuth プロバイダのドメインを許可。

## デプロイ前最終チェック

- [ ] 本番 Supabase URL を確認
- [ ] 本番 PUBLISHABLE_KEY と SECRET_KEY 設定
- [ ] OAuth プロバイダ側の本番設定（リダイレクトURL等）
- [ ] Redirect URLs に本番URLが登録
- [ ] localhost を本番 Dashboard から削除
- [ ] RLS テストが緑
- [ ] サインアウト動作確認
- [ ] 退会フロー動作確認
- [ ] エラー画面の表示確認

## インシデント対応

### 不正アクセス疑いの時

1. ユーザーの全セッションを無効化
   ```typescript
   await supabase.auth.admin.signOut(userId, 'global');
   ```
2. 影響範囲を調査（ログ確認）
3. ユーザーに通知
4. パスワード強制リセット（OAuth ユーザーは連携プロバイダ側で対応）

### Supabase Secret Key 漏洩時

1. Supabase Dashboard で即時ローテーション
2. 新キーを環境変数に設定し再デプロイ
3. ログ確認
4. 必要なら全ユーザーセッション無効化

### OAuth プロバイダの Secret 漏洩時

1. 該当プロバイダのコンソールで再生成
2. Supabase Dashboard に新Secret を設定
3. ログ確認

## アンチパターン

1. **service_role key をクライアント露出**：致命的、全RLSバイパス
2. **getSession() をサーバーで信用**：偽装可能
3. **RLS なしでテーブル運用**：全データ漏えい
4. **エラーメッセージで内部情報露出**：攻撃者への情報提供
5. **「ユーザーが存在しません」表示**：ユーザー列挙攻撃
6. **OAuth scope 過剰要求**：プライバシー懸念、レビュー却下
7. **localStorage で token 管理**：XSS脆弱性
8. **CSRF対策なしの POST**：state パラメータ等が必須
9. **退会で物理削除**：誤操作からの復旧不能
10. **監査ログなし**：インシデント時に追跡不能
