# ROADMAP

野口さんSaaSフレームワークの将来計画。

## Phase 1：基盤確立期（v0.1.0 → v0.5.0）

**目標**: 3案件で実運用、還流ループの実証

### マイルストーン

- [x] v0.1.0：初期リリース（21エージェント + 7 Skill）
- [x] v0.2.0：オブザバビリティ統合・AI通話・モバイル・LINE・E2E/トレーサビリティ強化（28エージェント体制の基盤）
- [x] v0.3.0：SEO / AIO 統合（seo-toolkit + seo-specialist）
- [x] v0.4.0：プロモーション動画生成（promo-video-toolkit + promo-video-producer）
- [x] v0.5.0：修正ループ（Block自動手戻り・上限5回・rework-loop.md）＋ 画面HTMLモック必須化と ui-mockup-reviewer（29エージェント体制）、main PR 二重レビューゲート、バージョン正本一元化
- [x] v0.6.0：AI向けSaaS提供（MCPサーバー化・mcp-server-specialist・agent-experience-reviewer）、セキュリティ監査（security-auditor）、負荷/障害耐性テスト（resilience-testing）、ビジネス運用系5エージェント（法務文書・価格戦略・オンボーディング・ブログ・コスト監視）、analytics-integration・i18n-and-currency・fleet-operations（37エージェント + 20 Skill体制）
- [x] v0.7.0：SNS広告戦略（paid-ads-toolkit + ad-strategy-specialist）。SEO/AIOだけでは頭打ちになる競合過多カテゴリ向けの有料広告集客（Meta/TikTok/X/LINE広告）、財務制約対応の予算設計、CAC/LTV管理、景品表示法・ステマ規制対応（38エージェント + 21 Skill体制）
- [x] v0.8.0：Codex CLI への移植初版整備
- [x] v0.9.0：営業ポータルモック必須化＋ローカル開発環境（Docker完結）のタスク0組み込み（Claude 版 v0.8.0 の移植）
- [x] v0.10.0：terraform-mcp Skill 追加（Codex 独自）
- [x] v0.11.0：SNS縦型ショート動画の実証済み制作レシピ（Claude 版 v0.9.0 の移植）
- [x] v0.12.0：テスト重厚化（test-case-adversary / exploratory-tester・Phase 12.5・ミューテーション・バグエスケープ台帳。Claude 版 v0.10.0 の移植、40エージェント体制）
- [x] v0.13.0：4階層PDCA・円環SDLC（Phase 15-17・operations-analyst / retrospective-facilitator・軽量チェンジサイクル・Self-Check・ループ計測。Claude 版 v0.11.0 の移植、42エージェント体制）
- [x] v0.14.0：派生システム配布機構（互換性契約・.codex-manifest 3分類更新・一括エクスポート・ドリフト検知。Claude 版 v0.12.0 の移植）
- [x] v0.15.0：非機能要件6カテゴリ必須化＋IaC マルチクラウド／CI/CD／外部ツールカタログ（Claude 版 v0.13.0 の移植、27 Skill 体制）
- [x] v0.16.0：セキュリティ基準参照とアカウンタビリティ（security-compliance Skill。Claude 版 v0.14.0 の移植、28 Skill 体制）
- [x] v0.17.0：文書カタログ・HTML公開文書体系（htmldocs）・文書セット選択制（Claude 版 v0.15.0 の移植）
- [x] v0.18.0・v0.19.0：欠番（Claude Code 版との版数対応 +2 を保つため。内容は v0.20.0 に含む）
- [x] v0.20.0：Claude Code 版 v0.16.0〜v0.18.0 の移植。**企画・戦略の上流 4 フェーズ**（concept-planner / concept-reviewer / business-strategist / business-strategy-reviewer、business-strategy-toolkit Skill）と全フェーズ採番し直し（旧 1-17 → 5-21、12.5 → 16.5。BREAKING）、**要件定義 Skill の IPA 準拠刷新**（BR→SR 2 層・記述規約・BZ/UC/NFR/ROLE/用語集/OQ テンプレ）、**ハーネスの最新モデル向け刷新**（全エージェントを役割憲章に、モデル継承、共通契約の一本化、MCP 雛形、check-harness.sh）。46 エージェント + 29 Skill 体制
- [x] v0.21.0：Claude Code 版 v0.19.0 の移植。**Stripe の QR 決済（PayPay）対応**。stripe-integration に `qr-payments-paypay.md` を追加（単発決済専用・サブスク不可の制約、期間パス／買い切り／付帯料金の使いどころ、加盟店審査、実装、テスト）、payment-integration-specialist の担当範囲に追加
- [ ] v0.22.0：案件運用の知見を統合した安定版

※ v0.2.0〜v0.16.0 は機能拡張リリースとなった。案件知見の還流は円環構造（Phase 17）と配布機構で構造的に支援され、v0.17.0 以降で実データ還流を本格化する。

### 期待される改善（仮説）

- 各エージェントのプロンプト最適化
- 業界特化のチェックリスト追加
- 案件タイプ別のテンプレ整備
- 想定外シナリオへの対応強化

## Phase 2：CLI化検討期（v0.5.0 → v0.8.0）

**条件**: 3〜5案件運用実績、還流ループが安定

### 検討項目

- npm package 化（`@noguchi/saas-framework`）
- `npx @noguchi/saas-framework init` コマンド
- `npx @noguchi/saas-framework update --interactive` コマンド
- 既存案件への配信自動化
- バージョン差分の自動表示

### 判断軸

CLI化に投資すべきか：
- 案件追加頻度（月1件以上なら投資ROI高い）
- 還流の手間（手動で苦痛になっていればCLI化）
- 案件側のカスタマイズ頻度（多いと CLI化が逆効果）

## Phase 3：成熟期（v1.0.0 以降）

**条件**: 5案件以上、CLI化済み、安定運用

### 構想

- 共通基盤の `lib/` パッケージ化
  - `@noguchi/saas-auth`（Supabase Auth ラッパー）
  - `@noguchi/saas-billing`（Stripe ラッパー）
  - `@noguchi/saas-marketing`（営業サイトコンポーネント）
- テスト基盤の標準化
- CI/CD テンプレート
- モニタリング標準セット

## Phase 4：商品化検討期（v2.0.0 以降）

**条件**: 10案件以上、月額収入家計成立

### 検討項目

- フレームワーク自体の有料配布
  - 他フリーランス向け
  - 月額制 or 買い切り
- コンサルティングサービス
- 業界別のテンプレ販売

これは**最後の選択肢**。本業に集中することを優先。

## 機能ロードマップ

### 認証拡張（v0.x で対応）

- [ ] Magic Link
- [ ] Passkey / WebAuthn
- [ ] MFA / 2FA
- [ ] SSO / SAML（エンタープライズ向け）

### 統合拡張

- [x] LIFF統合の専用Skill（v0.2.0 候補で対応：`line-liff-development` Skill + `line-platform-specialist` エージェント）
- [x] Analytics連携（v0.6.0：`analytics-integration` Skill。PostHog / GA4 / Vercel Analytics）
- [x] エラー監視（Sentry）の標準セット（v0.2.0：`observability-integration` Skill + specialist）
- [ ] Slack/Discord通知
- [x] AI向けSaaS提供（v0.6.0：`mcp-server-development` Skill + `mcp-server-specialist` / `agent-experience-reviewer`。MCPサーバー化）
- [x] SNS広告連携（v0.7.0：`paid-ads-toolkit` Skill + `ad-strategy-specialist`。Meta/TikTok/X/LINE広告、SEOだけでは限界がある競合過多カテゴリの集客加速）

### A/Bテスト・最適化

- [ ] A/Bテスト基盤
- [x] 価格最適化エージェント（v0.6.0：`pricing-strategist`）
- [ ] コンバージョン分析（`analytics-integration` のファネル定義で一部カバー）

### 国際化

- [x] 多言語対応（i18n）（v0.6.0：`i18n-and-currency` Skill）
- [x] 多通貨対応（Stripe Tax 連携）（v0.6.0：`i18n-and-currency` Skill）

### コンテンツ・SEO

- [x] ブログ基盤の標準セット（v0.6.0：`blog-content-producer` エージェント）
- [x] SEO 自動化エージェント（v0.3.0：`seo-specialist`。v0.6.0でブログ量産まで拡張）
- [ ] サイトマップ自動生成（`seo-toolkit` の Next.js `sitemap.ts` 手動実装は既にカバー。完全自動化は未着手）

### 運用支援

- [ ] cron / scheduled function の標準パターン
- [ ] バッチ処理基盤
- [ ] データバックアップ自動化
- [x] 複数SaaS艦隊運用（v0.6.0：`fleet-operations` Skill。横串ダッシュボード設計・インシデント優先順位付け・月次棚卸し）
- [x] コスト監視・無料枠超過アラート（v0.6.0：`cost-guardian` エージェント）

### 品質・法務（v0.6.0 新規カテゴリ）

- [x] セキュリティ監査の専任ゲート（`security-auditor`。RLS全数監査・OWASP Top 10・シークレットスキャン・依存関係監査。Phase 14 並列）
- [x] 負荷・障害耐性テスト（`resilience-testing` Skill。k6負荷試験、Supabase/Stripe/AI API障害時のフォールバック演習）
- [x] ビジュアルリグレッション（モック vs 実装）・axe-core a11y自動チェック（`e2e-browser-testing` 拡張）
- [x] 法務文書生成（`legal-docs-generator`。利用規約・プライバシーポリシー・特商法表記・外部送信規律の雛形）
- [ ] カスタマーサポート自動化の実運用検証（`customer-support-toolkit` Skill は整備済み、実案件での検証は未実施）

## 撤退条件

以下のいずれかに該当したらフレームワーク開発を見直す：

- 6ヶ月間案件追加なし
- 還流ループが3ヶ月以上停止
- 維持コストが収益を上回る
- 野口さん本人の健康・家庭事情で運用継続困難

撤退する場合：

1. アクティブ案件は維持
2. 新規案件には適用しない
3. ドキュメント化して凍結保存

## 次の3ヶ月の優先項目

1. **最初の実案件で1サイクル回す**（最優先）
2. **PROJECT_LEARNINGS.md を毎日書く習慣を作る**
3. **月末に必ず月次レビューを実施**
4. **v0.1.x の patch リリースを最低1回出す**

---

このロードマップは野口さんの状況に応じて柔軟に変更可。固執しない。
