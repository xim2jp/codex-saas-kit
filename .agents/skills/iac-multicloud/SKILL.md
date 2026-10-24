---
name: iac-multicloud
description: AWS / GCP / Azure 対応の Infrastructure as Code 知識集。Terraform / OpenTofu を第一選択に、ECS Fargate・Cloud Run・Container Apps の実装パターン、State 管理、環境分離、モジュール設計、Terraform MCP による最新スキーマ参照、tfsec/Checkov/Trivy、コスト見積り、ドリフト検出、plan→承認→apply の CI 連携を収録する。Tier A は IaC 最小、Tier B/C で本格運用。技術選定・インフラ設計・infra/ 実装・監査・運用時に参照する。「IaC」「Terraform」「OpenTofu」「インフラコード」「Bicep」「ECS」「Cloud Run」「Container Apps」「マルチクラウド」「tfstate」で参照。
---

# IaC Multicloud Skill

AWS / GCP / Azure を横断する Infrastructure as Code の標準。**手作業のコンソール操作で作ったインフラは再現も監査もレビューもできない**——IaC はインフラを SDLC のレビュー・修正ループ（L1）に乗せるための前提である。

## ツール選定（野口Profile）

| 状況 | 第一選択 | 理由 |
|------|---------|------|
| **Tier A（Vercel + Supabase）** | **IaC ほぼ不要** | Vercel/Supabase はダッシュボード＋設定ファイル（vercel.json / supabase/config.toml）が実質のIaC。無理に Terraform 化しない（過剰品質） |
| **Tier B（AWS）** | **Terraform**（または OpenTofu） | 業界標準・情報量・Terraform MCP サーバーで最新参照可。ECS Fargate + RDS/Aurora + CloudFront 構成 |
| **GCP 案件** | Terraform | Cloud Run + Cloud SQL + Load Balancer。google プロバイダ |
| **Azure 案件** | Terraform | Container Apps + Azure Database + Front Door。azurerm プロバイダ。クライアントが Microsoft 系縛りの場合 |
| クラウド純正が指定された場合 | AWS: CDK(TypeScript) / GCP: Terraform / Azure: Bicep | クライアント標準に従う。ただし提案時は Terraform で統一を推奨（1名で3クラウドの純正DSLを維持しない） |

**原則：マルチクラウドの知識は Terraform に一本化して蓄積する**（HCL 1言語で3クラウド。案件間でモジュール・レビュー観点・CI が再利用できる）。OpenTofu は Terraform 互換の OSS フォーク——ライセンス懸念がある案件のみ選択。

## Terraform MCP サーバーの活用（必須）

**Terraform コードを書く前に必ず Terraform MCP サーバーで最新情報を引く**（学習時点の古いプロバイダ仕様で書かない）：

- `get_latest_provider_version` → `get_provider_capabilities` → `get_provider_details`：リソース定義の正確なスキーマ
- `search_modules` → `get_module_details`：公式/実績モジュールの再利用（自作より公式 module を優先）
- 登録：`.codex/config.toml` の `[mcp_servers.terraform]`（本フレームワークでは接続済み。詳細は external-tools-catalog Skill）

## 標準ディレクトリ構成

```
infra/
├── modules/                  # 再利用モジュール（案件間でコピー流用）
│   ├── network/              # VPC/サブネット（GCP: VPC、Azure: VNet）
│   ├── app/                  # ECS Fargate / Cloud Run / Container Apps
│   ├── db/                   # RDS / Cloud SQL / Azure Database
│   └── observability/        # アラート・ダッシュボード
├── envs/
│   ├── dev/                  # 環境ごとにディレクトリ分離（workspace 分離より事故が少ない）
│   │   ├── main.tf           # modules を組み合わせる
│   │   ├── backend.tf        # State バックエンド
│   │   └── terraform.tfvars
│   ├── stg/
│   └── prod/
└── README.md                 # 初期化手順・apply 権限・破壊防止の注意
```

## State 管理（最重要・事故ポイント）

| クラウド | バックエンド | ロック |
|---------|------------|--------|
| AWS | S3（バージョニング必須）| S3 lockfile（Terraform 1.10+。旧構成は DynamoDB） |
| GCP | GCS（バージョニング必須） | GCS 組み込み |
| Azure | Azure Blob Storage | Blob リース組み込み |

- **State はローカル・Git に置かない**（シークレットが平文で入る。.gitignore に `*.tfstate*` 必須）
- 環境ごとに State を分離（prod の plan で dev が壊れない）
- `prevent_destroy = true` を DB・ストレージに必ず付与

## 環境分離とシークレット

- 環境差分は `terraform.tfvars` のみに集約（tf ファイル内の分岐は最小化）
- シークレットは tfvars に平文で書かず、SSM Parameter Store / Secret Manager / Key Vault を参照。CI では OIDC 連携（長期キーを CI に置かない。AWS: GitHub OIDC ロール、GCP: Workload Identity、Azure: Federated Credentials）

## セキュリティ・品質ゲート（CI 組み込み。cicd-pipeline Skill と連携）

```
terraform fmt -check → terraform validate → tfsec（または Trivy）→ Checkov → terraform plan
```

- **plan は PR コメントに出力し、人間（野口さん）承認後にのみ apply**（自動 apply は dev のみ許可）
- tfsec/Checkov の Critical は Block（security-auditor のレビュー対象に含める）
- 定期ドリフト検出：週次で `terraform plan -detailed-exitcode` を CI 実行し、差分があれば通知（コンソール手作業の混入検知）

## コスト（cost-guardian 連携）

- plan 時に Infracost で概算をPRコメント化（無料枠内が原則の野口Profileでは、月額増分が見える状態で承認する）
- 環境の夜間停止（dev の RDS 停止スケジュール等）をモジュール標準に含める

## SDLC への組み込み

| フェーズ | 作業 |
|---------|------|
| Phase 7（技術選定） | tech-stack-architect が IaC 要否・ツールを ADR 化（Tier A は「IaC 不要」も明示的に記録） |
| Phase 11（内部設計） | internal-designer が `docs/30-internal-design/infra-design.md`（構成図 Mermaid＋モジュール分割）を作成 |
| Phase 15（実装） | implementation-worker が `infra/` を実装。**タスク0のローカル環境とは別物**（ローカルは Docker、infra/ はクラウド） |
| Phase 18 並列 | security-auditor が tfsec/Checkov 結果と State 管理・シークレット参照方式を監査 |
| Phase 20（運用） | ドリフト検出結果と実コストを ops-review に反映 |

## アンチパターン

- コンソール手作業で作って「あとで Terraform 化する」（ドリフトの温床。最初から IaC か、Tier A なら潔くマネージド設定ファイルに寄せる）
- State を Git にコミット（シークレット漏洩・チーム破壊。発見したら即 履歴からも除去）
- 1つの State に全環境を同居（prod 事故の典型）
- prod への自動 apply（plan 承認ゲートを必ず挟む）
- 3クラウドそれぞれの純正 DSL（CDK/Bicep/DM）を並行維持（1名運用では Terraform 一本化）
- MCP を引かずに記憶でプロバイダ定義を書く（属性の廃止・改名が頻繁。validate は通っても挙動が古い）
