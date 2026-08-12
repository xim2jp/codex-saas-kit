## 概要

（このPRで何を・なぜ変えるか。結論ファースト）

## 変更内容

-

## レビューゲート（main への PR は二重レビュー必須）

このリポジトリは **レビュワーエージェント × Amazon Q Developer** の二重ゲートでマージを守る。

- [ ] **① レビュワーエージェント**: 開発中に Phase 14 `implementation-reviewer` のレビューを通した（Verdict: 🟢 Approve）
- [ ] **② Amazon Q Developer**: PR 上の Amazon Q 自動レビューの指摘を確認し、必要な対応を済ませた
- [ ] CI の `amazon-q-review-gate` がパスしている
- [ ] Code Owner の approve を取得（または取得予定）

> Amazon Q のレビューは PR 作成後「少し時間をおいて」自動で付く。CI が最大 3 分間隔 × 3 回ポーリングして待機する。

## テスト

- [ ] Phase 11 ユニット/統合テスト パス
- [ ] Phase 12 ユースケース E2E パス
- [ ] Phase 13 要件トレーサビリティ監査 パス

## 影響範囲・補足

-
