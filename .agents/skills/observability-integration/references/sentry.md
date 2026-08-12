# Sentry 詳細

エラー/例外監視の専門ツール。Next.js + Supabase スタックとの相性が良く、**Seer（AI根本原因分析）** と **Session Replay** が強み。野口さんの全案件の監視土台として最初に入れる候補。

> 情報は 2026 年 6 月時点。SDK 構成・料金・MCP は更新が速いため、実装直前に末尾の出典URLで再確認すること。

## 1. Next.js SDK 導入（推奨：公式ウィザード）

```bash
npx @sentry/wizard@latest -i nextjs
```

ウィザードが自動で行うこと：
- `@sentry/nextjs` インストール
- 設定ファイル一式の生成
- `next.config.ts` を `withSentryConfig()` でラップ（ソースマップ自動アップロード）
- 検証用ページ `/sentry-example-page` の追加

### 現行の設定ファイル構成（重要）

| ファイル | 役割 |
|---------|------|
| `instrumentation.ts` | サーバー/Edge 設定を Next.js に登録。`export const onRequestError = Sentry.captureRequestError;` を含む |
| `instrumentation-client.ts` | **ブラウザ初期化（現行パターン）。旧 `sentry.client.config.ts` を置き換える** |
| `sentry.server.config.ts` | Node.js ランタイム初期化（`Sentry.init({...})`） |
| `sentry.edge.config.ts` | Edge ランタイム初期化 |

> ⚠️ 旧情報では `sentry.client.config.ts` だが、現行は `instrumentation-client.ts`。古い記事をコピーしないこと。

### ソースマップ & 認証トークン

- `next.config.ts` を `withSentryConfig()` でラップ → minify されたコードを可読スタックトレース化。
- ウィザードは `SENTRY_AUTH_TOKEN` を `.env.sentry-build-plugin` に格納。**CI/CD（Vercel/AWS）では環境変数 `SENTRY_AUTH_TOKEN` をビルド側に設定**。

### Tunneling（広告ブロッカー対策）

`withSentryConfig` の `tunnelRoute: "/sentry-tunnel"` で Sentry へのリクエストを自サーバー経由にし、ad-blocker による欠落を防ぐ。

## 2. 主要機能（「目視で即確認」観点）

- **Error Monitoring**：例外を自動キャプチャ。スタックトレース + ブレッドクラム + ユーザー影響で「どのファイル・行で何が」を即把握。
- **Performance / Tracing**：分散トレース・スパンで遅いリクエストや N+1 を可視化。`tracesSampleRate`（開発 1.0 / 本番 0.1 が典型）。
- **Session Replay**：エラー時のユーザー操作・画面を動画のように再生。再現が難しいバグに有効。
- **Cron Monitoring**：定期ジョブ（Vercel Cron / AWS スケジュール）の実行漏れ・失敗を検知。
- **Uptime Monitoring**：エンドポイント死活監視。
- **Logs**：`enableLogs: true` で構造化ログを集約。エラーと同一画面で文脈確認。
- **Alerts**：新規 Issue・閾値超過などで Slack/メール通知。

## 3. Seer（AI デバッガ、GA 済み）

スタックトレース・ブレッドクラム・スパン・ログ・連携 GitHub リポジトリを横断して**根本原因を特定し修正案/PR を生成**する。3ステップ：Root Cause Analysis → Solution Identification → Code Generation。

- MCP の `analyze_issue_with_seer` から **Codex 経由で呼べる**（→ `mcp-servers.md`）。
- **Seer の利用は有料プラン or トライアルのユーザーが対象。**

## 4. Supabase 連携（公式インテグレーションあり）

`supabaseIntegration` で Supabase クライアントを計装し、DB 呼び出し/Auth のトレース・ブレッドクラム・エラーを収集。

```javascript
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [Sentry.supabaseIntegration({ supabaseClient })],
  tracesSampleRate: 0.1, // 本番。開発は 1.0
});
```

計装対象：
- **Auth**：`signInWithPassword` / `signOut` / `signInWithOAuth` / admin系 `createUser` 等
- **DB操作**：テーブル・スキーマ・URL・クエリパラメータ・リクエストボディ
- **エラー**：失敗操作のキャプチャ、DB操作のブレッドクラム付与

注意：
- 対応 `@supabase/supabase-js >= 2.0.0`。
- Next.js では `instrumentation-client.ts` / `sentry.server.config.ts` のどの環境に入れるか、対象ごとに検証する。
- **Supabase Edge Functions（Deno）** は別途 Sentry Deno SDK で監視（Supabase 公式手順あり）。
- ⚠️ DB操作のクエリパラメータ・リクエストボディには**PII が混入しやすい**。`security-and-pii.md` の `beforeSend` マスキングを必ず併用。

## 5. PII / セキュリティ

- **`sendDefaultPii`**：自動 PII 収集フラグ。デフォルト依存を避け、`Sentry.setUser()` で必要最小限のみ明示。
- **クライアント側スクラビング**：`beforeSend`（送信前にイベント改変）、`beforeBreadcrumb`（ブレッドクラム濾過）。
- **サーバー側 Data Scrubbing**：Sentry UI で設定し、そもそも保存させない。
- 混入しやすい箇所：スタックトレースのローカル変数、ブレッドクラム（ログ/DBクエリ）、HTTP クエリ文字列、トランザクション名のユーザー識別子。

詳細は `security-and-pii.md`。

## 6. 料金感（2026年6月時点）

イベントベース課金。プランは Developer（無料）/ Team / Business / Enterprise。

| 項目 | Developer（無料） | Team | Business |
|------|------------------|------|----------|
| 月額（年払い） | $0 | $26/mo | $80/mo |
| ユーザー | 1 | 無制限 | 無制限 |
| errors | 5K | 50K | 50K |
| spans | 5M | 5M | 5M |
| replays | 50 | 50 | 50 |
| data 保持 | — | 7日 | 90日 |

- 超過分は事前予約（PAYG比 約20%割引）か従量課金（PAYG）。
- Business 追加：SSO/SAML、カスタムダッシュボード、長期保持等。
- **野口さん向け**：Tier A は Developer 無料（5K errors）で開始 → 本番運用は Team（$26〜）。Seer 利用は有料プラン必須。
- ⚠️ 2025-08-27 にプラン改定あり。正確な数値・超過レートは決済直前に pricing で再確認。

## 7. 導入チェックリスト

- [ ] `npx @sentry/wizard@latest -i nextjs` でセットアップ
- [ ] `instrumentation-client.ts`（現行構成）を使用しているか
- [ ] `supabaseIntegration` で DB/Auth を計装
- [ ] `beforeSend` で PII マスキング
- [ ] CI に `SENTRY_AUTH_TOKEN` 設定、ソースマップアップロード確認
- [ ] 本番 `tracesSampleRate` を 0.1 程度に（コスト管理）
- [ ] `/sentry-example-page` でテストエラーが届くか検証
- [ ] アラート（新規 Issue → Slack/メール）を設定
- [ ] MCP サーバー接続（→ `mcp-servers.md`）

## 出典（一次ソース）

- Next.js SDK: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- Manual setup: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
- Seer: https://docs.sentry.io/product/ai-in-sentry/seer/ ・ https://sentry.io/product/seer/
- Supabase 連携: https://sentry.io/integrations/supabase/ ・ https://supabase.com/docs/guides/telemetry/sentry-monitoring ・ https://github.com/supabase-community/sentry-integration-js
- Sensitive Data: https://docs.sentry.io/platforms/javascript/data-management/sensitive-data/
- Pricing: https://sentry.io/pricing/
- MCP: https://mcp.sentry.dev/ ・ https://github.com/getsentry/sentry-mcp
