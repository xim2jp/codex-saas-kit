---
name: mcp-server-development
description: SaaS をブラウザUIだけでなく MCP サーバーとして AI エージェントに提供するための知識集。Streamable HTTP / Next.js Route Handler でのホスティング、OAuth 2.1 認可と Supabase Auth ブリッジ、テナント分離、LLM が使いこなせるツール/リソース設計、Stripe Billing Meters による従量課金、MCP Inspector でのテスト、レジストリ登録・発見性までを収録する。技術スタック選定・外部設計・内部設計・実装・課金設計・テスト・公開の全フェーズで参照する。「MCP」「MCPサーバー」「AI向けSaaS」「エージェント向けAPI」「ツール定義」「リモートMCP」「従量課金」「Model Context Protocol」「AIエージェント連携」で参照。
---

# MCP Server Development Skill

SaaS を**人間向けブラウザUI**だけでなく、**AIエージェント向けの MCP（Model Context Protocol）サーバー**としても提供するための知識集。2026年、SaaS の利用者は人間だけでなく Claude をはじめとする AI エージェントになりつつある。ブラウザUIしか持たない SaaS は、AI エージェント経由の業務自動化から取り残される。

> **このSkillのゴール**：野口さんが量産する月額 SaaS に、既存の Next.js アプリへ**低コストで追加できる MCP サーバー**を組み込み、①人間はブラウザUIで、②AI エージェントは MCP 経由のツール呼び出しで、同じ SaaS の価値を利用できる状態を作る。人間向けサブスクと AI 向け従量課金を両立させ、量産・テンプレ化可能な形にする。

## いつこのSkillを参照するか

MCP 提供は**すべての案件で必須ではない**が、検討漏れを防ぐため以下のタイミングで必ず参照する：

- **要件定義**：クライアント/エンドユーザーが AI エージェント経由の利用（自動化・他ツール連携）を必要とするか検討する時
- **技術スタック選定**：MCP 提供を Tier A スタック（Next.js + Vercel + Supabase）にどう統合するかの ADR 記録時
- **外部設計**：ツール一覧（MCP tools）・リソース・認可スコープの設計時
- **内部設計**：`/api/mcp` のホスティング構成、認可ブリッジ、従量課金の内部設計時
- **実装**：mcp-handler を使った Route Handler 実装時
- **課金設計**：Stripe Billing Meters での従量課金・無料枠設計時
- **テスト・レビュー**：MCP Inspector での動作確認、CI 組み込み時
- **公開**：MCP レジストリ登録、接続ガイド作成時

## 重要原則（必読）

### 1. Streamable HTTP + Next.js Route Handler で作る

MCP には stdio（ローカル・同一マシン専用）と Streamable HTTP（リモート・マルチクライアント・HTTPS+SSE）の2トランスポートがある。野口さんスタック（Next.js on Vercel）との統合を最優先し、**配布物としては作らず、既存アプリに `/api/mcp` を追加する形で作る**。

> **基本方針：stdio はローカル開発・デバッグ用と割り切り、本番提供は必ず Streamable HTTP。`mcp-handler` パッケージで Route Handler として実装する。**

### 2. OAuth 2.1 + Supabase Auth ブリッジで認可する

MCP サーバーは OAuth 2.1 の resource server として動作するのが仕様上の標準。**自前のトークン方式を作らない**。既存の Supabase Auth（auth-integration Skill 参照）をベースに、MCP 用のトークン検証をブリッジする。

> **`.well-known/oauth-protected-resource` を必ず公開し、`withMcpAuth` + `verifyToken` でスコープ検証する。テナント分離は Supabase RLS の仕組みをそのまま流用する。**

### 3. ツールは「LLMが選べる・呼べる・自己回復できる」設計にする

MCP tools は人間向け API とは設計原則が異なる。**命名の一貫性（namespacing）・曖昧さのないパラメータ名・明確な description・actionable なエラーメッセージ**が、AI エージェントが正しくツールを選び使えるかを左右する。

### 4. 人間向けサブスク課金とAI向け従量課金のハイブリッドを前提に設計する

MCP 経由の利用はブラウザ操作と異なるパターン（バースト的・自動化された高頻度呼び出し）になりやすい。**月額サブスク（stripe-integration Skill）に加えて、ツール呼び出し量に応じた Stripe Billing Meters 従量課金**をハイブリッドで設計する。

### 5. MCP Inspector での動作確認とCI組み込みを省略しない

MCP はプロトコルレベルの契約であり、ブラウザE2Eでは検証できない。**MCP Inspector でのローカル確認と、CLIモードでのCIスモークテストを実装の一部として必須にする**。

### 6. レジストリ登録・.well-known・接続ガイドで「発見される」設計まで面倒を見る

MCP サーバーは作っただけでは AI エージェントから見つからない。**`registry.modelcontextprotocol.io` への登録、接続ガイド（README）の整備までを公開作業の一部とする**。seo-toolkit の AIO/LLMO と同じく「AIから見つかるSaaS」という視点を持つ。

### 7. 野口Profile：1名運用・無料枠優先・テンプレ化して次案件へ量産

民事再生中・1名運用という財務制約は MCP 提供でも変わらない。

> **基本方針：Vercel Functions（Fluid compute）の無料/従量枠の範囲で開始し、mcp-handler の実装パターンをテンプレ化して次の SaaS 案件に流用する。専用インフラの新規構築はしない。**

## このSkillの構成

```
mcp-server-development/
├── SKILL.md                              # 本ファイル
└── references/
    ├── architecture-and-hosting.md       # Streamable HTTP/Next.js/Vercelホスティング、stdio比較、スケーリング
    ├── auth-and-multitenancy.md          # OAuth 2.1、Supabase Authブリッジ、RLSテナント分離、スコープ設計
    ├── tool-and-resource-design.md       # ツール/リソース/プロンプト設計、命名、schema、エラー設計
    ├── billing-and-metering.md           # Stripe Billing Metersでの従量課金、無料枠、サブスクとのハイブリッド
    ├── testing-and-debugging.md          # MCP Inspector、CI組み込み、プログラマティックテスト
    └── registry-and-discovery.md         # MCPレジストリ登録、.well-known、接続ガイド、発見性
```

## エージェント別の使い方ガイド

MCP 提供に特化した専用エージェントは現時点では存在しない。**専用エージェントは今後追加予定**とし、それまでは以下のように既存エージェントが本Skillを直接参照する。

### tech-stack-architect

ADR として MCP 提供の要否と方式を記録：MCP提供する/しない、Streamable HTTP + mcp-handler、認可方式（OAuth 2.1 + Supabase Authブリッジ）、従量課金の要否。

### external-designer

MCP tools 一覧（機能一覧の AI 向け版）、スコープ設計、resources/prompts の要否を設計。`architecture-and-hosting.md` / `tool-and-resource-design.md` を参照。

### internal-designer

`/api/mcp` のルーティング構成、認可ブリッジのモジュール設計、Meter Event 送信の非同期同期パターンを設計。`auth-and-multitenancy.md` / `billing-and-metering.md` を参照。

### implementation-worker

`mcp-handler` での実装、`withMcpAuth`/`verifyToken` の実装、Zod によるツール入力スキーマ定義。

### payment-integration-specialist

Stripe Billing Meters の従量課金部分を stripe-integration Skill と合わせて担当。`billing-and-metering.md` を参照。

### auth-integration-specialist

Supabase Auth と MCP OAuth のブリッジ部分を担当。`auth-and-multitenancy.md` を参照。

### tester / e2e-usecase-tester

MCP Inspector での確認、プロトコルレベルのプログラマティックテストを担当。`testing-and-debugging.md` を参照。ブラウザE2Eの `e2e-browser-testing` / `e2e-usecase-tester` とは責務が異なる点に注意。

### seo-specialist

「AIから発見されるSaaS」の観点で `registry-and-discovery.md` の内容を seo-toolkit の AIO/LLMO と併走させる。

## 参照ファイルの読み方

| ファイル | 必読タイミング |
|---------|--------------|
| `architecture-and-hosting.md` | MCP提供の技術方式決定時、実装開始時 |
| `auth-and-multitenancy.md` | 認可・テナント分離の設計時 |
| `tool-and-resource-design.md` | ツール一覧設計時、実装中のスキーマ定義時 |
| `billing-and-metering.md` | 課金設計時（Stripe連携前に必読） |
| `testing-and-debugging.md` | 実装後の動作確認時、CI組み込み時 |
| `registry-and-discovery.md` | 公開前・レジストリ登録時 |

## 野口さん固有のチェック

- [ ] MCP 提供の要否を要件定義段階で意識的に判断したか（惰性で作らない／惰性で省略しない）
- [ ] stdio ではなく Streamable HTTP + `mcp-handler` で実装しているか
- [ ] 既存 Next.js アプリの `/api/mcp` に追加する形で、専用インフラを新規構築していないか
- [ ] OAuth 2.1 認可を自前実装せず、Supabase Auth をブリッジしているか
- [ ] RLS によるテナント分離が MCP 経由アクセスでも効いているか
- [ ] 従量課金を Stripe Billing Meters で実装し、レガシーな usage record 方式を使っていないか
- [ ] 無料枠・レート制限を実装し、想定外コストの発生を防いでいるか
- [ ] MCP Inspector での確認を実装工程に組み込んだか
- [ ] 実装パターンをテンプレ化し、次案件に流用できる形にしているか

## アンチパターン（よくある失敗）

1. **stdio サーバーとして配布しようとする**：リモート・マルチテナントSaaSに不向き。Streamable HTTPが基本
2. **自前のAPIキー方式でMCP認可を作る**：OAuth 2.1 resource serverとしての標準に反し、将来のクライアント互換性を失う
3. **`.well-known/oauth-protected-resource` を公開し忘れる**：クライアントがリソースサーバーを発見できない
4. **ツール名・パラメータ名を人間向けAPIの命名のまま流用する**：LLMが誤選択・誤呼び出しする
5. **エラーメッセージがスタックトレースのまま**：LLMが自己回復できず、無限リトライや誤操作を招く
6. **従量課金をリアルタイムでStripeに同期しようとする**：Stripe障害時に利用データが失われる。自社DB経由の非同期同期にする
7. **MCP Inspectorでの確認をせずデプロイ**：プロトコルレベルの不整合が本番で初めて発覚する
8. **レジストリ登録・接続ガイドを作らず「動くだけ」で終える**：AIエージェント・開発者から発見されない
9. **人間向けサブスクとAI向け従量課金を分離せず単一プランに混ぜる**：利用実態に応じた価格設計ができない
10. **専用インフラ（別サーバー・別ドメイン）をMCPのためだけに新規構築する**：1名運用の運用負荷が増える
