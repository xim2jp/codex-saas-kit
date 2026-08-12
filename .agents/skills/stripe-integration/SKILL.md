---
name: stripe-integration
description: SaaS の月額定額決済を Stripe で実装するための知識集。アーキテクチャパターン、サブスクリプション設計、Webhook 処理、日本の税務・適格請求書（インボイス制度）対応、テスト戦略、PCI DSS 準拠のセキュリティチェックリストを収録する。決済の設計・実装・レビューの全フェーズで payment-integration-specialist / implementation-worker らが参照する。「Stripe」「サブスク」「決済」「課金」「Webhook」「インボイス制度」「適格請求書」で参照。
---

# Stripe Integration Skill

SaaS の月額定額決済を Stripe で実装するための知識集。野口さんの「SaaS を量産」方針を支える基盤Skill。

## いつこのSkillを参照するか

以下の場面で必ず読む：

- **要件定義**：課金モデル（プラン構造、トライアル、年契約）の決定時
- **技術スタック選定**：決済プロバイダ選定の根拠記録時
- **外部設計**：決済画面、価格表、サブスク管理画面、解約フローの設計時
- **内部設計**：Webhookハンドリング、Subscription状態遷移、Customer/Subscription/Invoiceのデータモデル設計時
- **テスト計画**：決済関連テストケースの策定時
- **実装**：Stripe SDKの実装時
- **レビュー**：上記成果物のレビュー時

## 重要原則（必読）

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

### 5. テスト → 本番の切り分け

`sk_test_*` と `sk_live_*` の混同は致命的。環境変数で厳密分離、CI/CDで誤デプロイ防止。

## このSkillの構成

```
stripe-integration/
├── SKILL.md                                # 本ファイル
└── references/
    ├── architecture-patterns.md            # アーキテクチャ選択（Checkout vs Elements vs PaymentIntent）
    ├── subscription-design.md              # サブスク設計（プラン、トライアル、アップグレード、解約）
    ├── webhook-handling.md                 # Webhook受信、署名検証、Idempotency、リトライ
    ├── tax-compliance-jp.md                # インボイス制度、消費税、登録番号
    ├── testing-strategy.md                 # テスト戦略（テストモード、Stripe CLI、Webhookテスト）
    └── security-checklist.md               # セキュリティチェックリスト
```

## エージェント別の使い方ガイド

### tech-stack-architect

ADR-XXXX として決済選定を記録：
- 決済プロバイダ：Stripe（決定）
- 統合方式：Stripe Checkout + Customer Portal（推奨）
- 税対応：Stripe Tax 有効化、適格請求書発行事業者として登録番号設定

### external-designer

以下の画面・APIを設計：
- 価格ページ（marketing-site-builder と協業）
- チェックアウトボタン（Stripe Checkout へのリダイレクト）
- サブスク管理画面（Customer Portal リンク提供）
- 決済成功・失敗のリダイレクト先
- Webhook エンドポイント仕様
- 解約後のデータ保持・削除ポリシー

### internal-designer

以下を設計：
- `lib/stripe/` ディレクトリ構造
- Webhook ハンドラの状態機械
- Subscription / Customer / Invoice の自社DB側モデル
- Stripe イベントと自社モデルの同期戦略
- リトライ・エラーハンドリング

### test-planner / tester

- Stripe テストカード一覧でのテスト
- Stripe CLI による Webhook ローカルテスト
- 3DSecure 必須シナリオのテスト
- リトライ・冪等性テスト
- 失敗パターン（カード拒否、不正、限度額超過）の網羅

### implementation-worker

- `stripe` npm パッケージ最新版を使用
- API バージョンを明示固定（年単位の互換性）
- 環境変数で `sk_test_*` と `sk_live_*` を厳密分離
- Webhook で `stripe.webhooks.constructEvent` 使用

### payment-integration-specialist（専用エージェント）

決済関連の設計・実装の品質を横断的に担保。詳細は `agents/payment-integration-specialist.md` 参照。

## 参照ファイル一覧の読み方

| ファイル | 必読タイミング |
|---------|--------------|
| `architecture-patterns.md` | 決済方式選定時（Checkout / Elements / PaymentIntent） |
| `subscription-design.md` | サブスクのプラン・料金設計時 |
| `webhook-handling.md` | Webhook実装時 |
| `tax-compliance-jp.md` | 課金前・実装前（インボイス制度を必ず読む） |
| `testing-strategy.md` | テスト計画策定時、実装中 |
| `security-checklist.md` | レビュー時、デプロイ前 |

## 野口さん固有のチェック

- [ ] 適格請求書発行事業者の登録番号（T + 13桁）を Stripe Dashboard に設定
- [ ] 消費税率（10%）と内税/外税の選択
- [ ] 端数処理ルール（subtotal 単位での丸め）
- [ ] 月額定額の料金体系
- [ ] 年契約割引の必要性
- [ ] 1名運用負荷の最小化（Stripe Hostedを最大活用）
- [ ] 民事再生中の与信影響（Stripe側の本人確認・KYC対応）

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
