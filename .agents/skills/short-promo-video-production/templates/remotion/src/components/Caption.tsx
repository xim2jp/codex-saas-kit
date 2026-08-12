import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { colors } from "../brand";
import { notoSansJP } from "../load-font";

/**
 * 焼き込みテロップ（オープンキャプション）共通コンポーネント。
 * 無音・自動再生前提のSNS動画で、音声なしでも意味が通ることを担保する。
 * - 中央下部寄せ・特大フォント・縁取り＋半透明の下地で視認性を確保
 * - フェードイン/アウトでカット内の登場を演出
 */
export const Caption: React.FC<{
  text: string; // "\n" で改行
  color?: string;
  fontSize?: number;
  bottom?: number;
  fadeInFrames?: number;
}> = ({ text, color = colors.neutral900, fontSize = 44, bottom = 160, fadeInFrames = 8 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const opacity = interpolate(
    frame,
    [0, fadeInFrames, durationInFrames - fadeInFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const translateY = interpolate(frame, [0, fadeInFrames], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lines = text.split("\n");

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom,
        display: "flex",
        justifyContent: "center",
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          background: "rgba(26, 26, 22, 0.55)",
          borderRadius: 16,
          padding: "18px 32px",
          maxWidth: 640,
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              fontFamily: notoSansJP,
              fontWeight: 700,
              fontSize,
              lineHeight: 1.35,
              color: "#FFFFFF",
              textAlign: "center",
              letterSpacing: 0.5,
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
};

export const brandColorsForCaption = colors;
