---
name: terraform-mcp
description: HashiCorp 公式の Terraform MCP サーバー（hashicorp/terraform-mcp-server）を Codex から利用し、Terraform Registry の正確なプロバイダ/モジュール仕様を参照しながら IaC を書くための知識集。Docker での起動、.codex/config.toml への登録、提供ツール（プロバイダドキュメント検索・モジュール検索・HCP Terraform/TFE 操作）、TFE_TOKEN の扱い、Tier B（AWS/ECS Fargate）案件での活用パターンを収録する。「Terraform」「IaC」「インフラコード」「プロバイダ仕様」「tfモジュール」「HCP Terraform」で参照。
---

# Terraform MCP Skill

HashiCorp 公式の **Terraform MCP サーバー**を Codex に接続し、Terraform Registry の一次情報（プロバイダのリソース/データソース仕様、モジュール）を参照しながら HCL を書くためのガイド。記憶ベースの古い引数名・非推奨リソースの混入を防ぐ。

## いつこの Skill を参照するか

- **技術スタック選定**：Tier B（AWS/ECS Fargate）判定案件で IaC 方針を決める時（tech-stack-architect）
- **内部設計**：インフラ構成（VPC/ECS/RDS/Bedrock 等）のモジュール分割を設計する時（internal-designer）
- **実装**：Terraform コードを書く・レビューする時（implementation-worker / implementation-reviewer）
- **運用**：HCP Terraform / Terraform Enterprise のワークスペース操作が必要な時

野口さんスタックでの位置づけ：Tier A（Vercel + Supabase）案件では原則不要。**Tier B / ハイブリッド案件で必須参照**（tech-stack-profile の「IaC = Terraform」に対応）。

## 1. 前提

- **Docker が起動していること**（stdio でコンテナを起動する方式。WSL2 では Docker Desktop / dockerd の起動を先に確認）
- 公開レジストリ検索だけなら**認証トークン不要**。HCP Terraform / TFE 操作をする場合のみ `TFE_TOKEN`（自己ホストなら `TFE_ADDRESS` も）が必要

```bash
docker pull hashicorp/terraform-mcp-server:latest
```

## 2. 登録

プロジェクトレベル（推奨：案件リポジトリで共有）は `.codex/config.toml` に追記：

```toml
[mcp_servers.terraform]
command = "docker"
args = ["run", "-i", "--rm", "hashicorp/terraform-mcp-server:latest"]
```

ユーザーレベルで全案件に効かせる場合：

```bash
codex mcp add terraform -- docker run -i --rm hashicorp/terraform-mcp-server:latest
```

HCP Terraform / TFE 操作も使う場合は環境変数を追加：

```toml
[mcp_servers.terraform]
command = "docker"
args = [
  "run", "-i", "--rm",
  "-e", "TFE_TOKEN",          # 値はシェル環境から引き継ぐ（config に直書きしない）
  "hashicorp/terraform-mcp-server:latest",
]
```

> トークンを `.codex/config.toml` に直書きしない（リポジトリにコミットされる）。`-e VAR` 形式でホスト環境変数を透過させるか、ユーザーレベル登録にする。

## 3. 提供ツール

| カテゴリ | できること | トークン |
|---|---|---|
| 公開レジストリ | プロバイダ（aws / google / vercel 等）のリソース・データソースのドキュメント検索/取得、モジュール検索 | 不要 |
| プライベートレジストリ | 組織のプライベートモジュール/プロバイダ参照 | TFE_TOKEN |
| Terraform 操作 | ワークスペース管理、変数設定、run（plan/apply）操作 | TFE_TOKEN |
| HCP Terraform | 組織/プロジェクト一覧、ワークスペース CRUD | TFE_TOKEN |

トランスポートは stdio が既定。リモート共有したい場合は `TRANSPORT_MODE=streamable-http` で Streamable HTTP 起動も可能。

## 4. 活用パターン（実装時の規律）

1. **書く前に引く**：リソースを書く前に必ずプロバイダドキュメントを MCP で検索し、必須引数・非推奨フィールドを確認する（記憶で書かない）
2. **バージョンを固定**：`required_providers` のバージョン制約は、MCP で確認した実在バージョンでピン留めする
3. **モジュール流用の判断**：自作前に公式/コミュニティモジュールを検索し、採用可否を ADR に残す（tech-stack-architect / internal-designer）
4. **レビュー時の照合**：implementation-reviewer は疑わしい引数・属性を MCP のドキュメント取得で照合してから指摘する

## 5. トラブルシューティング

- `Connection failed`：Docker デーモンが動いているか確認（`docker info`）。WSL2 では Docker Desktop の起動忘れが最頻出
- ツールが見えない：MCP サーバー登録後は**新しいセッション**から有効
- `401/403`：TFE_TOKEN の期限切れ・スコープ不足。公開レジストリ検索だけならトークン自体を外す
