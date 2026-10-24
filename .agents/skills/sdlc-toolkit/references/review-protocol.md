# Review Protocol（全レビュワー共通）

レビュー系エージェント（concept-reviewer、business-strategy-reviewer、requirements-reviewer、planning-reviewer、external-design-reviewer、ui-mockup-reviewer、agent-experience-reviewer、internal-design-reviewer、test-plan-reviewer、implementation-reviewer、security-auditor、requirement-traceability-auditor）の共通プロトコル。Verdict の 3 値とブロックの書式は `SKILL.md` §5、ループは `rework-loop.md`。

## 姿勢

- **全体俯瞰から始める**。誤字より先に、文書間の不整合・仕様漏れ・目的不適合を探す。細部はサンプリングでよい
- **Pedantic but honest**。指摘には該当箇所・失敗モード・根拠を付ける。根拠が無いものは書かない。指摘ゼロも正当な結果で、レビューを正当化するために指摘を作らない
- **重要度を膨らませない**。書く前に：該当箇所を正確に示せるか／具体的な失敗モードを言えるか／周辺（上流で既に処理済みでないか）を読んだか／その重要度を弁護できるか。ひとつでも否なら下げるか消す
- **検出と対策を分ける**。何を直すかは書く、どう設計するかは書かない。成果物本体は直さない
- 上流（Approve 済みの企画・戦略）の妥当性を蒸し返さない。下流では「整合しているか」だけを見る。上流自体の問題は「Phase 1 / 3 差し戻し候補」として PM に返す
- `docs/99-pm/document-set.md` で除外された文書の不存在は指摘しない。`htmldocs/` はレビューしない

## Severity

| 重要度 | 条件 |
|--------|------|
| 🔴 Critical | 要件を満たせない／セキュリティ・データ損失／法規制違反／重大な業務影響／上流との明らかな矛盾／必須成果物の欠落 |
| 🟡 Major | 設計の不整合・論理矛盾／性能・保守性の重大な懸念／検証できない設計／大きなベストプラクティス逸脱 |
| 🟢 Minor | 命名・文書の不明瞭さ、軽微な冗長、規約の些細な違反、改善提案 |
| ⚪ Nit | 好み、代替案、将来の検討材料 |

Self-Check が無い成果物は Verdict を出す前に差し戻してよい（ループ回数は消費しない）。Self-Check が全 pass なのに同種の指摘が複数出るなら、producer のチェックリスト形骸化として指摘に含める。

## レポート書式

`docs/<phase>/reviews/YYYY-MM-DD-<reviewer>-loopN.md`（N は同一フェーズのレビュー回数、初回 1。既存ファイルを上書きしない）。

```markdown
# レビュー結果: <対象>
- レビュワー / レビュー日 / レビュー対象（パス列挙）/ ループカウント N/5 / 総合 Verdict

## サマリー
| 重要度 | 件数 |（4 行）
**判定理由**: 1〜2 行

## 🔴 Critical Issues
### C-001: <タイトル>
- 該当箇所 / 問題 / 失敗モード / 根拠 / 修正提案 / 担当エージェント

## 🟡 Major Issues（同形式、M-001）
## 🟢 Minor Issues（表：ID / 該当箇所 / 問題 / 提案）
## ⚪ Nits（箇条書き）
## ✅ Positive Highlights（良い点も必ず書く）
## 📋 Action Checklist（指摘 ID と担当エージェント）
## 🔄 Verdict ブロック（SKILL.md §5 の 4 行。完了報告にも同じものを書く）
```

## 再レビュー

- 起動時に `reviews/` を見て最大 loop 番号＋1 を今回のカウントにする
- producer の対応表（`-response-loopN.md`）を照合し、前回 Critical / Major 全件の対応を成果物の実体で確認する。対応表なし・無変更再提出は NO-CHANGE として Block
- 新規指摘は最小限（同レベルの観点を新たに見つけたときだけ）
- 5 回目でも Approve に至らなければ、レポートと完了報告に上限到達を明記し PM のエスカレーションを要請する

## ユーザーによる上書き

「Approve を強制」（Defer 記録付きで次へ）、「Defer」（後フェーズへ先送り）、「Reject」（対象を破棄し上流へ）。いずれも status.md に記録する。
