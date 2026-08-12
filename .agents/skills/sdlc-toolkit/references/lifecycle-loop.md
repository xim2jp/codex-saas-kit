# Lifecycle Loop（4階層PDCA・円環SDLC）プロトコル

「人間社会の業務はすべて循環構造をしている」という設計思想を、フレームワーク全体に**4つの入れ子ループ**として明示的に実装する（v0.13.0）。SDLC は Phase 14 で終わる直線ではなく、**リリース後の運用→課題認識→改善→次サイクル**へ回り続ける円環である。全エージェントと project-manager が従う。

## 4階層ループの全体像

```
L0 マイクロループ（エージェント内）      ：作る → 自己検証 → 直す → 提出
L1 フェーズループ（rework-loop.md）      ：提出 → レビュー → 修正 → 再レビュー（上限5回）
L2 プロダクトループ（本書 Phase 15-17）  ：開発 → リリース → 運用 → 課題 → 改善 → 開発…
L3 フレームワークループ（feedback-loop） ：案件知見 → 本体進化 → 全案件へ配信
```

各ループの Check は**必ず構造化された記録を排出する**（Verdict ブロック、bug-escape-ledger、ops-review、PROJECT_LEARNINGS）。記録が無い Check は「印象」であり PDCA を回せない。

## L0：エージェント自己検証プロトコル（提出前セルフレビュー）

全 producer 系エージェント（作成系）は、成果物を提出（完了報告）する前に**自己チェック**を行い、結果を成果物末尾の Handoff Block 直前に添付する：

```markdown
## ✅ Self-Check（提出前セルフレビュー）

- 実施日: YYYY-MM-DD
- チェックリスト: <自エージェント定義のチェックリスト名 or artifact-layout 準拠>
- 結果: 12/12 pass（fail した項目は修正済み or 理由を明記）

| # | 項目 | 判定 | 備考 |
|---|------|------|------|
```

ルール：
- 自エージェント定義に「チェックリスト」節があればそれを使う。無ければ最低限：上流成果物との整合／必須成果物の存在／Handoff Block の完備、の3点
- fail のまま提出する場合は理由を明記（隠して pass にするのは無変更再提出と同罪）
- **レビュワーは Self-Check が無い成果物を即差し戻してよい**（review-protocol.md 準拠）。レビュワーの役割は「浅い抜け漏れの検出」から「深い指摘」へ集中させる
- 目的は儀式ではなく **L1 ループ回数の削減**。ループ回数が減らないなら自己チェック項目が形骸化している（L3 で見直す）

## L2：プロダクトループ（Phase 15-17、円環の本丸）

Phase 14 の Approve とデプロイ Go はゴールではなく、**次サイクルの入力**である。

### Phase 15：リリース・計測開始

- 担当：project-manager ＋ observability-integration-specialist ＋（analytics-integration Skill 準拠の計装確認）
- 成果物：`docs/60-operations/release-log.md`（リリース日・バージョン・変更内容・ロールバック手順）、KPI ベースライン（`docs/60-operations/kpi-baseline.md`：登録数・Activation・MRR・解約率・エラー率の初期値と目標値）
- 監視・アラート・アナリティクスが**計測できる状態**になっていることを確認してから Phase 16 へ（計測なき運用は Check 不能）

### Phase 16：運用サイクル（常設・繰り返し）

- 担当：**operations-analyst**（新設）。月次（成長期は週次）で起動
- 入力：監視ダッシュボード／アナリティクス／問い合わせログ／Stripe 実績／cost-guardian の月次コスト／bug-escape-ledger.md
- 成果物：`docs/60-operations/ops-review-YYYY-MM.md`（KPI 実績 vs 目標、エラー・障害サマリー、問い合わせ・解約理由の分類、コスト実績、**課題リスト（改善候補）**）
- 本番バグ・障害は必ず bug-escape-ledger.md にも記録（test-hardening.md 原則5。発見フェーズ=本番）

### Phase 17：改善サイクル起票（ふりかえり→次サイクル）

- 担当：**retrospective-facilitator**（新設）
- 入力：ops-review、bug-escape-ledger、status.md のループ実績、PROJECT_LEARNINGS.md
- 成果物：
  - `docs/60-operations/improvement-backlog.md`（優先度付き改善バックログ。各項目に：根拠データ／期待効果／サイクル種別の判定）
  - `docs/60-operations/retrospective-YYYY-MM.md`（ふりかえり記録：うまくいったこと／いかなかったこと／プロセス自体の改善）
  - PROJECT_LEARNINGS.md への還流候補の転記（L3 への接続）
- バックログ上位が承認されたら、**次サイクルの Phase 1（またはフルサイクル/軽量サイクルの判定）へ入力**して円環が閉じる

### status.md への追記（運用フェーズ）

```markdown
## 運用サイクル（Phase 15-17、v0.13.0）

| サイクル | 期間 | ops-review | 改善起票 | 実施サイクル種別 | 状態 |
|---------|------|-----------|---------|----------------|------|
| #1 | 2026-08 | ops-review-2026-08.md | 3件 | 軽量×3 | ✅ |
```

## 軽量チェンジサイクル（改善を止めないための小さい輪）

フル SDLC（Phase 1-14）を全改善に強制すると円環が止まる。**大きい輪（新機能）と小さい輪（改善パッチ）の二重円環**で回す。

### サイクル種別の判定（PM / retrospective-facilitator）

| 種別 | 条件 | プロセス |
|------|------|---------|
| **フルサイクル** | 新機能・画面追加・データモデル変更・課金/認証/権限に触る変更 | Phase 1-14 を通常どおり（既存 docs への差分追記でよい） |
| **軽量サイクル** | 既存機能の改善・バグ修正・文言/UI 調整・性能改善（外部仕様とデータモデルが不変） | 下記 5 ステップ |
| **即時ホットフィックス** | 本番障害・セキュリティ | 修正＋再現テスト → 事後に軽量サイクルの記録を埋める |

### 軽量サイクルの 5 ステップ

```
1. 変更要求記録   docs/60-operations/changes/CR-NNN.md（背景データ・変更内容・影響範囲）
2. 影響分析      関連する既存設計文書の該当節を特定し、差分を追記（新文書は作らない）
3. 実装＋テスト   implementation-worker / tester。再現テスト or 回帰テスト必須（test-hardening 準拠）
4. 縮約ゲート    回帰テスト全緑（E2E は影響範囲＋標準UCのスモーク）＋ implementation-reviewer の
                差分レビュー1回（課金・認証・権限に触れる場合は security-auditor も）
5. リリース記録   release-log.md に追記、CR-NNN.md をクローズ
```

- 軽量サイクルでも **bug-escape-ledger / 再現テストの義務は免除されない**
- 判定に迷ったら**フルサイクル寄り**に倒す（軽量サイクルの乱用でデータモデルが壊れるのが最悪の失敗）
- 軽量サイクルが 5 件たまったら、設計文書と実装の乖離を external-designer / internal-designer に棚卸しさせる（文書の腐敗防止）

## ループ計測（Check の燃料）

`scripts/loop-metrics.sh`（フレームワーク本体に同梱、案件へコピー）で以下を機械集計する：

- フェーズ別ループ回数（status.md の「ループ」列から）
- reviews/ 配下の Verdict 分布（BLOCK / WARNING / APPROVE の推移）
- bug-escape-ledger.md の「混入フェーズ×発見フェーズ」マトリクス（弱点フェーズの特定）

出力は `docs/60-operations/loop-metrics-YYYY-MM.md`。retrospective-facilitator と月次レビュー（L3）の一次資料になる。

**解釈の指針**：
- 特定フェーズのループ回数が恒常的に多い → そのフェーズの producer のチェックリスト（L0）か上流の成果物品質に問題
- 「混入=設計、発見=本番」の行が多い → レビュー観点の追加を L3 へ還流
- Self-Check 導入後もループ回数が減らない → 自己チェック項目が形骸化

## L3 との接続（フレームワークループ）

- Phase 17 の retrospective は PROJECT_LEARNINGS.md への転記までを責務に含む（「気付いた即日に書く」の構造的な受け皿）
- loop-metrics と bug-escape-ledger は月次レビュー（`docs/operations/monthly-review.md`）の必須インプット
- 還流の詳細は `docs/operations/feedback-loop.md`（本体リポジトリ）が正本

## アンチパターン

- **Phase 14 完了・デプロイで「案件終了」扱いにする**（円環が始まる前に止める。最大の失敗モード）
- 計測基盤なしで Phase 16 に入る（KPI もエラー率も測れず、Check が印象論になる）
- すべての改善にフル SDLC を強制する／逆にすべてを軽量サイクルで流す（二重円環の判定を守る）
- ops-review を書かずに改善を思いつきで実施（根拠データの無い Act）
- Self-Check を全項目 pass の儀式にする（fail と理由を書く方が価値がある）
- retrospective で人を責める（対象はプロセスとチェックリスト。エージェント定義の改善に変換する）
