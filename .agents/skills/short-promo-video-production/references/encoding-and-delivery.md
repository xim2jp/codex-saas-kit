# 最終エンコード・付帯ファイル・配信

## パイプライン終盤（remotion render 以降）

```bash
# 1. Remotion レンダリング（720×1280 で書き出し）
cd remotion && npx remotion render src/index.ts PromoVideo out/promo-video.mp4

# 2. ffmpeg 最終エンコード（配信用・実績パラメータ）
ffmpeg -i out/promo-video.mp4 \
  -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  ../public/video/<slug>-9x16.mp4

# 3. poster 静止画（フックの表情が出るフレームを選ぶ。実績: frame 60 = 2秒地点）
npx remotion still src/index.ts PromoVideo ../public/video/<slug>-9x16-poster.jpg --frame=60
# webp 版も生成（LP埋め込み用）
cwebp -q 80 ../public/video/<slug>-9x16-poster.jpg -o ../public/video/<slug>-9x16-poster.webp
```

- `yuv420p` は必須（欠くと一部プレイヤー・SNSで再生不可）
- `+faststart` は必須（Web埋め込み時の再生開始を速くする moov atom 前置）
- 音声ラウドネスの目安: -14 LUFS、ピーク -1dBTP 以内

## .srt（クローズドキャプション）

文字起こしツール不要 — **企画書のテロップ原稿がそのまま正**。カット表の時刻でタイムコードを振って手書きする。

```srt
1
00:00:00,000 --> 00:00:04,000
先生の観察を、通知表の言葉に。

2
00:00:04,000 --> 00:00:09,000
LINEで、ひとことメモ。保存は10秒以内。
```

用途: LP埋め込み時のトランスクリプト・アクセシビリティ・SEO（VideoObject と併用）。

## 配信先別仕様（投稿直前に最新版を要再確認）

| 配信先 | 比率 | 尺 | 備考 |
|---|---|---|---|
| Instagram Reels | 9:16 | 〜90秒 | 上下UI被りの安全マージンを確保 |
| TikTok | 9:16 | 15–60秒が主 | フック最重視。30秒は標準的 |
| YouTube Shorts | 9:16 | 〜3分 | 短いほど有利 |

- SNS投稿は各アカウントから手動アップロード運用
- LP埋め込みは `<video autoPlay muted loop playsInline preload="none" poster="...">` パターン
  （marketing-site-builder の担当領域。9:16 は LP ヒーローに使い回し不可 — 16:9 版は別設計）
- LP/ブログ転載時は VideoObject 構造化データ＋トランスクリプトを付与（seo-toolkit 参照）

## 納品前チェックリスト

- [ ] `ffprobe` で尺・解像度・コーデック（h264/yuv420p/aac）確認
- [ ] 実機（スマホ縦画面）でテロップの可読性確認
- [ ] 透かし・破綻の最終目視（フレーム抽出）
- [ ] BGM クレジット文言を投稿キャプション用に納品物へ添付
- [ ] AI生成コンテンツの開示要否を配信先ポリシーで確認（投稿運用者に引き継ぎ）
- [ ] コストログ確定（試行回数・採用数・実額・残予算）
- [ ] Remotion プロジェクト一式をリポジトリに保存（再レンダリング・次案件流用のため）
