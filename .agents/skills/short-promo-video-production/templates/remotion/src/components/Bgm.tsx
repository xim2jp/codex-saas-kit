import React from "react";
import { Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { cuts } from "../brand";

/**
 * BGM 音量エンベロープ（テロップ主導を壊さない「控えめな上乗せ」設計）。
 *
 * TODO: 案件ごとに差し替え —
 *   1. incompetech.com（CC BY 4.0）等から選曲（references/bgm-and-mixing.md の選曲基準参照）
 *   2. 使用尺+1秒程度にトリムして public/audio/ に配置し、下の staticFile パスを更新
 *   3. 曲のマスタリング音量に合わせて BASE_VOLUME / CTA_VOLUME を再調整
 *      （実績: Water Lily=0.35/0.5、より音圧の高い Life of Riley=0.18/0.26）
 *   4. クレジット文言（曲名・作者・ライセンス）をこのコメントと cost-log に記録
 *
 * 音量設計:
 *   0.0–0.5s     フェードイン（0 → 基準音量）
 *   0.5s–CTA前   基準音量で持続（テロップの印象を邪魔しない控えめレベル）
 *   CTA 1秒前〜  CTA音量へわずかにブースト
 *   終盤1.5s     フェードアウト → 末尾無音
 */
export const Bgm: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const BASE_VOLUME = 0.18; // TODO: 曲に合わせて再調整
  const CTA_VOLUME = 0.26; // TODO: 曲に合わせて再調整

  const ctaStartFrame = Math.round(cuts.cut6.startSec * fps);

  const volume = interpolate(
    frame,
    [
      0,
      fps * 0.5, // fade-in 完了
      ctaStartFrame - fps * 1, // CTA手前で上げ始め
      ctaStartFrame, // CTAで基準音量より少し上げる
      durationInFrames - fps * 1.5, // 終盤フェードアウト開始
      durationInFrames, // 末尾で無音
    ],
    [0, BASE_VOLUME, BASE_VOLUME, CTA_VOLUME, CTA_VOLUME, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return <Audio src={staticFile("audio/bgm.mp3")} volume={volume} />;
};
