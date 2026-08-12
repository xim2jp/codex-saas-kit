# 計装パターン（Next.js / Supabase / Vercel / ECS Fargate）と検証

野口Profile のスタックに監視 SDK を組み込む際の配置・初期化順序・トレース相関・検証方法。ツール横断の共通原則をまとめる。各ツール固有の手順は `sentry.md` / `newrelic.md` / `datadog.md`。

## 1. 計装レイヤーの全体像

SaaS は層ごとに監視点が異なる。漏れなく押さえる：

| レイヤー | 監視点 | 主なツール |
|---------|--------|-----------|
| ブラウザ（フロント） | JS エラー、Core Web Vitals、ユーザー操作再現 | Sentry（Replay）/ Datadog RUM / New Relic Browser |
| Next.js サーバー/Edge | API レイテンシ、例外、トランザクション | Sentry / New Relic APM / dd-trace |
| Supabase（DB/Auth） | クエリ遅延、Auth 失敗、RLS エラー | Sentry supabaseIntegration / APM のDB計装 |
| 外部連携（Stripe/LINE 等） | Webhook 失敗、API 呼び出しエラー | 各 APM のHTTP計装 + カスタムイベント |
| インフラ（ECS Fargate） | CPU/メモリ、コンテナ死活 | New Relic Infra / Datadog Agent |
| 定期ジョブ（Cron） | 実行漏れ・失敗 | Sentry Cron Monitoring |

## 2. 初期化順序の鉄則

**APM agent / トレーサは、アプリの他のどの import よりも先にロードする。** 後にロードすると一部ライブラリが計測されない。

- New Relic / dd-trace：`-r`（`--require`）プリロードで最初に読む。
- Next.js：`instrumentation.ts`（Sentry）や `NODE_OPTIONS='-r ...'` を使う。
- ⚠️ Babel/トランスパイラ併用時は先頭 `require()` 方式が壊れやすい → プリロード方式を使う。

## 3. トレース相関（フロント↔バック↔DB）

「目視で原因を追える」ためには、1リクエストが層をまたいで**1本のトレースとして繋がる**ことが重要。

- **trace context の伝播**：W3C Trace Context（`traceparent` ヘッダ）でフロント→バックを連結。
- **RUM ↔ APM 連携**：Datadog/New Relic は RUM とバックエンドトレースを相関設定で1画面に。
- **trace ↔ log 相関**：構造化ログに `trace_id` / `span_id` を含め、エラートランザクションから該当ログへジャンプできるように。
- **Vercel の注意**：trace 相関には OTel の service 名を一致させる（Datadog は Vercel プロジェクト名と一致が必須）。

## 4. 構造化ログのスキーマ（共通）

ログは「あとで検索・相関できる」形で出す。最低限のフィールド：

```json
{
  "level": "error",
  "message": "supabase insert failed",
  "trace_id": "<APMと相関するID>",
  "service": "coupon-rader-web",
  "env": "production",
  "user_id": "<匿名化IDまたは省略>",
  "route": "/api/coupons",
  "error": { "name": "...", "code": "..." }
}
```

- `user_id` は**生のメール/氏名を入れない**（→ `security-and-pii.md`）。
- `env` を必ず付け、本番/ステージング/開発を分離（アラート誤発火防止）。

## 5. サンプリング戦略（コスト vs 可視性）

- **エラー/例外**：100%（取りこぼし厳禁）。
- **トレース（正常系）**：開発 100% / 本番 10%（`tracesSampleRate: 0.1` 等）。トラフィック次第でさらに下げる。
- **Session Replay**：全セッションは高コスト。エラー発生セッションは100%、通常は数%（`replaysOnErrorSampleRate: 1.0`, `replaysSessionSampleRate: 0.1` 等）。
- **ログ**：全件送ると取り込み量が膨らむ。debug レベルは本番で抑制、必要な構造化ログに絞る。

## 6. Supabase 特有の計装ポイント

- **Auth 失敗**：ログイン失敗・トークン期限切れ・OAuth コールバックエラーをイベント化。
- **RLS 違反**：ポリシーで弾かれたクエリは静かに空を返しがち → 明示的にログ/イベント化して気付けるように。
- **Edge Functions（Deno）**：Next.js とは別ランタイム。Sentry Deno SDK 等で個別計装。
- **Realtime / Storage**：使っていれば接続エラー・アップロード失敗を計装。
- ⚠️ クエリパラメータ・行データに PII が乗るため、DB 計装は必ずマスキングとセット。

## 7. 外部連携の計装（Stripe / LINE 等）

- **Webhook 受信失敗**は売上・通知に直結 → 専用アラート。Stripe Webhook 署名検証失敗、LINE 配信失敗をイベント化。
- 外部 API 呼び出しは HTTP スパンとして自動計装されることが多いが、**ビジネス的に重要な失敗**（決済確定失敗等）はカスタムイベント＋アラートで明示。
- `stripe-integration` / `line-liff-development` Skill と連携。

## 8. テレメトリの検証（計装が「実際に届く」ことを確認）

入れただけで満足しない。**意図的に異常を起こして届くか**を必ず検証する。

### エラーが届くか

- Sentry：ウィザードが作る `/sentry-example-page` でテストエラーを発火 → ダッシュボードに出るか。
- 任意：一時的に `throw new Error("obs-test")` を仕込み、本番相当環境で確認 → 確認後に削除。

### トレース/APM が届くか

- 代表的な API を叩き、APM のトランザクション一覧に出るか、レイテンシが記録されるか。
- フロント→バックのトレースが1本に繋がっているか（trace_id 相関）。

### ログ相関が効くか

- エラートランザクションから該当ログにジャンプできるか（`trace_id` が両方に入っているか）。

### アラートが発火するか

- ステージングで閾値を一時的に下げ、条件を満たして **Slack/メールに実際に通知が届く**か（→ `alerting-and-dashboards.md`）。

### ソースマップ（Sentry/フロント）

- 本番ビルドのスタックトレースが minify されず、元のファイル名・行番号で読めるか。

### E2E との接続

- `e2e-usecase-tester` のシナリオでフロントエラーを起こし、RUM/Browser に記録されるか確認。

## 9. 計装チェックリスト

- [ ] APM/トレーサを最初にロード（プリロード方式）
- [ ] 全レイヤー（ブラウザ/サーバー/DB/外部連携/インフラ/Cron）に監視点
- [ ] trace context をフロント↔バックで伝播、log に trace_id
- [ ] `env` でステージング/本番を分離
- [ ] 本番サンプリング（エラー100% / トレース10% / Replay はエラー時100%）
- [ ] Supabase Auth 失敗・RLS 違反を可視化
- [ ] Stripe/LINE の Webhook 失敗を専用アラート
- [ ] テストエラー/トレース/アラートが実際に届くか検証済み
- [ ] ソースマップで本番スタックトレースが可読

## 出典（一次ソース）

- Sentry Next.js: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- New Relic Next.js: https://github.com/newrelic/newrelic-node-nextjs
- dd-trace Node.js: https://docs.datadoghq.com/tracing/trace_collection/dd_libraries/nodejs/
- Next.js OpenTelemetry: https://nextjs.org/docs/app/guides/open-telemetry
- W3C Trace Context: https://www.w3.org/TR/trace-context/
