---
name: observability-integration
description: SaaS の障害・エラー・予兆を目視で即座に把握できる仕組みを組み込むための知識集。New Relic / Datadog / Sentry の選定（役割分担）、Next.js/Supabase/ECS Fargate の計装パターン、アラート/ダッシュボード設計、PII 対策、公式リモート MCP サーバー経由の本番障害調査・根本原因分析を収録する。監視統合の設計・実装フェーズと本番障害対応時に observability-integration-specialist / implementation-worker らが参照する。「オブザバビリティ」「監視」「モニタリング」「Sentry」「Datadog」「New Relic」「APM」「アラート」「ダッシュボード」「障害調査」「エラー監視」で参照。
---

# Observability Integration Skill

成果物（SaaS）の障害・エラー・予兆を**目視で即座に把握できる仕組み**を組み込むための知識集。New Relic / Datadog / Sentry の3ツールを軸に、実装者（ビルド時）と運用担当者（ランタイム）の双方を支援する。

> **このSkillのゴール**：本番で何かが起きたとき、「どこで・何が・誰に・どれくらい影響しているか」を**ダッシュボードとアラートで一目で**確認でき、さらに **MCP サーバー経由で Codex から本番エラーを直接調査・根本原因分析**できる状態を作る。

## いつこのSkillを参照するか

オブザバビリティは**横断的関心事**であり、特定フェーズだけでなく SDLC 全体に薄く広く関わる。以下で必ず読む：

- **技術スタック選定（Phase 3 相当）**：監視ツールの選定とADR記録時（→ `tool-selection.md`）
- **外部設計（Phase 5 相当）**：SLO / アラート方針 / 監視対象（何を「異常」とするか）の定義時（→ `alerting-and-dashboards.md`）
- **内部設計（Phase 7 相当）**：計装ポイント（トレース・カスタムイベント・ログ構造）の設計時（→ `instrumentation-patterns.md`）
- **実装（Phase 11 相当）**：各SDKの組み込み時（→ `sentry.md` / `datadog.md` / `newrelic.md`）
- **テスト（Phase 12 相当）**：テレメトリが実際に届くかの検証時（→ `instrumentation-patterns.md` の検証節）
- **本番デプロイ前・運用開始**：ダッシュボード・アラート・MCP接続・ランブック整備（→ `alerting-and-dashboards.md` / `mcp-servers.md`）
- **障害対応時（運用フェーズ）**：MCP 経由で本番エラーを調査し根本原因分析（→ `mcp-servers.md`）
- **レビュー時**：PII漏洩・キー管理・過剰計装のチェック（→ `security-and-pii.md`）

## 重要原則（必読）

### 1. 3ツールは「競合」ではなく「役割分担」

排他選択ではない。それぞれ得意領域が異なり、**組み合わせて使う**のが基本。

| ツール | 主戦場 | 一言で |
|--------|--------|--------|
| **Sentry** | エラー・例外の深掘り + AI根本原因分析（Seer） + Session Replay | 「なぜ落ちたか」をコード行・ユーザー操作まで遡る |
| **New Relic** | フルスタック APM / Infra / Logs / Browser を**無料枠で**まとめて | 「全体の健康状態」を1名運用でも安く俯瞰 |
| **Datadog** | 大規模・マルチサービスの統合監視（Infra/APM/Log/RUM/Synthetic） | クライアントが費用負担する本格運用の決定版 |

詳細な選定ロジックは `tool-selection.md`。

### 2. 野口さん財務制約：まず無料枠で始める

民事再生中・1名運用・一括払い前提。**ランニングコストが膨らむ監視SaaSは要注意**。

> **基本方針：Tier A（Vercel + Supabase MVP）は「Sentry 無料 + New Relic 無料枠」で開始。Datadog は本番ホスト課金が積み上がるため、クライアント費用負担が確定した Tier B 案件に限定。**

- Sentry Developer プラン：永久無料（5K errors/月、1ユーザー）
- New Relic 無料枠：100GB/月取り込み + Full Platform User 1名が**永続無料**（個人運用なら実質APM/Infra/Logs全部使える）
- Datadog：無料枠は5ホスト・メトリクス保持1日と実運用に不足。ホスト課金（Infra $15 + APM $31〜/host/月）が掛け算で増える

### 3. 「目視で即確認」の正体は ①ダッシュボード ②アラート ③MCP

ユーザー（運用担当者）が求める「目視ですぐ状況確認」は具体的に3層で実現する：

1. **常設ダッシュボード**：エラー率・レイテンシ・スループット・主要KPIを1画面に集約（定常監視・俯瞰）
2. **アラート**：閾値・異常検知（AI）で「予兆」段階に Slack/メールへ能動通知（見に行かなくても気付ける）
3. **MCP サーバー**：Codex / エージェントから本番テレメトリを**自然言語で**問い合わせ、根本原因分析まで実施（調査の高速化）

`alerting-and-dashboards.md` と `mcp-servers.md` を必ずセットで読む。

### 4. PII を「取り込む前」に止める

監視ツールに保存された個人情報は**後から消せない**（New Relic/Datadog/Sentry 共通の原則）。Supabase 由来のユーザーデータがログ・スタックトレース・トレースに混入しやすい。

> **取り込み前マスキング（Sentry `beforeSend` / New Relic drop rules / Datadog Sensitive Data Scanner）を最初から設定する。** 詳細は `security-and-pii.md`。

### 5. 公開キーと秘密キーを厳格に分離

- ブラウザに出るもの（Sentry DSN、Datadog clientToken、New Relic Browser snippet）＝公開前提
- サーバー専用（Sentry `SENTRY_AUTH_TOKEN`、Datadog `DD_API_KEY`/App key、New Relic License key / User API key `NRAK-`）＝環境変数でサーバー側のみ

MCP の認証キーとアプリ計装のキーは**別物**である点に注意（特に New Relic：MCP=User key、計装=License key）。

## このSkillの構成

```
observability-integration/
├── SKILL.md                          # 本ファイル
└── references/
    ├── tool-selection.md             # 3ツールの選定ロジック（野口Profile × Tier）
    ├── sentry.md                     # Sentry 詳細（Next.js SDK・Seer・Supabase連携・料金）
    ├── newrelic.md                   # New Relic 詳細（APM・無料枠・ECS・OTel）
    ├── datadog.md                    # Datadog 詳細（Agent・RUM・APM・Watchdog・コスト注意）
    ├── mcp-servers.md                # 3ツールの公式MCPサーバー登録方法（Codex）
    ├── instrumentation-patterns.md   # Next.js/Supabase/ECS/Vercel への計装と検証
    ├── alerting-and-dashboards.md    # 「目視で即確認」のSLO・ダッシュボード・アラート設計
    └── security-and-pii.md           # PII対策・キー管理・データ最小化チェックリスト
```

## エージェント別の使い方ガイド

### tech-stack-architect

`docs/11-tech-stack/adr/NNNN-observability.md` として監視構成を記録：
- Tier A：Sentry（エラー）+ New Relic 無料枠（APM/Logs）を標準提案
- Tier B：Datadog or New Relic（クライアント費用）+ Sentry（エラー深掘り）
- 各ツールの MCP サーバーを Codex に接続するか（運用支援の有無）
- 判断根拠は `tool-selection.md` を引用

### external-designer

以下を設計（`docs/20-external-design/observability-design.md`）：
- **SLO / SLI 定義**：可用性・レイテンシ・エラー率の目標値
- **アラート方針**：何を Critical / Warning とし、どこ（Slack/メール）へ通知するか
- **ダッシュボード要件**：運用担当者が定常監視で見る画面の構成
- **監視対象一覧**：フロント（RUM/Browser）・API・DB（Supabase）・外部連携（Stripe/LINE）

### internal-designer

以下を設計（`docs/30-internal-design/` に追記）：
- 計装ポイント（どの処理にカスタムトレース/スパン/イベントを入れるか）
- 構造化ログのスキーマ（トレースIDとの相関）
- エラーバウンダリと captureException の配置
- 環境変数・初期化順序（計装は他importより先にロード）

### implementation-worker

- 各ツールの**公式ウィザード/SDK**を最新版で導入（`sentry.md` 等参照）
- 環境変数で公開/秘密キーを厳格分離、`.env.example` に網羅
- ソースマップアップロードを CI に組み込む（可読スタックトレース化）
- PII マスキングを実装時点で組み込む（後付けにしない）

### test-planner / tester / e2e-usecase-tester

- 意図的にエラーを発生させ、監視ツールに届くことを検証（Sentry の `/sentry-example-page` 等）
- アラートが発火するかをステージングで確認
- E2E でフロントエラーが RUM/Browser に記録されるか確認

### implementation-reviewer

- `security-and-pii.md` のチェックリストで PII 混入・キー漏洩・過剰計装をレビュー
- サンプリングレートが本番で適切か（コスト vs 可視性）

### observability-integration-specialist（専用エージェント）

監視統合の設計・実装・運用支援を横断的に担保。MCP 経由の本番障害調査も担当。詳細は `agents/observability-integration-specialist.md` 参照。

## 参照ファイルの読み方

| ファイル | 必読タイミング |
|---------|--------------|
| `tool-selection.md` | 監視ツール選定時（最初に読む） |
| `sentry.md` | Sentry 実装時・Seer 活用時 |
| `newrelic.md` | New Relic 実装時・無料枠運用時 |
| `datadog.md` | Datadog 実装時・コスト試算時 |
| `mcp-servers.md` | Codex へ MCP 接続時・障害調査時 |
| `instrumentation-patterns.md` | 計装設計・実装・テレメトリ検証時 |
| `alerting-and-dashboards.md` | SLO/アラート/ダッシュボード設計時 |
| `security-and-pii.md` | レビュー時・デプロイ前 |

## 野口さん固有のチェック

- [ ] Tier A 案件：Sentry 無料 + New Relic 無料枠で開始しているか（Datadog を安易に選んでいないか）
- [ ] Datadog を選ぶ場合、ランニングコストをクライアントが負担する契約になっているか
- [ ] 監視SaaSの月額が初期費用設計（立替→請求）に織り込まれているか
- [ ] MCP サーバーを Codex に接続し、1名で本番障害を即調査できる体制か
- [ ] PII マスキングが取り込み前に設定済みか（Supabase ユーザーデータの混入対策）
- [ ] 公開キー（DSN/clientToken）と秘密キー（auth token/API key/license key）が分離されているか
- [ ] アラートの通知先（野口さんの Slack / メール）が設定され、実際に届くか検証済みか

## アンチパターン（よくある失敗）

1. **Tier A MVP に Datadog をフル投入**：ホスト課金が膨らみ財務制約に反する
2. **エラー監視だけで満足**：APM/トレースがないと「遅い」原因が分からない
3. **アラートを作らない**：ダッシュボードは見に行かないと気付けない。予兆検知にならない
4. **アラート過多（アラート疲れ）**：Critical を乱発すると本物を見逃す。閾値とノイズ削減（AI異常検知）を設計
5. **PII を後からマスキング**：保存後は削除困難。取り込み前に止める
6. **ソースマップ未アップロード**：本番のスタックトレースが minify されて読めない
7. **本番100%サンプリング**：トレースを全件取るとコストが爆発。本番は10%程度＋エラーは100%
8. **MCP の User key と計装の License key を混同（New Relic）**：別物。キーの役割を取り違える
9. **計装を他importより後にロード**：APM agent が一部ライブラリを計測できない
10. **監視ツールを入れて満足し、ランブックを書かない**：アラートが鳴っても対応手順がない

## 出典・一次ソース方針

このSkillの技術情報は**公式ドキュメントを一次ソース**とする（docs.sentry.io / docs.datadoghq.com / docs.newrelic.com / 各 github）。MCP・SDK・料金は更新が速いため、実装直前に各 references の出典URLで最新を再確認すること。各 references ファイル末尾に出典URLを明記している。
