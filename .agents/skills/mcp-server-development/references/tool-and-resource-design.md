# Tool and Resource Design（LLMが使いこなせるツール設計）

MCP tools / resources / prompts を、LLM（AIエージェント）が**正しく選び、正しく呼び、失敗しても自己回復できる**ように設計するための指針。Anthropic の "Writing effective tools for AI agents" の考え方を MCP 実装に落とし込む。

## 1. tools / resources / prompts の使い分け

MCP には3つの主要プリミティブがある。

| プリミティブ | 役割 | SaaS での典型例 |
|-------------|------|----------------|
| **tools** | LLM が能動的に呼び出す「アクション」（副作用あり/なし両方） | `myapp_invoices_list`, `myapp_records_create` |
| **resources** | LLM/クライアントが参照する「データ」（読み取り専用の文脈） | 現在のプラン情報、ダッシュボードのサマリーデータ |
| **prompts** | 定型的なタスクをテンプレート化した「操作の雛形」 | 「月次レポートを作成して」に対応する定型プロンプト |

- 基本方針：**まず tools で必要な操作をすべて提供する**。resources は「毎回渡すと文脈が重い/更新頻度が低いデータ」を効率的に扱いたい場合に追加する。prompts は定型業務が明確にある場合のみ、量産の優先度は低い。
- SaaS の CRUD 的な操作は tools として設計する（resources を書き込みに使わない）。

## 2. ツール命名：一貫した namespacing

似たツールが増えるほど、LLM は誤った選択をしやすくなる。**サービス単位・リソース単位で prefix を統一**する。

```
✅ 良い例（一貫したnamespacing）
myapp_invoices_list
myapp_invoices_get
myapp_invoices_create
myapp_customers_search

❌ 悪い例（バラバラな命名）
listInvoices
get_invoice
CreateNewInvoice
findCustomer
```

- prefix は SaaS 名（例：`myapp`）で統一し、他のMCPサーバーのツールと衝突・混同しないようにする
- 動詞は `list` / `get` / `search` / `create` / `update` / `delete` 等に統一し、同義語を混在させない（`fetch` と `get` を両方使わない）

## 3. パラメータ名を曖昧にしない

```
✅ user_id, customer_id, invoice_id
❌ id, user, target
```

`id` のような汎用的な名前は、複数のリソースが絡む文脈で LLM がどの ID を指しているか誤認しやすい。**何のIDかをパラメータ名自体に含める**。

## 4. スキーマの質がすべてを左右する（Zod での定義）

`mcp-handler` では Zod でツールの入力スキーマを定義する。**name・description・input schema の3点セットの質**が、LLM が正しくツールを使えるかを直接左右する。

```ts
server.tool(
  'myapp_invoices_list',
  'List invoices for the current tenant. Supports filtering by status and date range. ' +
    'Returns up to `limit` invoices ordered by issue date (newest first). ' +
    'Use this before creating a new invoice to check for duplicates.',
  {
    status: z
      .enum(['draft', 'open', 'paid', 'void'])
      .optional()
      .describe('Filter by invoice status. Omit to return all statuses.'),
    issued_after: z
      .string()
      .datetime()
      .optional()
      .describe('ISO 8601 timestamp. Only return invoices issued after this date.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe('Max number of invoices to return (1-50, default 20).'),
    cursor: z.string().optional().describe('Pagination cursor from a previous response.'),
  },
  async ({ status, issued_after, limit, cursor }) => {
    // 実装
  },
);
```

- description は**何をするツールか**だけでなく、**いつ使うべきか／使わないべきか**、**副作用の有無**まで書く
- 各パラメータにも `describe()` で用途・制約（フォーマット、範囲、デフォルト）を明記する
- 曖昧な自由記述文字列より、`z.enum(...)` で選択肢を絞れるものは絞る（LLMの誤入力を構造的に防ぐ）

## 5. Tool Annotations で振る舞いのヒントを与える

MCP のツール定義には annotations（ヒント情報）を付与できる。クライアント側の確認UI・自動実行可否の判断材料になる。

| annotation | 意味 |
|-----------|------|
| `readOnlyHint` | データを変更しない（安全に自動実行しやすい） |
| `destructiveHint` | 破壊的な操作（削除等）を含む可能性がある |
| `idempotentHint` | 同じ入力で複数回呼んでも結果が変わらない |
| `openWorldHint` | 外部の未知のエンティティ（Web検索等）と相互作用する |

- 一覧取得・参照系ツールには `readOnlyHint: true` を明示し、書き込み系と明確に区別する
- 削除系ツールには `destructiveHint: true` を付け、クライアント側の確認プロンプトを誘発させる

## 6. エラーメッセージは「アクション可能」にする

LLM はエラーメッセージを読んで次の一手を決める。**人間向けのスタックトレースをそのまま返さない**。

```
❌ 悪い例
"Error: null pointer exception at InvoiceService.java:142"
"500 Internal Server Error"

✅ 良い例
"Invoice with id 'inv_123' was not found for this tenant. " +
"Use myapp_invoices_list to find a valid invoice_id."

"Cannot create invoice: customer 'cus_456' has no registered tax ID. " +
"Ask the user to add a tax ID via myapp_customers_update, or omit tax_id-dependent fields."

"Rate limit exceeded: this tool can be called at most 60 times per minute. " +
"Retry after 30 seconds."
```

- 何が失敗したか（Not Found / Validation / Rate Limit / Permission）を明確に分類する
- **次に何をすべきか**（別のツールを呼ぶ、パラメータを直す、時間を置く）を文中に含める
- 課金・無料枠超過のエラーは `billing-and-metering.md` の設計と合わせ、アップセル導線を含めたメッセージにする（例：「無料枠の上限に達しました。プランをアップグレードしてください: https://.../billing」）

## 7. レスポンスは簡潔に、コンテキスト効率を意識する

MCP のツール結果は LLM のコンテキストウィンドウを消費する。**必要な情報だけを返す**。

- 一覧系ツールは**ページネーション必須**（`limit` / `cursor` パラメータ、`billing-and-metering.md` の無料枠管理とも連動）
- レスポンスに含めるフィールドは絞る（内部IDやメタデータを無条件に全部返さない）。詳細が必要な場合のみ `get` 系の別ツールで取得する2段構成にする
- 大きなテキスト/バイナリは resources として提供し、tool 結果には参照（URIやID）だけを含める設計も検討する

```ts
// レスポンス例：詳細フィールドを絞り、詳細は別ツールに逃がす
return {
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        invoices: results.map((inv) => ({
          id: inv.id,
          status: inv.status,
          amount: inv.amount,
          issued_at: inv.issuedAt,
        })),
        next_cursor: nextCursor,
      }),
    },
  ],
};
```

## 8. resources のメタデータ

resources には `audience` / `priority` / `lastModified` 等のメタデータを付与できる。SaaS のダッシュボードサマリーのような「頻繁に参照されるが重すぎない文脈情報」を resources として公開する際に活用する。

## 9. 野口さんスタックでの実務パターン

- ツールの実装本体は `lib/mcp/tools/` 配下にリソース単位でファイル分割し、`route.ts` からまとめて登録する（量産・テンプレ化しやすくするため）
- 1つの SaaS で最初に用意すべきツール数は**絞る**（3〜7個程度）。人間向けUIの全機能を機械的にツール化するのではなく、AIエージェントが自動化したがる業務（照会・レポート生成・定型データ作成）から優先する
- 既存の REST API 実装（Route Handler）がある場合、**そのままラップせず**、LLM 向けに再設計する（パラメータの曖昧さ、レスポンスの冗長さは人間向けAPIと要求が異なる）

## 野口さん固有のチェック

- [ ] ツール名が SaaS 名で統一した namespacing になっているか
- [ ] パラメータ名が曖昧でないか（`id` 単体を避けているか）
- [ ] description に「いつ使うか」「副作用の有無」が書かれているか
- [ ] 読み取り専用ツールに `readOnlyHint` が付与されているか
- [ ] エラーメッセージが次の一手を示すアクション可能な文になっているか
- [ ] 一覧系ツールにページネーション（limit/cursor）があるか
- [ ] 最初に用意するツール数を絞り、自動化価値の高いものから優先しているか
- [ ] 既存REST APIの単純ラップになっていないか（LLM向けに再設計したか）

## アンチパターン

1. **人間向けREST APIをそのままツール化する**：パラメータ・レスポンスがLLM向けに最適化されていない
2. **命名がツールごとにバラバラ**：LLMがツールを誤選択する
3. **エラーメッセージがスタックトレースそのまま**：LLMが自己回復できない
4. **一覧系ツールが全件返す**：コンテキストを圧迫し、コストも増える
5. **最初から数十個のツールを用意する**：LLMの選択精度が下がる。価値の高いものから絞って始める
6. **description を1行の名詞句だけで済ませる**：使いどころが伝わらない
7. **破壊的操作に annotations を付けない**：クライアント側の安全策が働かない

## 出典・参照した一次ソース

- Anthropic「Writing effective tools for AI agents」: https://www.anthropic.com/engineering/writing-tools-for-agents
- Anthropic「MCP connector」（tools/resources/promptsのサポート範囲）: https://platform.claude.com/docs/en/agents-and-tools/mcp-connector
- MCP 公式仕様（tools/resources/prompts の一般仕様）: https://modelcontextprotocol.io/specification/draft
- Vercel「Deploy MCP servers to Vercel」（Zodでのツール実装例）: https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel

※ tool annotations の対応状況はクライアントによって差がある。実装直前に MCP 仕様の最新版と主要クライアント（Claude.ai / Codex / Claude Desktop）の対応状況を再確認すること。
