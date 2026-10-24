# Testing and Debugging（MCP Inspector とプロトコルレベルのE2E）

MCP サーバーの動作確認・デバッグ・CI組み込みのための指針。ブラウザ操作ではなく、**プロトコルレベル**（JSON-RPCメッセージのやり取り）でテストする点が既存のE2E Skillと異なる。

## 1. MCP Inspector とは

Anthropic の MCP チームがメンテする公式インタラクティブ開発者ツール。「MCP版の Postman」に相当する。2コンポーネントで構成される。

- **MCP Inspector Client（MCPI）**：React 製の Web UI。ツール一覧の確認、パラメータ入力、呼び出し結果の確認ができる
- **MCP Proxy（MCPP）**：Node.js サーバー。stdio / SSE / Streamable HTTP のプロトコルブリッジを担う

`npx` で起動でき、**グローバルインストール不要**。stdio・SSE・Streamable HTTP の3トランスポートすべてに対応する。

## 2. ローカルでの起動・接続手順

```bash
# 1. Next.js アプリをローカル起動
npm run dev
# → http://localhost:3000/api/mcp が立ち上がる

# 2. 別ターミナルで MCP Inspector を起動
npx @modelcontextprotocol/inspector
# → http://127.0.0.1:6274 が開く
```

Inspector の Web UI で：

1. **Transport Type** を `Streamable HTTP` に設定
2. **URL** に `http://localhost:3000/api/mcp` を入力
3. 認可が必要な場合、Bearer トークン（`auth-and-multitenancy.md` の PAT方式で発行したテスト用トークン）を設定
4. **Connect** で接続
5. **Tools** タブでツール一覧が正しく表示されるか確認
6. 各ツールを選択し、パラメータを入力して実行、レスポンス（`content` / `isError`）を確認

### 確認すべき観点

- ツールの description・パラメータ説明が意図通り表示されるか（LLM視点での可読性チェックにもなる）
- 認可なしアクセスが正しく拒否されるか（401等）
- スコープ不足のトークンで権限エラーになるか
- 無料枠超過時にアクションブルなエラーメッセージが返るか（`billing-and-metering.md` 参照）
- 不正なパラメータ（型違反、必須項目欠落）で Zod バリデーションエラーが適切に返るか

## 3. CLI モードでの CI スモークテスト

Inspector は `--cli` フラグでスクリプト化できる。ブラウザUIを開かずコマンドラインから検証でき、CI に組み込みやすい。

```bash
# ツール一覧を取得（接続確認のスモークテスト）
npx @modelcontextprotocol/inspector --cli \
  --transport streamable-http \
  --url https://myapp-staging.vercel.app/api/mcp \
  --header "Authorization: Bearer $MCP_TEST_TOKEN" \
  list-tools

# 特定ツールを呼び出す
npx @modelcontextprotocol/inspector --cli \
  --transport streamable-http \
  --url https://myapp-staging.vercel.app/api/mcp \
  --header "Authorization: Bearer $MCP_TEST_TOKEN" \
  call-tool myapp_invoices_list --args '{"limit": 5}'
```

```yaml
# .github/workflows/mcp-smoke-test.yml（イメージ）
name: MCP Smoke Test
on:
  deployment_status:
jobs:
  smoke-test:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - name: List MCP tools
        run: |
          npx @modelcontextprotocol/inspector --cli \
            --transport streamable-http \
            --url ${{ github.event.deployment_status.target_url }}/api/mcp \
            --header "Authorization: Bearer ${{ secrets.MCP_TEST_TOKEN }}" \
            list-tools
```

デプロイ完了フック（Vercel の Deployment Status）に連動させ、**デプロイのたびにツール一覧が壊れていないかを自動確認**する。1名運用ではこの自動化が特に重要（手動でInspectorを毎回開く余裕がない）。

## 4. プログラマティックなクライアントテスト（TypeScript SDK）

CLIモードより詳細な検証（レスポンス内容のアサーション、複数ツールの連続呼び出しシナリオ）が必要な場合は、MCP TypeScript SDK のクライアントを使ってテストコードを書く。

```ts
// tests/mcp/tools.spec.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('MCP server: myapp', () => {
  let client: Client;

  beforeAll(async () => {
    const transport = new StreamableHTTPClientTransport(
      new URL(`${process.env.MCP_BASE_URL}/api/mcp`),
      { requestInit: { headers: { Authorization: `Bearer ${process.env.MCP_TEST_TOKEN}` } } },
    );
    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it('lists invoices tool in the tool catalog', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('myapp_invoices_list');
  });

  it('rejects request without required scope', async () => {
    const result = await client.callTool({
      name: 'myapp_billing_get_meter',
      arguments: {},
    });
    expect(result.isError).toBe(true);
  });

  it('returns paginated invoice list', async () => {
    const result = await client.callTool({
      name: 'myapp_invoices_list',
      arguments: { limit: 5 },
    });
    const body = JSON.parse((result.content as any)[0].text);
    expect(body.invoices.length).toBeLessThanOrEqual(5);
  });
});
```

Vitest（tester Skill の既存スタックと同じ）に載せて実行できるため、既存の Unit/Integration テストの並びに組み込みやすい。

## 5. 既存 E2E Skill との役割分担

| Skill | テスト対象 | レイヤー |
|-------|----------|---------|
| `e2e-browser-testing` | ブラウザ上のUI操作（クリック・入力・画面遷移） | Playwright / 実ブラウザ |
| `e2e-usecase-tester`（Phase 16） | 業務ユースケース（新規登録・利用・退会等）のブラウザ再現 | Playwright / 実ブラウザ |
| **本Skill（MCP）** | **AIエージェントから見たプロトコル契約**（ツール一覧・スキーマ・認可・エラー） | MCP Inspector / TypeScript SDK クライアント |

- MCP のテストは「ブラウザに何が表示されるか」ではなく「**LLMクライアントが実際にツールを正しく呼び、正しい結果を得られるか**」を検証する
- MCP を提供する SaaS では、Phase 16（e2e-usecase-tester）のブラウザE2Eに加えて、**MCPプロトコルのスモークテストを別トラックとして実施**する（どちらか一方で代替できない）
- CIには両方を組み込む：ブラウザE2Eは `e2e-browser-testing`/`e2e-usecase-tester` の既存ワークフロー、MCPスモークテストは本ファイルの CLIモード or TypeScript SDK テストを追加する

## 6. セキュリティ上の注意

- MCP Inspector には過去に **CVE-2025-49596**（旧バージョンにおけるリモートコード実行の脆弱性）が報告されている。**必ず最新版を使用**する（`npx` は常に最新のpublishedバージョンを取得するため、通常は問題ないが、バージョン固定運用をしている場合は定期更新を怠らない）
- 信頼できない第三者の MCP サーバーを Inspector でテストする場合は、コンテナ/VM内など隔離環境で実行する（自分のSaaSサーバーをテストする分には通常問題にならないが、他社サーバーとの接続確認時は注意）

## 野口さん固有のチェック

- [ ] MCP Inspector でのローカル動作確認を実装完了の定義に含めているか
- [ ] CIにMCPスモークテスト（CLIモード or SDKテスト）を組み込んでいるか
- [ ] デプロイ完了フックと連動させ、デプロイのたびに自動確認できているか（手動確認に依存していないか）
- [ ] ブラウザE2E（Phase 16）とMCPプロトコルテストの両方を実施しているか（片方で済ませていないか）
- [ ] MCP Inspector を最新版で使っているか

## アンチパターン

1. **MCP Inspectorでの確認を省略し、実装完了とみなす**：プロトコルレベルの不整合が本番で初めて発覚する
2. **ブラウザE2Eだけで「テスト済み」と判断する**：MCP経由の契約は別レイヤーで壊れうる
3. **CIにMCPテストを組み込まず、手動確認に依存する**：1名運用では確認漏れが起きやすい
4. **古いバージョンのInspectorを使い続ける**：既知の脆弱性の影響を受ける
5. **認可なし・スコープ不足のケースをテストしない**：本番で権限エラーの挙動が未検証のまま公開される

## 出典・参照した一次ソース

- MCP Inspector 公式ドキュメント: https://modelcontextprotocol.io/docs/tools/inspector
- MCP Inspector GitHub リポジトリ: https://github.com/modelcontextprotocol/inspector
- Vercel「Deploy MCP servers to Vercel」（Inspectorでの接続確認手順）: https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel

※ CLIモードのオプション、TypeScript SDK のAPI、CVE対応状況は変わりうるため、実装直前に GitHub リポジトリの README・Releases で最新情報を再確認すること。
