/**
 * ブランドトークン — プロモ動画（案件ごとに差し替える唯一のファイル）
 *
 * TODO: 案件の docs/12-brand-design/design-system.md / docs/15-marketing-site/style-guide.md から
 * カラー・タイポグラフィの値を転記する（動画都合で変更しない・完全一致させる）。
 */

export const colors = {
  // TODO: デザインシステムのプライマリ/アクセント/ニュートラルを転記
  primary600: "#0D7A6E",
  primary700: "#0A6159",
  primary100: "#D1EEE9",
  primary50: "#EAF7F5",

  accent500: "#D97706",
  accent100: "#FEF3C7",

  success: "#16A34A",
  warning: "#D97706",
  error: "#DC2626",
  info: "#2563EB",

  neutral50: "#FAFAF9",
  neutral100: "#F5F5F3",
  neutral200: "#E8E8E4",
  neutral300: "#D2D1CB",
  neutral400: "#A8A89F",
  neutral500: "#78786F",
  neutral600: "#57574F",
  neutral700: "#3A3A33",
  neutral900: "#1A1A16",
} as const;

export const fontFamily = {
  base: "'Noto Sans JP', sans-serif",
} as const;

// 動画全体の仕様（SNS縦型テンプレ: 9:16・30fps・30秒）
export const videoSpec = {
  width: 720,
  height: 1280,
  fps: 30,
  totalDurationInSeconds: 30,
} as const;

// カット構成（promo-video-plan.md のカット表と1:1対応させる）
// 役割: 1=フック(Sora) 2=中核機能UI 3=蓄積/ビフォーアフター 4=感情ビート(Sora) 5=差別化 6=ロゴCTA
export const cuts = {
  cut1: { name: "hook-sora", startSec: 0, durationSec: 4 },
  cut2: { name: "core-feature", startSec: 4, durationSec: 5 },
  cut3: { name: "accumulate", startSec: 9, durationSec: 5 },
  cut4: { name: "emotion-sora", startSec: 14, durationSec: 4 },
  cut5: { name: "differentiator", startSec: 18, durationSec: 6 },
  cut6: { name: "logo-cta", startSec: 24, durationSec: 6 },
} as const;

// テロップ原稿（promo-video-plan.md の台本と一字一句一致させる。1行12〜20字・数字で具体化）
export const copy = {
  // TODO: 案件のメインコピー・台本に差し替え
  mainCopyLine1: "（メインコピー前半・1行目）",
  mainCopyLine2: "（メインコピー前半・2行目）",
  cut2: "（中核機能の訴求。\n数字で具体化）",
  cut3: "（蓄積の価値・\nビフォーアフター）",
  cut4: "（感情ビートの説明）",
  cut5: "（最重要の差別化軸）",
  cut6Line1: "（クロージングコピー1行目）",
  cut6Line2: "（クロージングコピー2行目）",
  cta: "無料プランからはじめる",
  url: "example.jp",
} as const;
