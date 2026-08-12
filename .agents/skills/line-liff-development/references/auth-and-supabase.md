# LIFF ログイン × Supabase Auth ブリッジ

LIFF アプリで Supabase の DB / RLS を安全に使うための、LINE 認証 → Supabase セッションのブリッジ設計。

## 前提：LIFF ログインと Supabase OAuth の LINE ログインは別物

| | Supabase Auth の LINE ログイン | LIFF ログイン |
|--|------------------------------|--------------|
| どこ | 通常ブラウザの Web サイト | LINE アプリ内（LIFF） |
| 方式 | OAuth リダイレクト（`signInWithOAuth`） | `liff.login()` / 起動時に実質ログイン済み |
| 担当 skill | `auth-integration` | 本 skill |

- LIFF アプリでは、ユーザーは LINE にログイン済みの状態でアプリが起動する。`liff.getIDToken()` で **LINE の ID トークン（OpenID Connect の JWT）**が得られる。
- このトークンを Supabase の認証につなぐ「ブリッジ」を自作する必要がある。

## なぜブリッジが必要か

- Supabase の `supabase.auth.signInWithIdToken()` が直接サポートするプロバイダに **LINE は含まれない**。LINE の ID トークンをそのまま渡してログインはできない。
- したがって **サーバ側（Next.js Route Handler / Supabase Edge Function）で LINE トークンを検証し、Supabase 側のユーザーと結びつけてセッションを発行**する。

## 全体フロー

```
[LIFF アプリ（クライアント）]
   liff.getIDToken()  ──── ID トークン（JWT）────▶ [自社サーバ／Edge Function]
                                                      │
                                                      │ 1. LINE で ID トークンを検証
                                                      │    POST https://api.line.me/oauth2/v2.1/verify
                                                      │    （id_token + client_id=LINEログインチャネルID）
                                                      │ 2. 検証 OK → sub（LINE userId）, name, picture, email を取得
                                                      │ 3. LINE userId ⇄ Supabase ユーザーを upsert（マッピング）
                                                      │ 4. Supabase セッションを発行
                                                      ▼
[LIFF アプリ]  ◀──── Supabase セッション ──── 以後 RLS 付きで DB アクセス
```

## ステップ 1-2：サーバで LINE ID トークンを検証

**フロントから来た ID トークンを信用せず、必ず LINE プラットフォームで検証する。**

```ts
// app/api/auth/line/route.ts （Next.js Route Handler。サーバ専用）
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { idToken } = await req.json();

  // LINE の verify エンドポイントで ID トークンを検証
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: process.env.LINE_LOGIN_CHANNEL_ID!, // LIFF が属する LINE ログインチャネル ID
    }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: "invalid id token" }, { status: 401 });
  }
  const payload = await res.json();
  // payload.sub = LINE userId, payload.name, payload.picture, payload.email（email スコープ取得時）

  // … ステップ 3-4 へ
}
```

- `client_id` は **LIFF アプリが属するチャネルの ID**。取り違えると検証が落ちる。
- アクセストークンを送る方式なら `GET https://api.line.me/oauth2/v2.1/verify?access_token=...` で有効性を確認できる。ID トークンの方がプロフィールまで一度に取れて扱いやすい。
- 検証は**必ずサーバで**。クライアントでデコードした `getDecodedIDToken()` の結果を信用しない。

## ステップ 3-4：Supabase ユーザーにマッピングしてセッション発行

LINE の `userId` を安定キーに、Supabase のユーザーを作る／引き当てる。実装方式は 2 つ。

### 方式 A：Supabase Auth のユーザーとして扱う（推奨・既存スタックと一貫）

`auth-integration` skill の `profiles` テーブル設計とそろう。サーバで Supabase Admin（`service_role` / `secret` キー）を使い、ユーザーを upsert してセッションを発行する。

```ts
// 続き：サーバ側。service_role キーは絶対にサーバのみ
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!, // サーバ専用
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const lineUserId = payload.sub;
const email = payload.email ?? `${lineUserId}@line.example.invalid`; // email スコープ未取得時のダミー

// LINE userId をキーにユーザーを引き当て or 作成（profiles.line_user_id にユニーク制約）
// 既存ユーザーがいなければ admin.auth.admin.createUser(...) で作成し、
// profiles に line_user_id / display_name / picture_url を保存。

// セッション発行：マジックリンクを生成し、サーバ側でトークンを取り出してクライアントへ返す
const { data, error } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
});
// data から得たトークンをクライアントへ返し、クライアントで supabase.auth.verifyOtp / setSession する
```

- セッション発行は Supabase のバージョンで最適 API が変わる（`generateLink` + `verifyOtp`、または管理 API でのセッション生成）。**実装時に Supabase の最新ドキュメントを確認**する。
- `profiles` テーブルに `line_user_id`（ユニーク）を持たせ、これを LINE ⇄ Supabase の対応キーにする。
- **アカウント統合**：同一人物が「通常 Web の LINE OAuth」「LIFF」「他プロバイダ」で来うる。`auth-integration` skill の `account-linking.md` の統合戦略（メアド一致 / 厳密分離 / 手動マージ）と整合させる。LINE の email は取得できないこともあるため、`line_user_id` を主たる同一性キーにするのが堅い。

### 方式 B：カスタム JWT（Supabase Auth を使わず RLS だけ使う）

サーバで LINE トークンを検証後、**Supabase の JWT シークレットで署名した JWT を自前で発行**し、クライアントの Supabase クライアントにセットする。RLS は `auth.jwt()` / `auth.uid()` で効く。

- Supabase Auth のユーザー管理（メール送信・パスワード等）を一切使わない、LINE 完結のミニアプリ向け。
- メリット：シンプル、LINE userId をそのまま `sub` にできる。
- デメリット：Supabase Auth の機能（他プロバイダ統合、管理画面でのユーザー一覧）と分断される。JWT シークレットの管理が増える。Supabase が非対称鍵（JWT signing keys）へ移行している点も踏まえ、署名鍵の方式を最新ドキュメントで確認する。

> **野口さん向けの既定**：他チャネル（通常 Web SaaS）と同じ Supabase スキーマ・`profiles` を共有するなら **方式 A**。LINE ミニアプリ単体で完結し、ユーザー管理も最小にしたいなら方式 B も可。ADR に選択を記録する。

## RLS の前提

- どちらの方式でも、Supabase のテーブルは **RLS 有効**にし、`auth.uid()` ベースのポリシーで本人のデータのみ操作可能にする。
- サーバの `service_role` / `secret` キーは RLS をバイパスする。**特権操作はサーバの Route Handler / Edge Function に閉じ込め**、クライアントには publishable キーのみ。

## セッションの保持

- 発行した Supabase セッションは、LIFF アプリ（ブラウザ）の標準ストレージに保存される（`@supabase/supabase-js` の既定）。
- LINE アプリ内ブラウザはストレージが永続しない場合がある。**起動のたびに `liff.getIDToken()` → サーバ検証 → セッション再確立**できる設計にしておくと堅い（毎回ブリッジを通る前提）。

## セキュリティ要点（`testing-and-security.md` も参照）

- [ ] ID トークン／アクセストークンの検証を**サーバで**行っている
- [ ] フロントの `getProfile()` / `getDecodedIDToken()` の結果をサーバの認可判断に使っていない
- [ ] `verify` の `client_id` が LIFF アプリの属するチャネル ID と一致
- [ ] `service_role` / `secret` キー・JWT シークレットがサーバのみ
- [ ] 全テーブルで RLS 有効、`line_user_id` にユニーク制約
- [ ] アカウント統合戦略が `auth-integration` の方針と整合
- [ ] トークン送受信が HTTPS

## auth-integration-specialist との連携

- `profiles` テーブル設計・アカウント統合戦略・RLS は `auth-integration` skill が母体。本ブリッジはその上に LINE 固有の入口を足すもの。
- 設計は line-platform-specialist と auth-integration-specialist が共同で行い、`docs/20-external-design/auth-design.md` に LIFF ログイン経路を追記する。
