# Tax Compliance - Japan（インボイス制度・消費税）

野口さんは**適格請求書発行事業者として登録済み**。2026年10月以降、経過措置の控除率が80%→50%に低下するため、登録番号の重要性が一段と高まる。

## 適格請求書の必須記載事項

国税庁の規定する記載事項（Stripe で対応可能）：

1. **適格請求書発行事業者の氏名又は名称**
2. **適格請求書発行事業者の登録番号**（T + 13桁、例：T1234567890123）
3. **取引年月日**
4. **取引内容**（軽減税率対象品目はその旨）
5. **税率ごとに区分して合計した金額**（税抜 or 税込）と適用税率
6. **税率ごとに区分した消費税額等**
7. **書類の交付を受ける事業者の氏名又は名称**

## Stripe 側の設定手順

### 自社（出荷側）の Tax ID 設定

```typescript
// 自社アカウントに登録番号を設定
await stripe.accounts.update(accountId, {
  // Note: 適切な settings の path はStripeダッシュボードで確認
});

// または、Customer 単位で設定（B2B顧客向け）
await stripe.customers.update(customerId, {
  tax_id_data: [
    { type: 'jp_trn', value: 'T1234567890123' },
  ],
});
```

### Stripe Tax の有効化

Stripe Dashboard → Tax → Settings で：
- 日本を Tax Registration として追加
- 登録番号を入力
- 端数処理を「**subtotal レベルで丸め**」に設定（推奨）

## 消費税の扱い

### 内税 vs 外税

| 区分 | 採用シーン | 例 |
|------|----------|-----|
| **内税（tax_behavior: 'inclusive'）** | 消費者向け、B2C SaaS | ¥1,980（税込） |
| **外税（tax_behavior: 'exclusive'）** | B2B SaaS、企業向け | ¥1,800 + ¥180税 = ¥1,980 |

野口さんSaaSのターゲットは中小企業が多い → **外税推奨**（経費精算・会計処理が分かりやすい）。

ただし**個人事業主・コンシューマー向け**プランは内税が一般的。

### Price 作成時の指定

```typescript
const price = await stripe.prices.create({
  unit_amount: 1980,  // または 1800（外税の場合）
  currency: 'jpy',
  recurring: { interval: 'month' },
  product: productId,
  tax_behavior: 'exclusive',  // 外税
  // 'inclusive' で内税
});
```

## 端数処理（重要）

### Stripe の端数処理設定

ダッシュボードで以下を選択：
- **Round at subtotal**（推奨）：合計に対して1度だけ丸める
- Round at line item：明細ごとに丸める

複数明細がある請求書では、**Round at subtotal の方が金額差異が小さい**ため推奨。

### 丸めルール

国税庁のガイドラインでは、**切り捨て・切り上げ・四捨五入のいずれでも可**。ただし**同一事業者内で統一**することが原則。

野口さん推奨：**切り捨て**（実務でよく使われる、税負担が顧客有利）

## Receipts と Invoices の違い

| 種類 | 用途 | Stripe での発行 |
|------|------|---------------|
| **Receipt（領収書）** | 決済成功時の証憑 | 自動。`receipt_email` 設定で自動送信 |
| **Invoice（請求書）** | 課金前または定期請求の請求書 | Stripe Billing 自動生成 |
| **適格簡易請求書** | 小売・飲食等で受領者氏名省略 | Stripe では「Receipt」が該当（条件付） |
| **適格請求書（正式）** | B2B取引で控除を受けるために必要 | Stripe Invoice が該当 |

### SaaS の場合の運用

SaaS のサブスクリプションでは：
1. **B2C** → Receipt（領収書）が自動発行される
2. **B2B** → Invoice が自動発行される。Customer に `tax_id` を設定すると、顧客の登録番号も記載される

## Customer Portal での請求書ダウンロード

Customer Portal を有効化すれば、顧客が自分で過去の請求書PDFをダウンロード可能。**運用負荷が大幅に減る**。

```typescript
// Customer Portal の設定で「Invoice history」を有効化
const portalSession = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: `${appUrl}/billing`,
  configuration: portalConfigId,  // 事前にDashboardで設定
});
```

## 国内発行と海外発行の違い

野口さんのSaaSが海外顧客にも販売する可能性：

| 顧客の所在 | 消費税 | 適格請求書 |
|----------|-------|---------|
| 日本国内（B2B） | 課税（10%） | 必要 |
| 日本国内（B2C） | 課税（10%） | 不要（Receiptで可） |
| 海外（B2B/B2C） | 不課税（輸出免税） | 不要 |

海外取引の判定は Stripe Tax の自動判定に任せる（顧客の住所情報に基づく）。

## 2026年10月以降の経過措置

国税庁の経過措置：
- 2023年10月〜2026年9月：免税事業者からの仕入も**80%控除可**
- 2026年10月〜2029年9月：**50%控除**に低下
- 2029年10月以降：控除不可

**含意**：野口さんは適格請求書発行事業者なので、**B2B顧客は野口さんから仕入れた分は100%控除可能**。これは取引上の競争優位となる。営業ポータルサイトで明示することで、B2B顧客への訴求になる。

## 営業サイトでの表示

価格表ページに必ず記載：
- 税込 / 税別の明示
- 「適格請求書発行事業者（登録番号：T...）」の表記
- 領収書・適格請求書の自動発行（B2B顧客の安心材料）

## トラブル時の対処

### 顧客から「請求書が間違っている」連絡

1. Stripe Dashboard で当該 Invoice を確認
2. 修正版（Credit Note）を発行
3. 適切な修正後の Invoice を再発行

### 過去請求書の再発行

Customer Portal で顧客が自分でダウンロード可能。運営側からは Stripe Dashboard で再送信。

## チェックリスト

- [ ] 適格請求書発行事業者の登録番号を Stripe に設定
- [ ] 内税 / 外税の選択（B2B/B2C に応じて）
- [ ] 端数処理を「Round at subtotal」に設定
- [ ] B2B Customer に `tax_id` 設定フロー
- [ ] Customer Portal で請求書ダウンロード有効化
- [ ] 領収書の自動メール送信設定
- [ ] 営業サイトに「適格請求書発行事業者」表記
- [ ] 経過措置（80% → 50% → 0%）の顧客説明

## アンチパターン

- 登録番号を設定せず、顧客に手動連絡で対応
- 内税/外税を途中で切り替える（顧客混乱）
- 端数処理をライン明細単位にする（金額不整合）
- 経過措置の説明不足（B2B顧客の懸念を解消できない）

## 参考リンク（要確認）

- 国税庁「インボイス制度」 https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/invoice.htm
- Stripe Japan ヘルプ https://stripe.com/jp/resources/more/invoice-requirements
