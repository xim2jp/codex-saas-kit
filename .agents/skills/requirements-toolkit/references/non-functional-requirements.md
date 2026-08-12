# 非機能要件（NFR）定義ガイド（v0.15.0）

要件定義の非機能要件を「性能・可用性・セキュリティ・運用」の一言で済ませず、**計測可能な目標値**として確定させるためのガイド。IPA「非機能要求グレード」の6大項目を、1名運用・Tier A 中心の野口さんSaaSに合わせて軽量化したもの。requirements-architect（フェーズ5の深掘り）、requirements-reviewer（欠落チェック）、test-planner（non-functional-tests.md への変換）、tech-stack-architect（Tier 選定の入力）が参照する。

## 原則

1. **全項目に数値または「対象外（理由）」を入れる**。「高い可用性」「十分な性能」は要件ではない
2. **Tier A 既定値から出発する**。1名運用SaaSで過剰な NFR は運用負荷・コストに直結する（野口Profile：過剰品質の警戒）
3. NFR は下流の直接入力になる：test-planner の non-functional-tests.md、tech-stack-architect の Tier 判定、cost-guardian の試算、observability の SLO/アラート閾値
4. requirements.md の「非機能要件」節は**下記6カテゴリの表形式**で書く（欠落カテゴリがあれば requirements-reviewer が Block）

## 6カテゴリと Tier A 既定値

### 1. 可用性

| 項目 | Tier A 既定値 | 記入欄 |
|------|--------------|--------|
| 稼働率目標（SLO） | 99.5%/月（Vercel/Supabase の SLA に依存。1名運用で 99.9% 保証は約束しない） | |
| 計画メンテナンス | 事前告知の上、深夜帯に実施可 | |
| RTO（復旧時間目標） | 営業時間内 4時間 / 夜間 翌営業開始まで（1名運用の現実値） | |
| RPO（データ損失許容） | 24時間（Supabase 日次バックアップ）。課金データは Stripe 側が正・実質0 | |
| 障害検知 | アラート通知から覚知まで（observability 設計と整合させる） | |

### 2. 性能・拡張性

| 項目 | Tier A 既定値 | 記入欄 |
|------|--------------|--------|
| 応答時間 | 主要画面 p95 < 1.5s、API p95 < 500ms、AI生成系は非同期＋進捗表示 | |
| 同時接続 | 想定 MAU と ピーク同時ユーザー数を明記（k6 負荷試験の目標値になる） | |
| データ量 | 1年後の想定レコード数・ストレージ（無料枠超過予測は cost-guardian へ） | |
| Core Web Vitals | LCP < 2.5s / INP < 200ms / CLS < 0.1（営業サイトは必須） | |
| スケール方針 | Tier A は Vercel/Supabase の自動スケールに委任。上限到達時の Tier B 移行条件を明記 | |

### 3. 運用・保守性

| 項目 | Tier A 既定値 | 記入欄 |
|------|--------------|--------|
| 運用体制 | 野口さん1名（前提として明記。24時間対応は約束しない） | |
| 監視 | エラー監視（Sentry 等）＋死活監視＋KPI（observability-integration 準拠） | |
| バックアップ・リストア | Supabase 標準＋リストア手順の文書化（年1回リストア演習） | |
| デプロイ | CI/CD 経由のみ（cicd-pipeline Skill 準拠）。ロールバック手順必須 | |
| サポート窓口・SLA | 問い合わせ応答目標（例：2営業日以内）。B2B 契約では明文化 | |

### 4. 移行性

| 項目 | 確認事項 | 記入欄 |
|------|---------|--------|
| 既存データ移行 | 有無・件数・形式・クレンジング責任・リハーサル要否 | |
| 並行稼働 | 旧システムとの並行期間・切り戻し条件 | |
| データエクスポート | 解約時のユーザーデータ持ち出し手段（CSV等。利用規約と整合） | |

### 5. セキュリティ

| 項目 | Tier A 既定値 | 記入欄 |
|------|--------------|--------|
| 認証・認可 | Supabase Auth＋RLS 全テーブル（security-auditor の監査対象） | |
| 個人情報 | 取得項目の最小化・保存場所・暗号化・PII のログ/監視ツール混入禁止 | |
| 通信・保存 | TLS 必須・at-rest はマネージド暗号化に委任 | |
| 脆弱性対応 | npm audit を CI で常時＋Critical は即時対応（軽量サイクル/ホットフィックス） | |
| 法令・規制 | 個人情報保護法・外部送信規律（legal-docs-generator と整合）。業界固有規制はここで列挙 | |
| 準拠目標・説明責任 | 参照する公的基準（IPA「安全なウェブサイトの作り方」対応表・SECURITY ACTION 自己宣言・ISO27001 附属書A対応表等）と、顧客向けセキュリティチェックシートの要否（`security-compliance` Skill 準拠、v0.16.0。顧客が ISMS 取得企業なら委託先評価回答が必要になる前提で確認） | |

### 6. システム環境・制約

| 項目 | 確認事項 | 記入欄 |
|------|---------|--------|
| 対応ブラウザ・デバイス | 既定：Chrome/Edge/Safari/Firefox 最新版＋モバイルブラウザ。IE 非対応を明記 | |
| 多言語・多通貨 | 対象言語・通貨（i18n-and-currency Skill）。日本語のみなら「対象外」と明記 | |
| 外部依存 | 依存 SaaS（Stripe/AI API 等）の障害時方針（resilience-testing の演習対象） | |
| 予算制約 | 月額ランニングコスト上限（cost-guardian の試算と往復。野口さん財務制約：一括払いのみ） | |

## フェーズ間の接続（NFR の流れ）

```
Phase 1 requirements-architect が本ガイドの表を埋める（requirements.md §非機能要件）
  → Phase 2 requirements-reviewer：6カテゴリ網羅＋数値化を検証（曖昧語は Block）
  → Phase 3 tech-stack-architect：可用性・性能・規制強度から Tier 判定
  → Phase 9 test-planner：non-functional-tests.md に変換（k6 目標値・a11y 対象・障害シナリオ）
  → Phase 15 kpi-baseline.md：SLO・エラー率の初期目標として引き継ぐ
```

## アンチパターン

- 「高速」「安定」「セキュア」のまま確定する（検証不能。requirements-reviewer は曖昧語として Block）
- 1名運用で 99.99% や 24時間対応を約束する（守れない SLA は契約リスク。Tier A 既定値から交渉する）
- NFR を要件定義で書いたきり、テスト計画・監視設計に接続しない（書きっぱなしの NFR は無いのと同じ）
- 全カテゴリを Tier B 相当で盛る（コスト・運用負荷の過剰。既定値との差分には理由を書く）
