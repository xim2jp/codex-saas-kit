---
name: analytics-integration
description: SaaS の利用実態・ファネル・KPIを数値で把握し、意思決定に使える状態にするための知識集。PostHog（プロダクト分析）/ GA4（マーケ標準）/ Vercel Analytics（Core Web Vitals）の役割分担と選定基準、登録〜活性化〜課金〜解約のファネル定義とイベント設計、MRR/Churn/Activation Rate/LTV/CAC等のKPI定義、Next.js App Router でのPostHog Provider・gtag.js・@vercel/analytics実装パターン、PIIマスキング方針を収録する。企画・外部設計・実装の各フェーズと公開後のKPI運用時に marketing-site-builder / implementation-worker / cost-guardian らが参照する。「アナリティクス」「PostHog」「GA4」「ファネル分析」「KPIダッシュボード」で参照。
---

# Analytics Integration Skill

成果物（SaaS）の**利用実態・ファネル・KPIを数値で把握し、経営判断に使える状態**にするための知識集。PostHog / GA4 / Vercel Analytics の3ツールを軸に、ファネル・KPI設計と実装の双方を支援する。

> **このSkillのゴール**：野口さんが量産する月額 SaaS の1つ1つで、「誰が・どこで離脱し・何が課金に繋がっているか」を**無料枠中心のツールで即座に可視化**でき、KPIダッシュボードで経営判断（機能改善/解約対策/広告投資）を数字で下せる状態を作る。

## いつこのSkillを参照するか

アナリティクスは**横断的関心事**であり、企画から運用まで薄く広く関わる。以下で必ず読む：

- **技術スタック選定（Phase 3 相当）**：PostHog/GA4/Vercel Analyticsの選定とADR記録時（→ `tool-selection.md`）
- **外部設計（Phase 5 相当）**：`screen-list.md` / `feature-list.md` からイベント設計・ファネル定義を導出する時（→ `funnel-and-kpi.md`）
- **実装（Phase 11 相当）**：Provider/SDK の組み込み・イベント送信の実装時（→ `implementation-patterns.md`）
- **営業サイト構築**：LP のコンバージョン計測・GA4連携時（`marketing-site-playbook` と併読）
- **公開後の運用**：KPIダッシュボードでMRR/Churn/Activationを定点観測し改善する時（→ `funnel-and-kpi.md`）
- **レビュー時**：PII混入・二重計測・イベント命名の不整合をチェック（→ `implementation-patterns.md` のチェックリスト）

## 重要原則（必読）

### 1. 3ツールは「競合」ではなく「役割分担」

排他選択ではない。それぞれ得意領域が異なり、**組み合わせて使う**のが基本。

| ツール | 主戦場 | 一言で |
|--------|--------|--------|
| **PostHog** | プロダクト分析・ファネル・セッション記録・機能フラグ | 「プロダクト内で何が起きているか」をイベント単位で追う |
| **GA4** | マーケティング標準・広告連携・オーガニック流入分析 | 「どこから来て何に転換したか」を集客観点で追う |
| **Vercel Analytics** | Core Web Vitals・簡易ページ訪問数 | 「サイトが速いか・見られているか」を運用コスト最小で把握 |

詳細な選定ロジックは `tool-selection.md`。

### 2. 野口さん財務制約：無料枠で完結させる

民事再生中のため一括払いのみ、分割・借入不可。1名運用でSaaSを複数並行運用するため、**ランニングコストが積み上がるツールは慎重に選定**する。

> **基本方針：Tier A 案件は「PostHog 無料枠（月100万イベント）+ GA4（無料）+ Vercel Analytics（Hobbyの一部無料）」で開始。有料プランへの引き上げは、イベント量やクライアント費用負担が確定してから検討する。**

### 3. ファネルは外部設計から機械的に導出する

思いつきでイベントを打たない。`docs/20-external-design/screen-list.md` と `feature-list.md` から**登録→活性化→課金→解約**の各段階に対応する画面・操作を洗い出し、イベント名を設計する。詳細は `funnel-and-kpi.md`。

### 4. PII対策は observability-integration と方針を統一する

計測ツールにも Supabase 由来の個人情報（メール・氏名等）が混入しやすい。`observability-integration/references/security-and-pii.md` が定める**「取り込み前マスキング」（保存後は消せない前提で送信前に除去する）**の考え方をアナリティクス側でも踏襲する。イベントプロパティに `email` / `name` 等の生PIIを載せず、匿名化・仮名化したIDのみを使う。詳細は `implementation-patterns.md`。

### 5. 量産テンプレ化を前提に、Provider は初期セットアップの型を固定する

1名運用で複数SaaSを並行するため、PostHog Provider・gtag.js・`@vercel/analytics` の組み込みは**案件ごとに設計し直さず、標準パターンを再利用**する。詳細は `implementation-patterns.md`。

## このSkillの構成

```
analytics-integration/
├── SKILL.md                       # 本ファイル
└── references/
    ├── tool-selection.md          # PostHog/GA4/Vercel Analyticsの選定ロジック（野口Profile × Tier）
    ├── funnel-and-kpi.md          # ファネル定義・イベント設計導出・KPI定義と計算式
    └── implementation-patterns.md # Next.js App Router 実装パターン・PIIマスキング
```

## エージェント別の使い方ガイド

### tech-stack-architect

`docs/11-tech-stack/adr/NNNN-analytics.md` として計測構成を記録：
- Tier A：PostHog 無料枠 + GA4 + Vercel Analytics を標準提案
- 判断根拠は `tool-selection.md` を引用

### external-designer

`docs/20-external-design/` に画面一覧・機能一覧を作る際、ファネルの各段階に対応する画面・操作を意識して設計する（イベント設計の元ネタになる）。

### marketing-site-builder

営業サイトの LP・価格ページ・CTA に GA4 コンバージョンイベントと Vercel Analytics を組み込む。`marketing-site-playbook` の導線設計と併せて `funnel-and-kpi.md` の登録前ファネルを参照。

### implementation-worker

- PostHog Provider / gtag.js / `@vercel/analytics` を `implementation-patterns.md` の標準パターンで導入
- イベント送信箇所を内部設計のユースケースに対応づけて実装
- PII マスキングを実装時点で組み込む（後付けにしない）

### cost-guardian（並行して他担当が整備中の新エージェント）

複数SaaS運用時のツール利用コスト（PostHogイベント量・GA4プロパティ数等の無料枠逸脱リスク）を横断監視する役割を担う見込み。本Skillの`tool-selection.md`の無料枠情報を判断材料として参照される想定。

### implementation-reviewer

- イベント命名の一貫性、二重計測、PII混入を `implementation-patterns.md` のチェックリストでレビュー

## 参照ファイルの読み方

| ファイル | 必読タイミング |
|---------|--------------|
| `tool-selection.md` | 計測ツール選定時（最初に読む） |
| `funnel-and-kpi.md` | ファネル・KPI設計時、外部設計からのイベント導出時 |
| `implementation-patterns.md` | 実装時、PIIマスキング設計時 |

## 野口さん固有のチェック

- [ ] Tier A 案件：PostHog無料枠 + GA4 + Vercel Analyticsで開始しているか（有料プランを安易に選んでいないか）
- [ ] 複数SaaS運用でPostHogのイベント量が無料枠（月100万イベント）を超過する見込みがないか
- [ ] 計測SaaSの月額が発生する場合、初期費用設計（立替→請求）に織り込まれているか
- [ ] ファネル定義が `feature-list.md` / `screen-list.md` の実際の画面・操作と対応しているか
- [ ] PIIマスキングが取り込み前に設定済みか（observability-integrationのPII方針と整合しているか）
- [ ] KPIダッシュボードが1名運用でも定期チェックできる粒度・頻度になっているか

## アンチパターン（よくある失敗）

1. **ツール選定前にSDKを闇雲に組み込む**：役割分担を決めずに導入すると計測が重複・欠落する
2. **PostHogとGA4で同じ指標を二重計測し数字が食い違う**：どちらを正とするか役割分担を先に決める
3. **イベント設計なしに実装から入る**：ファネルの各段階が何のイベントに対応するか未定義だと分析できない
4. **イベントプロパティにユーザーオブジェクトを丸ごと添付**：PIIが混入し取り込み後に消せなくなる
5. **KPIダッシュボードを作って放置**：定点観測しないと解約予兆や活性化率の悪化に気付けない
6. **Tier A MVPで有料アナリティクスSaaSをフル導入**：財務制約（一括払いのみ・無料枠優先）に反する
7. **Vercel Analyticsだけで満足しプロダクト内ファネルを計測しない**：ページ訪問は分かるが「何が課金に繋がるか」は分からない
8. **イベント命名規則を決めずに量産**：案件ごとにバラバラだとテンプレ化・横展開ができない
9. **サーバーサイドイベントとクライアントサイドイベントの二重送信**：カウントが水増しされKPIが歪む
10. **GA4のコンバージョン設定を放置**：LP改善の効果測定ができず広告投資判断が数字で下せない

## 出典・一次ソース方針

このSkillの技術情報は**公式ドキュメントを一次ソース**とする（PostHog `posthog.com/docs`、GA4 `developers.google.com/analytics`、Vercel Analytics `vercel.com/docs/analytics`）。料金・無料枠・SDKは更新が速いため、実装直前に各 references の出典URLで最新を再確認すること。各 references ファイル末尾に出典URLを明記している。
