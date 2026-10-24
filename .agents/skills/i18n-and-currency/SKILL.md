---
name: i18n-and-currency
description: SaaS を複数言語・複数通貨に対応させるための知識集。Next.js App Router + next-intl での多言語対応（`app/[locale]/` 構成、middleware でのロケール検出、メッセージファイル管理、Server/Client Component の使い分け、hreflang）、Stripe での多通貨対応（Stripe Tax、通貨別 Price、Adaptive Pricing、地域別決済手段）、AI ドラフトによる翻訳量産フロー、東南アジア展開時の決済導線を収録する。対応言語・通貨の要件確定、URL・画面・データモデル設計、実装、海外展開の検討時に参照する。「多言語対応」「i18n」「多通貨」「海外展開」「ローカライズ」「hreflang」「Stripe Tax」で参照。
---

# i18n and Currency Skill

SaaS を**日本語だけでなく複数言語・複数通貨に対応**させるための知識集。Next.js App Router 上の `next-intl` による多言語実装と、Stripe による多通貨・地域別決済対応を一気通貫で扱う。

> **ゴール**：野口さんが量産する SaaS が、①日本語以外のユーザーにも自然な言語で使え、②その国・地域の通貨と決済手段で支払え、③将来の東南アジア展開時に大きな作り直しなく拡張できる状態を、**1名運用で回せる手順**として作る。

## 参照ファイル

| ファイル | 内容 | いつ読むか |
|---------|------|-----------|
| `references/nextjs-i18n.md` | next-intl による Next.js App Router 多言語実装パターン、翻訳量産フロー | 多言語対応の設計・実装時（最初に読む） |
| `references/multi-currency-stripe.md` | Stripe による多通貨・地域別決済対応（Stripe Tax・多通貨 Price・Adaptive Pricing） | 多通貨・海外向け決済の設計・実装時、海外展開の追加コスト見積り時 |

## 原則

### 1. 「あとから多言語化」は避け、最初から `[locale]` 構造にする

日本語単一で作った後に多言語化すると、ルーティング・metadata・DB設計を作り直すことになりやすい。**単一言語で始める案件でも `app/[locale]/` 構造だけは最初から敷いておく**と、後の追加言語がほぼ翻訳作業だけで済む。対応言語・通貨・展開国の範囲は要件定義で確定し、i18n ライブラリと Stripe の多通貨方式は ADR に記録する。詳細は `references/nextjs-i18n.md`。

### 2. Stripe の多通貨対応は「追加コストなし」で使える優先候補

民事再生中・一括払いのみ・1名運用という野口Profileの財務制約下では、ランニングコストが積み上がる専用ツールは避けたい。**Stripe の多通貨 Price / Adaptive Pricing / Stripe Tax は Stripe 利用料（決済手数料）の範囲内で使え、追加の月額SaaS契約が不要**。多言語対応より先に着手できる場合も多い。詳細は `references/multi-currency-stripe.md`。税務・サブスク設計は `stripe-integration` Skill と整合させる。

### 3. 翻訳は「AIドラフト＋人手レビュー」の軽量フローで量産する

1名運用で翻訳会社に依頼する余裕はない。**Claude API（Claude Sonnet 5.5 など）で翻訳ドラフトを生成するスクリプトを用意し、野口さんが要点だけレビューする**フローを標準とする。全文を人手で翻訳しない。詳細は `references/nextjs-i18n.md` の翻訳量産セクション。

### 4. SEO の hreflang とテクニカルSEOは `seo-toolkit` Skill と整合させる

多言語ページの `generateMetadata` での hreflang 設定は、`seo-toolkit` Skill が扱うテクニカルSEO（`technical-seo.md`）と密接に関係する。i18n 実装時は hreflang・多言語 sitemap・多言語 metadata が `seo-toolkit` の方針と矛盾しないか確認する。

### 5. 東南アジア展開は「言語・通貨・決済手段」の3点セットで検討する

東南アジア展開時に不足しがちなのは英語対応だけではない。**現地通貨（THB/PHP/VND/IDR/MYR/SGD 等）と、コンビニ決済・PayNow・GrabPay 等の現地決済手段の両方**が揃って初めて実用になる。電話・AI通話でのフィリピン展開を検討する場合は `ai-calling-philippines` Skill も併せて参照し、言語・法令面の知見と連携する（本Skillは決済・表示言語、`ai-calling-philippines` は音声対応が主眼で守備範囲が異なる）。

### 6. 設計で決めておくこと

| 領域 | 決めること |
|------|-----------|
| 外部設計 | `app/[locale]/` 前提の URL 設計・画面遷移、言語切替 UI（ヘッダー/フッター）、価格ページの通貨表示、hreflang |
| 内部設計 | メッセージファイル（`messages/*.json`）のディレクトリ構造・キー命名規則、ロケール検出 middleware（Cookie / Accept-Language の優先順位）、Stripe の通貨別 Price ID を持つ自社 DB モデル |
| 実装 | `next-intl` の組み込みと `useTranslations`（クライアント）/ `getTranslations`（サーバー）の使い分け、Stripe Price / Payment Element の多通貨対応 |

## 野口さん固有のチェック

- [ ] 単一言語案件でも `app/[locale]/` 構造で実装しているか（後の多言語化コストを潰しているか）
- [ ] 翻訳を全文人手発注していないか（AIドラフト＋レビューの軽量フローになっているか）
- [ ] Stripe の多通貨対応で追加の月額SaaSを契約していないか（Stripe標準機能で完結しているか）
- [ ] 展開国の通貨・決済手段（コンビニ決済/PayNow/GrabPay等）が実需に対応しているか、過剰対応になっていないか
- [ ] hreflang / 多言語 sitemap が `seo-toolkit` の技術SEO方針と矛盾していないか
- [ ] 為替・価格丸めのルールが決まっているか（Stripe自動換算に任せきりで不自然な価格になっていないか）

## アンチパターン（よくある失敗）

1. **日本語決め打ちでルーティングを設計**：後から `[locale]` 構造に直すと画面・APIの作り直しが発生
2. **文字列をコンポーネントにハードコード**：メッセージファイルに切り出さないと翻訳が実質不可能になる
3. **全文を人手翻訳に発注**：1名運用のコスト構造に合わない。AIドラフト＋レビューが基本
4. **通貨表示だけ多言語化し決済手段を放置**：現地ユーザーが使い慣れた決済手段がないと離脱する
5. **hreflang を設定せず多言語ページを公開**：検索エンジンに重複コンテンツと誤認される
6. **Server Component と Client Component で翻訳取得方法を混同**：`getTranslations`（サーバー）と `useTranslations`（クライアント）の使い分けを誤ると動かない
7. **通貨換算を独自実装**：Stripe 標準の多通貨 Price / Adaptive Pricing を使わず為替APIを自前運用しコストと保守を増やす
8. **価格の丸め処理を無視**：単純な為替換算で「¥1,000 → $6.73」のような不自然な価格になる
9. **サブスクリプション契約後に通貨変更を許可する設計**：Stripe は原則サブスク作成後の通貨変更不可。事前の確認導線が必要
10. **東南アジア展開を「英語対応」だけで済ませる**：現地通貨・現地決済手段が伴わないと実際には使われない

## 出典・一次ソース方針

このSkillの技術情報は**一次ソース**を基準とする（next-intl 公式 `next-intl.dev`、Next.js 公式 `nextjs.org/docs`、Stripe 公式 `stripe.com/docs`）。多通貨・決済手段・料金は更新が速いため、実装直前に各 references の出典URLで最新を再確認すること。各 references ファイル末尾に出典URLを明記している。
