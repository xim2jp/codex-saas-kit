---
name: sdlc-toolkit
description: SaaS 開発 SDLC（Phase 0〜21）の共通契約。成果物の配置、Handoff / Self-Check / Verdict の書式、修正ループ、文書セット、オーナー制約を 1 か所に定める。全エージェントが作業開始時に最初に読む。「成果物の配置」「フェーズ進行」「レビュー手順」「修正ループ」「Tier 判定」で参照。
---

# SDLC Toolkit — 全エージェント共通契約

この Skill は全エージェントが作業開始時に最初に読む（各エージェント定義の冒頭で指示している）。ここに書いてあることは各エージェント定義で繰り返さない。詳細は `references/` にあり、必要なときに開く。

## 1. 全体像

SDLC は企画から始まり、リリース後も運用→改善→次サイクルへと**円環**で回る。

```
0 持ち込み資料 → 1-2 企画 → 3-4 戦略 → 5-6 要件 → 7-8 業務設計・技術選定・ブランド
→ 9-10 外部設計（画面モック＋営業ポータルモック）→ 11-12 内部設計 → 13-14 テスト計画
→ 15 実装＋Unit/Integration（タスク0＝ローカル開発環境）→ 16 ユースケース E2E → 16.5 探索的テスト
→ 17 トレーサビリティ監査 → 18 実装レビュー＋セキュリティ監査 → デプロイ
→ 19 リリース・計測開始 → 20 運用レビュー → 21 改善起票 → 次サイクル（5 から。企画・戦略を変えるなら 1 / 3 から）
```

偶数フェーズはレビュー。フェーズごとの担当・成果物・ゲートは `references/pm-playbook.md` の表が正本。**Phase 1-4、9 の営業ポータルモック、15 のタスク0、16、16.5、17 は省略しない**。省略したい場合はユーザーがリスクを理解したうえで承認し、`docs/99-pm/status.md` と `document-set.md` に記録する。

## 2. 成果物の置き場

`docs/NN-<name>/` の番号付きディレクトリに置く（`references/artifact-layout.md` が正本、パスは安定 API）。レビューは `docs/<phase>/reviews/YYYY-MM-DD-<agent>-loopN.md`、producer の指摘対応表は同じ場所に `-response-loopN.md`。

- `docs/00-inputs/` はユーザーの持ち込み資料。エージェントが書けるのは `INDEX.md` だけ（PM はフェーズ完了時に `git status docs/00-inputs/` で改変が無いことを確かめる）
- `htmldocs/` は `node .agents/skills/sdlc-toolkit/scripts/build-htmldocs.mjs` の生成物。手書きしない
- 作る文書は `docs/99-pm/document-set.md` で案件ごとに採否が決まっている。除外された文書の不存在は指摘しない
- 既存ファイルがあれば上書きせず追記・節更新する。上流文書（企画・戦略）を下流で書き換えて矛盾を吸収しない

## 3. 上流との整合

Phase 5 以降の全員は作業前に `docs/01-concept/concept.md`（OBJ・成果物スコープ）、`docs/02-business-strategy/business-strategy.md`（SEG・収益モデル・KPI・営業ポータル要否）、`docs/03-requirements/requirements.md` を読み、自分の成果物がそれらと矛盾しないようにする。矛盾を見つけたら勝手に解釈を変えず、Handoff の「上流差し戻し候補」で PM に返す（判定基準は `business-strategy-toolkit/references/upstream-reconciliation.md` §4）。

## 4. producer の提出書式

成果物の末尾に **Self-Check → Handoff** の順で付ける。Self-Check が無い成果物はレビュワーが差し戻してよい（ループ回数は消費しない）。

```markdown
## ✅ Self-Check
- 実施日: YYYY-MM-DD
- 結果: N/M pass（fail は理由を書く。隠して pass にしない）
| # | 項目 | 判定 | 備考 |

## 📤 Handoff
- **Created by**: <agent>  - **Date**: YYYY-MM-DD
- **Next suggested agent(s)**: ...
- **Open questions for next phase**: ...
- **Assumptions made**: ...
- **Upstream reconsideration candidates**: （無ければ「なし」）
- **Files referenced**: ...
```

Self-Check の項目は自エージェント定義の「品質基準」節から作る。

## 5. reviewer の判定と書式

- Severity は Critical / Major / Minor / Nit。**Critical ≥1 → Block、Major のみ → Warning、それ以外 → Approve**。指摘ゼロも正当な結果
- 指摘には該当箇所・失敗モード・根拠を付ける。根拠が出せないものは書かない。重要度を膨らませない
- レビュワーは成果物本体を直さない。Write は自分のレポートだけ
- 2 回目以降は producer の対応表を照合する。対応表なし・無変更再提出（NO-CHANGE）は Block
- レポート末尾と完了報告の両方に **Verdict ブロック**を置く（PM が機械的に読む。4 行が欠けたレポートは PM が書き直させる）：

```
VERDICT: BLOCK | WARNING | APPROVE
LOOP: N/5
RETURN_TO: <修正担当エージェント名>（APPROVE 時は NEXT_PHASE）
REPORT: docs/<phase>/reviews/YYYY-MM-DD-<reviewer>-loopN.md
```

レポートの節構成は `references/review-protocol.md`。

## 6. 修正ループ

Block が出たら PM は確認なしで `RETURN_TO` のエージェントを修正モードで起動し、producer は Critical / Major 全件に「修正済／代替案／反論（根拠）／保留」を付けた対応表を書き、レビュワーを再起動する。上限 5 回。5 回目でも Block なら PM がエスカレーション（上流に戻る／Defer 付き承認／スコープ見直し）。Warning はユーザーに「修正」か「受容（Defer 記録）」を確認する。詳細は `references/rework-loop.md`。

修正モードで起動された producer は、レビューレポートを読み、指摘に触れずに再提出しない。

## 7. 執筆ルール（docs/ 配下の全文書）

- 冒頭に「この文書について」（目的・読者・前提）
- ID と名称を併記する（`UC-SIGNUP-01 新規登録` のように）。指示代名詞（あれ・それ・上記の）で参照しない
- 用語は `docs/03-requirements/glossary.md` に合わせる。一文一義、数値で書く
- 文書間の整合（同じ ID に同じ名称、参照先の実在）は書き手の責任

## 8. オーナー制約（野口 Profile）

- **1 名運用**：過剰機能・過剰運用を避ける。守れない SLA（99.99%・24 時間対応）を約束しない
- **財務**：民事再生中。一括払いのみ、借入・分割不可、広告は前払い。コストは無料枠と月額上限で考える
- **税務**：適格請求書発行事業者（登録番号あり）。B2B では強み。Stripe Tax に登録番号を設定
- **スタック**：Tier A（Vercel + Supabase + Next.js）を既定、Tier B（AWS）は規制・規模・既存連携が要るときだけ。判定は「規制強度 → 規模 → 既存連携 → 運用体制 → 予算」の順（`references/tech-stack-profile.md`）
- **品質姿勢**：テストは独立性と多様性で守る（`references/test-hardening.md`）。バグは修正より先に再現テストと `bug-escape-ledger.md` 記録

## 9. references

| ファイル | 内容 |
|---------|------|
| `references/pm-playbook.md` | フェーズ表（担当・成果物・ゲート）、status.md 書式、Go/No-Go、文書セット |
| `references/artifact-layout.md` | `docs/` ディレクトリ構造と命名 |
| `references/review-protocol.md` | レビュー姿勢、Severity 定義、レポート書式 |
| `references/rework-loop.md` | 修正ループと対応表、エスカレーション、差し戻し先表 |
| `references/lifecycle-loop.md` | 4 階層 PDCA、Phase 19-21、軽量チェンジサイクル、ループ計測 |
| `references/test-hardening.md` | テスト重厚化（抽出二重化・ミューテーション・探索的・多重実行・バグ台帳） |
| `references/document-catalog.md` | 文書カタログ、プロファイル、htmldocs、ID 相互参照 |
| `references/tech-stack-profile.md` | Tier A/B/C の定義と判定軸、ADR 書式 |
| `scripts/build-htmldocs.mjs` | docs/ → htmldocs/ 生成器 |
