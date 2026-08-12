# 外部プラグイン採用判断：frontend-design（Anthropic公式） vs visual-director / visual-design-toolkit

| 項目 | 内容 |
|------|------|
| ステータス | ✅ 採用決定（**共存**） |
| 決定日 | 2026-06-02 |
| 決定者 | 野口慎一 |
| 対象 | Anthropic 公式プラグイン `frontend-design@claude-plugins-official` |
| 影響範囲 | `marketing-site-builder`, `implementation-worker`, `page-designer` |

> **Codex 移植注記（2026-07）**: `/plugin install` は Claude Code 専用機能で Codex には存在しない。Codex では `frontend-design` の SKILL.md（公開リポジトリから入手可）を `.agents/skills/frontend-design/` に手動移植して同等の効果を得る。本ドキュメントの判断根拠（共存・優先順位ルール）はそのまま有効。

---

## 1. 結論（TL;DR）

**どちらか一方を採用するのではなく、共存させる。**

- 本フレームワークの `visual-director` / `visual-design-toolkit` … **上流**の「ビジュアル方向性の決定とアセット生成」を担当（公式プラグインにこの機能は無い）。
- 公式 `frontend-design` … **下流**の「実装コードの美的品質向上」を担当（本フレームワークが手薄だった領域）。

両者は**フロントデザインの異なる工程**を担当しており機能の重なりがほぼないため、片方を捨てると必ず機能欠損が発生する。よって**公式プラグインを追加導入し、実装エージェントから併用する**。

---

## 2. 背景

Anthropic が公式プラグインマーケットプレイス `claude-plugins-official` で `frontend-design` を公開した。これと、本フレームワークが既に持つ `visual-director` エージェント＋`visual-design-toolkit` スキルが競合するのか、どちらを採用すべきかを判断する必要が生じた。

---

## 3. 両者の実態

### 3.1 公式 `frontend-design`

- **正体**：単一スキル（`skills/frontend-design/SKILL.md` 1ファイル）のみで構成された軽量プラグイン。Slash command / Subagent / Hook / MCP server は**いずれも持たない**。
- **主眼**：没個性な "AI slop"（汎用的なAI生成UI）を避け、明確な美学的方向性を持つ**本番品質のフロントエンド実装コード**を生成させる。フロントエンド作業時に**自動発動**する。
- **生成物**：実装**コード**（タイポグラフィ・配色・モーション・空間構成・視覚的奥行きに配慮）。デザインカンプや画像ではない。
- **明示的に避けるもの**：汎用フォント（Inter / Roboto / Arial / システムフォント）、陳腐な配色（特に**白地に紫グラデーション**）、予測可能なレイアウト、金太郎飴的デザイン。
- **対応スタック**：React / Vue / Svelte / 素の HTML+CSS。特定ライブラリ（Tailwind / shadcn）必須の記述はなし。
- **AI画像生成・ムードボード・ブランド設計**：**なし**。方向性決めは「言語的コミット」で行う。
- **作者**：Anthropic（Prithvi Rajasekaran、Alexander Bricken）。

### 3.2 本フレームワーク `visual-director` + `visual-design-toolkit`

- **正体**：エージェント定義（`.codex/agents/visual-director.md`）＋スキル参照群（`.agents/skills/visual-design-toolkit/references/`）からなる重量パイプライン。
- **主眼**：**ビジュアル方向性の決定とアセット生成**。HTML 実装はせず、後続の `marketing-site-builder` / `page-designer` に指針を引き渡す。
- **生成物**：ムードボード画像（OpenAI gpt-image で実生成）、`visual-style-guide.md`、`prompt-template.md`、代表挿絵（hero.png 等）、追加挿絵、スクリーンショット。
- **AI画像生成・ムードボード・ブランド設計**：**あり**（brand-design-strategist と連携）。
- **コスト管理**：あり（¥5,000/案件、`prompt-history.md` で履歴追跡）。
- **対応スタック**：Next.js + Tailwind + shadcn/ui + lucide-react に固定。

---

## 4. 比較表

| 観点 | 公式 `frontend-design` | `visual-director` + `visual-design-toolkit` |
|------|------------------------|---------------------------------------------|
| 正体 | 単一スキル（自動発動） | エージェント＋スキルの重量パイプライン |
| 主眼 | **実装コードの美的品質向上** | **ビジュアル方向性の決定とアセット生成** |
| 生成物 | フロントエンド**コード** | ムードボード・スタイルガイド・挿絵・スクショ |
| AI画像生成 | なし（言語コミットのみ） | あり（gpt-image で実生成） |
| ブランド設計 | しない | brand-design-strategist と連携して扱う |
| HTML実装 | **する（本体）** | **しない**（実装エージェントへ委譲） |
| スタック | React/Vue/Svelte/素HTML（非依存） | Next.js + Tailwind + shadcn 固定 |
| コスト管理 | なし | あり（¥5,000/案件） |
| 担当工程 | 下流（実装） | 上流（方向性・素材） |

---

## 5. なぜ競合しないか（工程マッピング）

本フレームワークのビジュアル工程は Phase A〜F の6段階。公式プラグインが埋めるのは **Phase D（実装）の中身の質** というピンポイントで、それ以外の工程は一切カバーしない。

```
Phase A ムードボード生成   ┐
Phase B スタイルガイド明文化 ├─ visual-director（公式に該当機能なし＝置換不可）
Phase C 代表挿絵+テンプレ   ┘
─────────────────────────────────────────────
Phase D HTML実装           ← marketing-site-builder ★ここに frontend-design が効く
                              （実装コードの美学を底上げ。元々手薄だった領域）
─────────────────────────────────────────────
Phase E 追加挿絵量産        ┐
Phase F スクショ確認        ┘ page-designer（公式に該当機能なし＝置換不可）
```

- 公式採用のみ → ムードボード・スタイルガイド・挿絵生成・スクショを喪失。
- 自前のみ → 実装コードの美的品質指針が無い（`marketing-site-builder` / `implementation-worker` 任せで手薄）。

→ **どちらも捨てられない。共存が唯一の最適解。**

---

## 6. 採用方針

### 6.1 導入（Codex）

```
入手元: https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/plugins/frontend-design/skills/frontend-design/SKILL.md
配置先: .agents/skills/frontend-design/SKILL.md
```

SKILL.md（Agent Skills 形式）は Claude Code / Codex 共通仕様のため、そのまま配置すれば Codex が自動発見する。外部 API キー不要、MCP サーバーなし。

### 6.2 統合先エージェント

| エージェント | 統合内容 |
|-------------|---------|
| `marketing-site-builder` | 営業サイトのHTML/コンポーネント実装時に `frontend-design` の美学指針を適用。優先順位ルールを定義。 |
| `implementation-worker` | アプリ画面UIの実装時に同スキルを活用（visual-style-guide / design-system 優先）。 |
| `page-designer` | **適用対象外**（コードを書かずアセット/スクショのみ生成）。混同防止の注記を追加。 |

### 6.3 優先順位ルール（衝突回避）

`frontend-design` は「Inter 等の汎用フォント回避」「白地紫グラデ回避」などの一般則を課すが、本プロジェクトでは **プロジェクト固有のビジュアル指針が常に最優先**。矛盾時は以下の順で判断する：

```
1. docs/15-marketing-site/visual-style-guide.md（最優先・source of truth）
2. docs/12-brand-design/design-system.md
3. frontend-design スキルの一般則（上記2つで未定義の領域のみ適用）
```

これにより「公式の汎用回避則が、ブランドで意図的に選んだフォント・配色を勝手に上書きする」事故を防ぐ。

---

## 7. 補足：別の公式プラグイン `design`

Anthropic には別途公式プラグイン **`design`** がある（デザイン批評・UXライティング／マイクロコピー・アクセシビリティ監査（WCAG 2.1 AA）・デザインシステム管理／ハンドオフ。コード生成・画像生成は行わない）。これは本フレームワークの **Phase 14 レビュー工程**（`external-design-reviewer` / `implementation-reviewer`）と相性が良い可能性があり、**今後の別途検討対象**とする（本決定のスコープ外）。

---

## 8. 出典

- [Frontend Design – Claude Plugin | Anthropic](https://claude.com/plugins/frontend-design)
- [anthropics/claude-plugins-official — frontend-design (GitHub)](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/frontend-design)
- [frontend-design SKILL.md (GitHub raw)](https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/plugins/frontend-design/skills/frontend-design/SKILL.md)
- [Discover and install plugins — Claude Code Docs（参考・移植元の仕組み）](https://code.claude.com/docs/en/discover-plugins)
- [Agent Skills — Codex Docs](https://developers.openai.com/codex/skills)
- [Design – Claude Plugin | Anthropic（比較用の別プラグイン）](https://claude.com/plugins/design)
- [Frontend Aesthetics Cookbook（関連リソース）](https://github.com/anthropics/claude-cookbooks/blob/main/coding/prompting_for_frontend_aesthetics.ipynb)
