#!/usr/bin/env python3
"""Sora 2 カット生成ヘルパー（short-promo-video-production Skill テンプレート）

センセイメモ実制作で確立した手順の雛形:
  1. 参照画像をリクエストサイズに厳密一致させて加工（不一致だと invalid_request_error）
  2. 生成ジョブ作成 → ポーリング → ダウンロード
  3. 試行のたびにコストログへ追記する（結果に関わらず）

使い方:
  OPENAI_API_KEY を環境変数（または .env）に設定した上で、
  CHARACTER_BLOCK / SCENE 等を案件の promo-video-plan.md の草案に差し替えて実行。

注意:
  - 実行前に platform.openai.com でモデル提供状況・単価を必ず確認（Sora 2 サンセット情報あり）
  - moderation_blocked が出たら「職業的・健全な文脈」の言い回しに書き換えて再試行
    （例: at home/close-up/relax → tidy home study desk / medium shot / wholesome framing）
  - 予算の80%到達で停止しオーナー判断を仰ぐ
"""

import sys
import time
from pathlib import Path

from openai import OpenAI
from PIL import Image

# ======================== 案件ごとに差し替え ========================
MODEL = "sora-2"          # sora-2 ($0.10/秒・720p) / sora-2-pro
SECONDS = "4"             # "4" / "8" / "12" — 4秒×カット単位が最安
SIZE = "720x1280"         # 9:16 縦
REF_IMAGE_SRC = "site/assets/logo.png"          # キャラクター/ロゴ元画像
REF_IMAGE_OUT = "tmp/ref_720x1280.png"          # 加工済み参照画像の出力先
CANVAS_BG = "#FAFAF9"     # パディング背景色（ブランドの背景色に合わせる）
OUTPUT = "remotion/public/video/cut1-sora.mp4"  # 採用時の配置先

# 共通キャラクター記述ブロック — 全カットで一言一句一致させる（一貫性の要）
CHARACTER_BLOCK = """\
(TODO: 人物の年代・髪型・髪色・服装（色コード付き）・表情・画風・雰囲気を明記。
ロゴ/キャラクター生成時のプロンプト原本を一言一句レベルで踏襲する)
Clean modern Japanese anime / cel-shaded illustration style, calm and quiet mood.
No text, no logos, no watermark, no captions burned into the footage,
no distorted hands, no extra fingers."""

SCENE = """\
+ Scene: (TODO: 場所・時間帯・光・動作。画面の中身を映す場合は
  "screen content kept soft/out of focus — do NOT render any readable text or UI" を必ず明記)
+ Camera: slow, gentle dolly-in, eye-level, shallow depth of field
+ Mood: calm, quiet, trustworthy, warm — NOT energetic or flashy
+ Negative: no text, no watermark, no UI overlay, no distorted hands, no other people"""
# ====================================================================


def prepare_reference(src: str, out: str, size: str, bg: str) -> Path:
    """参照画像をリクエストサイズと厳密一致させる（不一致は invalid_request_error になる）。

    元画像をアスペクト維持で縮小し、リクエストサイズのキャンバス中央に配置する。
    """
    w, h = (int(v) for v in size.split("x"))
    img = Image.open(src).convert("RGBA")
    img.thumbnail((w, h), Image.LANCZOS)
    canvas = Image.new("RGBA", (w, h), bg)
    canvas.paste(img, ((w - img.width) // 2, (h - img.height) // 2), img)
    out_path = Path(out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path)
    print(f"reference image: {out_path} ({w}x{h})")
    return out_path


def main() -> None:
    client = OpenAI()
    ref = prepare_reference(REF_IMAGE_SRC, REF_IMAGE_OUT, SIZE, CANVAS_BG)
    prompt = f"{CHARACTER_BLOCK}\n{SCENE}"

    with open(ref, "rb") as f:
        video = client.videos.create(
            prompt=prompt,
            model=MODEL,
            seconds=SECONDS,
            size=SIZE,
            input_reference=f,
        )
    print(f"job created: {video.id}")

    while True:
        video = client.videos.retrieve(video.id)
        print(f"  status={video.status} progress={getattr(video, 'progress', '?')}")
        if video.status in ("completed", "failed"):
            break
        time.sleep(10)

    if video.status == "failed":
        # moderation_blocked の場合はプロンプトを職業的・健全な文脈に書き換えて再試行。
        # 失敗分の課金有無は API から確認不可 → OpenAI Usage ダッシュボードで実額確認。
        print(f"FAILED: {getattr(video, 'error', video)}", file=sys.stderr)
        print("→ コストログに失敗も記録すること", file=sys.stderr)
        sys.exit(1)

    out = Path(OUTPUT)
    out.parent.mkdir(parents=True, exist_ok=True)
    content = client.videos.download_content(video.id, variant="video")
    content.write_to_file(out)
    print(f"saved: {out}")
    print("→ 透かし・手指破綻・一貫性を目視確認し、コストログに追記すること")


if __name__ == "__main__":
    main()
