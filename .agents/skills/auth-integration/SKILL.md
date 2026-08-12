---
name: auth-integration
description: SaaS の新規登録を最小摩擦化するための、Supabase Auth + 外部認証プロバイダ統合の知識集。Google/Apple/Facebook/X/GitHub/LINE の OAuth 設定、@supabase/ssr でのセッション管理・middleware、アカウント統合、セキュリティチェックリスト、テスト戦略を収録する。認証の要件定義・設計・実装・レビューの全フェーズで auth-integration-specialist / implementation-worker らが参照する。「認証」「OAuth」「ログイン」「サインアップ」「Supabase Auth」「Google認証」「LINEログイン」「アカウント統合」で参照。
---

# Auth Integration Skill

SaaSの新規登録を最小摩擦化するための、Supabase Auth + 外部認証プロバイダの統合知識集。野口さんの「SaaS量産」戦略を支える基盤Skill。

## いつこのSkillを参照するか

以下の場面で必ず読む：

- **要件定義**：認証方式・対応プロバイダの決定時
- **技術スタック選定**：認証基盤の選定根拠記録時
- **外部設計**：ログイン・サインアップ画面、認証フロー設計時
- **内部設計**：認証ハンドラ、middleware、セッション管理の設計時
- **テスト計画**：認証関連テストケースの策定時
- **実装**：Supabase Auth SDK の実装時
- **レビュー**：認証関連成果物のレビュー時

## 重要原則（必読）

### 1. Supabase Auth + @supabase/ssr を主軸に

野口さんのTier A スタック（Next.js + Vercel + Supabase）に最も適合。`@supabase/ssr` パッケージで Server Components / Route Handlers / Middleware すべてに対応可能。

> **基本方針：Supabase Auth + `@supabase/ssr` を標準とする。Auth Helpers（旧 `@supabase/auth-helpers-nextjs`）は廃止予定なので新規で使わない。**

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

OAuth登録 → アプリ側のユーザー作成 → Stripe Customer作成、の流れを設計。`payment-integration-specialist` と連携。

## このSkillの構成

```
auth-integration/
├── SKILL.md                                # 本ファイル
└── references/
    ├── supabase-auth-setup.md              # Supabase Auth + Next.js App Router セットアップ
    ├── oauth-providers.md                  # 6プロバイダ別の設定手順・注意点
    ├── account-linking.md                  # アカウント統合戦略
    ├── session-management.md               # セッション・トークン管理、middleware
    ├── security-checklist.md               # 認証セキュリティチェックリスト
    └── testing-strategy.md                 # 認証テスト戦略
```

## エージェント別の使い方ガイド

### tech-stack-architect

ADR-XXXX として認証基盤選定を記録：
- 認証プロバイダ：Supabase Auth
- 統合方式：`@supabase/ssr` + Next.js Middleware
- OAuth プロバイダ選定根拠（ターゲット顧客から逆算）

### external-designer

以下の画面・フローを設計：
- サインアップ画面（OAuth ボタン群 + email/password）
- ログイン画面（同上）
- OAuth コールバック画面
- メアド検証画面
- パスワードリセット
- アカウント連携画面（既存ユーザーが追加プロバイダを連携）
- 退会画面

### internal-designer

以下を設計：
- `lib/supabase/` のクライアント構造（browser / server / middleware）
- `middleware.ts` のトークンリフレッシュロジック
- OAuth コールバック route handler
- Profile テーブル（auth.users と1:1）の設計
- セッション状態の管理戦略

### test-planner / tester

- 各 OAuth プロバイダのテスト（モック / E2E）
- セッション期限切れテスト
- アカウント統合のテスト
- セキュリティテスト（CSRF、redirect_uri 検証）

### implementation-worker

- `@supabase/ssr` 最新版を使用
- 新API key形式（sb_publishable_xxx / sb_secret_xxx）を使用
- middleware でトークンリフレッシュ
- OAuth callback の正しい実装

### auth-integration-specialist（専用エージェント）

認証関連の設計・実装の品質を横断的に担保。詳細は `agents/auth-integration-specialist.md` 参照。

### payment-integration-specialist との連携

- OAuth登録 → Stripe Customer 作成
- メアド変更時の Stripe 側同期
- アカウント削除時の Stripe Customer 削除
- 適格請求書発行用の氏名取得（OAuthプロバイダから）

## 参照ファイルの読み方

| ファイル | 必読タイミング |
|---------|--------------|
| `supabase-auth-setup.md` | Supabase Auth初回セットアップ時 |
| `oauth-providers.md` | プロバイダ別の設定手順が必要な時（必須読み） |
| `account-linking.md` | 複数プロバイダ対応設計時 |
| `session-management.md` | middleware、SSR、セッション設計時 |
| `security-checklist.md` | レビュー時、デプロイ前 |
| `testing-strategy.md` | テスト計画策定時、実装中 |

## 野口さん固有のチェック

- [ ] 適格請求書発行のため、OAuth から取得した氏名を保持
- [ ] 個人情報保護法対応：取得した情報の利用目的明示
- [ ] LINE Login の検討（B2C向け案件で強力）
- [ ] Stripe Customer 作成のフロー（payment-integration-specialist と連携）
- [ ] 1名運用負荷の最小化（Hosted UIを最大活用 or 自前UI最小限）

## SaaS量産戦略への貢献

### 共通テンプレート化

複数 SaaS を量産するため、認証まわりは**再利用可能なテンプレート**として整備：

- `lib/supabase/` モジュールを別リポジトリ化 or npm package化
- 共通の middleware
- 共通の OAuth callback handler
- 共通の Profile テーブル設計

### コンバージョン最大化

営業サイト → CTA → サインアップ → アクティブ化の流れで、サインアップ時の摩擦を最小化することが最重要。OAuthワンクリック登録が中心戦略。

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
