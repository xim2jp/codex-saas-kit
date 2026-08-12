# サービス選定（日本向け AI 通話）

「どのサービスを使うか」の全体像。マネージドプラットフォーム / 自作フレームワーク / 各部品（STT・TTS・LLM・音声対話）の選択肢と、野口さんスタックへの当てはめ方。

> 価格・対応言語・機能は変化が速い。本ファイルの数値・対応状況は**設計時に必ず一次情報で再確認**する。

## 大分類：マネージド vs 自作

### マネージドプラットフォーム（音声ループを任せる）

電話・STT・TTS・割り込み制御・ダッシュボードまで込みのプラットフォーム。**自分で常駐サーバを持たなくてよい**ので 1 名運用・最速出荷に向く。

| プラットフォーム | 特徴 | 課金の形 |
|----------------|------|---------|
| **Vapi** | STT/LLM/TTS/電話を自分で選んで組む柔軟型。プラットフォーム手数料 + 各部品の実費 | プラットフォーム約 $0.05/分 + 部品実費（合計 約 $0.13〜0.31/分） |
| **Retell AI** | STT/LLM/TTS/電話を束ねた単価。設定がシンプル | 約 $0.07/分〜（従量、基本サブスク不要） |
| **Bland AI** | 構成が固定的で割り切った作り | 分課金 |
| **ElevenLabs Agents** | TTS の品質が強み。会話エージェント機能 | 分課金 |

**長所**：最速で出荷、電話まわりを意識しなくてよい、ダッシュボード/録音/文字起こし付属。
**短所**：分課金に上乗せ手数料、データ所在のコントロールが弱い、ベンダーロックイン、細かい挙動を制御しにくい。

### 自作フレームワーク（常駐コンテナで音声ループを持つ）

| 選択肢 | 特徴 |
|--------|------|
| **LiveKit Agents** | OSS の音声エージェントフレームワーク。LiveKit Cloud が WebRTC + SIP テレフォニーを提供。STT/LLM/TTS プラグイン、または音声対話モデルを差せる。ターン検出モデルを持つ |
| **Pipecat**（Daily） | OSS の音声エージェントフレームワーク（Python）。Daily の transport、または Twilio 等のテレフォニーと組む |
| **Twilio ConversationRelay** | Twilio が STT/TTS と電話を担当し、利用者は LLM だけを WebSocket で持ち込む中間形態。電話まわりは Twilio に任せつつ会話ロジックは自前 |
| **Twilio Media Streams** | 生の音声を WebSocket で受け、STT/LLM/TTS をすべて自前で組む最も低レイヤな構成 |

**長所**：データ所在を国内/AWS 内に保てる、Bedrock と密結合できる、規模が出ればコスト有利、挙動を完全制御。
**短所**：常駐インフラ（ECS Fargate 等）の構築・運用、割り込み制御や監視も自前。

> **基本方針**：最初の数案件・PoC・要件が読み切れない段階は**マネージド**。データ所在要件が厳しい / 通話量が多い（分課金の手数料が重い）/ Bedrock 必須 なら**自作**。ADR に切り替え基準（例「月 X 万分を超えたら自作を再検討」）を書く。

## 各部品の選択肢（カスケード型を組む場合）

### STT（音声認識）

| サービス | 日本語 | 備考 |
|---------|-------|------|
| **Deepgram**（Nova 系） | 対応 | 低レイテンシ・ストリーミングに強い。電話音声向けモデルあり |
| **Google Cloud Speech-to-Text** | 対応（ja-JP） | 安定。電話音声モデルあり |
| **Azure AI Speech** | 対応（ja-JP） | カスタム音声モデル・発音辞書 |
| **AmiVoice**（アドバンスト・メディア、国産） | 日本語特化 | 日本語業務音声に強い。国内事業者でデータ所在の相談がしやすい |
| **OpenAI**（gpt-4o-transcribe / Whisper） | 対応 | バッチ寄り。ストリーミング用途は要検証 |

### TTS（音声合成）

| サービス | 日本語 | 備考 |
|---------|-------|------|
| **ElevenLabs** | 多言語（日本語可） | 品質が高い。声のクローン・多言語 |
| **Google / Azure ニューラル TTS** | 対応 | 安定。クラウド一体運用しやすい |
| **Amazon Polly**（ニューラル） | 対応 | AWS 完結。野口さん Tier B と相性良 |
| **Cartesia** 等 | 多言語 | 超低レイテンシ志向。日本語品質は要評価 |

### LLM

GPT 系 / **Claude（Anthropic API または Amazon Bedrock）** / Gemini。**Bedrock の Claude を使えば野口さん Tier B（AWS）でデータを完結**できる。会話用途では応答の速さ（TTFT）とコストで小〜中型モデルを基本に、難所だけ上位モデルへ振り分ける。

### 音声対話モデル（方式 B）

- **OpenAI Realtime API**（`gpt-realtime` 系）
- **Google Gemini Live API**
- **Amazon Nova Sonic**（Bedrock）— **AWS 内で音声対音声が完結**。データ所在・越境移転の観点で日本案件に有力

## 野口さんスタックへの当てはめ

### Tier A 経路：マネージド + Next.js 管理 UI（最速出荷）

```
[一般電話] ─ Twilio ─ [Vapi / Retell（音声ループ）] ─Webhook→ [Next.js Route Handler on Vercel]
                                                                      │
                                                              [Supabase: 通話記録/文字起こし/録音メタ]
[Next.js 管理 UI] ─REST→ プラットフォーム API（エージェント設定・架電トリガ）
```

- 音声のリアルタイム処理は**プラットフォーム側**。Vercel には触れさせない（原則：Vercel は長時間接続を保持できない）
- Vercel の Next.js は「管理 UI」「架電のトリガ（REST 呼び出し）」「Webhook 受信」だけを担う
- 録音/文字起こしは Supabase（Storage + テーブル）に保存。RLS でマルチテナント分離

### Tier B 経路：自作 + ECS Fargate + Bedrock（データ国内/AWS 完結）

```
[一般電話] ─ Twilio SIP / Amazon Connect ─ [LiveKit Agents or Pipecat（ECS Fargate 常駐）]
                                                       │
                                          Amazon Nova Sonic（音声対話）/ Bedrock Claude（カスケード）
                                                       │
                                          [Supabase or RDS: 通話記録/文字起こし]
```

- 音声ループは **ECS Fargate の常駐コンテナ**（野口さん Tier B のスタックにそのまま乗る）
- 音声対話は **Amazon Nova Sonic**、またはカスケードで **Deepgram/Connect の STT + Bedrock Claude + Polly**
- **Amazon Connect 東京リージョン**を使えば、日本の電話番号・通話基盤・データ所在を AWS 内に保てる（`telephony-japan.md`）

### Vercel/Supabase を使ってよい範囲（重要）

| 用途 | 置き場所 |
|------|---------|
| 音声のリアルタイムループ（WebSocket/WebRTC 保持） | **マネージド or ECS Fargate**（Vercel/Edge 不可） |
| 管理 UI、エージェント設定、架電トリガ | Next.js on Vercel |
| Webhook 受信（通話開始/終了・文字起こし完了） | Next.js Route Handler（短時間処理）|
| 通話記録・文字起こし・録音・構造化アウトカム | Supabase（DB + Storage、RLS） |
| 通話後の文字起こし要約・抽出（非同期） | Supabase Edge Function / バッチ（リアルタイムでなければ可） |

## 選定の流れ

1. **方式**を決める（`voice-ai-architecture.md`：カスケード型 / 音声対話型）
2. **構築方式**を決める（マネージド / 自作）
3. **PSTN プロバイダ**を決める（`telephony-japan.md`）
4. **部品**を決める（自作・カスケードの場合の STT/TTS/LLM）
5. **コスト試算**する（`cost-and-accuracy-jp.md`）
6. ADR（`docs/11-tech-stack/adr/`）に 1〜5 と切り替え基準を記録

## レビュー観点

- [ ] マネージド / 自作を選び、ADR に切り替え基準を記録
- [ ] 音声ループが Vercel/Supabase Edge に載っていない
- [ ] データ所在要件があるなら国内/AWS 完結の構成（Connect 東京 + Bedrock 等）になっている
- [ ] 価格・対応言語を一次情報で再確認した
- [ ] 録音/文字起こしの保存先（Supabase 等）と分離（RLS）を決めた
