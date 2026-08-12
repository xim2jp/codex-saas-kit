# MCP サーバー登録（Codex から本番障害を調査する）

3ツールはいずれも**公式リモート MCP サーバー**を提供している。Codex に接続すると、本番のエラー・メトリクス・ログ・トレースを**自然言語で問い合わせ**、根本原因分析まで実施できる。野口さん1名運用の障害対応を劇的に速くする中核機能。

> 接続URL・認証方式・提供ツールは更新が速い。実装直前に各 setup ページ（末尾出典）で再確認。接続後は Codex 内 `/mcp` で実際に提供されるツール一覧を確認するのが確実。

## なぜ MCP を接続するのか

- ダッシュボードを見に行かずに「直近1時間のエラー上位は？」「あのエンドポイントの p95 レイテンシは？」と**会話で聞ける**。
- エラー Issue を渡すと **AI が根本原因分析 → 修正案 → PR** まで（Sentry Seer）。
- 障害対応のコンテキスト（コードとテレメトリ）を Codex が同時に持てる → 修正が速い。

## セキュリティ大前提

- MCP は本番データへの読み取り（一部書き込み）アクセスを与える。**最小権限のスコープ付きキー/サービスアカウント**を使う。
- OAuth 対応ツールは OAuth を優先（キーをファイルに置かない）。
- API キー方式を使う場合、キーを `config.toml` に**直書きしない**（`env_http_headers` / `bearer_token_env_var` で環境変数参照にする）。プロジェクト共有の `.codex/config.toml` にキーを書いてコミットするのは厳禁。
- MCP のキーとアプリ計装のキーは**別物**（特に New Relic：MCP=User key `NRAK-`、計装=License key）。

---

## 1. Sentry MCP（公式リモート、OAuth）

- エンドポイント：`https://mcp.sentry.dev/mcp`
- ドキュメント：https://mcp.sentry.dev/ ／ リポジトリ：https://github.com/getsentry/sentry-mcp
- 認証：**OAuth**（追加後にブラウザ認証フロー。開かない場合は `/mcp` から手動）

### Codex 登録（推奨：リモート HTTP）

`~/.codex/config.toml`（個人）または `.codex/config.toml`（プロジェクト）に追記：

```toml
[mcp_servers.sentry]
url = "https://mcp.sentry.dev/mcp"
```

追記後、OAuth 認証を実行：

```bash
codex mcp login sentry
```

ローカル（stdio、自己ホスト Sentry 等）：

```bash
codex mcp add sentry -- npx @sentry/mcp-server
```

（`SENTRY_ACCESS_TOKEN` を env で。env キー名は README で最終確認）。

### 主な提供ツール

- `find_organizations` / `find_projects` … 組織・プロジェクト発見
- `search_events` / `search_issues` … 自然言語でイベント/Issue 検索（Sentry クエリ構文不要）
- `get_issue_details` … Issue ID の詳細（スタックトレース、エラーメッセージ）
- `update_issue` … ステータス/アサイン更新
- `get_trace_details` … トレース詳細
- **`analyze_issue_with_seer`** … Seer による根本原因分析（→ 修正案/PR 生成）

---

## 2. Datadog MCP（公式リモート、GA、OAuth or API key）

- エンドポイント（US1 = app.datadoghq.com）：
  `https://mcp.datadoghq.com/api/unstable/mcp-server/mcp`
  - EU：`https://mcp.datadoghq.eu/...`、US3：`https://mcp.us3.datadoghq.com/...`（リージョンで置換）
  - ⚠️ パスに `unstable` を含む。GovCloud は非対応。
- 認証：**OAuth（推奨）** または **API key + App key**（ヘッダー送信）。すべて既存の RBAC 権限を尊重。

### Codex 登録

OAuth 方式（推奨）— `config.toml` に追記して `codex mcp login datadog`：

```toml
[mcp_servers.datadog]
url = "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp"
```

API key 方式（キーは環境変数参照。`config.toml` に直書きしない）：

```toml
[mcp_servers.datadog]
url = "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp"
# ヘッダー名 = 参照する環境変数名
env_http_headers = { "DD_API_KEY" = "DD_API_KEY", "DD_APPLICATION_KEY" = "DD_APPLICATION_KEY" }
```

ツールセット絞り込み：URL末尾に `?toolsets=apm,llmobs` や `?toolsets=all`。

### 主な提供ツールセット

- **core（GA）**：ログ・メトリクス・トレース・ダッシュボード・モニター・インシデント・ホスト・サービス・イベント・ノートブック
- 他 GA：alerting / cases / dashboards / databases(DBM) / ddsql / error-tracking / feature-flags / kubernetes / security / software-delivery(CI/DORA) / synthetics / workflows 等
- **Preview（要申請）**：apm（高度トレース分析）/ rum / code-exec / onboarding

> メトリクス検索・ログ検索・モニター・インシデント・APM trace 取得は **core（GA）** に含まれる。

---

## 3. New Relic MCP（公式リモート、Public Preview、OAuth or User key）

- エンドポイント：US `https://mcp.newrelic.com/mcp/` ／ EU `https://mcp.eu.newrelic.com/mcp/`
- ドキュメント：https://docs.newrelic.com/docs/agentic-ai/mcp/setup/
- 認証：**OAuth（推奨）** または **User API Key（`NRAK-`）**。License key / Insights key は不可。
- ステータス：**Public Preview**。UI の Previews & Trials で有効化が必要。FedRAMP/HIPAA アカウントは利用不可。

### Codex 登録

API key 方式（User key を環境変数 `NEW_RELIC_API_KEY` に設定）：

```toml
[mcp_servers.newrelic]
url = "https://mcp.newrelic.com/mcp/"
env_http_headers = { "Api-Key" = "NEW_RELIC_API_KEY" }
```

OAuth 方式（`config.toml` に url のみ記載後、ブラウザ認証）：

```bash
codex mcp login newrelic
```

> ⚠️ EU アカウントは URL を EU エンドポイントへ置換。ヘッダー整形は公式ドキュメント記載を正とし、接続後に `/mcp` で疎通確認する。

### 主な提供ツール

- `execute_nrql_query` … NRDB に NRQL を実行
- `natural_language_to_nrql_query` … 自然言語→NRQL 変換・実行
- `list_entity_types` / `search_entity_with_tag` / `get_entity` / `list_related_entities` … エンティティ探索
- alerting タグ：アラート状態確認、アラートイベントレポート生成
- ユースケース：デプロイ影響分析、エラーログ分析

> APM/Browser/Dashboard のデータは `execute_nrql_query` 経由で取得可能（専用ツールの有無は接続後 `/mcp` で確認）。

---

## 障害対応フロー例（1名運用の理想形）

```
1. アラート通知（Slack）が届く：「error rate 急増」
2. Codex に「Sentry で直近30分の新規エラー上位3件を要約して」
   → search_issues / get_issue_details で特定
3. 「このエラーを Seer で根本原因分析して」
   → analyze_issue_with_seer が原因と修正案を提示
4. 「該当のレイテンシ悪化を New Relic で確認」
   → natural_language_to_nrql_query で p95 を取得
5. Codex がコード修正 → テスト → PR
```

## 接続後チェックリスト

- [ ] OAuth 接続を優先（キー直書きを避ける）
- [ ] API key 方式なら最小権限のスコープ付きキー/サービスアカウント
- [ ] `config.toml` にキーを直書き・コミットしていない（キー漏洩防止）
- [ ] New Relic：MCP=User key（NRAK-）、計装=License key を取り違えていない
- [ ] `/mcp` で実際の提供ツールを確認
- [ ] Preview 機能（New Relic MCP / Datadog 一部）の本番依存度を把握

## 出典（一次ソース）

- Sentry MCP: https://mcp.sentry.dev/ ・ https://github.com/getsentry/sentry-mcp
- Datadog MCP: https://docs.datadoghq.com/bits_ai/mcp_server/setup/ ・ https://docs.datadoghq.com/bits_ai/mcp_server/tools/ ・ https://www.datadoghq.com/product/ai/mcp-server/
- New Relic MCP: https://docs.newrelic.com/docs/agentic-ai/mcp/setup/ ・ https://docs.newrelic.com/docs/agentic-ai/mcp/overview/ ・ https://docs.newrelic.com/docs/agentic-ai/mcp/tool-reference/
- Codex MCP: https://developers.openai.com/codex/mcp
