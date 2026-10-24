---
name: business-strategy-toolkit
description: 要件定義より前の上流 4 フェーズ（Phase 1 企画 → 2 企画レビュー → 3 ビジネス・マーケティング戦略 → 4 戦略レビュー）の知識集。「何を作り、何を成し遂げるか」を確定する企画（concept.md）と「どう売り、どう収益化するか」を確定する戦略（business-strategy.md）の作り方、市場・競合調査、収益モデルとユニットエコノミクス（CAC/LTV/回収期間）、GTM・チャネル選定・KPI ツリー、RFP・既存企画書の取り込み、企画×戦略×RFP を要件定義の入力へ統合する突合ルールを収録する。企画・戦略の作成とレビュー、要件定義冒頭の突合、下流で戦略を参照するときに使う。「企画」「コンセプト」「ビジネス戦略」「マーケティング戦略」「収益モデル」「マネタイズ」「GTM」「市場調査」「競合分析」「KPIツリー」「RFP の取り込み」で参照。
---

# Business Strategy Toolkit Skill

SDLC の**最上流**を支える Skill。要件定義の前に次の 2 つの問いに答えてから進む：

1. **企画（Phase 1-2）**：このリポジトリで何を作り、誰のどんな課題を、どこまで解決するのか。何を成し遂げたら成功か
2. **ビジネス・マーケティング戦略（Phase 3-4）**：それをどの市場で、誰に、どう届け、どう収益化し、どの数値で健全性を判断するのか

要件定義（Phase 5）は、この 2 つの成果物と、ユーザーが `docs/00-inputs/` に置いた RFP・既存企画書・参考資料を**総合的に勘案した入力**として始まる。戦略書は価格・ブランド・SEO・広告・営業サイト・コスト・運用レビューの上流正本でもある。

## 参照ファイル

| ファイル | 内容 | いつ読むか |
|---------|------|-----------|
| `references/concept-playbook.md` | 企画の対話手順と問いバンク、既存企画書・RFP の取り込み手順、「リポジトリ成果物スコープ」の定義、文書セットプロファイルの初期判定 | 企画の作成・レビュー時 |
| `references/market-and-positioning.md` | 市場規模の軽量算出（TAM/SAM/SOM）、競合分析の手順と比較表、ポジショニング、WebSearch の出典ルール | 市場・競合調査とそのレビュー時 |
| `references/monetization-and-unit-economics.md` | 収益モデル類型、価格仮説の立て方、CAC / LTV / 粗利 / 回収期間の算出、無料枠の原価、野口さん固有の財務制約 | 収益モデル・価格・コストを決めるとき |
| `references/go-to-market-and-kpi.md` | チャネル選定マトリクス、ローンチ計画、KPI ツリーと北極星指標、PMF 判定と撤退基準、営業ポータル要否の判定 | GTM・集客チャネル・KPI を決めるとき、運用で KPI を測るとき |
| `references/upstream-reconciliation.md` | 企画×戦略×RFP の突合ルール（優先順位・矛盾時の扱い・OQ 起票・上流差し戻しの判定） | 要件定義冒頭の突合、上流差し戻し判断時 |
| `templates/inputs-index.md` | `docs/00-inputs/INDEX.md`（持ち込み資料の一覧と採否） | 持ち込み資料の取り込み時 |
| `templates/concept.md` | 企画書テンプレ（`docs/01-concept/concept.md`） | Phase 1 |
| `templates/business-strategy.md` | ビジネス・マーケティング戦略書テンプレ（`docs/02-business-strategy/business-strategy.md`） | Phase 3 |
| `templates/upstream-reconciliation.md` | 突合表テンプレ（`docs/03-requirements/upstream-reconciliation.md`） | Phase 5 冒頭 |

## 原則

1. **企画と戦略は要件定義の「前」に確定する**。Phase 1-4 を飛ばして Phase 5 に入らない（RFP が精緻でも、企画と戦略の成果物が無ければ要件定義は始めない。新規案件は企画から始める）
2. **ユーザーの持ち込み資料は `docs/00-inputs/` に置く**。RFP（`rfp.md`）・既存企画書（`existing-concept.md`）・参考資料（`materials/`）。生成物と入力を分離し、取り込み結果は `INDEX.md` と企画書側に書く
3. **「いまある企画でもいい」**：ユーザーが既に企画書を持っている場合、それを取り込んで concept.md の形式に整え、不足項目だけを対話で埋める。ゼロから聞き直さない
4. **戦略は数値で書く**。市場規模・価格仮説・CAC・LTV・回収期間・KPI 目標・撤退基準は、根拠（出典 URL または算出式）付きの数値。根拠が出せない数値は「仮説（確信度：低）」と明記する
5. **1名運用・財務制約（一括払いのみ・借入不可）は戦略の前提条件**。チャネルは 1〜2 本に絞る。広告は前払い方式。無料枠の原価上限を決める。これに反する戦略は Phase 4 で Block
6. **企画・戦略・RFP が矛盾したら要件定義で勝手に解釈しない**。`upstream-reconciliation.md` の優先順位ルールに従い、OQ を起票してユーザー判断を仰ぐか、Phase 1 / 3 へ差し戻す
7. **戦略の KPI 目標は Phase 19 の kpi-baseline.md の目標値になる**。Phase 20 の ops-review はこの目標との差分を測り、Phase 21 で企画・戦略の見直し要否（次サイクルを Phase 1 / 3 / 5 のどこから始めるか）を判定する（円環の起点と終点を同じ数値で結ぶ）
8. **クライアント案件でも戦略は書く**。主語はプロダクトのオーナー（クライアント）。「クライアントがそのプロダクトでどう事業を成り立たせるか」が無いと、要件の優先順位が決められない。受託対価の設計は提案書・decision-log 側で扱う
9. **社内ツール・CLI・PoC では戦略を軽量化する**（document-set.md のプロファイル `internal-tool` / `minimal`。プロファイルの初期判定は企画時に行う）。市場・価格・チャネルの節は「対象外（理由）」にし、導入・定着・効果測定の節だけを書く。省略は理由必須
10. **成果物は `docs/00-inputs/` `docs/01-concept/` `docs/02-business-strategy/` に配置**（sdlc-toolkit の artifact-layout.md に従う）。レビュー記録は各 `reviews/`、修正ループは rework-loop.md 準拠（上限5回）
