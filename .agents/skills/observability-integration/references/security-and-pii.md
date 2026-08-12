# セキュリティ・PII 対策・データ最小化

監視ツールは本番のエラー・トレース・ログを集める性質上、**個人情報が最も混入しやすいシステム**。一度保存された PII は3ツールとも「後から自分で消せない」のが原則。**取り込み前に止める**を徹底する。

## 1. 大原則：保存後は消せない → 取り込み前にマスク

| ツール | 取り込み前の防御手段 |
|--------|---------------------|
| **Sentry** | `beforeSend` / `beforeBreadcrumb`（クライアント側で送信前に改変）、UI の Data Scrubbing |
| **New Relic** | Drop Filter Rules（NRDB 書き込み前に破棄）、Log obfuscation（MASK/HASH、Data Plus） |
| **Datadog** | Sensitive Data Scanner（保存前に Logs/APM/RUM 横断で Redact/Hash/Mask、上位プラン）、RUM `defaultPrivacyLevel` |

> Supabase 由来のユーザーデータ（メール・氏名・電話・住所）がログ/スタックトレース/DB クエリに乗る前提で設計する。

## 2. PII が混入しやすい箇所（チェックすべき場所）

- **スタックトレースのローカル変数**（ユーザーオブジェクトがそのまま）
- **ブレッドクラム**（DB クエリ、ログ出力、HTTP リクエスト）
- **HTTP クエリ文字列・リクエストボディ**（`?email=...`、フォーム送信）
- **トランザクション名/URL** にユーザー識別子
- **DB 計装のクエリパラメータ・行データ**（Sentry supabaseIntegration 等）
- **Session Replay / RUM の画面録画**（入力欄に氏名・カード番号）
- **カスタムイベントのプロパティ**（つい user オブジェクトを丸ごと添付）

## 3. ツール別マスキング実装

### Sentry：`beforeSend`

```javascript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false, // 自動PII収集を無効
  beforeSend(event) {
    // 例：リクエストデータからメールを除去
    if (event.request?.data) {
      delete event.request.data.email;
      delete event.request.data.password;
    }
    return event;
  },
});
// ユーザー識別は最小限（生メールでなく匿名ID）
Sentry.setUser({ id: anonymizedUserId });
```

- Session Replay は入力欄をデフォルトでマスク（`maskAllText` / `maskAllInputs` を活かす）。

### New Relic：Drop Rules + Obfuscation

- **Drop Filter Rules**：NRQL にマッチしたログ/属性を取り込み前に破棄（PII 除去 + コスト削減）。
- **Log obfuscation**：正規表現で MASK（X 置換）or HASH（SHA-256、突合可能）。custom obfuscation は **Data Plus** 機能。
- 自動難読化（クレカ/SSN）は全アカウント標準有効。

### Datadog：Sensitive Data Scanner + RUM Privacy

- **SDS**：保存前に Logs/APM/RUM 横断スキャン → Redact/Partial/Hash/Mask（上位プラン/別課金）。
- **RUM**：`defaultPrivacyLevel: 'mask-user-input'`（入力値をマスク）。ブラウザ送信前にデータ変更可。
- **APM**：Configure Data Security でクエリ文字列・タグを除去/難読化。

## 4. キー管理（公開 vs 秘密の分離）

| キー | 区分 | 置き場所 |
|------|------|---------|
| Sentry DSN | 公開（ブラウザに出る） | `NEXT_PUBLIC_SENTRY_DSN` |
| Sentry `SENTRY_AUTH_TOKEN` | **秘密**（ソースマップ用） | CI/CD 環境変数のみ |
| Datadog `clientToken` | 公開（RUM 用） | `NEXT_PUBLIC_...` |
| Datadog `DD_API_KEY` / App key | **秘密** | サーバー環境変数のみ |
| New Relic Browser snippet | 公開 | HTML に注入 |
| New Relic License key | **秘密**（計装） | サーバー環境変数のみ |
| New Relic User key `NRAK-` | **秘密**（MCP/API） | MCP 設定・CI のみ |

ルール：
- 秘密キーは**コミットしない**。`.env*` を `.gitignore` し、`config.toml` の MCP 設定にはキーを直書きせず環境変数参照（`env_http_headers` / `bearer_token_env_var`）を使う。
- `.env.example` にキー名だけ列挙（値は空）。
- MCP は最小権限のスコープ付きキー/サービスアカウント（→ `mcp-servers.md`）。
- ローテーション可能にしておく（漏洩時に差し替え）。

## 5. データ最小化・保持・コンプラ

- **取らないのが最強の保護**：そもそも PII を計装に含めない設計が第一。
- **リージョン**：US/EU/AP。データ保存先の国を要件（個人情報保護法・越境移転）と照合。New Relic MCP は FedRAMP/HIPAA アカウントで利用不可等の制約あり。
- **保持期間**：必要最小限に。長期保持は上位プラン課金にもなる。
- **アクセス制御**：監視ダッシュボードへのアクセス権を絞る（本番データが見える）。
- **越境移転の開示**：プライバシーポリシーに監視ツール（第三者）への提供を記載（`requirements-architect` と連携）。

## 6. レビュー用チェックリスト（implementation-reviewer / デプロイ前）

- [ ] `sendDefaultPii: false`（Sentry）等、自動PII収集を抑止
- [ ] `beforeSend` / drop rules / SDS で PII を取り込み前にマスク
- [ ] Session Replay / RUM の入力欄マスクが有効
- [ ] DB 計装（Supabase）のクエリ/行データに生PIIが乗っていない
- [ ] カスタムイベントに user オブジェクトを丸ごと添付していない
- [ ] 秘密キーがコード/コミットに含まれない（`.env` が gitignore、`config.toml` にキー直書きなし）
- [ ] 公開キーと秘密キーが正しく分離（特に New Relic の License/User key）
- [ ] データ保存リージョンが越境移転要件に適合
- [ ] プライバシーポリシーに監視ツールへの第三者提供を記載
- [ ] アラート通知（Slack/メール）に PII を載せていない

## 出典（一次ソース）

- Sentry Sensitive Data: https://docs.sentry.io/platforms/javascript/data-management/sensitive-data/
- New Relic obfuscation: https://docs.newrelic.com/docs/logs/ui-data/obfuscation-ui/
- New Relic drop rules: https://docs.newrelic.com/docs/logs/ui-data/drop-data-drop-filter-rules/
- New Relic data privacy: https://docs.newrelic.com/docs/security/security-privacy/data-privacy/data-privacy-new-relic/
- Datadog SDS: https://docs.datadoghq.com/security/sensitive_data_scanner/
- Datadog RUM security: https://docs.datadoghq.com/data_security/real_user_monitoring/
