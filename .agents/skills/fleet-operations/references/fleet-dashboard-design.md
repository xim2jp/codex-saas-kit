# 艦隊横串ダッシュボード設計（稼働・エラー・MRR・解約の一元把握）

複数の SaaS を運用する野口さんが「今、全体としてどうなっているか」を**1画面**で把握するための横串ダッシュボードの設計。個別 SaaS の詳細監視は `observability-integration` に委ね、本ダッシュボードは**ポートフォリオ視点の要約**に徹する。

## 0. 位置づけ：どこに実装するか

これは**極めて重要な前提**である。

> **横串ダッシュボードは「各SaaS案件」のリポジトリではなく、「フレームワーク運用者（野口さん）」専用の管理ツールとして持つ。**

- 実装場所：案件とは独立した野口さん個人の管理用リポジトリ（例：`noguchi-fleet-console` のような専用プロジェクト）
- 理由1：案件を第三者に譲渡・売却する際、他案件の情報が混入していると支障が出る
- 理由2：各案件のクレデンシャルを一元管理するツールが案件コードに同居するのはセキュリティ上望ましくない
- 理由3：案件が増えるたびに全案件のコードへ手を入れる必要が出ると、運用コストが線形に増える

各SaaS側が持つのは、このダッシュボードが**読み取りに来るための最小限のAPI/メトリクス公開**のみ（後述）。

## 1. 表示すべき指標

各SaaSごとに以下を1行（カード）で表示する。

| 指標 | 内容 | データ源 |
|------|------|---------|
| 稼働状態 | UP / DEGRADED / DOWN | Vercel Deployment Status API、または自前ヘルスチェック |
| 直近エラー数 | 過去24hのエラー件数（5xx・例外） | Sentry API / New Relic API |
| MRR | 月次経常収益（当月・前月比） | Stripe API（Subscriptions集計）または cost-guardian の算定結果 |
| Churn | 当月解約率（解約数/月初契約数） | Stripe API（`customer.subscription.deleted`集計） |
| 直近デプロイ | 最終デプロイ日時・ステータス | Vercel API |

### 全体サマリ（艦隊全体のロールアップ）

- 総MRR（全SaaS合算）
- 稼働中SaaS数 / 障害中SaaS数
- 今月の新規解約合計
- コスト超過アラートの有無（cost-guardian 連携）

## 2. 画面レイアウト（概念）

```
┌────────────────────────────────────────────────────────┐
│  艦隊サマリ：総MRR ¥XXX,XXX（前月比+X%） 稼働 5/6 SaaS   │
├────────────────────────────────────────────────────────┤
│ SaaS-A  [UP]   err:2   MRR:¥80,000  Churn:1.2%  deploy:6/30│
│ SaaS-B  [UP]   err:0   MRR:¥45,000  Churn:0.0%  deploy:6/28│
│ SaaS-C  [DOWN] err:47  MRR:¥12,000  Churn:3.5%  deploy:6/15│ ← 赤で強調
│ SaaS-D  [UP]   err:1   MRR:¥5,000   Churn:0.0%  deploy:7/01│
├────────────────────────────────────────────────────────┤
│ MRR推移（全SaaS積み上げ棒グラフ・直近12ヶ月）              │
└────────────────────────────────────────────────────────┘
```

- **赤緑で即判断**：`observability-integration` の単一SaaSダッシュボードと同じ原則を踏襲。DOWNやChurn急増は赤で目立たせる。
- **ドリルダウンはリンクで**：詳細を見たい時はSaaS個別のSentry/Stripeダッシュボードへのディープリンクを貼るに留め、横串側では複雑な詳細分析をしない（それは `observability-integration` の役割）。

## 3. データ集約アーキテクチャ

### 3.1 全体構成

```
[SaaS-A: Sentry/Stripe/Vercel] ─┐
[SaaS-B: Sentry/Stripe/Vercel] ─┼─→ Vercel Cron（定期取得） → Supabase（集約テーブル） → 軽量Next.jsダッシュボード
[SaaS-C: Sentry/Stripe/Vercel] ─┘
```

- **集約先**：野口さん専用の軽量 Next.js アプリ（Tier A同様 Vercel + Supabase）
- **取得トリガー**：Vercel Cron Jobs で15分〜1時間おきに各SaaSのAPIをポーリングし、Supabaseに書き込む
- **表示**：ダッシュボードアプリは Supabase の集約テーブルを読むだけ（各SaaSのAPIに毎回直接アクセスしない＝レート制限回避・表示高速化）

### 3.2 集約テーブル設計（概念）

```
fleet_projects
  id, name, vercel_project_id, sentry_project_slug, stripe_account_id, sla_flag, created_at

fleet_metrics_snapshot
  id, project_id (FK), captured_at,
  status (up/degraded/down),
  error_count_24h,
  mrr_cents, churn_rate,
  last_deploy_at, last_deploy_status
```

- `fleet_metrics_snapshot` は Cron 実行のたびに1行追記するか、最新値のみ upsert する（容量が気になる場合は upsert + 別途日次アーカイブ）
- Supabase Free の容量制限（500MB）内で十分収まる規模（案件数が少数〜十数件想定のため）

### 3.3 各SaaS側で必要な最小限の準備

各SaaS案件は、横串ダッシュボードから叩かれる前提で以下を用意するだけでよい（実装は案件側の`implementation-worker`が対応、詳細監視は`observability-integration`が担当）：

- Sentry：プロジェクトごとの Auth Token（読み取り専用スコープ）を野口さん管理の集約Cronから利用できるよう発行
- Stripe：各案件のAPIキー（制限付き・読み取り専用）を集約Cronの環境変数に登録
- Vercel：野口さんの個人アカウント配下にあるプロジェクトなら Vercel API Token 1本で全プロジェクトを横断参照可能

## 4. 各API呼び出しの概念コード

以下は**概念コード**であり、実装コードそのものではない。実際の実装時はSDK公式ドキュメントを参照する。

### 4.1 Sentry（直近エラー数取得）

```
GET https://sentry.io/api/0/projects/{org_slug}/{project_slug}/issues/
  ?statsPeriod=24h&query=is:unresolved
Header: Authorization: Bearer <SENTRY_AUTH_TOKEN>

# 概念コード
sentryRes = fetch(sentryIssuesUrl, { headers: { Authorization: `Bearer ${token}` }})
errorCount24h = sentryRes.json().length  // または count() 集計エンドポイントを利用
```

### 4.2 Stripe（MRR・Churn集計）

```
GET https://api.stripe.com/v1/subscriptions?status=active&limit=100
Header: Authorization: Bearer <STRIPE_SECRET_KEY>

# 概念コード（簡略化）
activeSubscriptions = stripe.subscriptions.list({ status: "active" })
mrr = sum(sub.items.map(item => item.price.unit_amount * item.quantity) for active subscriptions, 月額換算)

canceledThisMonth = stripe.subscriptions.list({ status: "canceled", canceled_at: { gte: startOfMonth } })
churnRate = canceledThisMonth.length / activeSubscriptionsAtMonthStart.length
```

> MRR/Churn の正確な算定は税・按分・年間契約の月割りなど考慮点が多いため、**厳密な財務数値は cost-guardian の算定結果を正とし、本ダッシュボードは概算の速報値として扱う**のが望ましい。

### 4.3 New Relic（APM/稼働状態、Sentryを補完する場合）

```
POST https://api.newrelic.com/graphql
Header: API-Key: <NEW_RELIC_USER_KEY>
Body: NRQL query (NerdGraph経由)
  { actor { account(id: ACCOUNT_ID) { nrql(query: "SELECT count(*) FROM TransactionError SINCE 1 day ago") { results } } } }

# 概念コード
nerdGraphRes = fetch("https://api.newrelic.com/graphql", { method: "POST", headers: {...}, body: nrqlQuery })
```

### 4.4 Vercel（デプロイ状態）

```
GET https://api.vercel.com/v6/deployments?projectId={id}&limit=1
Header: Authorization: Bearer <VERCEL_API_TOKEN>

# 概念コード
latestDeploy = fetch(vercelDeploymentsUrl, { headers: { Authorization: `Bearer ${token}` }}).json().deployments[0]
lastDeployAt = latestDeploy.createdAt
lastDeployStatus = latestDeploy.state  // READY / ERROR / BUILDING
```

### 4.5 Vercel Cron による定期集約（概念）

```
# vercel.json の cron 設定イメージ
{
  "crons": [
    { "path": "/api/cron/collect-fleet-metrics", "schedule": "0 * * * *" }
  ]
}

# /api/cron/collect-fleet-metrics の処理概念
for project in fleetProjects:
    status   = checkVercelStatus(project)
    errors   = fetchSentryErrorCount(project)
    mrr      = fetchStripeMrr(project)
    churn    = fetchStripeChurn(project)
    deploy   = fetchVercelLastDeploy(project)
    supabase.from("fleet_metrics_snapshot").insert({...})
```

## 5. 無料枠での実現方法

野口さんの財務制約（一括払いのみ・ランニングコスト最小化）を踏まえ、以下の構成で**追加コストゼロ**を目指す。

| コンポーネント | 使用サービス | 無料枠での可否 |
|--------------|-------------|--------------|
| ダッシュボードアプリのホスティング | Vercel Hobby | 個人利用の範囲なら無料で十分 |
| 集約データの保存 | Supabase Free（500MB, 2プロジェクトまで等の制限に注意） | 案件数が少数〜十数件なら十分収まる |
| 定期取得のスケジューラ | Vercel Cron Jobs（Hobbyプランは1日1回等の制限あり点に注意） | Hobbyの実行頻度制限を確認し、必要なら1日数回に間引く |
| Sentry読み取り | 各案件のSentry無料枠APIをそのまま利用 | 追加コストなし（読み取りAPIは課金対象外が通常） |
| Stripe読み取り | 各案件のStripe APIをそのまま利用 | API呼び出し自体は無料 |

> **注意（Hobbyプランの制約）**：Vercel Hobby の Cron Jobs は実行頻度に制限があるため、リアルタイム性より「1日数回の定期スナップショットで十分」という運用に割り切る。艦隊運用は秒単位の即時性より、日次〜時間単位の俯瞰が目的であるため実用上問題ない。

## 6. 通知（能動的な気付き）

ダッシュボードは「見に行かないと気付けない」という `observability-integration` と同じ弱点を持つ。

- 週次 or 日次で Slack に艦隊サマリを自動投稿する仕組みを Cron に組み込む（総MRR・DOWN中のSaaS・Churn急増案件）
- Critical（いずれかのSaaSが DOWN、または Churn が閾値超過）は即時 Slack 通知
- 詳細な通知段階設計・対応フローは `multi-project-runbook.md` を参照

## 7. 案件追加時のチェックリスト

- [ ] `fleet_projects` テーブルに新SaaSのメタデータ（Vercel/Sentry/Stripe識別子、SLA有無）を追加
- [ ] 新SaaSのAPIキー（Sentry読み取り専用トークン、Stripe制限付きキー）を集約Cronの環境変数に追加
- [ ] Cron実行後、`fleet_metrics_snapshot` に新SaaSの行が現れることを確認
- [ ] ダッシュボードUIに新SaaSのカードが表示されることを確認
- [ ] Supabase Free の容量・Vercel Hobbyの実行回数上限に近づいていないか確認（艦隊拡大の都度）

## 出典（一次ソース、実装直前に再確認）

- Sentry API（Issues）: https://docs.sentry.io/api/events/list-a-projects-issues/
- Sentry Auth Tokens: https://docs.sentry.io/api/auth/
- Stripe API（Subscriptions）: https://stripe.com/docs/api/subscriptions
- Stripe API（billing/MRR算出の考え方）: https://stripe.com/docs/billing/subscriptions/metrics
- New Relic NerdGraph（GraphQL API）: https://docs.newrelic.com/docs/apis/nerdgraph/get-started/introduction-new-relic-nerdgraph/
- Vercel REST API（Deployments）: https://vercel.com/docs/rest-api/reference/endpoints/deployments
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
- Supabase Free プランの制限: https://supabase.com/pricing
