# Visual Design Workflow

ビジュアル系3エージェント（visual-director、page-designer、marketing-site-builder）が共有するワークフロー定義。

## 基本フロー

```
┌─────────────────────────────────────────────────────────────┐
│ Phase A: ムードボード生成（visual-director）                 │
│   要件・ブランド戦略を読み込み → 3-5枚のスタイル候補をAI生成 │
│   出力: docs/15-marketing-site/moodboard/option-{1-5}.png   │
└─────────────────────────────────────────────────────────────┘
                          ↓ ユーザーが選択
┌─────────────────────────────────────────────────────────────┐
│ Phase B: スタイルガイド明文化（visual-director）             │
│   選択されたムードボードからスタイル指針を言語化              │
│   出力: docs/15-marketing-site/visual-style-guide.md        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase C: 代表挿絵 + プロンプトテンプレート確定（visual-director）│
│   Hero画像 + キービジュアル1枚を高品質生成                   │
│   再利用可能なプロンプトテンプレートを抽出                   │
│   出力: public/images/hero.png, docs/15-.../prompt-template.md│
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase D: HTML実装（marketing-site-builder）                  │
│   visual-style-guide.md と代表挿絵を「参考」に実装           │
│   実装は野口さんスタック（Next.js + Tailwind + shadcn/ui）   │
│   出力: src/app/(marketing)/*                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase E: 追加挿絵の量産（page-designer）                     │
│   visual-director が確定したプロンプトテンプレートを再利用    │
│   セクションごとの追加挿絵を一貫性を保ちながら生成            │
│   出力: public/images/section-*.png                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase F: スクリーンショット確認（page-designer）             │
│   Playwrightで全ページ・全解像度キャプチャ                   │
│   出力: docs/15-marketing-site/screenshots/                  │
└─────────────────────────────────────────────────────────────┘
```

## 役割分担

| Phase | エージェント | 主な責務 |
|-------|------------|---------|
| A | visual-director | ムードボードAI生成 |
| B | visual-director | スタイルガイド明文化 |
| C | visual-director | 代表挿絵確定、プロンプトテンプレート抽出 |
| D | marketing-site-builder | HTML実装（visual-style-guideを必読） |
| E | page-designer | 追加挿絵量産（プロンプトテンプレート再利用） |
| F | page-designer | Playwrightスクリーンショット |

**重要な原則**：
- visual-director は「スタイルの設計者」、page-designer は「スタイル準拠の実行者」
- AI画像はあくまで「参考」。HTMLエージェントは画像を真似ない、スタイルガイドに従う
- プロンプトテンプレートは visual-director が作成し、page-designer が再利用する

## ディレクトリ構造

```
プロジェクトルート/
├── docs/15-marketing-site/
│   ├── moodboard/                        # Phase A
│   │   ├── option-1.png
│   │   ├── option-2.png
│   │   ├── option-3.png
│   │   ├── option-4.png  (optional)
│   │   ├── option-5.png  (optional)
│   │   ├── README.md                     # 各案の特徴・採用判断
│   │   └── decision.md                   # 採用決定とその理由
│   ├── visual-style-guide.md             # Phase B（中核成果物）
│   ├── prompt-template.md                # Phase C（再利用プロンプト）
│   ├── prompt-history.md                 # 全AI生成の記録（コスト管理）
│   └── screenshots/                      # Phase F
│       ├── home-mobile.png
│       └── ...
└── public/
    └── images/                           # Phase C/E（採用画像）
        ├── hero.png
        ├── section-features.png
        ├── section-pricing.png
        └── ...
```

## スタイルガイドのテンプレート

`visual-style-guide.md` は visual-director が以下の形式で作成：

```markdown
# Visual Style Guide

採用ムードボード: docs/15-marketing-site/moodboard/option-2.png
作成日: YYYY-MM-DD
作成者: visual-director

## 1. 全体トーン
- フォーマル度: 3/5
- 親しみやすさ: 4/5
- 革新性: 3/5
- 業界フィット: B2B SaaS / 中小企業向け

## 2. カラー方針
- 採用済みのデザインシステム（docs/12-brand-design/design-system.md）を踏襲
- 補完情報：
  - 背景：オフホワイト系の中で、特に温かみのある側
  - アクセント色の強度：中程度（蛍光色は避ける）

## 3. レイアウト密度
- セクション間の余白：大きめ（120px以上）
- 横方向の最大幅：1200px
- カラム数：最大3カラム
- カードのpadding：32px推奨

## 4. タイポグラフィの方向性
- 採用済みのフォント設定を踏襲
- 補完：
  - 見出しの文字間：ややタイト
  - 本文の行間：1.7倍程度
  - 強調はboldで、italicは使わない

## 5. イラストスタイル
- スタイル名：フラットデザイン + 少量のグラデーション
- 線画：太め（2-3px相当）、角丸
- 人物描写：避け、抽象的なオブジェクト・図形中心
- 配色：パステル調、低彩度
- 影：使わない or 非常に薄く

## 6. アイコン方針
- ライブラリ：lucide-react を基本
- スタイル：stroke 2px、角丸
- カラー：プライマリカラー or muted-foreground

## 7. 写真の使用方針
- 採用 / 不採用（イラスト中心ならNG）
- 採用時のスタイル：（自然光、低彩度、人物の表情は控えめ）

## 8. 動きの方針
- アニメーション：控えめ（hover、フェードイン程度）
- スクロール連動：使わない or 最小限

## 9. NG事項
- AI画像生成で避ける要素：
  - 写実的人物
  - 暗い背景
  - 複雑な背景
  - テキストを含む画像（誤字リスク）
- 実装で避けるパターン：
  - ガラスモーフィズム
  - ネオンエフェクト
  - 過剰なグラデーション
```

## プロンプトテンプレートの形式

`prompt-template.md` は visual-director が作成し、page-designer が再利用：

```markdown
# AI Image Prompt Template

採用スタイル: option-2 系
モデル: gpt-image-1（高品質モード）

## ベースプロンプト（毎回含める）

```
Style: Modern flat illustration with subtle gradients, soft pastel colors 
(blue: #6B9DFF, peach: #FFB088, sage: #88C9A1), thick rounded line strokes, 
no realistic humans, abstract objects and shapes, professional yet approachable, 
suitable for B2B SaaS marketing. White or off-white background (#FAFAFA).
Composition: Centered with breathing room.
Avoid: Text, photorealistic, dark/edgy aesthetics, complex backgrounds, 
shadows, neon effects, glassmorphism.
```

## 用途別プロンプト

### Hero背景
ベース + 以下を追加：
```
Subject: <プロダクト固有の主題、例：calendar grid with floating elements>
Composition: Wide horizontal, leaving left third blank for text overlay.
Mood: Optimistic, forward-looking.
Size: 1792x1024, high quality
```

### 機能紹介セクション
ベース + 以下を追加：
```
Subject: <機能を象徴する抽象的なシーン>
Composition: Square or vertical, illustration takes center.
Size: 1024x1024, medium quality
```

### OGP / Twitter Card
ベース + 以下を追加：
```
Subject: <プロダクトの本質を象徴する抽象表現>
Composition: 1200x630 aspect ratio for OGP.
Size: 1792x1024 then crop, high quality
```

### 装飾アイコン
ベース + 以下を追加：
```
Subject: <単一のシンボル>
Composition: Centered single icon, transparent or white background.
Size: 1024x1024, low or medium quality
```
```

## コスト管理

### 上限設定
- **1案件あたり ¥5,000以内**
- 内訳目安：
  - ムードボード（Phase A）：5枚 × low quality = ¥10-50
  - 代表挿絵（Phase C）：2枚 × high quality = ¥50-100
  - 試行錯誤分（Phase Cで何回かやり直し）：¥200-500
  - 追加挿絵（Phase E）：10-20枚 × medium = ¥600-1,500
  - 合計目安：¥1,000-2,500

### コスト追跡

`docs/15-marketing-site/prompt-history.md` に全生成を記録：

```markdown
# Prompt History

| 日時 | フェーズ | エージェント | 品質 | サイズ | 用途 | コスト | ファイル |
|------|---------|-----------|-----|-------|------|--------|---------|
| 2026-05-16 10:00 | A | visual-director | low | 1024x1024 | mood-1 | ¥1.5 | moodboard/option-1.png |
| 2026-05-16 10:00 | A | visual-director | low | 1024x1024 | mood-2 | ¥1.5 | moodboard/option-2.png |
| ... |
```

## 一貫性ロック

Phase E で追加挿絵を生成する際、以下を強制：

1. **必ず `prompt-template.md` のベースプロンプトを含める**
2. **試行錯誤は最大3回まで**（4回目以降は visual-director に相談）
3. **テスト生成 → 既存採用画像と並べて確認**：一貫性が崩れていたら採用しない
4. **不採用画像は `tmp/ai-drafts/` に保存**（学習用、コミットしない）

## アンチパターン

1. **AI画像を「最終UI」として扱う**：実装乖離、コピー誤字の原因
2. **visual-style-guide を作らずに実装に進む**：「参考」が曖昧化、デザインがブレる
3. **毎回プロンプトを書き直す**：一貫性が崩れる、テンプレート活用が重要
4. **コスト管理なしの試行錯誤**：気付くと数千円浪費
5. **採用ムードボードがどれか後で分からない**：decision.md を必ず残す
6. **page-designer が独自スタイルで生成**：visual-director の指針を超えない
