# Architecture and Hosting（アーキテクチャとホスティング）

MCP（Model Context Protocol）サーバーを、野口さんの Tier A スタック（Next.js 15 App Router + Vercel）に統合してホストするための構成方針。

## 1. トランスポート：stdio と Streamable HTTP

MCP には2種類のトランスポートがある。

| 項目 | stdio | Streamable HTTP |
|------|-------|------------------|
| 通信路 | 標準入出力（プロセス間） | HTTP POST/GET + Server-Sent Events |
| 動作場所 | クライアントと**同一マシン** | **リモート**サーバー |
| クライアント数 | 1プロセス1クライアント | マルチクライアント対応 |
| 認可 | 通常不要（ローカル前提） | OAuth 2.1 resource server が標準 |
| 典型用途 | CLIツール、ローカル開発ツール、デスクトップ拡張 | SaaS が外部公開する本番MCPサーバー |
| 野口さんスタックでの位置づけ | **ローカル開発・デバッグ用**（MCP Inspector 接続等） | **本番提供の唯一の選択肢** |

Streamable HTTP は 2025-06-18 仕様で導入されたトランスポートで、旧来の HTTP+SSE（2種類のエンドポイント）を単一エンドポイントに統合し、クライアント→サーバーは HTTP POST、サーバー→クライアントのストリーミングは Server-Sent Events で行う。

> **野口さんの結論**：SaaS を AI エージェントに提供する目的では、**stdio は選択肢に入らない**。ユーザーのローカルマシンにサーバープロセスを配布・実行させる運用は、1名運用・量産方針と相性が悪い（配布物のメンテナンス、ユーザー環境依存の不具合対応が発生する）。常に Streamable HTTP で作り、Vercel にデプロイする。

## 2. mcp-handler で Next.js Route Handler に統合する

Vercel 公式の `mcp-handler`（`@vercel/mcp-adapter` 系パッケージ）を使うと、MCP サーバーを Next.js の Route Handler として実装できる。既存の Next.js アプリに **新しいルートを1つ追加するだけ**で MCP 提供が始められる。

```bash
npm install mcp-handler zod
```

```ts
// app/api/mcp/route.ts
import { z } from 'zod';
import { createMcpHandler } from 'mcp-handler';

const handler = createMcpHandler(
  (server) => {
    server.tool(
      'roll_dice',
      'Rolls an N-sided die',
      { sides: z.number().int().min(2) },
      async ({ sides }) => {
        const value = 1 + Math.floor(Math.random() * sides);
        return { content: [{ type: 'text', text: `You rolled a ${value}!` }] };
      },
    );
  },
  {},
  { basePath: '/api' },
);

export { handler as GET, handler as POST, handler as DELETE };
```

- `basePath: '/api'` を指定すると、エンドポイントは `/api/mcp` になる（ファイルパスと合わせて調整する）。
- 動的ルート `app/api/[transport]/route.ts` にすれば、複数トランスポートのパスをまとめて扱える構成も可能。
- 実運用の SaaS では、`server.tool(...)` で1ツールずつ定義していく。命名・スキーマ設計は `tool-and-resource-design.md` を参照。

## 3. 既存 Next.js アプリへの追加パターン（推奨構成）

野口さんの SaaS は基本的に「1リポジトリ = 1 Next.js アプリ（ブラウザUI + API）」。MCP はこのアプリに**同居させる**のが第一選択。

```
app/
├── (dashboard)/              # 人間向けブラウザUI（既存）
├── api/
│   ├── mcp/
│   │   └── route.ts          # MCPサーバー本体（今回追加）
│   ├── webhooks/
│   │   └── stripe/route.ts   # 既存Webhook
│   └── ...
├── .well-known/
│   └── oauth-protected-resource/
│       └── route.ts          # OAuth Protected Resource Metadata（今回追加）
lib/
├── mcp/
│   ├── tools/                # ツール定義（サービスごとに分割）
│   ├── auth.ts               # verifyToken実装（Supabase Authブリッジ）
│   └── metering.ts           # 従量課金の計測ロジック
```

**同居させる理由**：
- Supabase クライアント、認証セッション、RLS 前提のデータアクセス層をそのまま再利用できる
- デプロイ・環境変数・監視（observability-integration Skill）が単一プロジェクトで完結する
- 1名運用でインフラの見る場所を増やさない

**別リポジトリ/別プロジェクトに分離すべき例外**：
- MCP専用の異なるスケーリング特性・レート制限ポリシーが必要な大規模案件（Tier B以降で検討）
- 複数の既存SaaSを横断する統合MCPゲートウェイを作る場合

Tier A の量産方針では、基本は同居構成をテンプレとして扱う。

## 4. Vercel Functions と Fluid Compute

MCP サーバーの利用パターンは、通常の Web API と異なり**不規則**になりやすい（長い待機、バースト的なメッセージ、重いAIワークロードとの組み合わせ）。Vercel Functions の **Fluid Compute** はこの特性に最適化されている。

- 最適化された並行性：1インスタンスで複数リクエストを効率的に処理
- 動的スケーリング：負荷に応じて自動増減
- インスタンス共有：コールドスタートの影響を抑える
- 実際に使った分だけ課金：アイドル時間のコストを抑えられる

野口さんの財務制約（無料枠優先）と相性がよく、追加のインフラ調達なしで MCP の不規則な負荷パターンに対応できる。

## 5. 本番運用に効く Vercel の機能

- **Instant Rollback**：MCP ツールのスキーマ変更・破壊的変更をデプロイした際、AIエージェント側の呼び出し不整合が発覚しても即座に前バージョンへ戻せる
- **Deployment Protection 付き Preview**：ツール実装のレビュー用プレビュー環境を認証保護した状態で用意できる
- **Vercel Firewall**：MCP エンドポイントへの異常なリクエストパターン（スクレイピング、DoS 的な高頻度呼び出し）を制御
- **Rolling Releases**：段階的にトラフィックを新バージョンへ移行し、ツール変更の影響範囲を限定

## 6. マルチテナントSaaSでの設計判断：1サーバー/マルチテナント vs テナント別エンドポイント

野口さんの SaaS は Supabase RLS によるマルチテナント設計が標準（tech-stack-profile.md 参照）。MCP サーバーの構成にも同じ判断軸が適用できる。

| 方式 | 概要 | 適する場面 |
|------|------|-----------|
| **1サーバー/マルチテナント（推奨・デフォルト）** | `/api/mcp` は単一。認可トークンからテナントを特定し、RLS でデータを分離 | 通常の SaaS。実装・運用コストが最小 |
| **テナント別エンドポイント** | `/api/mcp/[tenantSlug]` のようにURLでテナントを分ける | ホワイトラベル提供、テナントごとに異なるツールセットを見せたい場合 |

> **野口さんの結論**：デフォルトは**1サーバー/マルチテナント**。認可トークン（Supabase セッション由来）からテナントIDを解決し、以降のツール実行はすべて RLS 前提のクエリで自然にテナント分離される。テナント別エンドポイントは、ホワイトラベル案件など明確な要求がある場合のみ検討する（実装・運用の複雑化とのトレードオフ）。

## 7. スケーリングと 2026年ロードマップの視点

MCP 仕様自体も 2026年にかけて **stateless core** でのスケールを志向しており、`Mcp-Method` / `Mcp-Name` ヘッダー（SEP-2243 提案）によって、ロードバランサやゲートウェイがリクエストボディを見ずにルーティングできる方向に進んでいる。Vercel の Function 単位のステートレス実行モデルはこの方向性と相性がよい。実装時点でセッション状態をサーバーローカルに持たない設計（Supabase 等の外部ストアに状態を逃がす）を徹底しておくと、将来の仕様変更にも追従しやすい。

## 8. ローカル動作確認の基本フロー

1. `npm run dev` でローカル起動（`http://localhost:3000/api/mcp`）
2. `npx @modelcontextprotocol/inspector` で MCP Inspector を起動（`http://127.0.0.1:6274`）
3. Transport Type を Streamable HTTP に設定し、URL に `http://localhost:3000/api/mcp` を入力して接続
4. ツール一覧・呼び出しをブラウザ上で確認（詳細は `testing-and-debugging.md`）

デプロイ後は `https://<project>.vercel.app/api/mcp` のような本番URLになる。

## 野口さん固有のチェック

- [ ] stdio ではなく Streamable HTTP で実装しているか
- [ ] 既存 Next.js アプリに同居する構成を第一選択にしたか（安易に別インフラを作っていないか）
- [ ] Fluid Compute の恩恵を受けられる Vercel Functions 構成になっているか
- [ ] マルチテナント方式が「1サーバー/マルチテナント」をデフォルトにしているか（ホワイトラベル等の明確な要求なしにテナント別エンドポイントを作っていないか）
- [ ] サーバーローカルにセッション状態を持たず、Supabase 側に状態を逃がしているか

## 出典・参照した一次ソース

- MCP 公式仕様（トランスポート）: https://modelcontextprotocol.io/docs/concepts/transports
- MCP 公式仕様（認可）: https://modelcontextprotocol.io/specification/draft/basic/authorization
- MCP 2026年ロードマップ・stateless core: https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/
- Vercel「Deploy MCP servers to Vercel」: https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel
- Vercel MCP テンプレート: https://vercel.com/templates/next.js/model-context-protocol-mcp-with-next-js , https://vercel.com/templates/other/model-context-protocol-mcp-with-vercel-functions

※ mcp-handler のAPI・Fluid Compute の詳細仕様は更新が速いため、実装直前に Vercel 公式ドキュメントで最新のパッケージ名・オプションを再確認すること。
