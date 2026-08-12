# CI on GitHub Actions

Playwright を GitHub Actions で安定運用するためのワークフロー定義と、失敗時のデバッグ手順。

## 1. 基本ワークフロー

```yaml
# .github/workflows/e2e.yml
name: E2E

on:
  pull_request:
  push:
    branches: [main]

jobs:
  e2e:
    timeout-minutes: 30
    runs-on: ubuntu-latest

    env:
      CI: true
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL_TEST }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY_TEST }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_TEST }}
      STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
      STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_TEST_WEBHOOK_SECRET }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      # ブラウザインストール（キャッシュで時間短縮）
      - name: Cache Playwright browsers
        id: pw-cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: pw-${{ runner.os }}-${{ hashFiles('package-lock.json') }}

      - name: Install Playwright browsers
        if: steps.pw-cache.outputs.cache-hit != 'true'
        run: npx playwright install --with-deps

      - name: Install system deps only
        if: steps.pw-cache.outputs.cache-hit == 'true'
        run: npx playwright install-deps

      - run: npm run build

      - name: Run Playwright
        run: npx playwright test

      # 失敗時のみ artifact を上げる
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

      - name: Upload trace
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-trace
          path: test-results/
          retention-days: 30
```

## 2. シャーディング（並列で高速化）

ケース数が増えると 1 job では遅い。**N シャードに分割**して並列実行：

```yaml
jobs:
  e2e:
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]

    steps:
      # ... setup 省略 ...

      - run: npx playwright test --shard=${{ matrix.shard }}/4

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: blob-report-${{ matrix.shard }}
          path: blob-report/
          retention-days: 1

  merge-reports:
    needs: e2e
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - uses: actions/download-artifact@v4
        with:
          path: all-blob-reports
          pattern: blob-report-*
          merge-multiple: true

      - run: npx playwright merge-reports --reporter html ./all-blob-reports

      - uses: actions/upload-artifact@v4
        with:
          name: html-report-merged
          path: playwright-report
          retention-days: 30
```

`playwright.config.ts` で `reporter: 'blob'` を設定しておくこと（`setup-and-config.md` 参照）。

## 3. Vercel Preview に対する E2E

PR 時、Vercel Preview URL に対して E2E を回せる：

```yaml
on:
  deployment_status:

jobs:
  e2e:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    env:
      BASE_URL: ${{ github.event.deployment_status.target_url }}
    steps:
      - uses: actions/checkout@v4
      # ... 通常の setup ...

      - name: Run E2E against preview
        run: npx playwright test --project=chromium-anon
        # webServer を起動しない（baseURL が外部だから）
```

`playwright.config.ts` で `BASE_URL` が指定された時は `webServer` を無効化：

```ts
export default defineConfig({
  ...(process.env.BASE_URL?.startsWith('http') ? {} : {
    webServer: { command: 'npm run start', url: 'http://localhost:3000' },
  }),
});
```

## 4. Supabase Local を CI で起動

E2E 専用の Supabase project を別で持つよりも、CI で Supabase Local（Docker）を起動した方が**速い・無料・並列に強い**：

```yaml
- name: Start Supabase
  run: npx supabase start

- name: Get Supabase URL
  id: supabase
  run: |
    echo "url=$(npx supabase status --output env | grep API_URL | cut -d'=' -f2)" >> $GITHUB_OUTPUT
    echo "anon=$(npx supabase status --output env | grep ANON_KEY | cut -d'=' -f2)" >> $GITHUB_OUTPUT

- name: Run E2E
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ steps.supabase.outputs.url }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ steps.supabase.outputs.anon }}
  run: npx playwright test
```

## 5. Trace Viewer での失敗解析

CI で失敗した時の解析フロー：

```bash
# 1. GitHub Actions の artifact から playwright-trace をダウンロード
unzip playwright-trace.zip -d ./trace

# 2. Trace Viewer で開く
npx playwright show-trace ./trace/<test-name>/trace.zip
```

Trace Viewer で見られるもの：
- **タイムライン**：各アクションの所要時間
- **DOM スナップショット**：各時点の HTML（タイムトラベル可能）
- **アクションログ**：clicks / fills / waits
- **ネットワーク**：全リクエスト・レスポンス
- **コンソール**：browser console.log
- **ソース**：テストコードのどの行で何が起きたか

### オンライン Trace Viewer

```
https://trace.playwright.dev
```

ローカルファイルをドラッグ＆ドロップで開ける。チームに共有しやすい。

## 6. 失敗時の通知

```yaml
- name: Slack notify on failure
  if: failure() && github.ref == 'refs/heads/main'
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    text: 'E2E failed on main: ${{ github.event.head_commit.message }}'
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## 7. flaky を見つける `--repeat-each`

```yaml
- name: Detect flaky (nightly)
  if: github.event_name == 'schedule'
  run: npx playwright test --repeat-each=10 --retries=0
```

毎テスト 10 回ずつ実行。安定して通ればその実装は flaky じゃない。

## 8. 推奨環境変数

| 変数 | 用途 |
|-----|------|
| `CI=true` | Playwright が CI 用設定（retry、worker 数など）を採用 |
| `BASE_URL` | デプロイ済み URL に対して E2E |
| `PLAYWRIGHT_HTML_REPORT` | レポート出力先のカスタム |
| `PLAYWRIGHT_TEST_BASE_URL` | `baseURL` のオーバーライド |
| `DEBUG=pw:api` | 詳細ログ |

## 9. アンチパターン

1. **`actions/checkout` 後に `npm ci` を毎回実行（キャッシュなし）** → 30 秒→数分の差
2. **ブラウザを毎回 install** → キャッシュ必須
3. **失敗時に何も artifact 出さない** → ローカル再現不能で詰む
4. **`retries: 5` で flaky を隠す** → 根本原因が放置される
5. **シャードを分けるが reporter が blob ではない** → レポートが分離してマージできない
6. **本番 Supabase に向けた E2E** → 本番データを破壊
7. **CI で headed mode** → そもそも動かない、または Xvfb で迂遠
