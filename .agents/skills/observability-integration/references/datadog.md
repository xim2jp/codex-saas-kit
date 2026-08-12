# Datadog 詳細

最も多機能で UI/ダッシュボードが洗練された統合監視（Infra/APM/Log/RUM/Synthetic）。ただし**ホスト課金が掛け算で膨らむ**ため、野口Profile では **Tier B（クライアント費用負担）に限定**。Tier A MVP では原則使わない。

> 情報は 2026 年 6 月時点。Agent・SDK・料金・MCP は更新が速いため、実装直前に末尾の出典URLで再確認すること。

## 1. 概念：Agent ベース

ホスト/コンテナ上で動く **Datadog Agent** がメトリクス・ログ・トレースを収集して転送。コンテナ環境（ECS Fargate）では各タスクにサイドカーとして同梱する。

- 公開キー：`clientToken`（ブラウザ RUM 用）
- 秘密キー：`DD_API_KEY`（Agent 送信用）/ App key（API 操作用）

## 2. ブラウザ RUM（Next.js）

```bash
npm install @datadog/browser-rum
```

```js
datadogRum.init({
  applicationId: '<RUM_APP_ID>',
  clientToken: '<CLIENT_TOKEN>',
  site: 'datadoghq.com',
  service: 'my-nextjs-app',
  sessionSampleRate: 100,
  sessionReplaySampleRate: 20,
  trackUserInteractions: true,
  trackResources: true,
  defaultPrivacyLevel: 'mask-user-input', // PII対策（後述）
});
```

- App Router では **client component** で初期化。
- **Next.js 専用プラグイン**あり（`rum-next-plugin`）：App/Pages Router のルート変更検知、view name 正規化、error boundary 対応。

## 3. APM トレーシング（dd-trace for Node.js）

```bash
npm install dd-trace
```

標準起動：`node --require dd-trace/init app.js`
ESM（Node ≥ v20.6）：`node --import dd-trace/initialize.mjs app.js`

- ⚠️ **Next.js / Nest.js は特別対応が必要**（公式明記）。環境変数 `NODE_OPTIONS='-r dd-trace/init'` または専用 init を `--require`。
- トレーサは他 import より**最初**にロードする。
- Unified Service Tagging：`DD_ENV` / `DD_SERVICE` / `DD_VERSION`。
- RUM ↔ トレース相関で、フロント→バックエンドを1画面で追跡。

## 4. Vercel インテグレーション

- 設定経路：Datadog 側「Configure the Vercel integration」で API キー作成 → Vercel 側 Datadog ページでプロジェクト選択しキー貼付（**Vercel Marketplace 直接ではなく Datadog プラットフォーム経由**）。
- 収集：ログ（Vercel **Log Drains** 経由）、メトリクス7種、トレース（OpenTelemetry 経由）。
- ⚠️ trace 相関には **OTel service 名を Vercel プロジェクト名と一致**させる必要。service checks / events は非対応。

## 5. AWS ECS Fargate（サイドカー Agent）

- 各タスク定義に **Datadog Agent コンテナを同梱**（Task Metadata がタスク内からのみ見えるため、タスクごとに Agent が必要）。
- 必須環境変数：`DD_API_KEY` と **`ECS_FARGATE=true`**。
- APM：Agent 側で UDS（`/var/run/datadog`）を `mountPoints`/`volumes` で共有。
- 公式サンプル：`datadog-agent-ecs-apm-uds.json` 等。

## 6. 主要機能（「目視で即確認」観点）

| 機能 | 目視での即確認ポイント |
|------|----------------------|
| **Infrastructure** | Host Map で全体の CPU/メモリを色で即把握。1,000+ インテグレーション |
| **APM / Distributed Tracing** | Service Map でボトルネックが一目。Flame Graph で遅延スパン特定 |
| **Log Management** | Live Tail でリアルタイム流し見、トレースと相関リンク |
| **RUM** | 実ユーザーのページ遷移を Session Replay で録画再生 |
| **Synthetic Monitoring** | API/Browser テストの緑赤を即確認 |
| **Dashboards** | 1画面に KPI 集約（UI 品質が高い） |
| **Monitors / Alerts** | 閾値/異常/予測アラート、SLO |
| **Watchdog（AI異常検知）** | **設定不要**で APM/Infra/Log の異常を自動検出。RCA（根本原因分析）まで提示 |

## 7. 公式 MCP サーバー（GA）

Datadog はリモート MCP サーバーを提供（2025年 Preview → 2026年3月頃 GA）。core ツールセット（ログ/メトリクス/トレース/ダッシュボード/モニター/インシデント等）が GA。詳細・登録方法は `mcp-servers.md`。

## 8. PII / セキュリティ

- **Sensitive Data Scanner (SDS)**：**Datadog 保存前**に Logs/APM/RUM 横断で機微データを検出・処理（Redact / Partial / Hash / Mask）。⚠️ 上位プラン/別課金。
- **RUM プライバシー**：`defaultPrivacyLevel`（`mask` / `mask-user-input` / `allow`）。ブラウザ送信前にデータ変更可。
- **APM**：Configure Data Security でクエリ文字列・タグの除去/難読化。
- 小規模運用の基本線：「送信前に RUM/ログ側でマスク」＋「clientToken のみ公開、API キーはサーバー専用」。

詳細は `security-and-pii.md`。

## 9. 料金感（コスト膨張に注意）

年額契約価格（月次/オンデマンドは2〜3割高）：

| 製品 | 単位 | Annual |
|------|------|--------|
| Infrastructure Pro | per host/月 | $15 |
| APM | per host/月 | $31 |
| Log Ingestion | per GB | $0.10 |
| Log Indexing (30日) | per 100万イベント | $2.50 |
| RUM | per 1,000セッション | $0.15〜 |
| Synthetic Browser | per 1K runs | $12 |

### 無料枠

- 最大5ホスト、**メトリクス保持1日のみ**。実運用には不足。

### 1名運用でのコスト膨張要因（重要）

1. **製品が掛け算**：Infra($15)+APM($31) を同一ホストで約 $46/host/月〜。RUM/Synthetic/Log は別課金で積み上がる。
2. **ECS Fargate はタスク=課金対象**：サイドカー構成上、タスク増で Agent ホスト換算が増える。
3. **ログのインデックス課金**（$2.5/百万件）が効く。取り込みのみ保持を活用。
4. **カスタムメトリクスの増殖**：高カーディナリティのタグで膨張。
5. **Synthetic Browser**（$12/1K）は高頻度実行で割高。
6. 価格は年額コミット前提。

> **野口さん判断**：Datadog はクライアントが費用を負担し、ホスト数・ログ量が読める Tier B 案件に限定。MVP/持ち出し案件では New Relic 無料枠 or Sentry を選ぶ。スタートアップなら Datadog for Startups クレジットも検討余地。

## 10. 導入チェックリスト

- [ ] クライアントが費用負担する契約か（Tier B 確認）
- [ ] ECS Fargate に Agent サイドカー（`DD_API_KEY` + `ECS_FARGATE=true`）
- [ ] RUM `defaultPrivacyLevel` で PII マスク
- [ ] dd-trace を Next.js 向けに正しく初期化（最初にロード）
- [ ] Vercel 連携の OTel service 名一致
- [ ] ログのインデックス対象を絞りコスト管理
- [ ] Watchdog で異常検知を有効化
- [ ] MCP サーバー接続（→ `mcp-servers.md`）

## 出典（一次ソース）

- MCP setup: https://docs.datadoghq.com/bits_ai/mcp_server/setup/ ・ tools: https://docs.datadoghq.com/bits_ai/mcp_server/tools/
- RUM Next.js: https://docs.datadoghq.com/real_user_monitoring/guide/monitor-your-nextjs-app-with-rum/ ・ https://docs.datadoghq.com/integrations/rum-next-plugin/
- dd-trace: https://docs.datadoghq.com/tracing/trace_collection/dd_libraries/nodejs/
- Vercel: https://docs.datadoghq.com/integrations/vercel/
- ECS Fargate: https://docs.datadoghq.com/integrations/aws-fargate/
- Watchdog: https://www.datadoghq.com/product/platform/watchdog/
- SDS: https://docs.datadoghq.com/security/sensitive_data_scanner/
- Pricing: https://www.datadoghq.com/pricing/ ・ https://www.datadoghq.com/pricing/list/
