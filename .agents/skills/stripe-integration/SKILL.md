---
name: stripe-integration
description: SaaS の月額定額決済を Stripe で実装するための知識集。アーキテクチャパターン（Checkout / Elements / PaymentIntent）、サブスクリプション設計、Webhook 処理（署名検証・冪等性・リトライ）、日本の税務・適格請求書（インボイス制度）対応、QR 決済（PayPay。単発決済専用）の使いどころ、テスト戦略、PCI DSS 準拠のセキュリティチェックリストを収録する。課金モデルの要件定義から決済の設計・実装・テスト・レビューまで参照する。「Stripe」「サブスク」「決済」「課金」「Webhook」「インボイス制度」「適格請求書」「PayPay」「QR決済」で参照。
---

# Stripe Integration Skill

SaaS の月額定額決済を Stripe で実装するための知識集。野口さんの「SaaS を量産」方針を支える基盤Skill。

課金モデル（プラン構造・トライアル・年契約）を決める要件定義から、決済プロバイダの選定、画面・データモデル設計、テスト、実装、レビューまで、決済に触れる全フェーズで参照する。

## 重要原則

### 1. Stripe Checkout / Customer Portal を最大活用

野口さんは1名運用＋民事再生中の財務制約。**自前で決済UIを作らない**。Stripe Checkout（ホスト決済画面）と Customer Portal（ホスト顧客ポータル）を使えば、PCI DSS 対応、3DSecure、解約フロー、領収書発行、税ID登録などが Stripe 側で完結。

> **基本方針：自前のフォームでカード情報を扱わない。常にStripe Hostedを優先。**

### 2. インボイス制度（適格請求書）対応

野口さんは**適格請求書発行事業者として登録済み**。これは2026年10月以降、経過措置の控除率が80%から50%に下がる中で重要な強みとなる。

> **Stripe 設定で登録番号（T+13桁）を Tax ID として必ず設定する。**

### 3. Webhook 署名検証

Webhook はインターネット公開のエンドポイント。**署名検証なしの実装は重大な脆弱性**。`stripe.webhooks.constructEvent` で必ず検証。

### 4. Idempotency Key

決済リクエストは**必ず冪等キーを付ける**。リトライ時の二重課金を防ぐ。

### 5. QR 決済（PayPay）は単発専用

Stripe は PayPay に対応しているが、**サブスクには使えない**（Checkout は `mode: 'payment'` のみ）。月額課金の本体はカードの自動更新のままとし、PayPay は期間パス（前払い）・買い切り・単発の付帯料金に限って足す。手数料は 3.98%（デジタルコンテンツ区分は 9.48%）で、PayPay の加盟店審査がある。

### 6. テスト → 本番の切り分け

`sk_test_*` と `sk_live_*` の混同は致命的。環境変数で厳密分離、CI/CDで誤デプロイ防止。

## 参照ファイル

| ファイル | 内容 | いつ読むか |
|---------|------|-----------|
| `references/architecture-patterns.md` | アーキテクチャ選択（Checkout vs Elements vs PaymentIntent） | 決済方式の選定時 |
| `references/subscription-design.md` | サブスク設計（プラン、トライアル、アップグレード、解約） | プラン・料金設計時 |
| `references/webhook-handling.md` | Webhook 受信、署名検証、Idempotency、リトライ | Webhook 実装時 |
| `references/qr-payments-paypay.md` | PayPay の仕様・制約、期間パス設計、有効化審査、実装、テスト | QR 決済の要望が出たとき、B2C で決済手段を決めるとき |
| `references/tax-compliance-jp.md` | インボイス制度、消費税、登録番号 | 課金前・実装前（必ず読む） |
| `references/testing-strategy.md` | テストモード、Stripe CLI、Webhook テスト | テスト計画策定時、実装中 |
| `references/security-checklist.md` | セキュリティチェックリスト | レビュー時、デプロイ前 |

## フェーズ別の設計観点

- **技術選定（ADR）**：決済プロバイダは Stripe、統合方式は Stripe Checkout + Customer Portal を推奨、税対応は Stripe Tax を有効化し適格請求書発行事業者の登録番号を設定する。PayPay を採る場合は当てる課金（期間パス／買い切り／付帯料金）と手数料区分を ADR に残す
- **外部設計**：価格ページ（営業サイトと協業）、チェックアウトボタン（Stripe Checkout へのリダイレクト）、サブスク管理画面（Customer Portal リンク）、決済成功・失敗のリダイレクト先、Webhook エンドポイント仕様、解約後のデータ保持・削除ポリシー
- **内部設計**：`lib/stripe/` のディレクトリ構造、Webhook ハンドラの状態機械、Subscription / Customer / Invoice の自社 DB 側モデル、Stripe イベントと自社モデルの同期戦略、リトライ・エラーハンドリング
- **テスト**：Stripe テストカード一覧、Stripe CLI による Webhook ローカルテスト、3DSecure 必須シナリオ、リトライ・冪等性、失敗パターン（カード拒否、不正、限度額超過）の網羅
- **実装**：`stripe` npm パッケージは最新版、API バージョンは明示固定（年単位の互換性）、`sk_test_*` と `sk_live_*` は環境変数で厳密分離、Webhook は `stripe.webhooks.constructEvent` で検証する

## 野口さん固有のチェック

- [ ] 適格請求書発行事業者の登録番号（T + 13桁）を Stripe Dashboard に設定
- [ ] 消費税率（10%）と内税/外税の選択
- [ ] 端数処理ルール（subtotal 単位での丸め）
- [ ] 月額定額の料金体系
- [ ] 年契約割引の必要性
- [ ] 1名運用負荷の最小化（Stripe Hostedを最大活用）
- [ ] 民事再生中の与信影響（Stripe側の本人確認・KYC対応）
- [ ] PayPay を使う場合、加盟店審査（特商法ページ・法人情報の一致）と手数料区分の確認

## アンチパターン（よくある失敗）

1. **カード情報を自前のサーバーに送る**：PCI DSS違反
2. **Webhook 署名検証なし**：偽イベントで状態を改ざんされる
3. **Idempotency key なしのリトライ**：二重課金
4. **テストモードで本番デモ**：本番キーで動かしたまま忘れる
5. **Subscription 状態を自社DBで先に書き換え**：Webhookが Source of Truth
6. **エラー時のリトライ無限ループ**：指数バックオフ・最大回数を必ず
7. **税IDをカスタマー側で管理しない**：B2B顧客の請求書要件に対応できない
8. **解約フローを自前で実装**：Customer Portalを使う
9. **3DSecure を考慮しない**：日本でも必須化が進む
10. **`api_version` を固定しない**：将来の破壊的変更で突然動かなくなる
11. **PayPay でサブスクを組もうとする**：継続課金は非対応。期間パスにするなら期限前リマインドと再購入導線が必須
