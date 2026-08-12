---
name: requirements-toolkit
description: 曖昧な依頼を漏れのない要件定義書・RFP・提案書に変換するための知識集。クライアント案件用と自社プロダクト用の質問バンク、要件定義が浅いまま進む「自己満足化」を防ぐアンチパターン集、ドラフト前の完全性チェックリスト、成果物テンプレート（要件定義書・RFP・提案書・Decision Log）を収録する。要件定義フェーズ（Phase 1-2）で requirements-architect / requirements-reviewer が必ず参照する。「要件定義」「RFP」「提案書」「仕様策定」「ヒアリング」で参照。
---

# Requirements Toolkit Skill

曖昧な依頼を、開発着手・投資判断に耐える**要件定義書に変換する**ための知識集。対話の質（質問バンク・アンチパターン）と成果物の質（チェックリスト・テンプレート）の両面を支える。

## いつこのSkillを参照するか

- **requirements-architect**：Phase 1 の要件定義対話の全過程（質問選定 → 自己チェック → 完全性確認 → ドラフト作成）
- **requirements-reviewer**：Phase 2 のレビューで完全性チェックリストを判定基準に使うとき
- **project-manager**：要件の粒度が十分かを判断するとき

## references / templates 一覧

| ファイル | 内容 | 使いどころ |
|---------|------|-----------|
| `references/question-bank-client.md` | クライアント案件（RFP/提案書化）向け質問テンプレ集 | クライアント案件の対話 |
| `references/question-bank-product.md` | 自社プロダクト（仕様策定）向け質問テンプレ集 | 自社プロダクトの対話 |
| `references/anti-patterns.md` | 「気持ちよく進んでいるのに浅い」要件定義を防ぐセルフチェック。各ターンで内部実行 | 対話の全ターン |
| `references/completeness-checklist.md` | ドラフト前の完全性確認。全項目「確認済 or N/A（理由明記）」が必須 | ドラフト作成の直前 |
| `references/non-functional-requirements.md` | 非機能要件の6カテゴリ定義ガイド（IPA非機能要求グレードの軽量版＋Tier A 既定値。全項目を数値化 or 対象外明記、v0.15.0） | フェーズ5（非機能要件）の対話と requirements.md 記載 |
| `templates/requirements-doc.md` | 要件定義書テンプレ（自社プロダクト用） | 成果物作成 |
| `templates/rfp.md` | RFP（提案依頼書）テンプレ（クライアント案件用） | 成果物作成 |
| `templates/proposal.md` | 提案書ドラフトテンプレ | 成果物作成 |
| `templates/decision-log.md` | 判断・確認の時系列記録テンプレ | 対話と並行して随時 |

## 重要原則

1. **質問バンクは全部聞かない**。案件のフェーズと文脈で取捨選択する
2. **曖昧なまま進めることは禁止**。completeness-checklist の全項目が確認済 or N/A になるまでドラフトに進まない
3. **判断は decision-log に即記録**。「なぜこの仕様になったか」を後から追跡可能にする
4. **成果物は `docs/00-requirements/` に配置**（sdlc-toolkit の artifact-layout.md に従う）
