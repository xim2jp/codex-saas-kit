---
name: mcp-server-development
description: SaaS をブラウザ UI だけでなく MCP サーバーとして AI エージェントに提供するための知識集。Streamable HTTP / Next.js Route Handler でのホスティング、OAuth 2.1 認可と Supabase Auth ブリッジ、テナント分離、LLM が使いこなせるツール／リソース設計、Stripe Billing Meters による従量課金、MCP Inspector でのテスト、レジストリ登録と発見性を収録する。MCP 提供の要否判断から技術選定・設計・実装・課金・テスト・公開まで参照する。「MCP」「MCPサーバー」「AI向けSaaS」「エージェント向けAPI」「ツール定義」「リモートMCP」「従量課金」「Model Context Protocol」で参照。
---

# MCP Server Development Skill

SaaS を**人間向けブラウザUI**だけでなく、**AIエージェント向けの MCP（Model Context Protocol）サーバー**としても提供するための知識集。2026年、SaaS の利用者は人間だけでなく Claude をはじめとする AI エージェントになりつつある。ブラウザUIしか持たない SaaS は、AI エージェント経由の業務自動化から取り残される。

> **このSkillのゴール**：野口さんが量産する月額 SaaS に、既存の Next.js アプリへ**低コストで追加できる MCP サーバー**を組み込み、①人間はブラウザUIで、②AI エージェントは MCP 経由のツール呼び出しで、同じ SaaS の価値を利用できる状態を作る。人間向けサブスクと AI 向け従量課金を両立させ、量産・テンプレ化可能な形にする。

## いつ検討するか

MCP 提供は**すべての案件で必須ではない**が、要件定義の段階で要否を意識的に判断する（惰性で作らない／惰性で省略しない）。提供すると決めたら、技術選定（ADR）・外部設計（ツール一覧・スコープ）・内部設計（`/api/mcp` 構成・認可ブリッジ・メーター送信）・実装・課金・テスト・公開の各フェーズで本 Skill を参照する。

## 重要原則

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

## 参照ファイル

| ファイル | 内容 | いつ読むか |
|---------|------|-----------|
| `references/architecture-and-hosting.md` | Streamable HTTP / Next.js / Vercel ホスティング、stdio 比較、スケーリング | 技術方式の決定時、実装開始時 |
| `references/auth-and-multitenancy.md` | OAuth 2.1、Supabase Auth ブリッジ、RLS テナント分離、スコープ設計 | 認可・テナント分離の設計時 |
| `references/tool-and-resource-design.md` | ツール／リソース／プロンプト設計、命名、schema、エラー設計 | ツール一覧の設計時、スキーマ定義時 |
| `references/billing-and-metering.md` | Stripe Billing Meters での従量課金、無料枠、サブスクとのハイブリッド | 課金設計時（Stripe 連携の前に） |
| `references/testing-and-debugging.md` | MCP Inspector、CI 組み込み、プログラマティックテスト | 実装後の動作確認時、CI 組み込み時 |
| `references/registry-and-discovery.md` | MCP レジストリ登録、.well-known、接続ガイド、発見性 | 公開前・レジストリ登録時 |

## 設計上の要点

- **ADR に残す判断**：MCP を提供する／しない、Streamable HTTP + mcp-handler、認可方式（OAuth 2.1 + Supabase Auth ブリッジ）、従量課金の要否
- **外部設計**では MCP tools 一覧を「機能一覧の AI 向け版」として作り、スコープ設計と resources / prompts の要否を決める
- **内部設計**では `/api/mcp` のルーティング、認可ブリッジのモジュール境界、Meter Event を自社 DB 経由で非同期に Stripe へ送る同期パターンを決める
- **実装**は `mcp-handler`、`withMcpAuth` / `verifyToken`、Zod によるツール入力スキーマで行う
- **テスト**は MCP Inspector とプロトコルレベルのプログラマティックテストで行う。ブラウザ E2E（`e2e-browser-testing`）とは検証対象が異なる
- **発見性**は seo-toolkit の AIO/LLMO と同じ「AI から見つかる SaaS」の観点で扱う

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
