# Rework Loop（修正ループ）プロトコル

レビューで指摘が出たら、**前工程に自動で戻して修正 → 再レビュー**を Approve まで繰り返す。背景：レビュー報告で流れが止まり、指摘が放置されたまま次フェーズに進む事故が頻発した。レビュー報告はループ起動のトリガーであって終着点ではない。

## ループ

```
producer が成果物を提出（Self-Check + Handoff 付き）
  → reviewer が Verdict
     🟢 Approve → 次フェーズ
     🟡 Warning → ユーザーに「修正してループ」か「受容して進行（Defer 記録）」を確認
     🔴 Block   → PM が確認なしで producer を修正モードで起動
                  → producer が指摘対応＋対応表 → reviewer 再起動（ループ +1）→ Verdict へ
```

- ループカウント＝同一フェーズのレビュー実行回数（初回 1）。status.md の「ループ」列に `N/5`
- 上限 5 回。5 回目でも Approve（または Warning 受容）に至らなければ PM がエスカレーション
- ユーザーに聞くのは Warning 受容・上限到達・上流矛盾の 3 場面だけ

## 三者の責務

**reviewer**：レポートを `reviews/YYYY-MM-DD-<reviewer>-loopN.md` に書き、末尾と完了報告に Verdict ブロック（`SKILL.md` §5）を置く。2 回目以降は対応表を照合し、対応表なし・無変更再提出は NO-CHANGE で Block。

**producer（修正モード）**：レビューレポートのパスを渡されたら、Critical / Major 全件に `修正済` / `代替案で対応` / `反論（根拠必須）` / `保留（ユーザー判断待ち）` のいずれかを付け、成果物を直し、対応表を `reviews/YYYY-MM-DD-<producer>-response-loopN.md` に書く。Minor / Nit は任意だが対応／見送りを記録する。

```markdown
# 指摘対応表（loop N）
- 対象レビュー: reviews/YYYY-MM-DD-<reviewer>-loopN.md  - 対応日: YYYY-MM-DD
| 指摘ID | 重要度 | 対応 | 反映箇所 | 備考 |
```

**project-manager**：Verdict ブロックを読み、BLOCK なら即座に `RETURN_TO` を修正モードで起動（レポートのパスを渡す）、producer 完了後に reviewer を再起動、status.md のループ列を更新。`LOOP: 5/5` で Block ならエスカレーション。

## エスカレーション（PM → ユーザー）

状況（未解決指摘の ID と要約）、ループ履歴（Loop / 日付 / Verdict / 残指摘の表）、選択肢（1. 上流フェーズに戻る 2. Defer 記録付きで進行 3. スコープ・要件の見直し）、PM の推奨と理由、を示して判断を求める。

## 差し戻し先

| レビューフェーズ | reviewer | 差し戻し先（指摘ごとに該当者） |
|----------------|----------|------------------------------|
| 2 | concept-reviewer | concept-planner |
| 4 | business-strategy-reviewer | business-strategist |
| 6 | requirements-reviewer | requirements-architect |
| 8 | planning-reviewer | business-flow-designer / tech-stack-architect / brand-design-strategist |
| 10 | external-design-reviewer ＋ ui-mockup-reviewer（＋agent-experience-reviewer） | external-designer（文書・アプリ画面モック）/ marketing-site-builder（営業ポータルモック）/ mcp-server-specialist（MCP） |
| 12 | internal-design-reviewer | internal-designer |
| 14 | test-plan-reviewer | test-planner / test-case-adversary |
| 16.5 | exploratory-tester | implementation-worker |
| 17 | requirement-traceability-auditor | e2e-usecase-tester（E2E 追加）/ test-planner（計画の宣言不足） |
| 18 | implementation-reviewer ＋ security-auditor | implementation-worker / tester / e2e-usecase-tester / auth-integration-specialist / payment-integration-specialist |

Phase 10・18 は複数 reviewer が並列で、**全員 Approve** で通過。ループ回数は reviewer ごとに独立。

**上流差し戻し**：Phase 5 以降で企画書・戦略書自体の変更が必要と分かったら、本ループとは別枠で PM が Phase 1 / 3 の producer を修正モードで起動し、そのレビュワーで再 Approve を取る。下流で上流文書を書き換えて吸収しない。判定基準は `business-strategy-toolkit/references/upstream-reconciliation.md` §4。

## アンチパターン

レビュー報告で停止する／対応表なしの再提出／無変更再提出／ループ回数を記録しない／Warning を確認なしに受容する／上限を超えてループを続ける。
