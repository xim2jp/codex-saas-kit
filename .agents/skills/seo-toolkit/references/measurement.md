# 計測と改善ループ

SEO/AIO は**公開して終わりではない**。結果が出るまで数週間〜数ヶ月かかり、出た後も変動する。**無料ツール（Search Console + GA4）で計測導線を最初から作り**、改善を回す。

## 0. 立ち上げ時の必須セットアップ（公開前）

| ツール | 役割 | コスト | 必須度 |
|--------|------|--------|--------|
| **Google Search Console** | インデックス状況・検索クエリ・CTR・CWV・構造化データ | 無料 | 必須 |
| **GA4** | オーガニック流入とCV（申込/トライアル）の相関 | 無料 | 必須 |
| **Bing Webmaster Tools** | Bing/Copilot 向け（任意・登録は容易） | 無料 | 推奨 |
| Ahrefs / SemRush 等 | 競合被リンク・大規模KW・順位自動追跡 | 有料 | Tier B のみ |

> **野口さん方針**：無料の Search Console + GA4 で 90% は回せる。有料ツールはクライアント費用負担が確定した案件に限定。

## 1. Search Console（最重要・一次データ）

公開直後にやること：
1. プロパティ登録（ドメインプロパティ推奨）と所有権確認
2. **サイトマップ送信**（`https://example.com/sitemap.xml`）
3. 主要ページを「URL検査」→「インデックス登録をリクエスト」
4. 「ページ」レポートでインデックス除外理由を確認（noindex事故・重複・クロール済み未登録）

運用で見る指標：
- **検索パフォーマンス**：クエリ別の表示回数・クリック・CTR・平均掲載順位
  - 「表示は多いがCTRが低い」クエリ → **title/description を改善**（最も費用対効果が高い施策）
  - 「掲載順位 5〜15位」のクエリ → あと一押しで1ページ目。コンテンツ強化の優先対象
- **ページのインデックス**：登録/除外の推移、除外理由
- **拡張（構造化データ）**：FAQ/パンくず等のエラー・警告
- **ウェブに関する主な指標**：CWV のフィールド値（`core-web-vitals.md`）

## 2. GA4（流入とCVの相関）

- **オーガニック検索チャネル**の流入数・推移
- ランディングページ別の流入とCV（申込・トライアル開始・問い合わせ）
- **コンバージョン（キーイベント）設定**：Stripe Checkout 到達・トライアル開始をイベント化
- 参照元に AI検索（perplexity.ai / chat.openai.com 等）が現れるか＝AIO の流入確認
- Search Console と GA4 を連携（GA4 の「Search Console」レポート有効化）

## 3. AI可視性の定点観測（AIO/LLMO）

従来の順位に加え、生成AIでの露出を定期チェック（`aio-llmo.md` と連携）：
- 主要な見込み客の質問（例：「飲食店 シフト管理 おすすめ」）を **ChatGPT検索 / Perplexity / Google AI Overviews** に投げ、**自社が言及・引用・リンクされるか**を月次で記録
- 競合がどう言及されているかも併せて観察（差分が改善ネタ）
- Perplexity 等の出典リンクからの流入を GA4 の参照元で確認

## 4. 改善ループ（月次推奨・1名運用前提）

```
1. Search Console で「惜しいクエリ」を抽出
   - CTR低い高表示クエリ → タイトル/ディスクリプション改善
   - 5〜15位のクエリ      → 該当ページのコンテンツ強化・内部リンク追加
2. インデックス除外・構造化データエラーを潰す
3. CWV 不合格ページを最適化
4. AI可視性チェックで言及されていない重要トピック → コンテンツ追加 or 構造化
5. 効果は次月以降に現れる → 変更日をメモし、推移で検証
```

> SEOは因果が遅延する。**「いつ何を変えたか」を記録**し、数週間後の指標変化と突き合わせる。変更を一度に詰め込みすぎると効果の切り分けができない。

## 5. プロジェクト成果物との連携

- 公開前チェックは `docs/15-marketing-site/seo-plan.md`（または SEO計画書）の「計測」節として記録
- 月次レビューは野口さんの還流ループ（`docs/operations/monthly-review.md`）に乗せ、効いた施策を PROJECT_LEARNINGS に記録 →（横展開できる知見なら）フレームワーク本体へ還流

## 6. テストでの担保（CI / E2E）

`test-planner` / `tester` と連携し、デグレを防ぐ：
- `sitemap.xml` / `robots.txt` が 200 を返し想定URLを含む（E2E）
- 主要ページに `<title>` / meta description / canonical / JSON-LD が出力される（E2E）
- Lighthouse SEO スコア・CWV のしきい値を CI ゲートに（任意、`core-web-vitals.md`）
- noindex が本番ビルドで重要ページに付いていない（ビルド後チェック）

## チェックリスト

- [ ] Search Console 登録・サイトマップ送信・主要URLインデックス申請済み
- [ ] GA4 設置・キーイベント（CV）設定・Search Console 連携済み
- [ ] CWV フィールド値を Search Console で監視している
- [ ] AI可視性の定点観測（主要質問×AI各種）を月次で実施
- [ ] 「いつ何を変えたか」の変更ログを残している
- [ ] CI/E2E で sitemap/robots/metadata/構造化データのデグレを検知
- [ ] 効いた施策を PROJECT_LEARNINGS に記録している

## 出典・一次ソース

- Google Search Console ヘルプ: https://support.google.com/webmasters
- Google「検索パフォーマンス レポート」: https://support.google.com/webmasters/answer/7576553
- GA4 ヘルプ（Search Console 連携）: https://support.google.com/analytics/answer/10737381
- Bing Webmaster Tools: https://www.bing.com/webmasters
