---
name: short-promo-video-production
description: SNS 縦型ショートプロモ動画（9:16・30秒）を Sora 2 × Remotion ハイブリッドで低コスト制作する実証済みレシピ集。センセイメモの 30 秒機能紹介動画（実績約¥130、Sora 2 生成 2 カット＋Remotion 4 カット＋CC BY 4.0 BGM）の手順を汎用化し、6 カット構成の絵コンテ、Sora 2 API の実践知（input_reference 解像度一致・moderation 回避・コストログ）、Remotion テンプレート（テロップ焼き込み・BGM 音量エンベロープ・日本語フォント）、ffmpeg 最終エンコード、権利チェックを収録する。汎用知識は promo-video-toolkit、本 Skill は一度成功した手順の再現用。「ショート動画」「30秒動画」「SNS縦型動画」「Sora」「Remotion動画」「プロモ動画制作」で参照。
---

# Short Promo Video Production — Sora 2 × Remotion 実証済みレシピ

SNS縦型（9:16）・約30秒のプロモ動画を、**Sora 2 生成カット（差し色）× Remotion 実装カット（正確なUI・テロップ・CTA）のハイブリッド**で制作するレシピ集。

> **出自**: センセイメモ（LINE所見メモSaaS）の30秒機能紹介動画で確立した手順の汎用化。
> 実績: 総コスト約¥130（予算¥5,000）、Sora 2 生成2本採用/試行3回、制作〜納品まで1日。
> 汎用知識は `promo-video-toolkit` Skill を参照。本 Skill は「一度成功した具体的手順」を次案件で再現するためのもの。

## いつこの Skill を参照するか

- SNS縦型（Instagram Reels / TikTok / YouTube Shorts）向けの30秒前後のプロモ動画を作るとき
- Sora 2（OpenAI Videos API）でキャラクター一貫性のあるカットを生成するとき
- Remotion でテロップ焼き込み・UIモック・CTAカットを実装するとき
- BGM（ロイヤリティフリー）の選定・音量設計・ライセンス表記を行うとき

## 最重要原則（センセイメモで実証済み）

1. **AI動画は差し色として最小利用（全体の3割以下）**。感情・空気感のカットだけを AI に任せ、
   UI・文字・ロゴ・料金など「正確さが必須」のカットは必ず Remotion で描く。
   AI 動画は文字が崩れる／UIが捏造されるため、画面再現には絶対に使わない。
2. **テロップ主導・無音でも成立する設計**。SNS は無音自動再生が前提。
   全カットにオープンキャプション（焼き込みテロップ）を入れ、BGM は「控えめな上乗せ」に留める。
3. **キャラクター一貫性は image-to-video ＋ 共通プロンプト文言で担保**。
   同一の参照画像（`input_reference`）と、一言一句同じキャラクター記述ブロックを全カットで使う。
4. **コピーは数字で具体化、抽象語禁止**。1テロップ12〜20字、確定済みメインコピーは一字一句変更しない。
5. **コストログを試行のたびに記録**。予算の80%到達で停止しオーナー判断を仰ぐ。

## 制作パイプライン（7ステップ）

```
1. 企画書作成 — カット表（6カット/30秒）・台本・手法割り当て・コスト試算
   → references/cut-structure.md
2. Sora 2 でAIカットを生成（image-to-video、参照画像は事前にサイズ厳密一致へ加工）
   → references/sora2-generation.md ＋ templates/scripts/generate_sora_cut.py
3. Remotion プロジェクトをテンプレートから複製し、ブランドトークンを差し替え
   → templates/remotion/（brand.ts の TODO を埋める）
4. Remotion で UIモック/カウンター/CTA カットを実装、Sora クリップは <SoraClip> で全画面配置
5. BGM 選定（incompetech CC BY 4.0）→ 音量エンベロープ実装 → volumedetect 検証
   → references/bgm-and-mixing.md
6. remotion render → ffmpeg 最終エンコード（+faststart / yuv420p）→ .srt / poster 書き出し
   → references/encoding-and-delivery.md
7. 権利・コンプラチェック（透かし目視・商用利用要件・BGMクレジット・AI開示）→ 納品・コストログ確定
```

## 成果物の配置（sdlc-toolkit 準拠）

| 成果物 | 配置先 |
|---|---|
| 企画書（カット表・台本・プロンプト） | `docs/15-marketing-site/promo-video-plan.md` |
| コストログ（試行記録・ライセンス記録） | `docs/15-marketing-site/promo-video-cost-log.md` |
| Remotion プロジェクト | `remotion/`（リポジトリ直下） |
| 最終動画・poster・.srt | `public/video/`（または営業サイトのアセット置き場） |

## references 一覧

| ファイル | 内容 |
|---|---|
| `references/cut-structure.md` | 30秒6カット構成の設計パターン（フック→機能→蓄積→感情→差別化→CTA）、テロップ原稿の書き方 |
| `references/sora2-generation.md` | Sora 2 API 実践知：input_reference 解像度一致、moderation 回避の言い回し、キャラクター一貫性、コストログ運用、フォールバック設計 |
| `references/bgm-and-mixing.md` | incompetech（CC BY 4.0）での選曲基準、クレジット表記運用、音量エンベロープ設計、ffmpeg volumedetect 検証 |
| `references/encoding-and-delivery.md` | remotion render → ffmpeg 最終エンコードのコマンド、.srt/poster 生成、SNS配信仕様、権利チェックリスト |

## templates 一覧

| パス | 内容 |
|---|---|
| `templates/remotion/` | Remotion プロジェクト雛形（9:16・30fps・30秒）。brand.ts のトークンとカット定義を案件ごとに差し替えて使う |
| `templates/remotion/src/components/Caption.tsx` | 焼き込みテロップ共通コンポーネント（縁取り下地・フェード付き、実績そのまま） |
| `templates/remotion/src/components/Bgm.tsx` | BGM音量エンベロープ（フェードイン→基準→CTAブースト→フェードアウト） |
| `templates/remotion/src/compositions/SoraClip.tsx` | Sora 生成クリップの全画面ラッパー（音声除去＋テロップ後乗せ） |
| `templates/remotion/src/compositions/LogoCtaCut.tsx` | 最終カット（ロゴ＋コピー＋CTAボタン＋URL）のスプリングアニメ雛形 |
| `templates/scripts/generate_sora_cut.py` | Sora 2 生成ヘルパー（参照画像のリサイズ→生成→ポーリング→ダウンロード→ログ追記の雛形） |

## 予算ガイドライン（実績ベース）

- Sora 2（sora-2, 720×1280, 4秒）: 約 $0.40/回 ≈ ¥65。試行3〜10回×2カットで **¥390〜1,300** を見込む
- Remotion レンダリング・BGM（ロイヤリティフリー）: **¥0**
- 予算上限の目安 ¥5,000/本。80%（¥4,000）到達で停止→オーナー判断
- Sora 2 API のモデル提供状況・単価は**利用直前に platform.openai.com で必ず再確認**する
