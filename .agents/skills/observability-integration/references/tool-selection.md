# ツール選定ロジック（New Relic / Datadog / Sentry）

野口Profile（`sdlc-toolkit/references/tech-stack-profile.md`）の Tier 区分に対応づけた監視ツールの選定指針。**3ツールは役割が異なり、組み合わせて使う**のが前提。

## 結論：役割分担の地図

```
                  エラー深掘り        フルスタックAPM/Infra/Logs
                  ─────────────       ─────────────────────────
 安く始めたい  →  Sentry (無料)   +   New Relic (無料枠)
 本格運用      →  Sentry (Team)   +   Datadog or New Relic (有料)
```

- **Sentry** … エラー/例外監視の専門。Seer（AI根本原因分析）と Session Replay が強力。フロント/バックの「なぜ落ちたか」を最短で特定。**ほぼ全案件で入れる土台。**
- **New Relic** … フルスタック APM。**無料枠が破格**（100GB/月 + Full User 1名永続無料）で、1名運用の SaaS は実質無料で APM/Infra/Logs/Browser/Synthetic を回せる。Tier A/B のコスパ最強。
- **Datadog** … 最も多機能で UI/ダッシュボードが洗練。ただしホスト課金が掛け算で膨らむ。**クライアントが費用負担する Tier B 本格運用**の選択肢。

## Tier 別の標準構成

### Tier A：Vercel + Supabase 系（最速MVP / 100ユーザー未満）

| 用途 | 標準選択 | 理由 |
|------|---------|------|
| エラー監視 | **Sentry Developer（無料）** | `@sentry/nextjs` ウィザード一発、Supabase 公式連携あり、Seer で根本原因分析 |
| APM/Logs/Browser | **New Relic 無料枠**（任意） | 100GB/月無料。Vercel は `@vercel/otel`→OTLP で送信 |
| 監視SaaSの月額 | **¥0 で開始可能** | 財務制約に最適 |

> Tier A の最小構成：**Sentry だけ**でもエラー・パフォーマンス・Replay・Cron/Uptime 監視まで賄える。APM の深い分析が要るなら New Relic 無料枠を足す。

### Tier B：AWS ECS Fargate 系（エンタープライズ / コンプラ要件）

| 用途 | 標準選択 | 理由 |
|------|---------|------|
| 統合監視 | **Datadog** または **New Relic** | Infra/APM/Log/RUM/Synthetic を1プラットフォームで。ECS Fargate はサイドカー Agent 構成 |
| エラー深掘り | **Sentry Team/Business** | 統合監視ツールと併用し、例外単位の詳細・Replay・Seer を担保 |
| 費用 | **クライアント負担前提** | ホスト課金が積み上がるため契約で明示 |

**Datadog と New Relic どちらを選ぶか：**

| 判断軸 | Datadog 寄り | New Relic 寄り |
|--------|-------------|---------------|
| 予算 | クライアントが潤沢 | コストを抑えたい |
| ホスト数 | 多数・マルチサービス | 少数〜中規模 |
| UI/ダッシュボード | 最高品質を求める | 標準で十分 |
| 課金の読みやすさ | ホスト課金（増えやすい） | 取り込み量課金（100GB無料が効く） |
| AI異常検知 | Watchdog（設定不要・RCA） | Applied Intelligence / New Relic AI |

### Tier C：ハイブリッド（フロント=Vercel、バックエンド/AI=AWS）

- フロント（Vercel/Next.js）：**Sentry**（エラー+Replay）+ 必要なら RUM
- バックエンド（ECS Fargate/Bedrock）：**Datadog or New Relic**（APM/Infra/Log）
- **トレースをフロント↔バックで相関**させる（RUM↔APM 連携、OpenTelemetry の trace context 伝播）

## 選定の判断軸（順に検討）

1. **誰が費用を払うか**
   - 野口さん持ち出し / MVP → 無料枠（Sentry + New Relic）
   - クライアント負担確定 → Datadog も候補

2. **何を一番見たいか**
   - エラーの根本原因 → Sentry（Seer）
   - 全体のパフォーマンス/リソース → New Relic / Datadog（APM/Infra）
   - 実ユーザーの体感・操作再現 → Sentry Replay / Datadog RUM / New Relic Browser

3. **規模・SLA**
   - MVP/小規模 → Tier A 構成
   - 数百〜数千ユーザー・SLA あり → Tier B 構成（Synthetic 外形監視も追加）

4. **運用体制**
   - 野口さん1名 → MCP サーバー接続必須（Codex から障害調査を高速化）
   - クライアント保守 → ダッシュボード/ランブックを引き渡せる構成

5. **コンプラ**
   - データ残留・閉域要件 → ツールのリージョン（US/EU/AP）とデータ保存先を確認。New Relic は FedRAMP/HIPAA アカウントで MCP 不可等の制約あり

## なぜ「組み合わせ」が正解か

- **Sentry** はエラー単位の文脈（スタックトレース・ブレッドクラム・Replay）が圧倒的だが、インフラ全体のメトリクスやログ集約は守備範囲外。
- **New Relic / Datadog** は全体の健康状態（APM/Infra/Log）を俯瞰できるが、個々の例外をコード行・ユーザー操作まで遡る体験は Sentry に一日の長。
- 両者を入れると、**「全体ダッシュボードで異変に気付く → Sentry で該当エラーの根本原因を特定」**という障害対応の理想フローが完成する。
- コストは「Sentry 無料 + New Relic 無料枠」で **Tier A は実質ゼロ円**から始められるので、組み合わせのデメリットが小さい。

## ADR 記録テンプレート

`docs/11-tech-stack/adr/NNNN-observability.md`：

```markdown
# ADR-NNNN: オブザバビリティ構成

## Status
Accepted

## Context
本番障害・エラー・予兆を運用担当者（野口さん1名）が即座に把握し、
Codex から調査できる監視体制が必要。財務制約により初期はランニングコストを最小化したい。

## Decision
- エラー監視：Sentry Developer（無料）+ Supabase 連携 + Seer
- APM/Logs：New Relic 無料枠（100GB/月、Full User 1名）  ※採用案件のみ
- （Tier B の場合）統合監視：Datadog（クライアント費用負担）
- Codex に各ツールの公式 MCP サーバーを接続し障害調査を高速化
- PII は取り込み前マスキング、公開/秘密キー分離

## Considered Alternatives
- Datadog のみ：高機能だがホスト課金が財務制約に不適（Tier A では却下）
- 自前 OSS（Grafana/Prometheus/Loki）：運用工数が1名体制に過大
- CloudWatch のみ：AWS 内に閉じるが、フロント/UX/エラー深掘りが弱い

## Consequences
- ポジティブ：無料枠で開始でき、MCP で1名でも調査が速い
- ネガティブ：複数ツール併用で初期設定の手間
- リスク：無料枠の取り込み上限超過（drop rules で管理）、Datadog 採用時のコスト膨張

## References
- .agents/skills/observability-integration/references/tool-selection.md
- 各ツール公式 pricing（実装直前に再確認）
```

## 出典（実装直前に再確認）

- Sentry pricing: https://sentry.io/pricing/
- New Relic free tier: https://newrelic.com/pricing/free-tier
- Datadog pricing: https://www.datadoghq.com/pricing/
- 野口Profile: `.agents/skills/sdlc-toolkit/references/tech-stack-profile.md`
