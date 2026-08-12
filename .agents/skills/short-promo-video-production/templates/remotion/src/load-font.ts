import { loadFont } from "@remotion/google-fonts/NotoSansJP";

// Remotion のレンダリング環境でも確実に日本語フォントを読み込むための共通ロード処理。
// design-system.md 準拠フォント: Noto Sans JP
export const { fontFamily: notoSansJP, waitUntilDone } = loadFont("normal", {
  weights: ["400", "500", "700"],
  subsets: ["japanese"],
});
