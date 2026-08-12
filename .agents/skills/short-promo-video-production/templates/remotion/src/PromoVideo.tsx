import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { SoraClip } from "./compositions/SoraClip";
import { LogoCtaCut } from "./compositions/LogoCtaCut";
import { Bgm } from "./components/Bgm";
import { copy, cuts } from "./brand";

/**
 * プロモ動画本編（SNS縦型 9:16・約30秒）。
 * promo-video-plan.md のカット表と1:1対応させる。
 *
 * カット割り（30fps基準・brand.ts の cuts 定義と一致させる）:
 *   #1 hook-sora        0    - 120  (4s)  Sora 2生成
 *   #2 core-feature     120  - 270  (5s)  Remotion（案件ごとに実装）
 *   #3 accumulate       270  - 420  (5s)  Remotion（案件ごとに実装）
 *   #4 emotion-sora     420  - 540  (4s)  Sora 2生成
 *   #5 differentiator   540  - 720  (6s)  Remotion（案件ごとに実装）
 *   #6 logo-cta         720  - 900  (6s)  Remotion（LogoCtaCut テンプレ）
 *
 * TODO: カット2・3・5 を案件の UI モック/モーショングラフィックスとして実装する。
 * 参考実装（センセイメモ）: LINEトークUIモック / カードスタック＋カウントアップ /
 * タイプライター表示＋アイコンバッジ。teachersnote リポジトリの
 * remotion/src/compositions/{LineMemoCut,AccumulateCut,PrivacyDraftCut}.tsx を参照。
 */
export const PromoVideo: React.FC = () => {
  const { fps } = useVideoConfig();
  const sec = (s: number) => Math.round(s * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Bgm />

      <Sequence from={sec(cuts.cut1.startSec)} durationInFrames={sec(cuts.cut1.durationSec)}>
        <SoraClip src="video/cut1-sora.mp4" captionText={`${copy.mainCopyLine1}\n${copy.mainCopyLine2}`} />
      </Sequence>

      {/* TODO: カット2（中核機能のUIモック） */}
      {/* <Sequence from={sec(cuts.cut2.startSec)} durationInFrames={sec(cuts.cut2.durationSec)}>
        <CoreFeatureCut />
      </Sequence> */}

      {/* TODO: カット3（蓄積・ビフォーアフターのモーショングラフィックス） */}

      <Sequence from={sec(cuts.cut4.startSec)} durationInFrames={sec(cuts.cut4.durationSec)}>
        <SoraClip src="video/cut4-sora.mp4" captionText={copy.cut4} />
      </Sequence>

      {/* TODO: カット5（差別化軸のUIモック＋バッジ） */}

      <Sequence from={sec(cuts.cut6.startSec)} durationInFrames={sec(cuts.cut6.durationSec)}>
        <LogoCtaCut />
      </Sequence>
    </AbsoluteFill>
  );
};
