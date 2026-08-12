# Playwright MCP

Codex から **`@playwright/mcp`** server 経由でブラウザを直接操作するパターン。テストコードを書かずに、エージェントが自律的に「ログインして請求書をダウンロードして PDF を検証」のような操作が可能。

## 何ができるか

- Codex のエージェントが**実ブラウザ**を起動・操作（headed/headless）
- アクセシビリティツリーで DOM を認識（スクリーンショット不要・トークン効率良い）
- 40+ ツール：navigate / click / type / screenshot / evaluate / wait / network mock / storage / trace / video
- ログイン状態の**永続化**（コンテキストとして残る）
- **テストコードの自動生成**：操作の記録→Playwright Test 形式で出力

## 1. インストール

Codex の MCP server として登録：

```bash
# ユーザーレベル（~/.codex/config.toml に追記される）
codex mcp add playwright -- npx -y @playwright/mcp@latest
```

プロジェクトレベル（推奨：チーム共有）は `.codex/config.toml` に直接記述：

```toml
[mcp_servers.playwright]
command = "npx"
args = ["-y", "@playwright/mcp@latest"]
```

### オプション付き起動

```toml
[mcp_servers.playwright]
command = "npx"
args = [
  "-y", "@playwright/mcp@latest",
  "--browser", "chromium",
  "--headless",
  "--isolated",
  "--storage-state", "playwright/.auth/user.json",
  "--user-agent", "MyAgent/1.0",
]
```

| オプション | 用途 |
|----------|------|
| `--browser` | chromium / firefox / webkit |
| `--headless` | ヘッドレス（CI 想定） |
| `--isolated` | コンテキスト分離（テスト毎にクリーン） |
| `--storage-state` | 認証済みセッションを読み込み |
| `--vision` | 視覚モード（スクショベース、低レイヤ要素向け） |
| `--cdp-endpoint` | 既存ブラウザに接続 |

## 2. エージェントへの指示例

```
ローカルの http://localhost:3000 を開いて、テストユーザー e2e@example.test /
password で ログインし、ダッシュボードに「ようこそ」が表示されることを確認して。
```

エージェントは以下のような MCP ツールを順次呼ぶ：

1. `browser_navigate({ url: "http://localhost:3000" })`
2. `browser_snapshot()` → アクセシビリティツリーで構造把握
3. `browser_click({ ref: "...", element: "ログイン" })`
4. `browser_type({ ref: "...", element: "メールアドレス", text: "e2e@example.test" })`
5. `browser_type({ ref: "...", element: "パスワード", text: "password" })`
6. `browser_click({ ref: "...", element: "ログイン" })`
7. `browser_snapshot()` → ダッシュボードに「ようこそ」あるか確認

## 3. ユースケース

### a. 手動デバッグの代行

ローカル開発時、画面上の挙動を Claude に確認させる：

```
http://localhost:3000/checkout で Stripe Checkout が開けるか確認して。
カード番号 4242 4242 4242 4242 で購入完了まで進めて、
最後にスクリーンショットを撮って共有して。
```

### b. テストコード自動生成

```
http://localhost:3000 でログイン → 新規プロジェクト作成 → 削除
までの操作を行い、Playwright Test 形式の TypeScript コードを
tests/e2e/critical/project-crud.spec.ts として保存して。
ロケータは getByRole/getByLabel を優先して。
```

### c. リグレッション確認

```
Vercel Preview URL https://my-saas-pr-42.vercel.app に対して、
価格ページ → Pro プラン購入 → ダッシュボード遷移までを通しで実行して、
問題があれば screenshot 付きで報告して。
```

### d. SaaS の競合調査

```
https://competitor.example.com の価格ページを開いて、
プラン構造と価格を取得して、./docs/competitive-analysis.md
に Markdown 表形式で保存して。
```

## 4. テスト自動化との併用パターン

### 設計

- **MCP 駆動**：探索的・一発のブラウザ操作（自動化前段階）
- **`@playwright/test`**：CI で回す自動テスト

両者は同じ Playwright 上に乗っているので、**MCP で書かせた操作をそのまま Test 化**できる。

### 推奨ワークフロー

```
1. 機能実装完了
   ↓
2. Claude（MCP）にブラウザ操作させて、シナリオを確認
   ↓
3. うまく動いた操作を「Playwright Test 形式で保存」と指示
   ↓
4. 生成されたコードをレビュー → getByRole 等に整える
   ↓
5. CI に組み込み
```

## 5. Playwright CLI（2026 新機能）

MCP は accessibility tree をその都度 Claude のコンテキストに流すため、**トークン消費が大きい**。Microsoft が 2026 初頭にリリースした **Playwright CLI**（`@playwright/cli`）は、スナップショットを YAML でディスクに保存し、Claude には必要な部分だけ参照させる：

```bash
npx @playwright/cli init
npx @playwright/cli record --output snapshots/login.yaml
```

エージェントは YAML を Read することでコンテキスト効率が上がる。**大量操作の自動化なら CLI、対話的な操作なら MCP**。

## 6. 制限・注意

### a. 制限事項

- ファイルアップロードは限定的（フォーマット次第で fail）
- 動画再生・WebRTC は確実ではない
- 拡張機能は基本未対応
- BlobURL のダウンロードは扱いに難あり

### b. セキュリティ

- **本番環境にエージェントを向けない**（誤操作で副作用）
- **storageState を MCP に渡す**ときはテスト用セッションのみ
- **クレデンシャルを prompt に書かない**（テキストとして履歴に残る、`--env-file` 等で間接化）

### c. CI での利用

- 通常の `@playwright/test` を使う方が安定
- MCP は**人間 + Claude の対話セッション**用と割り切る
- CI での自動テストには Playwright Test を使う

## 7. デバッグ Tips

```bash
# MCP server を直接立てて挙動確認
npx @playwright/mcp@latest --headless

# Codex から MCP の生ログを見る
# /mcp で接続状態確認
# /mcp logs で詳細
```

エージェントが想定通りに動かない時：

1. `/mcp` で playwright server が `connected` か確認
2. エージェントに `browser_snapshot` を明示的に要求して、アクセシビリティツリーが取れているか確認
3. 要素が `role=button` 等で取れない場合は `--vision` モードに切り替え

## 8. アンチパターン

1. **MCP で大量テストを回す** → コンテキスト爆発、Playwright Test を使う
2. **本番 URL に MCP で接続** → 操作ミスで副作用
3. **storageState を本番セッションに** → セッション窃取相当
4. **`--isolated` なしで複数エージェント同時起動** → コンテキスト混線
5. **生成されたコードをそのまま採用** → getByRole 不使用、可読性低、必ずレビュー

## 関連

- `setup-and-config.md`：Playwright Test 側のセットアップ
- 公式ドキュメント：https://playwright.dev/mcp/introduction
