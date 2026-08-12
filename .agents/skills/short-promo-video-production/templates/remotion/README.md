# Remotion プロモ動画テンプレート（9:16・30fps・30秒）

センセイメモの30秒機能紹介動画（Sora 2 × Remotion ハイブリッド）の実装をテンプレ化したもの。

## 使い方

1. この `remotion/` ディレクトリをプロジェクト直下にコピーし、`npm install`
2. `src/brand.ts` の TODO を埋める（カラー＝デザインシステム完全一致、テロップ原稿＝企画書と一字一句一致）
3. Sora 2 生成クリップを `public/video/` に、BGM（トリム済み）を `public/audio/bgm.mp3` に、ロゴ/キャラ画像を `public/images/character.png` に配置
4. `src/PromoVideo.tsx` の TODO カット（2・3・5＝UIモック/モーショングラフィックス）を案件用に実装
   - 参考実装: teachersnote リポジトリ `remotion/src/compositions/{LineMemoCut,AccumulateCut,PrivacyDraftCut}.tsx`
5. `npm start` で Remotion Studio プレビュー → `npm run render` で書き出し
6. ffmpeg 最終エンコード・poster・.srt は Skill の `references/encoding-and-delivery.md` 参照

## 同梱コンポーネント（実績そのまま・変更不要）

- `components/Caption.tsx` — 焼き込みテロップ（半透明下地・フェード・改行対応）
- `components/Bgm.tsx` — BGM音量エンベロープ（曲差し替え時は音量値のみ再調整）
- `compositions/SoraClip.tsx` — Sora クリップ全画面ラッパー（muted＋テロップ後乗せ）
- `compositions/LogoCtaCut.tsx` — 最終CTAカット（スプリング登場アニメ）
- `load-font.ts` / `Root.tsx` — Noto Sans JP の確実な読み込み（delayRender でフォント待ち）
