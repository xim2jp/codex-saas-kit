# BGM 選定・音量設計・ライセンス運用

センセイメモ実制作で確立した、**¥0でライセンス安全な BGM** の選定〜検証手順。

## 音源: incompetech.com（Kevin MacLeod, CC BY 4.0）

- 商用利用可・改変可・**クレジット表示のみ必須**の CC BY 4.0
- 全曲データベース（`pieces.json`）から feel タグ・楽器編成・BPM で機械的に絞り込める

### 選曲の実証済み基準（明るい SaaS プロモ向け）

1. feel タグに `Bright` / `Uplifting` を含む
2. 楽器編成がウクレレ/アコースティックギター系（温かい親しみやすさ）または軽いコーポレート系
3. BPM 90以上（テンポ感）
4. **`Bouncy` / `Humorous` 寄りは避ける**（子供っぽさ・おもちゃっぽさが出る）
5. 3曲程度を比較表（楽器編成・BPM・feel・所感）にしてオーナーに提示 or 選定理由を記録

> 実績: 初回「Water Lily」（ピアノ主体・Relaxed）はオーナーFB「暗い印象」で差し替え。
> 「Life of Riley」（ウクレレ＋グロッケン・BPM102・Bright/Uplifting）で確定。
> **落ち着いた曲 ≠ 好印象。「明るく軽い、ただし賑やかすぎない」が SaaS プロモの安全圏。**

### クレジット表記（CC BY 4.0）

動画本体には焼き込まず（テロップと視覚競合するため）、**SNS投稿キャプション欄・LP転載時のクレジット欄**に表示する運用:

```
"<曲名>" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/
```

曲名・出典URL・ライセンス条文・選定比較の経緯は必ず cost-log に記録する。

## 音量エンベロープ設計（テロップ主導を壊さない「控えめな上乗せ」）

30秒動画での実証済み区間設計（`templates/remotion/src/components/Bgm.tsx` に実装済み）:

| 区間 | 音量 |
|---|---|
| 0.0–0.5秒 | フェードイン（0 → 基準音量） |
| 0.5秒–CTA 1秒前 | 基準音量で持続 |
| CTA開始（24秒）〜終盤 | CTA音量（基準の約1.4倍）で軽くブースト |
| 最後の1.5秒 | フェードアウト → 末尾無音 |

- Remotion の `<Audio volume={interpolate(frame, ...)}>` でフレーム単位のエンベロープを実装
- **曲を差し替えたら音量値を必ず再調整**する（曲ごとにマスタリング音量が違う。
  実績: Water Lily は 0.35/0.5、より音圧の高い Life of Riley は 0.18/0.26 に下げた）
- Sora 生成クリップ側の音声は `<OffthreadVideo muted>` で除去し、BGM と重複させない
- 音源はオリジナルから**使用尺＋1秒程度にトリム**して `remotion/public/audio/` に置く

## 検証（ffmpeg volumedetect — 毎回実施）

```bash
# 全体
ffmpeg -i out.mp4 -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume"
# 区間別（例: CTA区間 25-28秒）
ffmpeg -ss 25 -t 3 -i out.mp4 -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume"
```

チェック項目:
- [ ] 無音でなくなったこと（mean が -90dB 級でない）
- [ ] ピーク（max_volume）に十分な余裕があり音割れなし（実績目安: max -16dB 前後）
- [ ] CTA区間が基準区間よりわずかに大きい（意図どおりのブースト）
- [ ] フェードイン/アウト区間の自然な減衰
- [ ] `ffprobe` で尺が BGM 追加前と同一（映像に副作用がない）
