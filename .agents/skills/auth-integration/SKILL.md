---
name: auth-integration
description: SaaS の新規登録を最小摩擦化するための、Supabase Auth + 外部認証プロバイダ統合の知識集。Google/Apple/Facebook/X/GitHub/LINE の OAuth 設定、@supabase/ssr でのセッション管理・middleware、新 API キー形式、アカウント統合、Stripe Customer 同期、セキュリティチェックリスト、テスト戦略を収録する。認証方式の決定、認証基盤の選定、ログイン・サインアップ画面と認証フローの設計、middleware・セッション設計、認証テスト、実装・レビューで参照する。「認証」「OAuth」「ログイン」「サインアップ」「Supabase Auth」「Google認証」「LINEログイン」「アカウント統合」で参照。
---

# Auth Integration Skill

SaaSの新規登録を最小摩擦化するための、Supabase Auth + 外部認証プロバイダの統合知識集。野口さんの「SaaS量産」戦略を支える基盤Skill。営業サイト → CTA → サインアップ → アクティブ化の流れで、サインアップ時の摩擦を最小化することが最重要であり、OAuth ワンクリック登録が中心戦略になる。

## 参照ファイル

| ファイル | 内容 | いつ読むか |
|---------|------|-----------|
| `references/supabase-auth-setup.md` | Supabase Auth + Next.js App Router セットアップ | Supabase Auth 初回セットアップ時 |
| `references/oauth-providers.md` | 6プロバイダ別の設定手順・注意点 | プロバイダ別の設定手順が必要な時（必読） |
| `references/account-linking.md` | アカウント統合戦略 | 複数プロバイダ対応設計時 |
| `references/session-management.md` | セッション・トークン管理、middleware | middleware、SSR、セッション設計時 |
| `references/security-checklist.md` | 認証セキュリティチェックリスト | レビュー時、デプロイ前 |
| `references/testing-strategy.md` | 認証テスト戦略 | テスト計画策定時、実装中 |

## 原則

### 1. Supabase Auth + @supabase/ssr を主軸に

野口さんのTier A スタック（Next.js + Vercel + Supabase）に最も適合。`@supabase/ssr` パッケージで Server Components / Route Handlers / Middleware すべてに対応可能。認証基盤の ADR には「Supabase Auth」「`@supabase/ssr` + Next.js Middleware」「OAuth プロバイダ選定根拠（ターゲット顧客から逆算）」を記録する。

> **基本方針：Supabase Auth + `@supabase/ssr`（最新版）を標準とする。Auth Helpers（旧 `@supabase/auth-helpers-nextjs`）は廃止予定なので新規で使わない。**

### 2. API キーの新形式に対応

Supabase は 2026年末で旧 `anon` / `service_role` キーが廃止予定。新規プロジェクトでは：

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx`（クライアント用、旧anon相当）
- `SUPABASE_SECRET_KEY=sb_secret_xxx`（サーバー用、旧service_role相当）

を使う。

### 3. 「新規登録の摩擦最小化」がコア戦略

SaaS のCV率向上には、登録フローの摩擦を減らすことが重要：

- **ワンクリック登録**：OAuth で氏名・メアド取得 → 即アカウント作成
- **メアド検証スキップ**：OAuth 経由はプロバイダ側で検証済み
- **追加情報は後で**：会社名・電話番号等は登録後にプログレッシブに収集

### 4. プロバイダ選定は「ターゲット顧客起点」

すべてのプロバイダを並べるのは逆効果（選択肢が多いと選べない、Hick's law）。ターゲット顧客が日常使うものを2-3個に絞る。

### 5. アカウント統合の方針を最初に決める

「Googleで登録した山田さんが、後でFacebookでログインしたら同一人物として扱うか」問題。**メアド一致で同一アカウント** を基本（Supabase の標準動作）。例外運用は要件次第。

### 6. Stripe Customer との同期

OAuth登録 → アプリ側のユーザー作成 → Stripe Customer作成、の流れを設計する（stripe-integration Skill と整合）。同期が要るのは次の4点：

- OAuth 登録時の Stripe Customer 作成
- メアド変更時の Stripe 側同期
- アカウント削除時の Stripe Customer 削除（サブスク解約を含む）
- 適格請求書発行用の氏名取得（OAuth プロバイダから）

## 設計で必ず扱う要素

| 領域 | 対象 |
|------|------|
| 画面・フロー | サインアップ（OAuth ボタン群 + email/password）、ログイン、OAuth コールバック、メアド検証、パスワードリセット、アカウント連携（既存ユーザーが追加プロバイダを連携）、退会 |
| 内部構造 | `lib/supabase/` のクライアント構造（browser / server / middleware）、`middleware.ts` のトークンリフレッシュ、OAuth コールバック route handler、Profile テーブル（`auth.users` と 1:1）、セッション状態の管理戦略 |
| テスト | 各 OAuth プロバイダ（モック / E2E）、セッション期限切れ、アカウント統合、セキュリティ（CSRF、redirect_uri 検証） |

量産のため、`lib/supabase/` モジュール・middleware・OAuth callback handler・Profile テーブル設計は**再利用可能な共通テンプレート**として整備する（別リポジトリ化 or npm package 化）。

## 野口さん固有のチェック

- [ ] 適格請求書発行のため、OAuth から取得した氏名を保持
- [ ] 個人情報保護法対応：取得した情報の利用目的明示
- [ ] LINE Login の検討（B2C向け案件で強力）
- [ ] Stripe Customer 作成のフロー（原則6の4点）
- [ ] 1名運用負荷の最小化（Hosted UIを最大活用 or 自前UI最小限）

## アンチパターン（よくある失敗）

1. **`@supabase/auth-helpers-nextjs` を新規で使う**：deprecated
2. **middleware なしで運用**：トークンリフレッシュされず突然ログアウト
3. **service_role key をクライアントで使う**：RLSバイパスで全データ漏えい
4. **OAuth redirect_uri を検証しない**：オープンリダイレクト脆弱性
5. **メアド非検証で多重アカウント作成**：同一人物が複数アカウント
6. **state パラメータなし**：CSRF攻撃
7. **OAuth プロバイダを全部並べる**：選択疲れでCV低下
8. **アカウント統合方針を後から決める**：データ移行が大変
9. **退会フローで Stripe を放置**：課金継続のクレーム発生
10. **OAuth以外のフォールバックなし**：プロバイダ障害時に全員ログイン不能
