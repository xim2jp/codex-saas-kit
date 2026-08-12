import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, copy } from "../brand";
import { notoSansJP } from "../load-font";

/**
 * 最終カット：ロゴ（キャラクター）＋クロージングコピー＋CTAボタン＋URL。
 * ロゴ→コピー→CTA の順にスプリングで登場する汎用テンプレ。
 * コピー・URL は brand.ts の copy から取る（確定コピーは一字一句変更禁止）。
 */
export const LogoCtaCut: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame, fps, config: { damping: 14 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0.7, 1]);
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1]);

  const textOpacity = interpolate(frame, [fps * 0.6, fps * 1.0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ctaSpring = spring({ frame: frame - fps * 1.6, fps, config: { damping: 12 } });
  const ctaScale = interpolate(ctaSpring, [0, 1], [0.9, 1]);
  const ctaOpacity = interpolate(ctaSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.neutral50,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 28,
        padding: "0 48px",
      }}
    >
      <Img
        src={staticFile("images/character.png")}
        style={{
          width: 180,
          height: 180,
          borderRadius: "50%",
          objectFit: "cover",
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
        }}
      />

      <div style={{ opacity: textOpacity, textAlign: "center" }}>
        <div style={{ fontFamily: notoSansJP, fontWeight: 700, fontSize: 40, color: colors.neutral900, lineHeight: 1.4 }}>
          {copy.cut6Line1}
          <br />
          {copy.cut6Line2}
        </div>
      </div>

      <div
        style={{
          opacity: ctaOpacity,
          transform: `scale(${ctaScale})`,
          background: colors.accent500,
          color: "#fff",
          borderRadius: 999,
          padding: "20px 40px",
          fontFamily: notoSansJP,
          fontWeight: 700,
          fontSize: 30,
        }}
      >
        {copy.cta}
      </div>

      <div style={{ opacity: ctaOpacity, fontFamily: notoSansJP, fontWeight: 500, fontSize: 26, color: colors.primary600 }}>
        {copy.url}
      </div>
    </AbsoluteFill>
  );
};
