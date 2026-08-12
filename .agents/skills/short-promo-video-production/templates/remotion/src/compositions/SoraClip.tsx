import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { Caption } from "../components/Caption";

/**
 * Sora 2 生成クリップ（720x1280）をそのまま全画面表示するラッパー。
 * テロップはRemotionで焼き込み（Sora側には文字を生成させない = toolkit方針）。
 */
export const SoraClip: React.FC<{ src: string; captionText: string }> = ({
  src,
  captionText,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <Caption text={captionText} color="#FFFFFF" />
    </AbsoluteFill>
  );
};
