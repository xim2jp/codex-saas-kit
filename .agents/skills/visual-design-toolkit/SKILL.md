---
name: visual-design-toolkit
description: SaaS の営業サイト・UI のビジュアル方向性を決定し、AI 画像生成（gpt-image-2）でムードボード・挿絵アセットを一貫したスタイルで量産するための知識集。ビジュアル系3エージェント（visual-director / page-designer / marketing-site-builder）の共有ワークフロー、gpt-image-2 のプロンプト設計・運用ベストプラクティスを収録する。「ムードボード」「スタイル方針」「ビジュアルの方向性」「挿絵」「AI画像生成」「デザインのイメージ」で参照。
---

# Visual Design Toolkit Skill

SaaS のビジュアルスタイルを**上流で確定し、AI 画像生成で一貫したアセットを量産する**ための知識集。「方向性の決定（visual-director）→ アセット量産（page-designer）→ 実装（marketing-site-builder）」の3エージェント連携を支える。

## いつこのSkillを参照するか

- **visual-director**：ムードボード生成・スタイルガイド明文化・プロンプトテンプレート確定のとき（起動時に必読）
- **page-designer**：確定済みプロンプトテンプレートで追加挿絵を量産するとき
- **marketing-site-builder**：スタイルガイドに従って実装するとき

## references 一覧

| ファイル | 内容 | 主な読み手 |
|---------|------|-----------|
| `references/visual-workflow.md` | ビジュアル系3エージェントの共有ワークフロー（役割分担・引き継ぎ・スタイル一貫性の担保方法） | 3エージェント全員 |
| `references/gpt-image-best-practices.md` | gpt-image-2 のモデル選択・プロンプト設計・API 実装・運用コストの知見 | visual-director、page-designer |

## 重要原則

1. **スタイルの新規設計は visual-director のみ**。page-designer は確定済みテンプレートに忠実に従う（逸脱時は visual-director にエスカレーション）
2. **`docs/15-marketing-site/visual-style-guide.md` と prompt-template が source of truth**。外部プラグイン（frontend-design）の一般則より常に優先
3. **静止画は本 Skill、動画は `promo-video-toolkit`**（visual-director と promo-video-producer の役割分担）
4. **成果物は `docs/15-marketing-site/moodboard/` と `public/images/` に配置**（sdlc-toolkit の artifact-layout.md に従う）
