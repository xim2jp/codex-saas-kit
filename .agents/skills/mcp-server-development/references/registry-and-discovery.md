# Registry and Discovery（レジストリ登録と発見性）

MCP サーバーを作っただけでは AI エージェント・開発者から見つからない。**レジストリ登録・メタデータ公開・接続ガイド**まで含めて「公開作業」とする。seo-toolkit の AIO/LLMO（AIから見つかるコンテンツ）と同じ発想を、MCPサーバー自体の発見性に適用する。

## 1. MCP レジストリとは

`registry.modelcontextprotocol.io` は、MCP registry spec に準拠した**公式ホスト型レジストリ**。Anthropic・GitHub・PulseMCP・Microsoft 等がバックする community-owned のレジストリで、MCPサーバーのメタデータ（名前・説明・接続情報・バージョン）を一元的に検索可能にする。

- レジストリは**メタデータのみ**をホストし、アーティファクト（パッケージ本体・サーバーの実行コード）はホストしない
- リモートMCPサーバー（本Skillの前提）の場合、メタデータには接続先URL（`https://myapp.example.com/api/mcp`）を含める
- 現在プレビュー中。Registry API は v0.1 で API freeze（大きな破壊的変更は当面ない見込み）とされている

## 2. サーバー名の命名規則（逆引きDNS形式）

サーバー名は逆引きDNS形式で命名し、検証済みの GitHub アカウントやドメインに紐づける。

```
io.github.<username>/<server-name>   # GitHubアカウントに紐づく場合
com.<company-domain>/<server-name>   # 独自ドメインに紐づく場合
```

例：野口さんが `noguchi-saas.example.com` で SaaS を展開している場合

```
com.noguchi-saas/invoice-mcp
```

- **正当な所有者のみがそのnamespaceで公開できる**（ドメイン所有権 or GitHubアカウントの検証が必要）
- 量産方針を踏まえ、**会社ドメイン配下で命名規則を統一**しておくと、次の案件でも同じ namespace 体系を使い回せる（例：`com.noguchi-saas/<product-slug>-mcp`）

## 3. 登録手順の概要

1. **先にパッケージ本体を適切なレジストリに公開する**：リモートMCPサーバー（Streamable HTTP）の場合、コンテナイメージとして Docker Hub や GitHub Container Registry に公開するか、あるいは単純にホストされたURLをそのまま指す形にする（実装方式によって手順が異なるため、登録直前にドキュメントを確認）
2. **`server.json`（メタデータファイル）を用意**：サーバー名（逆引きDNS形式）、説明、バージョン、接続情報（リモートURLまたはパッケージ参照）を記述
3. **MCP Publisher CLI 等で `registry.modelcontextprotocol.io` に登録**：GitHubアカウントまたはドメインでの所有権検証を経て公開
4. **バージョンアップ時は都度メタデータを更新**：ツール一覧・スキーマの破壊的変更があった場合は特に、レジストリ側の説明文もあわせて更新する

```jsonc
// server.json（イメージ。実際のスキーマは公式ドキュメントで確認）
{
  "name": "com.noguchi-saas/invoice-mcp",
  "description": "請求書管理SaaSのMCPサーバー。請求書の照会・作成・レポート生成をAIエージェントから実行できます。",
  "version": "1.0.0",
  "remotes": [
    { "type": "streamable-http", "url": "https://invoice.noguchi-saas.example.com/api/mcp" },
  ],
}
```

## 4. Anthropic の Connectors ディレクトリも視野に入れる

MCP レジストリとは別に、Anthropic は Claude.ai 上で「カスタムコネクタ」として MCP サーバーをユーザーが追加できる仕組みを提供している。

- Claude にカスタムコネクタを追加すると、Claude は**ユーザーのローカルデバイスではなく Anthropic のクラウドインフラから**リモートMCPサーバーに接続する
- サーバーは**公開HTTPで到達可能**である必要があり、VPN背後・プライベートネットワークは不可。Anthropic のIPレンジからの到達性が求められる
- Connectors ディレクトリへの掲載は、フル OAuth 2.1 認可コードフロー（`auth-and-multitenancy.md` の方式B）が前提になりやすい。PAT方式のままでは掲載要件を満たさない可能性がある点に注意

> **野口さんの結論**：MVPでは MCP レジストリ登録までを標準工程とし、Connectors ディレクトリ掲載は「ある程度実績が出て、フルOAuthフローへの投資が正当化できる案件」で追加検討する段階的なロードマップにする。

## 5. `.well-known` によるメタデータ公開（発見の入口）

`auth-and-multitenancy.md` で扱った `.well-known/oauth-protected-resource` に加え、MCPサーバーの存在自体を示すための補助的なメタデータもドメインルートに置いておくと親切（クローラ・開発者双方にとっての手がかりになる）。

```
https://myapp.example.com/.well-known/oauth-protected-resource   # 認可メタデータ（必須）
https://myapp.example.com/llms.txt                                # AI向けサイト案内（seo-toolkit連携）
https://myapp.example.com/docs/mcp                                 # 人間向け接続ガイド（後述）
```

`llms.txt`（seo-toolkit の `aio-llmo.md` 参照）に MCP サーバーの案内を追記しておくと、AIエージェントがサイトを読んだ際に MCP 接続手段があることに気づきやすくなる。

```markdown
<!-- llms.txt への追記例 -->
## AIエージェント向け機能
- このSaaSは MCP サーバーを提供しています: https://myapp.example.com/api/mcp
- 接続ガイド: https://myapp.example.com/docs/mcp
```

## 6. 接続ガイド（README/ドキュメントページ）のテンプレート

人間の開発者・情シス担当者が「このSaaSをAIエージェントに繋ぎたい」と思ったときに迷わないよう、接続ガイドを用意する。営業サイトのFAQ/ドキュメントページの一角に置く。

```markdown
# MyApp を Claude / AIエージェントから使う（MCP接続ガイド）

MyApp は Model Context Protocol (MCP) サーバーを提供しています。
Claude Desktop / Codex / その他 MCP 対応クライアントから接続できます。

## 接続情報
- エンドポイント: `https://myapp.example.com/api/mcp`
- トランスポート: Streamable HTTP
- 認可: Bearer トークン（発行方法は下記）

## 1. 接続トークンを発行する
1. MyApp にログイン
2. 設定 → 「AIエージェント連携」からトークンを発行
3. 必要なスコープ（読み取りのみ / 書き込み含む）を選択

## 2. クライアントに設定する（Codex の例）
\`\`\`toml
# ~/.codex/config.toml に追記（トークンは環境変数 MYAPP_MCP_TOKEN に設定）
[mcp_servers.myapp]
url = "https://myapp.example.com/api/mcp"
bearer_token_env_var = "MYAPP_MCP_TOKEN"
\`\`\`

## 3. できること（提供ツール一覧）
- `myapp_invoices_list` / `myapp_invoices_create`: 請求書の照会・作成
- `myapp_reports_generate`: 月次レポートの生成
（以下略）

## 料金
- 月間1,000回まで無料（サブスクプランに含む）
- 超過分は1回あたり¥1の従量課金
```

- この接続ガイドは、次の案件でもテンプレとして再利用できるよう `templates/` 相当の構成（触ってはいけないディレクトリのため実際の配置は案件のdocsツリーに従う）を意識して書く
- marketing-site-playbook のFAQ/ドキュメント構成と統合し、営業サイトの一部として公開する

## 7. seo-toolkit / marketing-site-playbook との接続点

MCP サーバーの発見性は、従来の SEO/AIO/LLMO と地続きの課題である。

- **AI Overviews / ChatGPT / Perplexity への引用最適化**（seo-toolkit `aio-llmo.md`）と同様に、「AIが自社SaaSを認識し、ユーザーに推薦する」ためには、営業サイト自体のコンテンツ品質・構造化データ・llms.txt 整備が土台になる
- MCP レジストリ・Connectors ディレクトリへの掲載は、**「AIから選ばれるSaaS」という同じ目的の別の打ち手**と位置づける（検索エンジンのSEOに対する構造化データ・サイトマップ登録に相当する営み）
- 営業サイトのLP（marketing-site-playbook）にも「AIエージェント連携対応」を訴求ポイントとして明記し、B2B顧客の業務自動化ニーズに応える

## 野口さん固有のチェック

- [ ] サーバー名を逆引きDNS形式で、会社ドメイン配下の統一命名規則にしているか
- [ ] MCPレジストリへの登録を公開工程の標準ステップに含めているか
- [ ] Connectors ディレクトリ掲載は「実績が出てから」の段階的ロードマップにしているか（初期実装で無理に狙っていないか）
- [ ] `llms.txt` にMCPサーバーの案内を追記しているか（seo-toolkitとの連携）
- [ ] 接続ガイド（README/ドキュメントページ）を用意し、次案件に流用できるテンプレ化を意識しているか
- [ ] 営業サイトのLPで「AIエージェント連携対応」を訴求できているか

## アンチパターン

1. **MCPサーバーを実装しただけでレジストリ登録・接続ガイドを作らない**：存在を知られず利用が広がらない
2. **命名規則を案件ごとにバラバラにする**：量産方針に反し、テンプレ化の恩恵が得られない
3. **PAT方式のままConnectorsディレクトリ掲載を急ぐ**：認可方式の要件を満たさず手戻りが発生する
4. **接続ガイドを開発者向けの技術文書だけにし、営業訴求に活用しない**：MCP対応という差別化要素を営業サイトで活かせていない
5. **llms.txtにMCPの案内を書かない**：AIがサイトを読んでもMCP接続手段に気づけない

## 出典・参照した一次ソース

- MCP Registry 公式ドキュメント: https://registry.modelcontextprotocol.io/docs
- MCP Registry GitHub リポジトリ: https://github.com/modelcontextprotocol/registry
- 「About the MCP Registry」: https://modelcontextprotocol.io/registry/about
- サーバー公開ガイド: https://github.com/modelcontextprotocol/registry/blob/main/docs/guides/publishing/publish-server.md
- Anthropic「Building custom connectors via remote MCP servers」: https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers
- 既存の seo-toolkit Skill（`aio-llmo.md`：llms.txt・AIクローラ許可方針）: `.agents/skills/seo-toolkit/references/aio-llmo.md`

※ MCP Registry はプレビュー中でAPI・登録手順が変わりうる（v0.1でAPI freeze予定だが細部は流動的）。実装直前に公式リポジトリの最新ドキュメントを再確認すること。
