import React from "react";
import { Composition, continueRender, delayRender } from "remotion";
import { PromoVideo } from "./PromoVideo";
import { videoSpec } from "./brand";
import { waitUntilDone } from "./load-font";

// フォント読み込み完了を待ってからレンダリングを続行（日本語フォントの確実な読み込み保証）
const handle = delayRender("Loading Noto Sans JP");
waitUntilDone()
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error("Font load failed", err);
    continueRender(handle);
  });

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromoVideo"
        component={PromoVideo}
        durationInFrames={videoSpec.totalDurationInSeconds * videoSpec.fps}
        fps={videoSpec.fps}
        width={videoSpec.width}
        height={videoSpec.height}
      />
    </>
  );
};
