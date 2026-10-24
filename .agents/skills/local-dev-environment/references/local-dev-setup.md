# ローカル開発環境 構築ガイド（Docker完結）

全機能（アプリ本体・営業ポータル・認証・決済・AI・メール）を**ローカルのみで起動・テストできる**環境の構築標準。Phase 15 のタスク0として implementation-worker が実施し、tester / e2e-usecase-tester がこの環境上でテストを実行する。

## 1. ゴール定義

`bash scripts/dev-setup.sh` の一発で以下が成立すること：

| # | 確認項目 | 確認方法 |
|---|---------|---------|
| 1 | Docker 上で Supabase ローカルスタック（Postgres / Auth / PostgREST / Storage / Realtime / Studio / Mailpit）が起動 | `supabase status` |
| 2 | マイグレーション適用・シードデータ投入済み | `supabase db reset` が成功 |
| 3 | Next.js アプリが `http://localhost:3000` で起動 | `curl -f localhost:3000` |
| 4 | **営業ポータル（`(marketing)` の8ページ）がローカル表示できる** | `/`, `/features`, `/screenshots`, `/pricing`, `/faq`, `/operator`, `/contact`, `/legal/*` を巡回 |
| 5 | 認証フロー（サインアップ→確認メール→ログイン）がローカルで完結 | Mailpit（`localhost:54324`）で確認メールを受信 |
| 6 | Stripe テスト決済フローが動く（下記 4章の方式いずれか） | `stripe listen` 転送 or モックで webhook 到達 |
| 7 | AI 機能がモックで応答する（実API課金なし） | モックエンドポイントの応答確認 |
| 8 | Unit / Integration テストがローカルで緑 | `npm test` |
| 9 | Playwright E2E がローカルで起動する | `npx playwright test --list` → 代表1本実行 |

すべて確認したら `docs/41-test-results/local-env-verification-YYYYMMDD-HHMM.md` に記録する（8章テンプレート）。

## 2. 標準ファイル構成

```
<project-root>/
├── docker-compose.yml           # Supabase CLI が管理しないもの（stripe-cli, ai-mock 等）
├── supabase/
│   ├── config.toml              # supabase init で生成（ポート・Mailpit 設定）
│   ├── migrations/              # DDL（implementation-worker が実装とともに追加）
│   └── seed.sql                 # シードデータ（マスター + E2E 用テストユーザー）
├── scripts/
│   ├── dev-setup.sh             # 環境の初期構築＋起動（冪等）
│   ├── dev-check.sh             # ヘルスチェック（全サービスの状態を一覧表示）
│   └── dev-teardown.sh          # 停止・破棄（volume 削除は --hard オプション）
├── .env.local.example           # ローカル用環境変数の雛形（コミットする）
├── .env.local                   # 実ファイル（gitignore）
└── docs/41-test-results/
    └── local-env-verification-YYYYMMDD-HHMM.md
```

## 3. Supabase ローカルスタック（Tier A の中核）

Supabase CLI（`supabase start`）が Docker 上に本物同等のスタックを立てる。**自前で Postgres コンテナを書かない**（Auth/RLS/Storage の挙動が本番と揃わなくなる）。

```bash
# 初回
supabase init                    # supabase/config.toml 生成
supabase start                   # Docker 群起動（初回はイメージ取得で数分）
supabase status                  # URL / anon key / service_role key を表示

# スキーマ・シードの再適用（テスト前のクリーン化にも使う）
supabase db reset                # migrations 適用 + seed.sql 投入
```

- **メール**：ローカルの Auth は SMTP の代わりに **Mailpit**（旧 Inbucket、`localhost:54324`）に配信する。確認メール・マジックリンク・パスワードリセットの E2E はここから本文を取得する
- **`.env.local` への反映**：`supabase status -o env` の出力から `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` を生成する（dev-setup.sh で自動化）
- **ローカルキーはコミットしてよい唯一の例外**（全開発者共通の周知の値）だが、混乱防止のため .env.local に置き gitignore を維持する

## 4. Stripe（決済）のローカル戦略

優先順で3方式。**テスト計画（Phase 13）でどれを採用するか宣言**しておく：

| 方式 | 内容 | ネットワーク | 向き |
|------|------|-------------|------|
| A（推奨） | **Stripe テストモード + Stripe CLI 転送**。`stripe listen --forward-to localhost:3000/api/webhooks/stripe` | Stripe API への外部接続あり（課金なし） | Checkout・Webhook・署名検証まで本物の挙動で検証できる |
| B | **stripe-mock**（Docker: `stripe/stripe-mock`） | 完全オフライン | API 形状の Unit/Integration。ステートレスなので Checkout フロー全体は再現不可 |
| C | **msw / テストダブル**でアプリ側の Stripe 呼び出しをモック | 完全オフライン | Unit テスト、CI の高速化 |

- docker-compose.yml に stripe-cli を入れる場合：

```yaml
services:
  stripe-cli:
    image: stripe/stripe-cli:latest
    command: listen --api-key ${STRIPE_TEST_SECRET_KEY} --forward-to host.docker.internal:3000/api/webhooks/stripe
    extra_hosts:
      - "host.docker.internal:host-gateway"   # Linux/WSL2 で必須
```

- webhook 署名シークレットは `stripe listen` 起動時に表示される `whsec_...` を `.env.local` に反映（dev-setup.sh で自動取得）
- E2E での扱いは `e2e-browser-testing` Skill の Stripe 節に従う（テストカード 4242…、`stripe trigger` イベント注入）

## 5. AI API（Bedrock / Claude / OpenAI）のローカル戦略

**既定はモック**（コスト・オフライン再現性・レート制限回避）：

- **方式1（推奨）**：アプリの AI クライアントを1モジュールに集約し、`AI_PROVIDER=mock` のときローカルモックサーバ（下記）に向ける
- **方式2**：msw で SDK の HTTP レイヤーをインターセプト（テストコード内）
- モックサーバは docker-compose の 1 サービスとして立てる（WireMock か、`json-server`/小さな Hono アプリで十分）。**代表的なプロンプトに対する現実的な応答**を fixtures として保存し、ストリーミング応答が必要なら SSE で返す
- 実 API での確認は「スモーク用に手動で `AI_PROVIDER=real` に切り替える」運用とし、テストスイートには含めない（cost-guardian の予算管理対象）

## 6. アプリ本体・営業ポータル

- Next.js は**ホスト側で `npm run dev`** を基本とする（HMR・デバッグ性能。コンテナ化は任意）。「Docker ベース」の主対象はバックエンド群（Supabase スタック・stripe-cli・ai-mock）
- 営業ポータルは同一アプリの `(marketing)` ルートなので、アプリが起動すれば8ページすべてローカル表示できる。**スクリーンショット集ページが参照する画像がローカルに存在すること**（`public/images/screenshots/`）を確認項目に含める
- Phase 9 のポータルモック（`docs/15-marketing-site/mockups/*.html`）は自己完結HTMLなので、環境不要でブラウザ直開き・Playwright スクショ可能

## 7. dev-setup.sh / dev-check.sh の要件

### dev-setup.sh（冪等であること）

```
1. 前提チェック：docker / node / supabase CLI / stripe CLI の存在とバージョン表示
2. supabase start（起動済みならスキップ）
3. supabase db reset（--skip-seed オプションを用意）
4. .env.local 生成（.env.local.example + supabase status の値。既存ファイルは上書き前に確認）
5. npm ci（node_modules 無い場合のみ）
6. docker compose up -d（stripe-cli / ai-mock 等）
7. dev-check.sh を実行して結果表示
```

### dev-check.sh（全サービスの状態を一覧）

```
✅ Supabase (Postgres)   : http://localhost:54322  … OK
✅ Supabase (API)        : http://localhost:54321  … OK
✅ Supabase Studio       : http://localhost:54323  … OK
✅ Mailpit               : http://localhost:54324  … OK
✅ Next.js app           : http://localhost:3000   … OK
✅ Portal pages          : 8/8 ページ 200
✅ Stripe webhook 転送    : whsec 設定済み / listen 稼働
✅ AI mock               : http://localhost:8787   … OK
```

失敗時は原因と次のコマンドを表示する（「Docker Desktop が起動していません → 起動後に再実行」等）。

## 8. 検証レポート（必須成果物）

`docs/41-test-results/local-env-verification-YYYYMMDD-HHMM.md`：

```markdown
# ローカル開発環境 検証レポート

- 実施日時 / 実施者（agent）: implementation-worker
- OS / Docker: （WSL2 Ubuntu 22.04 / Docker Desktop 4.x 等）
- コミット: <sha>

## 検証結果（1章のゴール定義に対応）

| # | 項目 | 結果 | 備考 |
|---|------|------|------|
| 1 | Supabase スタック起動 | ✅ | |
| 2 | migration + seed | ✅ | |
| 3 | アプリ起動 | ✅ | |
| 4 | ポータル8ページ表示 | ✅ | /legal はリンク集 |
| 5 | 認証フロー（Mailpit 受信） | ✅ | |
| 6 | Stripe（方式A/B/C） | ✅ | 方式A、whsec 自動設定 |
| 7 | AI モック応答 | ✅ | |
| 8 | npm test 緑 | ✅ | N passed |
| 9 | Playwright 代表1本 | ✅ | UC-SIGNUP-01 |

## 既知の制約
- （例：Stripe Checkout の UI は外部接続が必要。オフライン時は方式Cに切替）

## セットアップ所要時間
- 初回: XX分 / 2回目以降: X分
```

**ブロッカー（未達項目）が残る場合は「検証レポートあり・ブロッカーあり」として記録し、PM は Phase 16 に進めない。**

## 9. テストとの接続

- **Vitest（Unit/Integration）**：Integration はローカル Supabase（54321/54322）に接続。テスト前に `supabase db reset` でクリーン化するか、テスト用スキーマ/トランザクションロールバックで分離
- **Playwright（E2E）**：`playwright.config.ts` の `webServer` で `npm run dev` を自動起動、`baseURL: http://localhost:3000`。認証は `auth.setup.ts` で storageState 生成（e2e-browser-testing Skill 準拠）。**E2E とローカル手動確認で DB 状態を共有しない**（E2E 実行前に reset）
- **CI（GitHub Actions）**：同じ dev-setup.sh を CI でも使う（`supabase start` は CI 上でも Docker で動く）。ローカルと CI の環境差異を作らないことが目的

## 10. Tier B（AWS）補足

- Bedrock：5章のモック方式をそのまま適用（実 Bedrock はスモークのみ）
- DynamoDB を使う場合：`amazon/dynamodb-local`、S3 直接利用は MinIO、SQS/SNS 等が増える場合のみ LocalStack を検討（最小限に）
- ECS 相当の動作確認はアプリコンテナの `docker build` + ローカル起動で代替

## 11. WSL2 での注意点（野口さん環境）

- **リポジトリは必ず Linux ファイルシステム側（`~/`）に置く**。`/mnt/c/` 配下は I/O が桁違いに遅く、HMR・supabase start が破綻する
- Docker Desktop の WSL Integration を対象ディストリで有効化
- `host.docker.internal` は Linux コンテナから既定では解決できない → `extra_hosts: ["host.docker.internal:host-gateway"]` を必ず付ける
- ファイル監視が効かない場合は `WATCHPACK_POLLING=true`（Next.js）
- ポート衝突：Supabase 既定（54321-54324）と他案件が衝突しやすい。**複数案件並行時は config.toml でポートをずらし、README に明記**

## 12. アンチパターン

- **環境構築を後回しにして実装を始める**（タスク0の意味がない。動作確認できないコードが積み上がる）
- 自前 Postgres コンテナで Supabase を代替する（RLS/Auth の挙動が本番と乖離）
- `.env.local` に本番・クラウドのキーを書く／`.env.local` をコミットする
- シードなしで「手で登録したデータ」に依存したテスト
- E2E と手動確認で同じ DB 状態を共有し、flaky の温床にする
- AI 実 API をテストスイートに組み込む（課金・レート制限・非決定性）
- dev-setup.sh が冪等でない（2回目の実行で壊れる）
- 検証レポートを書かずに「動いたはず」で Phase 16 に進む
