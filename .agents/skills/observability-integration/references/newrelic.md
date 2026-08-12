# New Relic 詳細

フルスタック APM（APM/Infra/Logs/Browser/Synthetic）。**無料枠が破格**（100GB/月取り込み + Full Platform User 1名が永続無料）で、1名運用の SaaS を実質無料でフル監視できる。野口Profile のコスパ枠。

> 情報は 2026 年 6 月時点。SDK・料金・MCP は更新が速いため、実装直前に末尾の出典URLで再確認すること。

## 1. キーの種類（混同注意）

New Relic は用途別にキーが複数あり、取り違えが事故の元：

| キー | プレフィックス | 用途 |
|------|--------------|------|
| **License key（Ingest）** | （UUID風） | **アプリ計装**（APM/Infra agent のデータ送信） |
| **User API key** | `NRAK-` | **MCP サーバー認証**・NerdGraph API |
| Insights query key | `NRIQ-` | 旧クエリ用（通常不要） |

> ⚠️ 計装は **License key**、MCP は **User key（NRAK-）**。`mcp-servers.md` と本ファイルでキーを取り違えないこと。

## 2. Node.js / Next.js APM 導入

### 基本（Node.js）

```bash
npm install newrelic
```

- 推奨ロード：`-r` プリロード → `node -r newrelic your-app.js`
- 設定：`newrelic.js`（ルートに配置）または環境変数 `NEW_RELIC_LICENSE_KEY` / `NEW_RELIC_APP_NAME`。
- ⚠️ Babel 等トランスパイラ使用時は `require('newrelic')` 先頭行方式だと計装不具合が出るため **`-r` 推奨**。

### Next.js

- 旧 `@newrelic/next` は **Node.js Agent v12.0.0 で本体にマージ済み**。`newrelic` を v12+ に上げれば Next.js instrumentation が標準同梱。
- 起動：`NODE_OPTIONS='-r newrelic' next start`（カスタムサーバーなら `node -r newrelic server.js`）。
- 計測対象：`getServerSideProps`（SSR）、middleware、page/server リクエストのトランザクション命名。
- 計測対象外：ビルド時処理、クライアントサイド（→ Browser agent が別途必要）。
- 要件：Next.js 12.0.9+（middleware は 12.2.0+）。

### Browser monitoring（クライアント側）

- New Relic UI →「Add Data → Browser monitoring」で JavaScript snippet を取得。
- App Router では `app/layout.tsx` の `<head>` に `next/script` の `<Script>` で注入（`id` を一意に、`strategy="beforeInteractive"`）。
- ⚠️ Next.js が raw JS をサニタイズすると snippet が壊れて計測不能になりうる。注入方法に注意。

### OpenTelemetry 経由（Vercel に有効）

- New Relic APM agent は OTel API をサポート（bridge mode）。
- Next.js は OTel 標準サポート。**Vercel では `@vercel/otel` で OTLP → New Relic** にエクスポートするのが現実的（`-r newrelic` プリロードは Vercel のサーバーレスで素直に動きにくい）。
- ⚠️ Vercel の OTel collector 提供範囲はプラン依存の可能性。Vercel 側ドキュメントを確認。

## 3. AWS ECS Fargate 構成

- アプリコンテナに Node.js APM agent を導入しつつ、**Infrastructure agent を同一 Task 内のサイドカーコンテナ**として配置 → アプリとインフラを相関。
- New Relic は ECS 用の Task Definition サンプル JSON / Terraform サンプル / 自動インストールスクリプトを提供（license key と cluster 名を渡す）。

## 4. 主要機能（「目視で即確認」観点）

| 機能 | 目視での即確認ポイント |
|------|----------------------|
| **APM** | Summary でレイテンシ/エラー率/スループット/Apdex を一目。遅いトランザクションをドリルダウン |
| **Infrastructure** | アプリ異常時に裏のリソース逼迫（CPU/メモリ）を即紐付け |
| **Browser** | Core Web Vitals・JS エラー・SPA 遷移をユーザー視点で可視化 |
| **Logs** | APM/トレースと自動相関（logs in context）。エラーから該当ログへ即ジャンプ |
| **NRQL / Dashboards** | SQL 風言語でカスタム可視化。MCP から自然言語でも叩ける |
| **Alerts & AI（Applied Intelligence / New Relic AI）** | 異常検知・インシデント相関・ノイズ低減・根本原因示唆 |
| **Synthetic Monitoring** | 外形監視。無料枠で 500 チェック + Ping 無制限 |
| **Errors Inbox** | 新規/急増エラーを優先度順に一覧トリアージ（Core user でも可） |

## 5. 料金感（無料枠が主役）

### 無料枠（永続・クレカ不要）

- **データ取り込み 100GB/月 無料**（全ソース合算）
- **Full Platform User 1名 無料**（APM/Infra/Browser/Synthetic/Logs 等フルアクセス）
- **Basic User 無制限**（クエリ・ダッシュボード・アラート設定可）
- 外形監視：Ping 無制限 + 500 synthetic checks
- デフォルトのログ難読化（クレカ/SSN パターン）標準有効、データ保持最低8日

### 課金モデル（2軸）

1. **データ取り込み課金**：100GB 超過分。Original Data（保持8日〜）/ Data Plus（保持最大90日）。
2. **ユーザー課金**：Basic（無料）/ Core / Full Platform。

> ⚠️ データ取り込み単価の正確な現行額は公式 pricing が動的表示のため要再確認（第三者集計値は相違あり）。

### 野口さん向け適性

- **1名運用なら無料枠で完結見込み**（Full User 1 + 100GB/月で APM/Infra/Browser/Logs/Synthetic/Alerts/Errors Inbox 全部）。
- 唯一のリスクは**取り込み量超過**。Logs を全件送ると 100GB を超えやすい → 後述の drop rules で管理。

## 6. PII / セキュリティ

- **自動難読化**：全アカウントでデフォルト有効（クレカ/SSN パターンをマスク）。
- **カスタム log obfuscation**：UI / NerdGraph で正規表現ルール。MASK（X置換）/ HASH（SHA-256、突合用）。**Data Plus オプション機能**。
- **Drop Filter Rules**：クエリにマッチしたデータを **NRDB 書き込み前に破棄**。PII 除去・コスト削減・ノイズ削減に有効。属性単位の drop も可。
- ⚠️ **NRDB 保存後は PII を自分で削除できない**。取り込み前（drop rules / obfuscation / agent側マスキング）で対処必須。

詳細は `security-and-pii.md`。

## 7. 導入チェックリスト

- [ ] `newrelic` v12+ を `-r newrelic` でロード（Next.js 同梱 instrumentation）
- [ ] License key を環境変数で（公開しない）
- [ ] Vercel は `@vercel/otel` で OTLP 送信
- [ ] ECS Fargate は Infra agent サイドカー構成
- [ ] Browser snippet を `app/layout.tsx` に注入
- [ ] drop rules で Logs の取り込み量と PII を管理
- [ ] 無料枠（100GB/Full User 1）の範囲内か監視
- [ ] MCP サーバー接続（User key `NRAK-`、→ `mcp-servers.md`）

## 出典（一次ソース）

- Node.js install: https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/install-nodejs-agent/
- Next.js: https://github.com/newrelic/newrelic-node-nextjs
- OTel: https://docs.newrelic.com/docs/apm/agents/manage-apm-agents/opentelemetry-api-support/
- ECS: https://docs.newrelic.com/docs/infrastructure/elastic-container-service-integration/monitor-ecs-with-apm-agents/
- 無料枠: https://newrelic.com/pricing/free-tier
- 課金: https://docs.newrelic.com/docs/accounts/accounts-billing/new-relic-one-pricing-billing/new-relic-one-pricing-billing/
- ログ難読化: https://docs.newrelic.com/docs/logs/ui-data/obfuscation-ui/
- Drop rules: https://docs.newrelic.com/docs/logs/ui-data/drop-data-drop-filter-rules/
- MCP: https://docs.newrelic.com/docs/agentic-ai/mcp/setup/
