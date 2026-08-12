# Auth and Multitenancy（認可とマルチテナント分離）

MCP サーバーの OAuth 2.1 認可フローを、既存の Supabase Auth（auth-integration Skill）にブリッジし、RLS ベースのテナント分離をそのまま活かす設計方針。

## 1. MCP の認可モデル（OAuth 2.1 resource server）

MCP 仕様は、リモートMCPサーバーを **OAuth 2.1 の resource server** として位置づける。クライアント（AIエージェント側）は OAuth client として authorization server からアクセストークンを取得し、そのトークンを MCP サーバーへのリクエストに付与する。関連する仕様：

- **RFC 9728（Protected Resource Metadata）**：resource server が「自分を保護している authorization server はどこか」を `.well-known/oauth-protected-resource` で公開する
- **RFC 9207（iss パラメータ検証）**：認可コードフローでの mix-up 攻撃対策として `iss` パラメータの検証が求められる（SEP-2468 関連）

> **野口さんの結論**：MCP用に**新しい authorization server を自前構築しない**。Supabase Auth を authorization server 相当として扱い、MCP サーバー（Next.js Route Handler）は resource server として、Supabase が発行したトークンを検証する側に徹する。

## 2. Supabase Auth をどうブリッジするか（設計判断）

Supabase Auth はそれ自体が汎用 OAuth authorization server ではなく、SaaS 向けの認証基盤（メール/パスワード、OAuth プロバイダ、JWT セッション）である。MCP のトークン検証にどう接続するか、2つの現実的な方式がある。

### 方式A：Personal Access Token（PAT）方式（推奨・デフォルト）

ユーザーがブラウザUI（ダッシュボード）上で MCP 接続用の長期トークンを発行し、AIエージェント（Claude Desktop / Codex 等）の設定にそのトークンを貼り付ける方式。

- ダッシュボードに「MCP接続用トークンを発行」ボタンを設置
- サーバー側で `mcp_tokens` テーブル（`user_id`, `tenant_id`, `token_hash`, `scopes`, `expires_at`, `created_at`, `last_used_at`）を Supabase 上に用意し、トークン自体はハッシュ化して保存（生の値は発行時にしか見せない）
- `verifyToken` はこのテーブルを引いてトークンの有効性・スコープを確認する
- 実装が単純で、フル OAuth 認可コードフローのUI（同意画面等）を作らずに済む → **1名運用と相性が良い**

```ts
// lib/mcp/auth.ts
import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'node:crypto';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function verifyToken(
  req: Request,
  bearerToken?: string,
): Promise<{ token: string; scopes: string[]; clientId: string } | undefined> {
  if (!bearerToken) return undefined;

  const tokenHash = createHash('sha256').update(bearerToken).digest('hex');

  const { data, error } = await supabaseAdmin
    .from('mcp_tokens')
    .select('id, user_id, tenant_id, scopes, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data || data.revoked_at) return undefined;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return undefined;

  await supabaseAdmin
    .from('mcp_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return {
    token: bearerToken,
    scopes: data.scopes ?? [],
    clientId: `${data.tenant_id}:${data.user_id}`,
  };
}
```

### 方式B：フル OAuth 2.1 認可コードフロー方式

Claude.ai の「カスタムコネクタ」等、汎用クライアントから同意画面付きで接続させたい場合に必要。Supabase Auth の前段に軽量な authorization server 層（`/oauth/authorize`, `/oauth/token` エンドポイント）を実装し、ユーザーがブラウザで同意した上で MCP 用のアクセストークン/リフレッシュトークンを発行する。

- 実装コストが方式Aより高い（同意画面、認可コード発行、PKCE 検証、トークンリフレッシュを自前実装）
- Claude.ai の Connectors ディレクトリ掲載や、不特定多数のサードパーティクライアントからの接続を見込む場合に検討

> **野口さんの結論**：**初期実装は方式A（PAT方式）をデフォルトとする**。方式Bは「Anthropic の Connectors ディレクトリに掲載したい」「複数の外部クライアントからOAuth同意フローで接続させたい」等の明確な要求が出てから、Tier B 相当の追加案件として検討する。

## 3. `.well-known/oauth-protected-resource` の実装

方式A・方式Bいずれでも、resource server としてのメタデータ公開は必要（クライアントの自動発見のため）。

```ts
// app/.well-known/oauth-protected-resource/route.ts
import { protectedResourceHandler } from 'mcp-handler';

const handler = protectedResourceHandler({
  authServerUrls: ['https://<your-app>.vercel.app'], // 自前のtoken発行エンドポイント or authorization server
});

export { handler as GET };
```

方式Aのように認可コードフローを持たない場合でも、独自のトークン発行UI（ダッシュボードのトークン発行ページ）を「authorization server」として最小限に見せる形で記述しておく。

## 4. `withMcpAuth` によるルート保護とスコープ制御

```ts
// app/api/mcp/route.ts
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { verifyToken } from '@/lib/mcp/auth';

const handler = createMcpHandler(
  (server) => {
    // server.tool(...) はここに定義
  },
  {},
  { basePath: '/api' },
);

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ['read:usage'],
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

export { authHandler as GET, authHandler as POST };
```

## 5. テナント分離：RLS を MCP 経由アクセスでも一貫させる

野口さんスタックの中核はマルチテナントを Supabase RLS で分離する設計（tech-stack-profile.md）。MCP 経由のアクセスでも**この境界線を絶対に崩さない**。

- `verifyToken` が返す `clientId`（または任意のコンテキスト）に `tenant_id` を含め、以降のツール実行では**必ずこの tenant_id を使って Supabase クライアントのセッション/RLSコンテキストを設定**する
- サービスロールキー（RLSをバイパスする管理者キー）でツールを実装しない。**ユーザー相当の RLS が効く形でクエリを発行する**のが原則
- どうしても管理者権限が必要な処理（例：使用量集計の書き込み）は、明示的にスコープ分離したツールとして提供し、通常ツールと混在させない

```ts
// lib/mcp/tenant-client.ts
import { createClient } from '@supabase/supabase-js';

export function createTenantScopedClient(userAccessToken: string) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${userAccessToken}` } },
  });
}
```

PAT方式の場合、`mcp_tokens` に対応する Supabase セッションの JWT（またはそれに準ずる短命トークン）を紐づけて発行し、ツール実行時に RLS コンテキストとして使う設計にする。

## 6. スコープ設計例

MCP tools ごとに必要な権限を最小化する。OAuth の `scope` とツールの namespacing（`tool-and-resource-design.md` 参照）を対応させる。

| スコープ | 許可されるツール例 | 用途 |
|---------|-------------------|------|
| `read:usage` | `myapp_usage_get`, `myapp_reports_list` | 読み取り専用の利用状況照会 |
| `write:records` | `myapp_records_create`, `myapp_records_update` | データ作成・更新 |
| `admin:billing` | `myapp_billing_get_meter` | 課金関連（人間の管理者トークンのみ発行） |

トークン発行画面で、ユーザーが必要なスコープだけを選んで発行できるようにする（最小権限の原則）。

## 野口さん固有のチェック

- [ ] MCP用の独自 authorization server をフルスクラッチで作っていないか（まず方式A=PATで足りるか検討したか）
- [ ] `.well-known/oauth-protected-resource` を公開しているか
- [ ] `verifyToken` がトークンをハッシュ化して保存・照合しているか（平文保存していないか）
- [ ] MCP経由のツール実行がサービスロールキーでRLSをバイパスしていないか
- [ ] トークン発行UIで、ユーザーがスコープを選択できるか（最小権限）
- [ ] トークンの失効（revoke）・有効期限をダッシュボードから管理できるか
- [ ] 監査ログ（`last_used_at` 等）で不正利用の予兆を追えるか

## アンチパターン

1. **自前のAPIキー方式（`X-API-Key` ヘッダー等）だけを実装しOAuthの体裁を取らない**：MCP標準クライアントとの互換性を失う
2. **サービスロールキーをMCPツールの実装にそのまま使う**：テナント分離が崩壊する
3. **トークンを平文でDBに保存する**：漏洩時に即悪用される
4. **スコープを設けず全トークンに全権限を付与する**：最小権限の原則に反する
5. **`.well-known/oauth-protected-resource` を用意しない**：標準準拠クライアントが接続できない

## 出典・参照した一次ソース

- MCP 公式仕様（認可）: https://modelcontextprotocol.io/specification/draft/basic/authorization
- RFC 9728（OAuth 2.0 Protected Resource Metadata）: https://www.rfc-editor.org/rfc/rfc9728
- RFC 9207（OAuth 2.0 Authorization Server Issuer Identification）: https://www.rfc-editor.org/rfc/rfc9207
- Vercel「Deploy MCP servers to Vercel」（`withMcpAuth`/`verifyToken`/`protectedResourceHandler`）: https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel
- Anthropic「Building custom connectors via remote MCP servers」: https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers
- Anthropic「MCP connector」: https://platform.claude.com/docs/en/agents-and-tools/mcp-connector

※ OAuth 2.1 / MCP認可仕様は draft から正式化に向けて変更が続いている領域。実装直前に modelcontextprotocol.io の最新仕様を再確認すること。既存の Supabase Auth 実装詳細は auth-integration Skill（`supabase-auth-setup.md` 等）と合わせて確認する。
