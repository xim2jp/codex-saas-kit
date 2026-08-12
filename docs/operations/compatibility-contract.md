# Compatibility Contract（互換性契約、v0.14.0）

フレームワーク本体と派生システム（本フレームワークを導入した各 SaaS 案件）の間で、**何が安定APIで何が内部実装か**を定義する。`.codex/`・`.agents/` のエクスポートで派生システムの品質を継続的に底上げしつつ、成果物の互換性を壊さないための正本。

## 基本原則

1. **安定APIの破壊的変更は MAJOR バージョンでのみ許可**（現在 v0.x のため、実質的に「やらない」。やむを得ない場合は移行手順を CHANGELOG に必ず記載）
2. **内部実装は MINOR / PATCH で自由に改善**してよい（派生システムはエクスポートを受けるだけで品質が上がる）
3. **フェーズ番号は追加のみ（Additive）**：既存フェーズの番号変更・削除は禁止。拡張は 12.5 / 15-17 のように挿入・追記で行う
4. 派生システム側のカスタマイズは `.codex-manifest`（配布時ハッシュ台帳）で保護される（update-project.sh の3分類適用）

## 安定API（派生システム・過去成果物が依存してよいもの）

### 1. 成果物の配置と命名（artifact-layout.md）

- `docs/00-99` の番号付きディレクトリ構造と、そこに定義された**ファイル名・命名パターン**
  - 例：`docs/41-test-results/usecase-e2e-YYYYMMDD-HHMM.md`、`reviews/YYYY-MM-DD-<agent>-loopN.md`
- 既存パスの改名・移動は破壊的変更。新規パスの追加は非破壊（MINOR）

### 2. 機械可読ブロックのフォーマット

- **Verdict ブロック**：`VERDICT:` / `LOOP:` / `RETURN_TO:` / `REPORT:` の4行形式（rework-loop.md）
- **Handoff Block** / **Self-Check ブロック**（artifact-layout.md / lifecycle-loop.md）
- **bug-escape-ledger.md** の列構成（test-hardening.md）
- フィールドの追加は非破壊、既存フィールドの改名・削除・意味変更は破壊的変更

### 3. ステータス・記録ファイルの形式

- `docs/99-pm/status.md` のフェーズ表の列構成（Phase / 名称 / ステータス / 担当 / 成果物 / Verdict / ループ / 完了日）
- `PROJECT_LEARNINGS.md` のセクション構成（還流候補のフィールド）
- `.framework-version`（1行目 = バージョン文字列）
- `.codex-manifest`（`version:` 行 + `sha256  パス` 行の列挙）

### 4. フェーズ体系

- Phase 1-17（+12.5）の番号と責務対応、Phase 12 / 12.5 / 13 のスキップ禁止、Verdict 3値（Approve / Warning / Block）、ループ上限5回

### 5. エージェント名

- 既存エージェントの `name`（起動名）。改名は破壊的変更（status.md・過去レポートの RETURN_TO が壊れる）。新規追加は非破壊

## 内部実装（予告なく MINOR / PATCH で変更してよいもの）

- 各エージェント定義の本文（プロンプト・チェックリストの内容・アンチパターン）
- Skill の references の記述内容
- スクリプト（setup.sh / update-project.sh / loop-metrics.sh 等）の内部ロジック（入出力ファイルの形式は安定API側）
- レビュー観点の追加・強化（Block 条件の**追加**は品質強化として非破壊扱い。ただし CHANGELOG に明記）

## 派生システムへの配布（エクスポート）

- 配布単位は `.codex/`＋`.agents/`＋`AGENTS.md` ＋ `.framework-version` ＋ `.codex-manifest`（＋必要に応じて scripts/ の管理スクリプト）
- `scripts/export-to-projects.sh` が `docs/projects/INDEX.md` の配布先リストへ一括適用する
- 適用は **update-project.sh の3分類**：
  - **SAFE_UPDATE**：案件が未カスタマイズ（配布時ハッシュと一致）で本体が更新 → 自動上書き
  - **CUSTOM_KEEP**：案件がカスタマイズ済みで本体は未変更 → 保持
  - **CONFLICT**：両方が変更 → 保持したうえでレポートに列挙（手動マージ判断）
- 案件独自の追加ファイル（本体に無い agents/skills）は常に保持される
- **CRITICAL（セキュリティ・重大バグ）の還流は月次を待たず即配布**（feedback-loop.md 準拠）

## 自己整合性の検証

- `scripts/check-layout-drift.sh`：エージェント/Skill 定義が参照する `docs/NN-*` パスが artifact-layout.md に定義されているかを機械検証（CI で実行）
- 破壊的変更を含む PR は CHANGELOG の該当バージョンに **「BREAKING」** と移行手順を必ず記載

## バージョニング（feedback-loop.md と共通）

| 変更 | レベル |
|------|--------|
| 安定APIの破壊的変更（移行手順必須） | MAJOR |
| エージェント/Skill/フェーズの追加、後方互換の拡張 | MINOR |
| 既存定義の内容改善・誤字修正 | PATCH |
