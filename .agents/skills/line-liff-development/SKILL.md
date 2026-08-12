---
name: line-liff-development
description: LINE LIFF アプリ／LINE ミニアプリを Next.js（野口さん Tier A スタック）で高品質に開発・テスト・公開するための知識集。LIFF SDK、LINE ログイン、Supabase Auth とのブリッジ、Messaging API（Flex Message・リッチメニュー・Webhook）、ミニアプリのサービスメッセージ・パーマネントリンク・公開までを網羅する。実装フェーズ（Phase 11）・テストフェーズ（Phase 11-12）・公開で参照する。「LIFF」「LINEミニアプリ」「LINE Mini App」「LINEアプリ」「Messaging API」「LINEログイン」「LINE連携」で起動。
---

# LINE LIFF / Mini App Development Skill

LINE のプラットフォーム上で動く Web アプリ（**LIFF アプリ**および**LINE ミニアプリ**）を高品質に開発・公開するための知識集。野口さんの B2C・地域コミュニティ案件で強力な「LINE をフロントにする」戦略を支える。

**主軸スタック：LIFF SDK（`@line/liff`）+ Next.js（App Router）+ Supabase。** 野口さんの Tier A（Vercel + Supabase + Next.js）にそのまま乗る。LIFF アプリは本質的に「LINE アプリ内ブラウザで動く Next.js Web アプリ」であり、既存の Web 開発資産を再利用できる。

## いつこの Skill を参照するか

以下の場面で必ず読む：

- **要件定義**（Phase 1）：「LINE で完結させたい」要望がある時、LIFF / ミニアプリの採否判断
- **技術スタック選定**（Phase 3）：LIFF / ミニアプリ / 通常 Web の方式選定を ADR 化する時
- **外部設計**（Phase 5）：LINE 内での画面遷移、リッチメニュー、トーク画面との連携設計
- **内部設計**（Phase 7）：LIFF SDK の組み込み方、認証ブリッジ、Webhook ハンドラ設計
- **実装**（Phase 11）：LIFF / Messaging API のコードを書く時（implementation-worker / line-platform-specialist）
- **テスト**（Phase 11-12）：LINE アプリ内・外部ブラウザでの動作確認、Webhook テスト
- **公開**：LIFF アプリの登録、ミニアプリの公開、サービスメッセージ設計時
- **レビュー**（Phase 14）：トークン検証・Webhook 署名などセキュリティ確認時

## 重要原則（必読）

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

## この Skill の構成

```
line-liff-development/
├── SKILL.md                          # 本ファイル
└── references/
    ├── liff-vs-miniapp.md            # LIFF / ミニアプリの違い、チャネル構成、方式選定
    ├── setup-and-nextjs.md           # Create LIFF App、Next.js 統合、SSR 対策、LiffProvider、Vercel 配信
    ├── liff-features.md              # LIFF SDK API（profile / sendMessages / shareTargetPicker / scanCodeV2 等）
    ├── auth-and-supabase.md          # LIFF ログイン × Supabase Auth ブリッジ、ID トークン検証
    ├── messaging-api.md              # Messaging API（Webhook / Flex Message / リッチメニュー / push・reply）
    ├── mini-app-release.md           # ミニアプリチャネル、サービスメッセージ、パーマネントリンク、公開
    └── testing-and-security.md       # テスト戦略、トークン検証、Webhook 署名、セキュリティチェック
```

## エージェント別の使い方ガイド

### tech-stack-architect

LINE 連携要件のある案件で `docs/11-tech-stack/adr/NNNN-line-platform.md` に記録：

- **方式選定**：LIFF アプリ / LINE ミニアプリ / 通常 Web の判断（`references/liff-vs-miniapp.md`）
- **野口さん適性**：LIFF は Tier A（Vercel + Supabase + Next.js）にそのまま乗る。B2C・地域コミュニティ案件で特に有効
- ADR に「必要なチャネル種別」「Messaging API 連携の有無」「ミニアプリ公開の要否」を明記

### external-designer

- 画面遷移を **LINE アプリ内ブラウザの制約**（戻る挙動、ヘッダ、`liff.closeWindow()`）込みで設計
- リッチメニュー → LIFF 画面の導線、トーク画面とアプリの行き来を設計
- ミニアプリならパーマネントリンク・サービスメッセージの体験設計（`references/mini-app-release.md`）

### internal-designer

- LIFF SDK の組み込み（`LiffProvider` + Context）、SSR 回避方針を設計
- LINE ID トークン → Supabase セッションのブリッジ（Route Handler / Edge Function）を設計
- Webhook ハンドラの構造・署名検証・冪等性を設計

### test-planner / tester

- LINE アプリ内 / 外部ブラウザの両方を含むテスト計画（`references/testing-and-security.md`）
- Webhook テスト（署名検証、イベント種別）、トークン検証のテスト

### e2e-usecase-tester（Phase 12）

- LIFF アプリの E2E は、外部ブラウザ（`withLoginOnExternalBrowser`）で動く範囲を Playwright でカバー
- LINE アプリ内固有の挙動はモック方針を `references/testing-and-security.md` に従って決める

### implementation-worker

- `references/setup-and-nextjs.md` でプロジェクトに LIFF を組み込み
- `liff.init()` をクライアント専用で呼ぶ（原則 2）
- シークレットをフロントに置かない（原則 6）

### implementation-reviewer

- ID トークンのサーバ検証、Webhook 署名検証、シークレットの配置、SSR 回避を確認
- `references/testing-and-security.md` のセキュリティチェックリストを適用

### line-platform-specialist（専任エージェント）

LIFF / ミニアプリ / Messaging API を横断的に担当。詳細は `agents/line-platform-specialist.md` 参照。本 Skill 全体を必読とする。

### auth-integration-specialist との連携（重要）

- **役割分担**：通常 Web の「LINE ログイン（OAuth ボタン）」は auth-integration-specialist、**LINE 内で動く LIFF / ミニアプリのログイン**は line-platform-specialist。
- LIFF ログイン → Supabase セッションのブリッジは両者で共同設計（`references/auth-and-supabase.md`）。

### payment-integration-specialist との連携

- LINE ミニアプリ内での課金は **LINE の決済（LINE Pay 等）／自社 Stripe** のどちらを使うか、案件要件で切り分ける。トークアプリ内の物販はミニアプリ + Stripe（外部決済）が一般的。

## 参照ファイルの読み方

| ファイル | 必読タイミング |
|---------|--------------|
| `liff-vs-miniapp.md` | 方式選定時（要件定義・技術選定） |
| `setup-and-nextjs.md` | プロジェクト初期化時、LIFF 組み込み時（必読） |
| `liff-features.md` | LIFF SDK の機能（プロフィール・シェア・QR 等）を使う時 |
| `auth-and-supabase.md` | 認証ブリッジの設計・実装時（必読） |
| `messaging-api.md` | Webhook・Flex Message・リッチメニュー実装時 |
| `mini-app-release.md` | ミニアプリの公開準備、サービスメッセージ設計時 |
| `testing-and-security.md` | テスト計画時、実装時、レビュー時（セキュリティは必読） |

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

## SaaS 量産戦略への貢献

### LINE をフロントにした最小摩擦の獲得

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
