---
name: visual-design-toolkit
description: SaaS の営業サイト・UI のビジュアル方向性を決め、AI 画像生成（gpt-image-2）でムードボードと挿絵アセットを一貫したスタイルで量産するための知識集。方向性決定→アセット量産→実装の共有ワークフローと、gpt-image-2 のプロンプト設計・運用ベストプラクティスを収録する。スタイル確定・挿絵追加・実装時のスタイル確認で参照する。「ムードボード」「スタイル方針」「ビジュアルの方向性」「挿絵」「AI画像生成」「デザインのイメージ」で参照。
---

# Visual Design Toolkit Skill

SaaS のビジュアルスタイルを**上流で確定し、AI 画像生成で一貫したアセットを量産する**ための知識集。「方向性の決定（visual-director）→ アセット量産（page-designer）→ 実装（marketing-site-builder）」の連携を支える。

## 参照ファイル

| ファイル | 内容 | いつ読むか |
|---------|------|-----------|
| `references/visual-workflow.md` | 方向性決定→量産→実装の共有ワークフロー（役割分担・引き継ぎ・スタイル一貫性の担保方法） | スタイル確定・引き継ぎ時 |
| `references/gpt-image-best-practices.md` | gpt-image-2 のモデル選択・プロンプト設計・API 実装・運用コストの知見 | 画像を生成するとき |

## 原則

1. **スタイルの新規設計は visual-director のみ**。page-designer は確定済みテンプレートに忠実に従い、逸脱が必要なら visual-director にエスカレーションする（量産で絵柄がぶれるのを防ぐ）
2. **`docs/15-marketing-site/visual-style-guide.md` と prompt-template が source of truth**。外部プラグイン（frontend-design）の一般則より常に優先する
3. **静止画は本 Skill、動画は `promo-video-toolkit`**
4. **成果物は `docs/15-marketing-site/moodboard/` と `public/images/` に置く**（sdlc-toolkit の artifact-layout.md に従う）
