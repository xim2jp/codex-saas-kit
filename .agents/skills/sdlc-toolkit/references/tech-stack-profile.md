# 技術スタックプロファイル（野口Profile）

野口さんの実案件で使われているスタック群。設計エージェントは技術選定時にこれを優先的に検討する。**ただし「常にこれを推す」のではなく、要件にフィットする場合に提案する**こと。

## デフォルト・スタック（軽量SaaS / MVP / PoC）

### Tier A：Vercel + Supabase 系（最速MVP）

| レイヤー | 標準選択 | 採用条件 |
|---------|---------|---------|
| フレームワーク | Next.js 15 (App Router) | フロント＋APIを一体で扱う案件 |
| ホスティング | Vercel | インフラ管理を排したい場合 |
| DB / 認証 | Supabase (PostgreSQL + Auth + Realtime) | RLSでマルチテナント分離する場合 |
| AI | Claude API (claude-sonnet-4) | LLM活用の中核 |
| 通知 | LINE Messaging API / メール | スタッフ層がLINE中心の場合 |
| 決済 | Stripe | SaaS課金 |

**適用例**：菓子店シフト管理、町会向けツール、軽量業務SaaS

### Tier B：AWS フルマネージド系（エンタープライズ／コンプラ要件）

| レイヤー | 標準選択 | 採用条件 |
|---------|---------|---------|
| コンテナ | ECS Fargate | 常駐サービス・マイクロサービス構成 |
| DB | RDS (PostgreSQL/MySQL) | 既存システム連携・大規模データ |
| AI | Amazon Bedrock (Claude Sonnet 4.6) | データ残留要件・閉域接続要件 |
| RAG | Dify (App Runnerでセルフホスト) | RAG基盤を素早く立ち上げる場合 |
| IaC | Terraform | 再現性・コードレビュー対象化 |
| CI/CD | GitHub Actions（self-hosted runner含む） | 大規模並列処理対応 |
| 監視 | CloudWatch + Prowler / Checkov | セキュリティレビュー自動化 |

**適用例**：医療・不動産・製造業のDX、AIエージェント基盤、インシデント対応自動化

### Tier C：ハイブリッド（最も多い実案件パターン）

- フロント＝Vercel + Next.js
- バックエンド／AI処理＝AWS（Bedrock or ECS Fargate）
- DB＝Supabase または RDS
- 認証＝Supabase Auth または Cognito

## 技術選定の判断軸

以下を順に検討して Tier を決定：

1. **データ機密度・コンプライアンス要件**
   - 個人情報・医療・金融など強い規制 → Tier B
   - 一般業務 → Tier A から検討

2. **想定規模**
   - MVP / 100ユーザー未満 → Tier A
   - 数百〜数千ユーザー / SLA要件あり → Tier B または C

3. **既存システム連携**
   - 既存AWSアセットあり → Tier B/C
   - 新規ゼロからスタート → Tier A

4. **運用保守体制**
   - 野口さん1名体制 → Tier A 優先（運用工数最小）
   - クライアント側で保守 → Tier B（コードと構成を引き渡せる）

5. **予算**
   - MVP段階：Vercel Hobby + Supabase Free で実質無償
   - 本番：月額課金構造で見積もる

## アンチパターン（過去案件で得た教訓）

- **AWS Lambdaの長時間処理**：15分制限を超える可能性のある処理は最初からFargateで設計
- **Supabaseの大規模OLAP**：分析ワークロードは Supabase 上で完結させず、別途BigQuery等へ
- **Difyのバージョン固定**：自己ホスト時は version pin 必須。upgrade で破壊的変更あり
- **Bedrockのリージョン依存**：Claude モデルの提供リージョンを事前確認。us-east-1 / us-west-2 が無難
- **LINE Messaging APIの月次無料枠**：1,000通/月の壁。本番運用では Premium 必須

## 財務・契約面の制約（野口さん固有）

- 一括払い前提（借入・分割不可）
- ランニング費用は野口さんが立替→請求の場合あり、初期費用設計を慎重に
- IT導入補助金活用案件は補助金スケジュールに合わせた検収マイルストーン設計

## 選定時に必ず記録するADR項目

技術選定時は `docs/11-tech-stack/adr/NNNN-title.md` に以下を残す：

```markdown
# ADR-NNNN: <選定対象>

## Status
Proposed / Accepted / Deprecated / Superseded by ADR-XXXX

## Context
（なぜこの選定が必要になったか）

## Decision
（採用した技術と構成）

## Considered Alternatives
（検討した他の選択肢と却下理由）

## Consequences
- ポジティブ：
- ネガティブ：
- リスク：

## References
- 公式ドキュメント、ベンチマーク、過去案件
```
