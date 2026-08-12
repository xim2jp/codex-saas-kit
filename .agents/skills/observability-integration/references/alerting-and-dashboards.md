# 「目視で即確認」の設計（SLO・ダッシュボード・アラート・ランブック）

ユーザー（運用担当者）が求める「障害・予兆・エラーを**目視ですぐ状況確認**できる仕組み」を具体化する。3層 ①ダッシュボード ②アラート ③ランブック で構成し、MCP（→ `mcp-servers.md`）を調査の入口に据える。

## 0. まず SLO/SLI を決める（何を「異常」とするか）

監視は「正常の定義」がないと作れない。最低限これだけ決める：

| SLI（指標） | SLO（目標）例 | データ源 |
|------------|--------------|---------|
| 可用性 | 月次 99.5% 以上 | Synthetic / Uptime |
| エラー率 | 5xx が全リクエストの 1% 未満 | APM |
| レイテンシ | API p95 < 800ms | APM |
| フロント体感 | LCP < 2.5s（Good） | RUM/Browser |
| 重要ジョブ | Cron 実行成功率 100% | Cron Monitoring |

- `docs/20-external-design/observability-design.md` に記録。
- SLO を**アラート閾値の根拠**にする（恣意的な閾値を避ける）。

## 1. ダッシュボード（定常監視・俯瞰）

運用担当者が「毎朝1枚見れば状況が分かる」画面を作る。

### 標準ダッシュボード構成（1画面）

```
┌──────────────────────────────────────────────┐
│ [可用性] 99.8%   [エラー率] 0.3%   [p95] 540ms │  ← 上段：SLO サマリ（赤緑で即判断）
├──────────────────────────────────────────────┤
│ エラー件数（時系列）    │ レイテンシ p50/p95/p99 │  ← 中段：トレンド
├──────────────────────────────────────────────┤
│ 上位エラー Top5        │ 遅いエンドポイント Top5 │  ← 下段：ドリルダウン入口
├──────────────────────────────────────────────┤
│ インフラ CPU/メモリ     │ 外部連携（Stripe/LINE） │  ← 依存先の健康
└──────────────────────────────────────────────┘
```

### 設計原則

- **赤緑で即判断**：数値の羅列でなく、SLO 違反を色で。
- **少数精鋭**：1画面に詰め込みすぎない。詳細はドリルダウン。
- **env 分離**：本番ダッシュボードに staging を混ぜない。
- **ビジネス指標も**：サインアップ数・決済成功率など、技術指標と並べると「障害がビジネスに効いているか」が分かる。
- 各ツールに OOTB（標準）ダッシュボードがあるので、まずそれを土台にカスタムを足す。

## 2. アラート（予兆・障害を能動通知）

ダッシュボードは「見に行かないと気付けない」。**アラートが予兆検知の本体。**

### アラートの段階設計

| 段階 | 条件例 | 通知先 | 対応 |
|------|--------|--------|------|
| **Warning（予兆）** | エラー率が平常の2倍 / p95 が SLO の80%に接近 / リソース70% | Slack（情報） | 様子見・調査 |
| **Critical（障害）** | 5xx 急増 / 可用性 SLO 違反 / Cron 失敗 / 決済 Webhook 連続失敗 | Slack（メンション）+ メール | 即対応 |

### AI 異常検知を活用（閾値だけに頼らない）

固定閾値は「いつもと違う」を捉えにくい。各ツールの AI 異常検知を併用：

- **Datadog Watchdog**：設定不要で APM/Infra/Log の異常を自動検出、RCA まで。
- **New Relic Applied Intelligence / New Relic AI**：異常検知・インシデント相関・ノイズ低減。
- **Sentry**：新規 Issue・spike 検知でアラート。

### アラート疲れを防ぐ（重要）

Critical を乱発すると本物を見逃す。

- Critical は「**今すぐ人間が動くべきもの**」だけに絞る。
- 重複アラートはグルーピング/相関で1本化（AI 機能）。
- ノイズの多いアラートは閾値を見直すか Warning に降格。
- 夜間/休日の通知ポリシーを決める（1名運用：Critical のみ即時、Warning は翌営業）。

### 通知先（野口さん運用）

- **Slack** を主、**メール**を副。
- アラート作成後、**必ずステージングで実際に届くか検証**（→ `instrumentation-patterns.md` 検証節）。届かないアラートは無いのと同じ。

## 3. ランブック（鳴った後どうするか）

アラートだけ作って対応手順がないと、鳴っても動けない。主要アラートごとに最小限のランブックを `docs/operations/runbooks/` に：

```markdown
# ランブック：決済 Webhook 連続失敗

## 検知
Sentry/APM で Stripe Webhook ハンドラのエラー率が5分で5件超

## 一次対応
1. Codex に「Sentry で stripe webhook の直近エラーを要約」（MCP）
2. 署名検証エラーか、DB 書き込みエラーか切り分け
3. Stripe Dashboard で Webhook の再送状況を確認

## 復旧
- 署名検証エラー → STRIPE_WEBHOOK_SECRET の env を確認
- DB エラー → Supabase の状態確認、リトライ

## エスカレーション
- 30分で復旧しない場合：（連絡先）
```

- ランブックは MCP 調査の手順を組み込む（1名運用の時短）。
- `stripe-integration` / `auth-integration` の障害は各 Skill のチェックリストと連携。

## 4. 運用開始チェックリスト

- [ ] SLO/SLI を定義し observability-design.md に記録
- [ ] 1画面の標準ダッシュボード（SLO サマリ + トレンド + Top5 + 依存先）
- [ ] Warning / Critical の2段階アラート
- [ ] AI 異常検知（Watchdog / Applied Intelligence / spike）を有効化
- [ ] アラートの通知先（Slack/メール）を設定し**実際に届くか検証済み**
- [ ] アラート疲れ対策（Critical を絞る、グルーピング）
- [ ] 主要アラートにランブック（MCP 調査手順込み）
- [ ] Codex に MCP サーバー接続（障害調査の入口）

## 出典（一次ソース）

- Datadog Watchdog: https://www.datadoghq.com/product/platform/watchdog/
- Datadog Monitors: https://docs.datadoghq.com/monitors/
- New Relic Alerts/AI: https://docs.newrelic.com/docs/alerts/
- Sentry Alerts: https://docs.sentry.io/product/alerts/
- Google SRE（SLO/エラーバジェットの考え方）: https://sre.google/sre-book/service-level-objectives/
