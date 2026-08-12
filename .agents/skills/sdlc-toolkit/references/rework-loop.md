# Rework Loop（修正ループ）プロトコル

レビューフェーズで指摘が出たとき、**前ステップに自動で手戻りして修正 → 再レビューを繰り返す**ための強制プロトコル。全レビュワー・全作成系エージェント・project-manager が従う。

> **背景**：レビュワーが指摘レポートを出した時点で流れが止まり、指摘がスルーされたまま次フェーズに進む事故が頻発した。本プロトコルは「レビュー報告＝ループ起動のトリガー」と定義し、Approve に到達するまで（または上限到達まで）ループを止めないことを保証する。

## ループの基本ルール

```
作成エージェント（producer）が成果物を作成
  ↓
レビュワー（reviewer）がレビュー → Verdict 判定
  ↓
┌─ 🟢 Approve ────→ 次フェーズへ（ループ終了）
├─ 🟡 Warning ───→ ユーザーに確認：「修正してループ」or「受容して進行（Defer記録）」
└─ 🔴 Block ─────→ 【自動・問答無用】producer を修正モードで再起動
                     ↓
                   producer が指摘対応 + 対応表を作成
                     ↓
                   reviewer を再起動（ループカウント +1）
                     ↓
                   （Verdict 判定に戻る）
```

- **ループカウント** = 同一フェーズにおけるレビュー実行回数。初回レビューが 1回目。
- **上限 5回**。5回目のレビューでも Approve（または Warning 受容）に至らない場合、PM がエスカレーション（後述）。
- Block 時のループ起動に**ユーザー確認は不要**（自動実行）。ユーザーに判断を仰ぐのは Warning 受容・上限到達・上流矛盾の3場面のみ。

## 三者の責務

### reviewer の責務

1. レビューレポートを `docs/<フェーズ>/reviews/YYYY-MM-DD-<reviewer名>-loopN.md` に**必ず書き出す**（N = ループカウント）
   - レビュワーの Write 権限は **reviews/ 配下の自レポートのみ**。設計ファイル本体への書き込みは引き続き禁止
2. レポート末尾と完了報告の両方に、次の**機械可読 Verdict ブロック**を必ず含める：

```
VERDICT: BLOCK | WARNING | APPROVE
LOOP: 2/5
RETURN_TO: <修正担当エージェント名>（APPROVE 時は NEXT_PHASE）
REPORT: docs/.../reviews/YYYY-MM-DD-<reviewer名>-loop2.md
```

3. 2回目以降のレビューでは producer の**対応表を必ず照合**：
   - 前回の Critical/Major 全件に対応記載があるか（無ければ即 Block）
   - 「修正済」の指摘が実際に成果物へ反映されているか
   - **無変更再提出の検出**：成果物に実質的変更が無いのに「修正済」とされていれば `NO-CHANGE` として即 Block

### producer（作成エージェント）の責務：修正モード

レビューレポートのパスを渡されて起動されたら「修正モード」として動作する：

1. レビューレポートを Read し、Critical / Major の**全件**に対応する
   - 対応の選択肢：`修正済` / `代替案で対応` / `反論（根拠必須）` / `保留（ユーザー判断待ち）`
   - **黙殺は禁止**。全指摘 ID に対して上記いずれかを明記する
2. 成果物を修正する
3. **対応表**を `docs/<フェーズ>/reviews/YYYY-MM-DD-<producer名>-response-loopN.md` に書き出す：

```markdown
# 指摘対応表（loop N）

- 対象レビュー: reviews/YYYY-MM-DD-<reviewer名>-loopN.md
- 対応日: YYYY-MM-DD

| 指摘ID | 重要度 | 対応 | 反映箇所 | 備考 |
|--------|--------|------|---------|------|
| C-001 | Critical | 修正済 | screen-list.md §3 S-AUTH-002 | パスワードリセット画面を追加 |
| M-002 | Major | 反論 | - | 要件RX-05で明示的に対象外。根拠: ... |
```

4. Minor / Nit は対応任意だが、対応表に「対応 / 見送り」を記録する
5. **禁止**：指摘に触れず成果物を再提出すること／対応表なしで完了報告すること

### project-manager の責務

1. reviewer の完了報告から Verdict ブロックをパースする
2. `VERDICT: BLOCK` → **即座に** `RETURN_TO` のエージェントを修正モードで起動（レビューレポートのパスをプロンプトに含める）。**Block レビューの結果をユーザーに報告するだけで停止することは絶対禁止**
3. producer 完了 → **即座に** reviewer を再起動（ループカウント +1 を伝える）
4. `VERDICT: WARNING` → ユーザーに「修正してループ」or「受容して進行」を確認。受容時は status.md に Defer として記録
5. status.md のフェーズ表「ループ」列を毎回更新（例: `3/5`）
6. `LOOP: 5/5` で Block のまま → エスカレーション（下記テンプレ）

## 上限到達時のエスカレーション（PM）

```
## ⚠️ 修正ループが上限（5回）に到達しました

### 状況
- Phase X のレビューが5回のループを経ても Block のままです
- 未解決の指摘: <ID と要約>

### ループ履歴
| Loop | 日付 | Verdict | 主な残指摘 |
|------|------|---------|-----------|

### 提案する選択肢
1. 上流フェーズ（Phase Y）に戻る：指摘の根本原因が上流にある場合（推奨条件: ...）
2. 指摘を Defer として記録し進行する：リスク受容（記録は残す）
3. スコープ・要件の見直し：そもそもの前提を変える

### 推奨
- <PM の推奨案と理由>

ご判断をお願いします。
```

## status.md への記録

フェーズ別ステータス表に「ループ」列を設け、`<現在のループ回数>/5` を記録する：

```markdown
| Phase | 名称 | ステータス | 担当 | 成果物 | Verdict | ループ | 完了日 |
|-------|------|----------|------|--------|---------|-------|--------|
| 5 | 外部設計 | 🔁 | external-designer | docs/20-external-design/ | 🔴 Block | 3/5 | - |
```

## 適用対象フェーズ

| レビューフェーズ | reviewer | 差し戻し先（producer） |
|----------------|----------|----------------------|
| Phase 2 | requirements-reviewer | requirements-architect |
| Phase 4 | planning-reviewer | business-flow-designer / tech-stack-architect / brand-design-strategist（指摘ごとに該当者） |
| Phase 6 | external-design-reviewer **＋ ui-mockup-reviewer（並列）** | external-designer（文書・アプリ画面モック）/ marketing-site-builder（営業ポータルモック、v0.9.0。指摘ごとに該当者） |
| Phase 8 | internal-design-reviewer | internal-designer |
| Phase 10 | test-plan-reviewer | test-planner / test-case-adversary（指摘ごとに該当者、v0.12.0） |
| Phase 12.5 | exploratory-tester（発見バグの Verdict を発行） | implementation-worker（v0.12.0） |
| Phase 14 | implementation-reviewer | implementation-worker / tester / e2e-usecase-tester（指摘ごとに該当者） |

**Phase 6 の特則**：external-design-reviewer（文書整合）と ui-mockup-reviewer（画面モック＋営業ポータルモックのビジュアル品質）は**並列にレビュー**し、**両方が Approve** で初めて Phase 6 通過。ループカウントはレビュワーごとに独立して数える。ui-mockup-reviewer の Block は、指摘対象がアプリ画面モック（`docs/20-external-design/mockups/`）なら external-designer、営業ポータルモック（`docs/15-marketing-site/mockups/`）なら marketing-site-builder に差し戻す（v0.9.0）。

## アンチパターン

- **レビュー報告で停止**（最大の失敗モード。Block はループ起動のトリガーであって終着点ではない）
- 対応表なしの再提出（reviewer は即 Block でよい）
- 無変更再提出（`NO-CHANGE` で即 Block）
- ループカウントを status.md に記録しない（何周目か分からなくなり、上限ストッパーが機能しない）
- Warning をユーザー確認なしで勝手に受容する／勝手にループする
- 上限を超えてループを続ける（5回で必ず止めてエスカレーション）
