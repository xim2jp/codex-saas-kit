# UC-LOGIN 標準ユースケースカタログ（ログイン・認証）

既存ユーザーの**再アクセス経路**。継続率（リテンション）の前提条件。

## 目次

- UC-LOGIN-01: OAuth ログイン → 既存ユーザーとして dashboard
- UC-LOGIN-02: Email/Password ログイン
- UC-LOGIN-03: パスワード間違い → エラー表示
- UC-LOGIN-04: パスワードリセット → メールリンク → 新パスワード → ログイン
- UC-LOGIN-05: 未認証で保護ページ → /login へリダイレクト → ログイン後に元の URL へ
- UC-LOGIN-06: セッション期限切れ → 自動リフレッシュで継続

---

## UC-LOGIN-01: OAuth ログイン → 既存ユーザーとして dashboard

**業務的意義**：継続利用の主導線。OAuth 経路の主要ユーザーが復帰できないと解約リスク。

**対応 FunctionalID**：`F-AUTH-001` (OAuthログイン)

**対応 swim lane**：認証済みユーザー（過去登録済み） / Supabase Auth

**前提**：
- 既存ユーザー（OAuth で過去に登録済み）が `existing-oauth@example.test` として存在
- 該当 Google アカウントが Supabase Auth の identities に紐付いている

**シナリオ**：

```
Given: 過去に OAuth 登録した既存ユーザー（profiles レコードあり）
       かつ ブラウザにセッション無し（storageState クリア状態）
When:  1. /login を開く
       2. 「Google でログイン」をクリック
       3. Google 認証完了
Then:  - /dashboard に遷移（/onboarding ではないこと、つまり初回ではない）
       - 新規 profiles レコードが**作成されていない**（既存レコードを再利用）
       - 既存の stripe_customer_id が維持されている
       - 最終ログイン時刻（profiles.last_signed_in_at 等）が更新されている
```

**Critical な不具合パターン**：
- `auth.identities` の検索条件ミスで「同じ Google アカウントなのに別ユーザーとして判定される」→ profiles が二重作成、Stripe Customer も二重 → 課金混乱

**優先度**：🔴 Critical

**実装ファイル**：`tests/e2e/usecases/login-oauth-existing.spec.ts`

---

## UC-LOGIN-02: Email/Password ログイン

**業務的意義**：Email 経路ユーザーの継続利用。

**対応 FunctionalID**：`F-AUTH-002`

**前提**：UC-SIGNUP-02 完了済みユーザー `email-user@example.test`

**シナリオ**：

```
Given: 既存ユーザー（メアド確認済み）
When:  /login でメアド・パスワード入力 → 「ログイン」
Then:  - /dashboard 遷移
       - セッション Cookie 発行
       - profiles.last_signed_in_at 更新
       - 401 / 403 のレスポンスが無いこと（network 監視）
```

**想定ロケータ案**：
```ts
page.getByLabel('メールアドレス')
page.getByLabel('パスワード')
page.getByRole('button', { name: 'ログイン' })
```

**優先度**：🔴 Critical

**実装ファイル**：`tests/e2e/usecases/login-password.spec.ts`

---

## UC-LOGIN-03: パスワード間違い → エラー表示

**業務的意義**：誤入力時の正しい UX。エラーが出ないと無限リトライしてレートリミットに掛かる。

**対応 FunctionalID**：`F-AUTH-002`、`F-AUTH-030` (レートリミット)

**シナリオ**：

```
Given: 既存ユーザー email-user@example.test、正しいパスワード "correctpass"
When:  メアド入力 / パスワードに "wrongpass" → ログイン
Then:  - エラー「メアドまたはパスワードが正しくありません」が表示
       - エラーメッセージが「ユーザーが存在しません」など、存在を示唆する表現になっていない
         （列挙攻撃対策）
       - /dashboard には遷移しない
       - 5 回連続で間違えるとレートリミット表示（要件次第）
```

**セキュリティ観点**：
- 「メアドが間違っています」と「パスワードが間違っています」を**区別表示しない**こと
- レスポンス時間が「存在するアカウントの誤パスワード」と「存在しないアカウント」で大きく差が出ないこと

**優先度**：🟡 Major

**実装ファイル**：`tests/e2e/usecases/login-wrong-password.spec.ts`

---

## UC-LOGIN-04: パスワードリセット → メールリンク → 新パスワード → ログイン

**業務的意義**：パスワード忘却時の自己解決経路。これが無いとサポート対応コストが跳ねる。

**対応 FunctionalID**：`F-AUTH-040` (パスワードリセット)、`F-MAIL-002` (リセットメール)

**対応 swim lane**：認証済みユーザー（パス忘れ） / Supabase Auth / メール配信

**前提**：
- 既存ユーザー存在
- Inbucket / Mailosaur がテスト用メール受信に使える

**シナリオ**：

```
Given: 既存ユーザー email-user@example.test、現パスワード "oldpass"
When:  1. /login の「パスワードを忘れた」をクリック → /forgot-password
       2. メアド入力 → 「リセットメールを送信」
       3. expect.poll で最大 30 秒、メールサーバから件名「パスワードリセット」のメールを取得
       4. メール本文の URL `${SITE_URL}/auth/reset?token_hash=...&type=recovery` を別タブで開く
       5. /reset-password で新パスワード "newpass123!" を入力 → 「変更」
       6. 「変更しました」→ 「ログインへ」
       7. /login で新パスワードでログイン
Then:  - /dashboard 遷移
       - 旧パスワード "oldpass" ではログインできない（後続テストで確認）
       - リセットメールが 1 通のみ受信されている
       - リセットリンクの有効期限（1 時間程度）が要件と一致
```

**Flaky 対策**：
- メール到着待ちで `waitForTimeout(5000)` を使うと CI で不安定 → `expect.poll({ timeout: 30000 })` でポーリング
- メール解析は正規表現で URL 抽出、HTML パースは避ける（テンプレ変更耐性）

**優先度**：🔴 Critical

**実装ファイル**：`tests/e2e/usecases/login-password-reset.spec.ts`

---

## UC-LOGIN-05: 未認証で保護ページ → /login へリダイレクト → ログイン後に元の URL へ

**業務的意義**：UX 上の重要要素。「リンク踏んだ → ログイン → トップに飛ばされる → 自分で目的ページを探す」は離脱要因。

**対応 FunctionalID**：`F-AUTH-050` (リダイレクト保存)、`F-MIDDLEWARE-001` (保護ルート)

**シナリオ**：

```
Given: ブラウザにセッション無し
When:  1. 保護ページ `/dashboard/settings/api-keys?tab=secret` を直接開く
       2. Next.js middleware で /login?redirect=%2Fdashboard%2Fsettings%2Fapi-keys%3Ftab%3Dsecret にリダイレクトされる
       3. /login でメアド・パスワード入力 → ログイン
Then:  - クエリパラメータ・ハッシュも含め、元の URL に正確に戻る
       - URL: /dashboard/settings/api-keys?tab=secret
       - 該当タブ（secret）がアクティブになっている
```

**Critical な実装ミス**：
- `redirect` パラメータが URL-encode されていない / されすぎている
- クエリ文字列を捨てて pathname だけ復元している
- redirect 先がオープンリダイレクト脆弱性になっている（外部 URL を受け付ける）→ E2E でも `?redirect=https://evil.com` を試して `/dashboard`（自サイト）に飛ぶことを検証

**優先度**：🟡 Major

**実装ファイル**：`tests/e2e/usecases/login-redirect-preserve.spec.ts`

---

## UC-LOGIN-06: セッション期限切れ → 自動リフレッシュで継続

**業務的意義**：長時間タブを開いたままのユーザーが、操作再開時に「ログアウトされてる」ストレスを受けない。

**対応 FunctionalID**：`F-AUTH-060` (セッション更新)、`F-AUTH-061` (Refresh Token)

**シナリオ**：

```
Given: ログイン済みユーザー
When:  1. /dashboard を開いた状態で、Supabase の access_token を意図的に過去日時に書き換え
         （page.evaluate で localStorage / cookie を操作）
       2. API を叩く操作（例：データ一覧の再取得）を実行
Then:  - 自動的に refresh_token で新しい access_token が発行される
       - 操作がエラーにならない
       - ログアウトされない（/login にリダイレクトされない）
       - network タブで refresh エンドポイントが 1 回呼ばれている
```

**応用版**：
- refresh_token も期限切れの場合は /login にリダイレクトされ、redirect パラメータが付くこと

**優先度**：🟢 Minor（長時間放置の希少シナリオだが、Supabase 標準実装が壊れていないかの担保）

**実装ファイル**：`tests/e2e/usecases/login-session-refresh.spec.ts`

---

## カタログ全体の運用ルール

1. **OAuth E2E はテスト用アカウント or admin 代替**：本番 Google アカウントは reCAPTCHA で詰む。
2. **メール検証は Inbucket / Mailosaur**：本番 SMTP 経由は遅延・到着不安定。
3. **storageState は role 別に分離**：anon / user / admin。`playwright.config.ts` の projects で切り替え。
4. **UC-LOGIN-04 は最も flaky 化しやすい**：メール到着のタイミング、URL のパース、token_hash の有効期限。`expect.poll` を必ず使う。
5. **Critical の Block 条件**：UC-LOGIN-01 / -02 / -04 のいずれかが fail かつ実装バグ起因なら、即 No-Go → Phase 11 差し戻し。
