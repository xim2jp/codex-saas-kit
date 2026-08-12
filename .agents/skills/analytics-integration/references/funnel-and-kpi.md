# ファネル定義・イベント設計・KPI

SaaS の「登録→活性化→課金→解約」ファネルを定義し、外部設計から機械的にイベントを導出し、標準KPIで数値化する方法。

## 1. 標準ファネル：登録→活性化→課金→解約

野口さんが量産する月額 SaaS で共通化できる**標準4段階ファネル**：

```
① 登録 (Sign Up)
   └→ ② 活性化 (Activation)
          └→ ③ 課金 (Conversion / Subscribe)
                 └→ ④ 継続 or 解約 (Retention / Churn)
```

| 段階 | 定義 | 典型イベント名 |
|------|------|----------------|
| ① 登録 | Supabase Auth でアカウント作成が完了 | `user_signed_up` |
| ② 活性化 | プロダクトの**核となる価値**を初回体験した瞬間（"Aha moment"） | `activation_completed`（案件ごとに中身は変わる） |
| ③ 課金 | Stripe Checkout でサブスク開始 | `subscription_started` |
| ④ 継続/解約 | 更新継続 or `stripe-integration` の解約Webhook受信 | `subscription_renewed` / `subscription_canceled` |

> 「活性化」の定義が最も重要かつ案件依存。**「これをやったユーザーは高確率で課金・継続する」という先行指標**を要件定義・業務フローから見つけ出す（例：タスク管理SaaSなら「初回タスクを3件登録」、予約SaaSなら「初回予約を1件完了」）。

## 2. 外部設計からイベント設計を導出する手順

`docs/20-external-design/screen-list.md` と `feature-list.md` を起点に、以下の手順でイベントを機械的に洗い出す。

### Step 1: feature-list.md の FunctionalID をファネル段階にマッピング

| FunctionalID | 機能名 | ファネル段階 | イベント名（案） |
|--------------|--------|--------------|-------------------|
| F-001 | 会員登録 | ① 登録 | `user_signed_up` |
| F-003 | オンボーディング完了 | ② 活性化 | `onboarding_completed` |
| F-010 | プラン選択・決済 | ③ 課金 | `subscription_started` |
| F-020 | 退会 | ④ 解約 | `subscription_canceled` |

- `feature-list.md` の各機能が「誰が・何を・いつ」できるかを見て、ユーザーの意思決定が発生する画面操作をイベント候補にする。
- **CRUD操作すべてをイベント化しない**。ファネルの意思決定点・価値実感点に絞る（イベント過多は分析を濁らせ、無料枠も消費する）。

### Step 2: screen-list.md の画面遷移からドロップオフ計測点を特定

- 画面遷移図（`docs/20-external-design/screen-list.md` 相当）で、**多段階フォーム・ウィザード**がある箇所は各ステップにイベントを打ち、離脱ステップを特定できるようにする。
- 例：登録フォームが3ステップなら `signup_step1_viewed` / `signup_step2_viewed` / `signup_step3_viewed` / `user_signed_up`。

### Step 3: イベント命名規則を統一する（量産テンプレ化の要）

複数SaaSを並行運用するため、**案件をまたいで同じ命名規則**を使う（横展開・テンプレ流用のため）：

```
<対象>_<動作>[_<状態>]
例: user_signed_up / subscription_started / invoice_payment_failed
```

- スネークケース・過去形の動詞（〜した瞬間を表す）
- プロパティ名も統一（`plan_id` / `amount_jpy` / `source` 等を全案件で共通化）

## 3. SaaS標準KPIの定義と計算式

| KPI | 定義 | 計算式 |
|-----|------|--------|
| **MRR**（月次経常収益） | 月次換算した経常収益の総額 | `Σ(アクティブ課金ユーザーの月額料金)` |
| **ARR** | MRRの年換算 | `MRR × 12` |
| **Churn Rate**（解約率） | 期首の課金ユーザーのうち期間内に解約した割合 | `期間内解約ユーザー数 ÷ 期首課金ユーザー数 × 100` |
| **Revenue Churn**（収益解約率） | 金額ベースの解約率（ダウングレード含む） | `(期間内MRR減少額) ÷ 期首MRR × 100` |
| **Activation Rate**（活性化率） | 登録ユーザーのうち活性化に到達した割合 | `活性化ユーザー数 ÷ 登録ユーザー数 × 100` |
| **Conversion Rate**（課金転換率） | 活性化ユーザーのうち課金に至った割合 | `課金ユーザー数 ÷ 活性化ユーザー数 × 100` |
| **LTV**（顧客生涯価値） | 1顧客が生涯にもたらす収益の期待値 | `ARPU ÷ Churn Rate`（簡易式。`ARPU × 平均継続月数` でも可） |
| **CAC**（顧客獲得コスト） | 1顧客獲得にかかる平均コスト | `獲得にかけた費用合計 ÷ 新規獲得顧客数` |
| **LTV / CAC比** | 事業の健全性指標。一般に3倍以上が目安 | `LTV ÷ CAC` |
| **ARPU**（顧客あたり平均収益） | 課金ユーザー1人あたりの平均月額収益 | `MRR ÷ 課金ユーザー数` |
| **NRR**（ネットレベニューリテンション） | 既存顧客の収益維持・拡大率（アップセル含む） | `(期首MRR + アップセル - ダウンセル - 解約MRR) ÷ 期首MRR × 100` |

> 1名運用・複数SaaS並行では、**MRR・Churn Rate・Activation Rateの3つ**を最優先の定点観測KPIとする。全KPIを毎週見るのは非現実的。

## 4. PostHogでのファネル可視化（実例）

PostHog の Product Analytics → Funnels で以下のようにステップを定義する：

```
Step 1: user_signed_up
Step 2: onboarding_completed
Step 3: subscription_started
```

- Conversion window（計測期間）はSaaSの意思決定サイクルに合わせる（例：BtoB SaaSなら14〜30日）
- Breakdown（内訳）に `source`（流入元）や `plan_id` を指定し、どのセグメントが最も転換率が高いかを見る
- Insights → Trends で `subscription_canceled` の推移を追い、解約率の悪化を早期検知する

イベント送信例（クライアントサイド、`posthog-js`）：

```typescript
posthog.capture('onboarding_completed', {
  step_count: 3,
  plan_id: 'starter',
  source: 'organic',
});
```

## 5. GA4でのコンバージョン設定（実例）

GA4 では「イベント」を「コンバージョン」としてマークすることで、広告効果測定・レポートの中心指標にできる。

1. GA4 管理画面 → イベント → 対象イベント（例：`sign_up` や `begin_checkout`）のトグルを「コンバージョンとしてマークする」に切り替える
2. 推奨イベント名（GA4 標準の命名規則）を使うと自動計測が有効になりやすい：`sign_up` / `begin_checkout` / `purchase`
3. Google Ads と連携している場合、コンバージョンイベントを広告の最適化目標に指定する

送信例（`gtag.js`）：

```typescript
window.gtag('event', 'sign_up', {
  method: 'email',
});

window.gtag('event', 'purchase', {
  transaction_id: subscriptionId,
  value: amountJpy,
  currency: 'JPY',
  items: [{ item_id: planId, item_name: planName }],
});
```

> GA4 側は**集客チャネル別の転換率**を見る用途に限定し、プロダクト内の詳細な行動分析は PostHog 側に寄せる（役割分担は `tool-selection.md` 参照）。

## 6. KPIダッシュボード雛形

1名運用で定期チェックする最小ダッシュボード構成（PostHog Dashboards or 手元集計シートいずれでも可）：

| ウィジェット | 指標 | 頻度 |
|-------------|------|------|
| ファネル | 登録→活性化→課金 の各段階転換率 | 週次 |
| トレンド | MRR推移（直近12週） | 週次 |
| トレンド | 新規課金ユーザー数 / 解約ユーザー数 | 週次 |
| 内訳 | 流入元別（GA4）の登録数・課金転換率 | 月次 |
| アラート | 解約率が閾値（例：月次5%）を超えたら通知 | 随時 |

- [ ] ダッシュボードは**3〜5ウィジェット以内**に絞る（見に行かないダッシュボードは無価値）
- [ ] 解約率の悪化はPostHogの Alert 機能や定期エクスポートでSlack等に能動通知する
- [ ] `observability-integration` の障害アラートとは目的が異なる（こちらは「ビジネスが健全か」）ことを混同しない

## 出典（実装直前に再確認）

- PostHog Funnels: https://posthog.com/docs/product-analytics/funnels
- PostHog Dashboards: https://posthog.com/docs/product-analytics/dashboards
- GA4 推奨イベント: https://developers.google.com/analytics/devguides/collection/ga4/reference/events
- GA4 コンバージョンの設定: https://support.google.com/analytics/answer/9267568
- SaaS KPI（Stripe公式ガイド）: https://stripe.com/resources/more/saas-metrics
