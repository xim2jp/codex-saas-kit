---
name: line-liff-development
description: LINE LIFF アプリ／LINE ミニアプリを Next.js（Tier A スタック）で開発・テスト・公開するための知識集。LIFF / ミニアプリの方式選定、LIFF SDK と SSR 対策、LINE ログインと Supabase Auth のブリッジ（ID トークンのサーバ検証）、Messaging API（Flex Message・リッチメニュー・Webhook 署名検証）、ミニアプリのサービスメッセージ・パーマネントリンク・公開、テストとセキュリティチェックを収録する。「LINE で完結させたい」要件の採否判断から技術選定・設計・実装・テスト・公開・レビューまで参照する。「LIFF」「LINEミニアプリ」「LINE Mini App」「LINEアプリ」「Messaging API」「LINEログイン」「LINE連携」で起動。
---

# LINE LIFF / Mini App Development Skill

LINE のプラットフォーム上で動く Web アプリ（**LIFF アプリ**および**LINE ミニアプリ**）を高品質に開発・公開するための知識集。野口さんの B2C・地域コミュニティ案件で強力な「LINE をフロントにする」戦略を支える。

**主軸スタック：LIFF SDK（`@line/liff`）+ Next.js（App Router）+ Supabase。** 野口さんの Tier A（Vercel + Supabase + Next.js）にそのまま乗る。LIFF アプリは本質的に「LINE アプリ内ブラウザで動く Next.js Web アプリ」であり、既存の Web 開発資産を再利用できる。

## 参照ファイル

| ファイル | 内容 | いつ読むか |
|---------|------|-----------|
| `references/liff-vs-miniapp.md` | LIFF / ミニアプリの違い、チャネル構成、方式選定 | 要件定義での採否判断・技術選定時 |
| `references/setup-and-nextjs.md` | Create LIFF App、Next.js 統合、SSR 対策、LiffProvider、Vercel 配信 | プロジェクト初期化時、LIFF 組み込み時（必読） |
| `references/liff-features.md` | LIFF SDK API（profile / sendMessages / shareTargetPicker / scanCodeV2 等） | LIFF SDK の機能（プロフィール・シェア・QR 等）を使う時 |
| `references/auth-and-supabase.md` | LIFF ログイン × Supabase Auth ブリッジ、ID トークン検証 | 認証ブリッジの設計・実装時（必読） |
| `references/messaging-api.md` | Messaging API（Webhook / Flex Message / リッチメニュー / push・reply） | Webhook・Flex Message・リッチメニュー実装時 |
| `references/mini-app-release.md` | ミニアプリチャネル、サービスメッセージ、パーマネントリンク、公開 | ミニアプリの体験設計・公開準備時 |
| `references/testing-and-security.md` | テスト戦略、トークン検証、Webhook 署名、セキュリティチェック | テスト計画・実装・レビュー時（セキュリティは必読） |

## 原則

### 1. 「LIFF アプリ」と「LINE ミニアプリ」を最初に切り分ける

**LINE ミニアプリは LIFF の上に作られる特別なカテゴリ**。両者は地続きだが、要件定義の段階で選ぶ。

| | LIFF アプリ | LINE ミニアプリ |
|--|-----------|----------------|
| 実体 | LINE 内で動く Web アプリ | LIFF をベースにした、LINE が用意した枠組み |
| チャネル | LINE ログインチャネル | **LINE ミニアプリチャネル**（専用） |
| 公開審査 | 不要（Web アプリとして登録するだけ） | 2024-11-28 以降、公開前審査は**必須ではなくなった**（品質ガイドラインは順守） |
| 友だち追加 | 必要になる場合がある | 友だち追加なしで利用可（リーチが広い） |
| 専用機能 | — | サービスメッセージ（無料）、パーマネントリンク、POP/QR、トーク内シェア |

> **基本方針**：「自社サービスを LINE 上で広く配りたい・友だち追加の摩擦をなくしたい」→ ミニアプリ。「特定の LINE 公式アカウントの友だち向けの機能」→ LIFF アプリ。詳細は `references/liff-vs-miniapp.md`。

### 2. LIFF はクライアント専用 SDK — SSR で必ず詰まる

LIFF SDK は内部で `window` を参照するため、Next.js のサーバ側で実行すると **`window is not defined`** で落ちる。`liff.init()` は**クライアント専用**（`useEffect` 内 or dynamic import）で呼ぶ。詳細は `references/setup-and-nextjs.md`。

### 3. ユーザー情報は「フロントで取得 → そのまま信用」しない

`liff.getProfile()` / `liff.getDecodedIDToken()` の結果を**フロントからバックエンドにそのまま送って信用してはいけない**（改ざん可能）。サーバで使うユーザー情報は、**ID トークン／アクセストークンをサーバへ送り、サーバが LINE プラットフォームで検証**して得る。これが LIFF セキュリティの最重要原則。詳細は `references/testing-and-security.md`。

> **基本方針：`liff.getIDToken()` をサーバへ送り、サーバが `POST /oauth2/v2.1/verify` で検証する。プロフィール JSON を直接送らない。**

### 4. LIFF ログインと「Supabase の LINE OAuth」は別物

- **Supabase Auth の LINE ログイン**（`auth-integration` skill の領域）：通常ブラウザの Web サイトで、LINE を OAuth ボタンの 1 つとして使う。リダイレクト型。
- **LIFF ログイン**：アプリが LINE 内で動くので、ユーザーは実質ログイン済み。`liff.login()` / `liff.isLoggedIn()` で扱う。リダイレクト型ではない。

LIFF アプリで Supabase の DB / RLS を使うには、**LIFF の LINE ID トークンをサーバで検証 → Supabase のユーザーにマッピングしてセッションを発行**するブリッジを自作する。`signInWithIdToken` は LINE を標準サポートしないため、サーバ側ブリッジが必須。詳細は `references/auth-and-supabase.md`。

### 5. Webhook は署名検証なしに実装しない

Messaging API の Webhook はインターネット公開エンドポイント。**`x-line-signature` の検証なしの実装は重大な脆弱性**。チャネルシークレットを使った HMAC-SHA256 検証を必ず入れる。詳細は `references/messaging-api.md`。

### 6. シークレットの置き場所を厳守

- **フロントに置いてよい**：LIFF ID（`NEXT_PUBLIC_LIFF_ID`）。これは公開情報。
- **フロントに置いてはいけない**：チャネルシークレット、チャネルアクセストークン、Supabase の `service_role`／`secret` キー。これらはサーバ（Route Handler / Edge Function）のみ。

### 7. LIFF SDK のバージョンを固定し、定期的に上げる

`@line/liff` は SemVer（v2.2.0 以降）。**npm パッケージでバージョンを固定**し、CDN を使う場合も `fixed` パスを使う（`edge` は勝手に最新追従して挙動が変わる）。LIFF v2.11.0 以降は `liff.init()` 解決後に URL から認証情報が除去されるため、ページビュー送信は `.then()` 内で行う。

## 設計で決めること

| 領域 | 決めること |
|------|-----------|
| 技術選定 | `docs/11-tech-stack/adr/NNNN-line-platform.md` に方式（LIFF アプリ / LINE ミニアプリ / 通常 Web）、必要なチャネル種別、Messaging API 連携の有無、ミニアプリ公開の要否を記録 |
| 外部設計 | **LINE アプリ内ブラウザの制約**（戻る挙動、ヘッダ、`liff.closeWindow()`）込みの画面遷移、リッチメニュー → LIFF 画面の導線、トーク画面とアプリの行き来。ミニアプリならパーマネントリンク・サービスメッセージの体験 |
| 内部設計 | LIFF SDK の組み込み（`LiffProvider` + Context）と SSR 回避、LINE ID トークン → Supabase セッションのブリッジ（Route Handler / Edge Function）、Webhook ハンドラの構造・署名検証・冪等性 |
| テスト | LINE アプリ内 / 外部ブラウザの両方を含める。E2E は外部ブラウザ（`withLoginOnExternalBrowser`）で動く範囲を Playwright でカバーし、LINE アプリ内固有の挙動はモック方針を `testing-and-security.md` に従って決める。Webhook（署名検証・イベント種別）とトークン検証のテストを持つ |
| レビュー | ID トークンのサーバ検証、Webhook 署名検証、シークレットの配置、SSR 回避を `testing-and-security.md` のチェックリストで確認 |

### 隣接領域との境界

- **ログイン**：通常 Web の「LINE ログイン（OAuth ボタン）」は `auth-integration` の領域、**LINE 内で動く LIFF / ミニアプリのログイン**は本 Skill の領域。LIFF ログイン → Supabase セッションのブリッジは両方の観点で共同設計する（`auth-and-supabase.md`）
- **課金**：LINE ミニアプリ内での課金は **LINE の決済（LINE Pay 等）／自社 Stripe** のどちらを使うか、案件要件で切り分ける。トークアプリ内の物販はミニアプリ + Stripe（外部決済）が一般的

## 野口さん固有のチェック

- [ ] LIFF アプリ / LINE ミニアプリのどちらかを ADR で確定
- [ ] 必要なチャネル（LINE ログイン / Messaging API / ミニアプリ）を LINE Developers Console で整理
- [ ] LIFF アプリが Tier A（Vercel + Supabase + Next.js）に乗っている
- [ ] ID トークンをサーバ検証し、フロントのプロフィール JSON を信用していない
- [ ] チャネルシークレット・アクセストークンがフロントに露出していない
- [ ] Webhook の `x-line-signature` 検証が実装されている
- [ ] LINE Messaging API の無料メッセージ枠（月次上限）を運用コストとして把握
- [ ] 1 名運用前提：リッチメニュー・サービスメッセージは更新負荷の小さい構成にする
- [ ] B2C / 地域コミュニティ案件では LINE をフロントにする利点（メアド入力不要・ほぼ全員が LINE 保有）を活かす

## LINE をフロントにする利点

### 最小摩擦の獲得

野口さんの B2C・地域コミュニティ案件では、**利用者がほぼ全員 LINE を持つ**。LIFF / ミニアプリにすれば：

- メールアドレス入力・パスワード設定が不要（LINE ログインで完結）
- アプリストアのインストール障壁がない（LINE 内で即起動）
- リッチメニュー・トーク通知で再訪導線を作れる

### Web SaaS との 1 ソース化

LIFF アプリは Next.js Web アプリなので、通常の Web SaaS と**コードベース・Supabase スキーマ・ドメインロジックを共有**できる。「同じ SaaS を Web でもミニアプリでも出す」構成が取れる。

### 売上直結フローを LINE 上でも保証

- 新規利用：LIFF 起動 → LINE ログイン → サーバ検証 → Supabase ユーザー作成
- 課金：ミニアプリ + Stripe（外部決済）、または LINE Pay
- 再訪：リッチメニュー / サービスメッセージ（ミニアプリ）/ push メッセージ

## アンチパターン（よくある失敗）

1. **`liff.init()` をサーバ側で実行**：`window is not defined` で落ちる。クライアント専用にする
2. **`liff.getProfile()` の結果をそのままサーバに送って信用**：改ざん可能。トークンを送りサーバ検証する
3. **チャネルシークレット／アクセストークンをフロントに置く**：漏洩。サーバのみ
4. **Webhook の署名検証なし**：偽イベントを注入される
5. **LIFF ログインと Supabase OAuth の LINE ログインを混同**：別物。LIFF は内部ログイン、ブリッジを自作
6. **`signInWithIdToken` で LINE を直接ログインしようとする**：LINE は標準サポート外。サーバブリッジが要る
7. **CDN の `edge` パスを本番採用**：勝手に最新追従。`fixed` か npm でバージョン固定
8. **LIFF の URL 制約を無視**：`liff.init()` はエンドポイント URL と同一かそれ以下の URL でのみ保証される
9. **ミニアプリのサービスメッセージを宣伝に使う**：ユーザー操作への確認・応答に限られる。規約違反になる
10. **外部ブラウザで開かれた時を考慮しない**：`liff.isInClient()` で分岐、`withLoginOnExternalBrowser` を検討
11. **`liff.closeWindow()` 後の体験を設計しない**：閉じた後トーク画面に戻る前提で導線を作る
12. **Messaging API の無料枠を超過**：月次上限を超えると配信不可。運用前に試算する

## 関連 Skill

- `auth-integration`：通常 Web の LINE ログイン（OAuth）。LIFF 内ログインは本 Skill が担当
- `stripe-integration`：ミニアプリでの外部決済（Stripe）
- `mobile-app-development`：ネイティブアプリ（Expo）。LINE 内で完結するなら LIFF、ストア配布するならネイティブ
- `e2e-browser-testing`：LIFF アプリの外部ブラウザ E2E（Playwright）
- `sdlc-toolkit`：成果物配置、レビュー方法論、技術スタック Tier
