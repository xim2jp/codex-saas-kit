---
name: observability-integration
description: SaaS の障害・エラー・予兆を目視で即座に把握できる仕組みを組み込むための知識集。New Relic / Datadog / Sentry の役割分担と選定、Next.js / Supabase / ECS Fargate の計装パターン、SLO・アラート・ダッシュボード設計、PII 対策とキー管理、公式リモート MCP サーバー経由の本番障害調査・根本原因分析を収録する。監視ツールの選定・設計・実装・テレメトリ検証・レビューと本番障害対応時に参照する。「オブザバビリティ」「監視」「モニタリング」「Sentry」「Datadog」「New Relic」「APM」「アラート」「ダッシュボード」「障害調査」「エラー監視」で参照。
---

# Observability Integration Skill

成果物（SaaS）の障害・エラー・予兆を**目視で即座に把握できる仕組み**を組み込むための知識集。New Relic / Datadog / Sentry の3ツールを軸に、実装者（ビルド時）と運用担当者（ランタイム）の双方を支援する。

> **このSkillのゴール**：本番で何かが起きたとき、「どこで・何が・誰に・どれくらい影響しているか」を**ダッシュボードとアラートで一目で**確認でき、さらに **MCP サーバー経由で Codex から本番エラーを直接調査・根本原因分析**できる状態を作る。

オブザバビリティは**横断的関心事**であり、技術選定から運用・障害対応まで SDLC 全体に薄く広く関わる。

## 重要原則

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

## 参照ファイル

| ファイル | 内容 | いつ読むか |
|---------|------|-----------|
| `references/tool-selection.md` | 3ツールの選定ロジック（野口Profile × Tier） | 監視ツール選定・ADR 記録時（最初に読む） |
| `references/sentry.md` | Next.js SDK・Seer・Supabase 連携・料金 | Sentry 実装時・Seer 活用時 |
| `references/newrelic.md` | APM・無料枠・ECS・OTel | New Relic 実装時・無料枠運用時 |
| `references/datadog.md` | Agent・RUM・APM・Watchdog・コスト注意 | Datadog 実装時・コスト試算時 |
| `references/mcp-servers.md` | 3ツールの公式 MCP サーバー登録方法（Codex） | MCP 接続時・本番障害調査時 |
| `references/instrumentation-patterns.md` | Next.js / Supabase / ECS / Vercel への計装と検証 | 計装設計・実装時、テレメトリ到達の検証時 |
| `references/alerting-and-dashboards.md` | 「目視で即確認」の SLO・ダッシュボード・アラート設計 | SLO / アラート方針の定義時、運用開始前 |
| `references/security-and-pii.md` | PII 対策・キー管理・データ最小化チェックリスト | レビュー時・デプロイ前 |

## フェーズ別の設計観点

- **技術選定**（`docs/11-tech-stack/adr/NNNN-observability.md`）：Tier A は Sentry（エラー）+ New Relic 無料枠（APM/Logs）を標準提案。Tier B は Datadog または New Relic（クライアント費用）+ Sentry（エラー深掘り）。各ツールの MCP サーバーを Codex に接続するか（運用支援の有無）も決める。根拠は `tool-selection.md` を引用する
- **外部設計**（`docs/20-external-design/observability-design.md`）：SLO / SLI（可用性・レイテンシ・エラー率の目標値）、アラート方針（何を Critical / Warning とし、Slack / メールのどこへ通知するか）、定常監視ダッシュボードの構成、監視対象一覧（フロント RUM/Browser・API・DB（Supabase）・外部連携（Stripe/LINE））
- **内部設計**（`docs/30-internal-design/` に追記）：計装ポイント（カスタムトレース／スパン／イベントを入れる処理）、トレース ID と相関する構造化ログのスキーマ、エラーバウンダリと captureException の配置、環境変数と初期化順序（計装は他 import より先にロード）
- **実装**：各ツールの公式ウィザード / SDK を最新版で導入する。公開／秘密キーを環境変数で分離し `.env.example` に網羅する。ソースマップアップロードを CI に組み込む。PII マスキングを実装時点で入れる（後付けにしない）
- **テスト**：意図的にエラーを発生させて監視ツールに届くことを確認する（Sentry の `/sentry-example-page` 等）。ステージングでアラートが発火するか、E2E でフロントエラーが RUM/Browser に記録されるかを確かめる
- **レビュー**：`security-and-pii.md` で PII 混入・キー漏洩・過剰計装を確認し、本番のサンプリングレートがコストと可視性の釣り合いに合っているかを見る
- **障害対応**：MCP 経由で本番エラーを調査し根本原因分析まで行う（`mcp-servers.md`）

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
