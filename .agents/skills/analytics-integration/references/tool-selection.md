# ツール選定ロジック（PostHog / GA4 / Vercel Analytics）

野口Profile（`sdlc-toolkit/references/tech-stack-profile.md`）の Tier 区分に対応づけたアナリティクスツールの選定指針。**3ツールは役割が異なり、組み合わせて使う**のが前提。

## 結論：役割分担の地図

```
                  プロダクト内の行動         集客・広告の効果
                  ─────────────────         ─────────────────
 プロダクト分析 →  PostHog（無料枠大）
 マーケ標準     →                          GA4（無料）
 サイト健全性   →  Vercel Analytics（Core Web Vitals・簡易訪問数）
```

- **PostHog** … プロダクト内の行動を追う専門。ファネル・セッション記録・機能フラグ・A/Bテストまで**1ツールで完結**。**無料枠が破格**（月100万イベント永続無料）で、1名運用のSaaSは実質無料でプロダクト分析基盤を持てる。**「登録後、誰が・どこで離脱するか」を追うのはPostHogの独壇場。**
- **GA4** … 集客・マーケティングの標準ツール。広告（Google Ads）・検索（Search Console）との連携が強く、`seo-toolkit` の計測導線とも重なる。「どこから来て、LPで何をしたか」を追うのに適する。**無料**。
- **Vercel Analytics** … Core Web Vitals とページ訪問数を、Vercel にデプロイするだけで最小コストで取得。詳細なイベント設計は不要で、**「サイトが速いか・見られているか」を一目で確認する**用途に限定。Hobby プランでも Web Analytics の基本機能が一部利用可能（Pro 以降でより高度な機能）。

## Tier 別の標準構成

### Tier A：Vercel + Supabase 系（最速MVP / 100ユーザー未満）

| 用途 | 標準選択 | 理由 |
|------|---------|------|
| プロダクト分析・ファネル | **PostHog 無料枠** | 月100万イベント無料。Next.js SDK 導入が容易、セッション記録・機能フラグも同一ツールで賄える |
| マーケ計測・広告連携 | **GA4** | 無料・業界標準。Google Ads/Search Console と自然に連携 |
| Core Web Vitals・簡易分析 | **Vercel Analytics**（`@vercel/analytics`） | デプロイ先が Vercel なら追加コストほぼゼロで導入 |
| 計測SaaSの月額 | **¥0 で開始可能** | 財務制約（一括払いのみ・無料枠優先）に最適 |

> Tier A の最小構成：**PostHog + GA4**が両輪。PostHogは「プロダクト内で何が起きたか」、GA4は「どこから来たか」を担う。Vercel Analyticsは実装コストがほぼゼロなので基本的に常時オンでよい。

### Tier B：AWS ECS Fargate 系（エンタープライズ / コンプラ要件）

| 用途 | 標準選択 | 理由 |
|------|---------|------|
| プロダクト分析 | **PostHog**（Cloud有料 or セルフホスト） | イベント量が無料枠を超える規模、またはデータ残留要件がある場合はセルフホスト（Docker）を検討 |
| マーケ計測 | **GA4** | 引き続き標準。BigQuery エクスポートで大規模分析基盤（Tier B の分析基盤）に接続可能 |
| サイト健全性 | **Vercel Analytics**（フロントがVercelの場合） | ハイブリッド構成でもフロント計測はVercel側に残せる |
| 費用 | **クライアント負担前提** | イベント量課金・セルフホスト運用工数が増えるため契約で明示 |

**PostHog Cloud と セルフホストどちらを選ぶか：**

| 判断軸 | Cloud 寄り | セルフホスト寄り |
|--------|-----------|-----------------|
| 運用体制 | 1名運用でインフラ管理を避けたい | クライアント側にインフラ運用体制がある |
| データ残留要件 | 特になし | 個人情報保護・業界規制で自社/国内保持が必須 |
| コスト | 無料枠〜従量課金がシンプル | ホスティング費用込みで自前計算が必要 |
| 機能追従 | 常に最新機能が使える | セルフホストは機能が一部制限される場合あり |

### Tier C：ハイブリッド（フロント=Vercel、バックエンド/AI=AWS）

- フロント（Vercel/Next.js）：**PostHog + GA4 + Vercel Analytics**（Tier A と同じ構成をそのまま適用）
- バックエンド側のイベント（サーバーサイド課金確定・バッチ処理結果等）：**PostHog サーバーサイドSDK**でイベントを送信し、フロントのユーザー行動と**同一 distinct_id で紐付け**る
- 監視（`observability-integration`）とは責務が異なる点に注意：オブザバビリティは「落ちていないか」、アナリティクスは「使われているか・儲かっているか」を見る

## 選定の判断軸（順に検討）

1. **何を一番知りたいか**
   - プロダクト内の行動・離脱・機能利用 → PostHog
   - 集客チャネル別の効果・広告ROI → GA4
   - サイトの表示速度・訪問数のみ → Vercel Analytics だけでも足りる場合がある

2. **誰が費用を払うか**
   - 野口さん持ち出し / MVP → 無料枠（PostHog + GA4 + Vercel Analytics）
   - クライアント負担確定・大規模イベント量 → PostHog 有料プラン/セルフホストも候補

3. **規模・イベント量**
   - MVP/小規模（月100万イベント未満） → PostHog 無料枠で十分
   - 急成長・イベント量が読めない → 早期に有料プラン移行の予算枠をADRに明記しておく

4. **運用体制**
   - 野口さん1名 → ダッシュボードは**定期チェック可能な最小枚数**に絞る（作りすぎない）
   - クライアント保守 → KPIダッシュボードとイベント定義書を引き渡せる構成にする

5. **コンプラ・データ残留**
   - 個人情報保護・業界規制で国内/自社保持が必須 → PostHog セルフホスト or GA4のデータ保持設定を確認
   - 越境移転の懸念があれば `observability-integration/references/security-and-pii.md` と同様にプライバシーポリシーへの記載を検討

## なぜ「組み合わせ」が正解か

- **PostHog** はプロダクト内の行動（クリック・画面遷移・機能利用・課金）をイベント単位で追跡でき、ファネル・コホート・セッション記録まで一気通貫だが、**広告経由の流入元やSEO効果の分析は守備範囲外**。
- **GA4** は集客チャネル別の効果測定・広告連携に強いが、**プロダクト内の詳細な行動追跡やA/Bテストは不得意**。
- **Vercel Analytics** はどちらのツールにもない「Core Web Vitalsとゼロコンフィグの訪問数」を提供するが、**イベント設計・ファネル分析はできない**。
- 3つを組み合わせると、**「GA4で集客を見る → LPからプロダクトに入った後はPostHogでファネルを追う → サイト自体の健全性はVercel Analyticsで俯瞰」**という一気通貫の可視化が完成する。
- コストは「PostHog無料枠 + GA4無料 + Vercel Analytics」で **Tier A は実質ゼロ円**から始められるので、組み合わせのデメリットが小さい。

## ADR 記録テンプレート

`docs/11-tech-stack/adr/NNNN-analytics.md`：

```markdown
# ADR-NNNN: アナリティクス構成

## Status
Accepted

## Context
プロダクトの利用実態・ファネル・KPIを数値で把握し、機能改善・解約対策・広告投資判断を
データドリブンに行う必要がある。財務制約により初期はランニングコストを最小化したい。

## Decision
- プロダクト分析・ファネル：PostHog 無料枠（月100万イベント）
- マーケ計測・広告連携：GA4（無料）
- Core Web Vitals・簡易訪問数：Vercel Analytics（`@vercel/analytics`）
- イベントプロパティに生PIIを含めない（取り込み前マスキング。observability-integrationのPII方針と統一）

## Considered Alternatives
- Mixpanel：プロダクト分析として高機能だが無料枠がPostHogより小さく、財務制約に照らし却下
- Amplitude：同上、無料枠の制約と1名運用でのツール数増加を避けたい
- GA4のみで完結：プロダクト内ファネル・セッション記録が弱く、機能改善の意思決定に不足

## Consequences
- ポジティブ：無料枠で開始でき、3ツールの役割分担で集客〜プロダクト内行動まで一気通貫
- ネガティブ：複数ツール併用で初期セットアップの手間、イベント定義の二重管理リスク
- リスク：イベント量が無料枠を超過した場合の追加コスト（複数SaaS運用時は横断監視が必要）

## References
- .agents/skills/analytics-integration/references/tool-selection.md
- 各ツール公式 pricing（実装直前に再確認）
```

## 出典（実装直前に再確認）

- PostHog docs: https://posthog.com/docs
- PostHog pricing: https://posthog.com/pricing
- GA4 開発者向けドキュメント: https://developers.google.com/analytics/devguides/collection/ga4
- Vercel Analytics: https://vercel.com/docs/analytics
- Vercel Analytics pricing/plans: https://vercel.com/docs/analytics/limits-and-pricing
- 野口Profile: `.agents/skills/sdlc-toolkit/references/tech-stack-profile.md`
