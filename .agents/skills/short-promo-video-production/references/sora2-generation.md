# Sora 2 API 実践知 — 生成・一貫性・コスト管理

センセイメモ実制作（2026-07）で踏んだ罠と回避策の記録。**利用直前に platform.openai.com でモデル提供状況・単価を必ず再確認**すること（Sora 2 API のサンセット情報あり。後継モデルの場合も本書の運用ノウハウ＝参照画像・moderation・ログ運用はそのまま通用する）。

## API 基本仕様（openai Python SDK）

| 項目 | 値 |
|---|---|
| エンドポイント | `POST /v1/videos`（`client.videos.create()`） |
| `model` | `sora-2`（$0.10/秒・720p） / `sora-2-pro`（$0.30/秒〜） |
| `seconds` | `"4"` / `"8"` / `"12"`（文字列。4秒が最安・カット単位に最適） |
| `size` | `"720x1280"`（9:16縦。そのまま採用可） |
| `input_reference` | 画像ファイルを渡して image-to-video（キャラクター一貫性の要） |
| ステータス | `client.videos.retrieve(id)` → queued / in_progress / completed / failed |
| ダウンロード | `client.videos.download_content(id, variant="video")` |

## 罠と回避策（実際に踏んだもの）

### 1. `input_reference` は解像度を厳密一致させる

参照画像がリクエストの `size` と一致しないと
`invalid_request_error: Inpaint image must match the requested width and height` になる。

**対策**: PIL でキャラクターをクロップし、リクエストと同一サイズのキャンバス
（背景はブランドの背景色でパディング）に配置した参照画像を事前生成する。
→ `templates/scripts/generate_sora_cut.py` の `prepare_reference()` 参照。

### 2. moderation_blocked の回避（progress 99% でも失敗する）

「at home / cozy room / close-up on face and shoulders / relax / exhale」のような
**私的空間＋身体的クローズアップ＋弛緩**の組み合わせがモデレーションに抵触した実績あり。

**対策**: **職業的・健全な文脈を明示する言い回し**に書き換える。
- ✗ `at home in a cozy room, close-up on face and shoulders, she relaxes and exhales`
- ✓ `at a tidy home study desk, medium shot from the chest up, professional and wholesome framing`

moderation 失敗分の課金有無は API から確認できない → **OpenAI Usage ダッシュボードで実額を都度確認**。

### 3. 課金ブロッカーの切り分け（billing_hard_limit_reached / insufficient_quota）

生成前に必ず**低コスト疎通確認**を chat → image → video の順で行う。
org レベルの Limits が正常でも、**プロジェクト（`sk-proj-` キー）単位の Limits** や
支払い方法の失効で別エラーが出る。オーナー確認先:
1. `platform.openai.com/settings/organization/billing/payment-methods`（カード有効性）
2. API キーの所属プロジェクトの個別 Limits（org と別に設定されている）
3. billing/overview の未払い・警告表示

民事再生中・一括払い前提の制約により、**限度額は都度必要な分だけ**（例: $31 ≈ ¥5,000）引き上げ、無制限にしない。

## キャラクター一貫性の担保（3点セット）

1. **共通キャラクター記述ブロック**を全カットのプロンプトで一言一句一致させる
   （髪型・髪色・服装・色コード・画風・雰囲気を明記。ロゴ/キャラ生成時のプロンプト原本を踏襲する）
2. **同一の参照画像**を全カットの `input_reference` に使う
3. **Negative 指定を毎回付ける**: `no text, no logos, no watermark, no captions burned into the footage, no distorted hands, no extra fingers`（文字は絶対に Sora に描かせない — テロップは Remotion で焼き込む）

### プロンプト構造テンプレート

```
[共通キャラクター記述ブロック — 全カット完全一致]
+ Scene: <場所・時間帯・光・人物の動作。画面の中身を映す場合は必ず
  "screen content kept soft/out of focus — do NOT render any readable text or UI" を明記>
+ Camera: <slow dolly-in / medium shot 等。派手な動きは破綻リスク>
+ Mood: <calm, trustworthy 等。ブランドトーンに一致させる>
+ Negative: no text, no watermark, no UI overlay, no distorted hands, no other people
```

## 一貫性破綻時のフォールバック（企画書に事前記載する）

- 顔の同一性が微妙にズレる → カットを短く感じさせるクイックカット・寄りアングルでごまかす
- 手指の破綻 → 手が映らない構図（顔・上半身のみ）で再生成
- どうしても破綻 → 該当カットを Remotion（静止画 Ken Burns ズーム＋光の演出）に差し替え。
  **AI動画ゼロでも成立する設計**を企画段階で担保しておく

## コストログ運用（必須）

`docs/15-marketing-site/promo-video-cost-log.md` に以下を**試行のたびに**記録してから作業を終える:

| 日時 | カット | モデル | 秒数 | サイズ | 結果 | コスト | 備考 |
|------|-------|-------|------|-------|------|--------|------|

- 予算の80%到達で一旦停止し、続行判断をオーナーに仰ぐ
- 採用クリップは `remotion/public/video/` にソース保管（再レンダリングに必要）

## 品質・権利チェック（生成後に毎回）

- [ ] 透かし目視確認（フレーム抽出して確認。API経由・有料ダウンロードは可視透かしなしの実績）
- [ ] C2PA メタデータは埋め込まれている前提で、AI生成開示が必要な媒体では別途対応
- [ ] 商用利用: 生成物そのままの販売は不可。**Remotion での編集・テロップ・ブランディング・合成**を行うことで要件を満たす構成にする
- [ ] 実在人物・他社IPの模写になっていないか（プロンプトに実在人物名を入れない）
- [ ] 手指・文字化けなどの破綻の目視確認
