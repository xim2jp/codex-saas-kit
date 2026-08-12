---
name: sdlc-toolkit
description: SaaS開発の SDLC 14フェーズ全体を支える共通基盤の知識集。成果物の配置ルール（docs/00-99）、PM のオーケストレーション手順（フェーズ進行・Verdict分岐・再レビューループ・デプロイGo/No-Go）、全レビュワー共通のレビュープロトコル、技術スタック Tier A/B/C の判定基準（Vercel+Supabase / AWS / ハイブリッド）を収録する。全エージェントが成果物の置き場所とフェーズ進行の判断で常時参照する。「成果物の配置」「フェーズ進行」「ステータス管理」「レビュー手順」「技術スタックTier」「デプロイ判断」で参照。
---

# SDLC Toolkit Skill

SaaS 開発の SDLC 14フェーズ全体を支える**共通基盤 Skill**。個別技術ではなく、「どこに成果物を置くか」「どう進行するか」「どうレビューするか」「どの技術 Tier を選ぶか」という全エージェント共通のルールを定義する。

## いつこのSkillを参照するか

- **全エージェント共通**：成果物を書き出す前に配置ルールを確認するとき
- **project-manager**：フェーズ進行・エージェント起動・status.md 更新・デプロイ Go/No-Go 判断のとき
- **全レビュワー**：レビューのスタンス・Verdict（Approve/Warning/Block）・レポート形式を確認するとき
- **tech-stack-architect**：Tier A/B/C の判定と野口さん固有の制約（1名運用・財務制約）を確認するとき

## references 一覧

| ファイル | 内容 | 主な読み手 |
|---------|------|-----------|
| `references/artifact-layout.md` | 成果物配置ルール（docs/00-99 のディレクトリ構造、Phase 12/13 成果物の必須性） | 全エージェント |
| `references/pm-playbook.md` | PM オーケストレーション手順（Phase別呼び出し、status.md フォーマット、進行ルール、再レビューループ、エスカレーション、デプロイ Go/No-Go チェックリスト） | project-manager |
| `references/review-protocol.md` | 全レビュワー共通プロトコル（レビュースタンス、Verdict 判定基準、レポート形式、再レビュー時の対応確認） | レビュー系9エージェント |
| `references/rework-loop.md` | 修正ループプロトコル（Block時の自動差し戻し、対応表、ループカウント上限5回、エスカレーション、機械可読 Verdict ブロック） | 全レビュワー・全作成系エージェント・project-manager |
| `references/tech-stack-profile.md` | 技術スタック Tier A/B/C の定義と選定判断軸、野口さん固有の財務制約 | tech-stack-architect、internal-designer |
| `references/test-hardening.md` | テスト重厚化プロトコル（抽出二重化・ブラックボックス優先・ミューテーション・探索的テスト Phase 12.5・バグエスケープ台帳・多重実行、v0.12.0） | テスト系6エージェント、implementation-reviewer、project-manager |
| `references/lifecycle-loop.md` | 4階層PDCA・円環SDLC（L0 Self-Check、Phase 15-17 運用サイクル、軽量チェンジサイクル、ループ計測、v0.13.0） | 全エージェント、operations-analyst、retrospective-facilitator、project-manager |
| `references/document-catalog.md` | 文書カタログと HTML 公開文書体系（フェーズ別文書セット・文書セット選択制 document-set.md・ID相互参照体系・htmldocs/ 生成・執筆ルール、v0.17.0） | 全 producer、全レビュワー、project-manager |

## 重要原則

1. **成果物は必ず docs/00-99 の番号付きディレクトリに配置する**（artifact-layout.md が正）
2. **Phase 12（ユースケースE2E）/ Phase 13（トレーサビリティ監査）はスキップ禁止**。成果物（`docs/41-test-results/usecase-e2e-*.md` / `traceability-audit-*.md`）が無ければ Phase 14 で Block
3. **Phase 5 では営業ポータル（LP兼営業サイト）モックアップが必須（v0.9.0）**。marketing-site-builder（モックアップモード）が `docs/15-marketing-site/mockups/` を作成し、Phase 6 で ui-mockup-reviewer のレビュー対象に含める。スキップは要件定義に「営業サイト不要」が明記されている案件のみ（PM がリスク提示＋明示承認＋status.md 記録）
4. **Phase 11 のタスク0＝ローカル開発環境構築は必須（v0.9.0）**。implementation-worker が `local-dev-environment` Skill に従い Docker ベースの**ローカル完結開発環境**（アプリ＋営業ポータル＋認証＋決済＋AIモック）を機能実装より先に構築し、検証レポート `docs/41-test-results/local-env-verification-*.md` を作成する。レポートが無ければ Phase 12 に進めない
5. **オンデマンド系エージェント**（mcp-server-specialist / agent-experience-reviewer / security-auditor / legal-docs-generator / pricing-strategist / onboarding-designer / blog-content-producer / cost-guardian / ad-strategy-specialist）は固定フェーズ番号を持たず、案件の必要性に応じて PM が随時起動する（v0.6.0〜v0.7.0）。security-auditor のみ Phase 14 と並列の準必須ゲート
6. **Verdict は Approve / Warning / Block の3値**。Block は自動で修正ループ（rework-loop.md）。5回目でも未解決なら PM がエスカレーション
7. **Block レビューを報告するだけで止まらない**。レビュー報告はループ起動のトリガーであって終着点ではない（rework-loop.md が正本）
8. **Tier 選定は「規制強度 → 規模 → 既存連携 → 運用体制 → 予算」の優先順**。迷ったら 1 名運用の Tier A（Vercel + Supabase）
9. **SDLC は直線ではなく円環（v0.13.0、lifecycle-loop.md が正本）**。Phase 14 完了・デプロイ Go は「案件終了」ではなく Phase 15（リリース・計測開始）→ 16（運用サイクル）→ 17（改善起票）→ 次サイクルの入口。改善はフルサイクル/軽量チェンジサイクル/ホットフィックスの3種別で判定して回す。全 producer は提出前に **Self-Check（L0）** を成果物に添付する
10. **文書は二層構造（v0.17.0、document-catalog.md が正本）**。`docs/`（Markdown）が正本、`htmldocs/`（HTML）は人間向け生成物。HTML は手書きせず `node .agents/skills/sdlc-toolkit/scripts/build-htmldocs.mjs` で全量再生成する。文書セットは案件ごとに `docs/99-pm/document-set.md` で採否を確定（全文書必須ではない）。執筆は指示代名詞禁止・ID＋名称併記
11. **テストは「二重三重」が既定（v0.12.0、test-hardening.md が正本）**。Phase 9 はケース抽出の二重化（test-planner × test-case-adversary 並列）、Phase 11 はブラックボックス・ファースト＋ミューテーション、Phase 12 は 3 回連続 Green、**Phase 12.5（探索的・敵対的テスト）はスキップ禁止**。発見された全バグは再現テスト＋ bug-escape-ledger.md 記録が義務（修正だけして流すのは最大の失敗モード）
