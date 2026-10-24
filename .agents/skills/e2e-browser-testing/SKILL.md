---
name: e2e-browser-testing
description: 実ブラウザ（Chromium/Firefox/WebKit）で UI 操作・スクリーンショット・ネットワーク監視・認証フロー・決済フローまで完全に模擬する E2E テストを Playwright で構築するための知識集。Next.js + Supabase + Stripe 前提の実装パターン、ロケータ戦略、storageState、Stripe Checkout iframe・Test Clocks、標準ユースケースカタログ（登録・ログイン・課金・退会・権限）、要件×E2E トレーサビリティ監査、CI 連携、フレーキー対策、Playwright MCP 駆動を収録する。E2E の計画・実装・監査・レビュー・障害再現時に参照する。「E2E」「Playwright」「ブラウザテスト」「ユースケースE2E」「トレーサビリティ」「スクリーンショット」「フレーキー」で参照。
---

# E2E Browser Testing Skill

実ブラウザを起動して、ユーザーの操作を完全に模擬する E2E テストの設計・実装・運用知識集。**Playwright を主軸**とし、野口さんの「SaaS 量産」スタック（Next.js + Supabase + Stripe）での再現可能なパターンを提供する。

## 参照ファイル

| ファイル | 内容 | いつ読むか |
|---------|------|-----------|
| `references/setup-and-config.md` | 初期セットアップ・playwright.config.ts・テストピラミッド指針 | プロジェクト初期化時、CI 設定見直し時、E2E シナリオ計画時 |
| `references/locators-and-assertions.md` | ロケータ戦略・web-first assertion | テスト実装時（必読） |
| `references/auth-and-storage-state.md` | auth.setup.ts・Supabase Auth E2E | 認証を要するテスト実装時 |
| `references/network-mocking.md` | page.route()・MSW・Next.js 連携 | 外部 API を含むフロー、決定論的テストが必要な時 |
| `references/accessibility-and-visual.md` | axe-core・toHaveScreenshot | A11y・ビジュアル回帰の要件がある時 |
| `references/stripe-e2e-pattern.md` | Stripe Checkout iframe・Test Clocks・Webhook | 決済フロー E2E 実装時 |
| `references/ci-github-actions.md` | CI 設定・Trace Viewer・アーティファクト | GitHub Actions セットアップ時、CI 失敗の調査時 |
| `references/playwright-mcp.md` | Playwright MCP server からの駆動 | Codex でブラウザ操作を自動化したい時 |
| `references/troubleshooting-flakiness.md` | フレーキー対策・デバッグ手順 | テストが不安定な時、Trace Viewer での原因特定時 |
| `references/helpers-template.md` | `tests/e2e/helpers/`（users/db/stripe/fixtures）の標準コード雛形 | プロジェクト初期化時に E2E ヘルパ層を構築する時 |
| `references/traceability-matrix.md` | 要件×E2E トレーサビリティ監査の方法論 | Phase 17 の監査時（必読）、e2e-scenarios.md に FunctionalID 対応を書く時 |
| `references/usecase-catalog/`（signup / login / profile / billing / withdraw / permission） | 標準ユースケースの詳細スペック（UC-SIGNUP-01〜05、UC-LOGIN-01〜06、UC-PROFILE-01〜05、UC-BILLING-01〜06、UC-WITHDRAW-01〜05、UC-PERM/RECOVERY/A11Y。Given/When/Then・DB検証・ロケータ） | E2E シナリオの初版作成時、ユースケース E2E 生成時 |

## 原則

### 1. 「完全模擬」とは何か

Playwright は **本物の Chromium/Firefox/WebKit プロセス**を起動し、CDP/WebDriver-BiDi で操作する。jsdom のような擬似 DOM ではない。以下がすべて実 UI で再現される：

- レンダリング（ピクセル単位）
- JavaScript 実行（Service Worker・Web Worker 含む）
- CSS アニメーション・トランジション
- フォーカス・ホバー・キーボード入力
- Cookie / localStorage / IndexedDB / sessionStorage
- ネットワーク（HTTP/2、WebSocket、SSE、リダイレクト）
- ファイルダウンロード・アップロード
- 別ウィンドウ・iframe（Stripe Checkout など）
- 認証フロー（OAuth リダイレクトを含む）

> **基本方針：「ユーザーがブラウザでやれることは Playwright でテストできる」**

### 2. Playwright を標準採用する

Cypress でも E2E は可能だが、野口さんスタックでは Playwright を標準とする：

| 観点 | Playwright | Cypress |
|-----|-----------|---------|
| マルチブラウザ | Chromium/Firefox/WebKit ネイティブ | Chromium 系のみ（Firefox は experimental） |
| 並列実行 | プロセス並列で高速 | ワーカー単位、設定複雑 |
| 認証永続化 | `storageState` で標準対応 | `cy.session()` で対応可だが構文が独自 |
| iframe / 別タブ | ネイティブ対応 | iframe 制約あり |
| MCP 統合 | Microsoft 公式 `@playwright/mcp` あり | なし |
| Trace Viewer | 公式提供、タイムトラベルデバッグ | Time Travel あるがネットワーク不可 |
| TypeScript | ファーストクラス | あり |

> **野口さんスタック標準：Playwright + `@playwright/test`。**

### 3. ユーザー視点のロケータを使う

CSS セレクタ・XPath は UI 改修で簡単に壊れる。**`getByRole` / `getByLabel` / `getByText` を優先**する。アクセシビリティツリー経由なので、a11y も同時に強化される。

> **基本方針：`page.locator('.some-class')` ではなく `page.getByRole('button', { name: '購入' })` を使う。**

### 4. ハードウェイト禁止

`waitForTimeout()` は CI でほぼ確実に flaky になる。Playwright の **auto-wait** と **web-first assertion** を使う：

```ts
// NG: 固定待機
await page.waitForTimeout(2000);

// OK: 要素の状態を待つ
await expect(page.getByRole('alert')).toContainText('保存しました');
```

### 5. テスト独立性を最優先

各テストは**他のテストに依存しない**。共有 DB を使う場合は：
- ユーザーごとにテストデータを作成（Supabase の場合 `auth.admin.createUser`）
- テスト末尾で必ずクリーンアップ
- 並列ワーカーごとに固有のテストユーザーを発行（`testInfo.parallelIndex`）

### 6. CI 上で trace・video・screenshot を取得

CI で失敗したテストは**ローカル再現が困難**。Playwright の Trace Viewer はタイムトラベルデバッグが可能で、DOM スナップショット・ネットワーク・コンソールがすべて記録される。

> **基本方針：`trace: 'on-first-retry'`、`video: 'retain-on-failure'`、`screenshot: 'only-on-failure'` を CI で必ず設定。**

### 7. 認証は storageState で再利用

毎テストでログインする設計は遅い・脆い。`auth.setup.ts` で**一度ログインしてセッションを JSON に保存**し、各テストで再利用する。`.gitignore` に必ず追加（セッション Cookie が漏洩する）。

### 8. Playwright MCP でエージェント駆動も可能

Codex から **`@playwright/mcp` server** 経由でブラウザを直接操作できる。テストコードを書かずに、エージェントが自律的に「ログインして→請求書をダウンロードして→PDF を確認」のような操作が可能。テストの自動生成にも活用できる。

### 9. シナリオは Critical に絞り、FunctionalID で要件と結ぶ

- E2E シナリオは `docs/40-test-plan/e2e-scenarios.md` に Given/When/Then 形式で書き、Critical（10-20ケース：認証・決済・コア業務フロー）に絞る。各シナリオに Playwright のロケータ案を併記する
- 初版は `references/usecase-catalog/*.md` の標準 UC をプレースホルダとして転記し、各 UC エントリに「対応 FunctionalID」欄を必ず設ける（Phase 17 の監査で突合される）
- ユースケース E2E は `tests/e2e/usecases/*.spec.ts` に置き、`test.describe('UC-XXXX-NN: ...')` に対応 FunctionalID をコメントで明記する。ヘルパは `helpers-template.md` の雛形から `tests/e2e/helpers/` に構築する
- トレーサビリティ監査は `feature-list.md` × E2E と `business-flow.md` × E2E の 2 軸で突合する。MUST FunctionalID の未カバー、金額・権限・退会の異常系 E2E 欠落は **Block**

### 10. 実装側を「テストできる構造」にする

`getByRole` で取れる構造を実装時に作る。フォームには `<label for="...">` を必ず付け（getByLabel 対応）、ボタンには明示的なテキストか `aria-label` を付ける。

### 11. 認証・決済・ビジュアルの定石

- 認証 E2E は `auth-and-storage-state.md` のパターンで実装し、OAuth は本番プロバイダのテストモードか Supabase の Email/Password でモックする
- Stripe Checkout は `frameLocator` で操作し、月跨ぎ・年跨ぎは Stripe Test Clocks で時間圧縮、Webhook 配信は Stripe CLI `stripe listen` でローカル経由にする
- 完成画面のキャプチャは `page.screenshot()`、ビジュアル回帰は `expect(page).toHaveScreenshot()`

## 野口さん固有のチェック

- [ ] Next.js App Router + `@supabase/ssr` での認証 E2E が組まれている
- [ ] Stripe Checkout（iframe）の E2E が `frameLocator` で実装されている
- [ ] 適格請求書ダウンロード（PDF）の E2E がある
- [ ] CI で trace/video アーティファクトが 30 日保存される
- [ ] 1 名運用前提：Critical 10-20 ケースに絞り、保守性最優先
- [ ] Tier A（Vercel）：Vercel Preview URL に対する E2E も検討
- [ ] Tier B（AWS）：ECS デプロイ前の Smoke E2E を必須化

## 量産テンプレート化

複数 SaaS を量産するため、E2E まわりも**再利用可能なテンプレート**として整備する：

- `playwright.config.ts` の共通設定（タイムアウト、リポータ、CI 設定）
- `auth.setup.ts` の Supabase Auth 版テンプレート
- `tests/fixtures/` の共通フィクスチャ（認証済みコンテキスト、テストユーザーファクトリ）
- Stripe Checkout E2E のテンプレート

## コンバージョン・継続率の担保

- **新規登録フロー**：OAuth ボタン → プロバイダ → コールバック → ダッシュボードまで E2E でカバー
- **決済成功フロー**：価格ページ → Stripe Checkout → Webhook → アクティベーションまで E2E
- **退会フロー**：退会 → Stripe Subscription 解約 → データ論理削除まで E2E

これらが壊れる＝売上停止なので、E2E で確実にガードする。

## アンチパターン（よくある失敗）

1. **`waitForTimeout` を多用**：CI で flaky 化、修正コスト爆発
2. **CSS セレクタ依存**：`.btn-primary` のクラス名変更で全テスト死亡
3. **テスト間でデータ共有**：並列実行で競合、独立性破綻
4. **storageState を git にコミット**：セッション Cookie 漏洩
5. **すべてのテストでログイン**：実行時間が爆発、Supabase レートリミット直撃
6. **本番環境で E2E 実行**：テストデータが本番に混入
7. **trace/video を CI で出力しない**：失敗時にローカル再現できず詰む
8. **Stripe Checkout を CSS で操作しようとする**：iframe・PCI 制約で不可、`frameLocator` 必須
9. **MSW を Playwright で併用しようとする**：MSW の Service Worker が Playwright の route を不可視化、`page.route()` を使う
10. **`page.click()` の前に手動 `waitForSelector`**：auto-wait が効いているので不要、可読性低下
11. **E2E でユニットテスト相当をやる**：テストピラミッド崩壊、CI 時間が分単位に
12. **`describe.parallel` を共有 DB で乱発**：Supabase の接続上限超過で全落ち

## 関連 Skill

- `auth-integration`：認証 E2E の前提知識
- `stripe-integration`：決済 E2E の前提知識
- `sdlc-toolkit`：成果物配置、テスト戦略の上位ガイド
