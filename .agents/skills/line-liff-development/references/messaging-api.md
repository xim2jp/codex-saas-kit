# LINE Messaging API 連携

LIFF / ミニアプリと併用する Bot 機能（Webhook 受信、メッセージ送信、Flex Message、リッチメニュー）の実装指針。

## 位置づけ

- **LIFF / ミニアプリ**＝ユーザーが操作する画面（フロント）。
- **Messaging API**＝LINE 公式アカウントから能動的にメッセージを送る／ユーザーの発言や友だち追加に反応する（バックエンド）。
- 多くの案件で両方を併用する：「リッチメニューから LIFF を開く」「LIFF で操作 → 完了をトークに push」など。
- Messaging API は **Messaging API チャネル**（`references/liff-vs-miniapp.md`）に属する。チャネルシークレットとチャネルアクセストークンは**サーバ専用**。

## SDK

- 公式 SDK：`@line/bot-sdk`（Node.js）。Webhook 検証・メッセージ送信のヘルパを持つ。
- Next.js では Route Handler（`app/api/line/webhook/route.ts`）にハンドラを置く。

```bash
npm install @line/bot-sdk
```

## Webhook 受信

LINE プラットフォームは、友だち追加・メッセージ受信などのイベントを **HTTPS POST** で Webhook URL に送る。Webhook URL は Messaging API チャネルに設定する。

### 署名検証は必須（最重要）

Webhook はインターネット公開エンドポイント。**`x-line-signature` ヘッダの検証なしでイベントを処理してはいけない**（偽イベント注入の脆弱性）。チャネルシークレットを鍵に HMAC-SHA256 で検証する。

```ts
// app/api/line/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-line-signature") ?? "";
  const body = await req.text(); // ★ 生のテキストで受ける（JSON parse 前）

  const expected = crypto
    .createHmac("SHA256", process.env.LINE_MESSAGING_CHANNEL_SECRET!)
    .update(body)
    .digest("base64");

  // タイミング安全な比較
  const valid =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const { events } = JSON.parse(body);
  // イベント処理（下記）。重い処理は即 200 を返してから非同期で
  return NextResponse.json({ ok: true });
}
```

- **生のリクエストボディ**で署名を計算する。フレームワークが JSON を再シリアライズすると署名が一致しない。
- `@line/bot-sdk` の `validateSignature` / `middleware` を使ってもよい。
- LINE は応答が遅いと再送する。**重い処理は先に 200 を返してから非同期実行**し、`webhookEventId` で冪等化する。

### 主なイベント種別

| イベント | 内容 |
|---------|------|
| `follow` / `unfollow` | 友だち追加 / ブロック |
| `message` | テキスト・画像・スタンプ・位置情報など受信 |
| `postback` | リッチメニュー・テンプレートのアクション |
| `accountLink` | アカウント連携 |
| 検証用の空 `events`（接続確認）も来る | 0 件配列でも 200 を返す |

## メッセージ送信

| 方式 | 用途 | 注意 |
|------|------|------|
| **reply**（`replyMessage`） | Webhook イベントへの応答 | `replyToken` を使う。**有効期限が短い**ので即応答。無料 |
| **push**（`pushMessage`） | 任意タイミングで特定ユーザーへ | **無料メッセージ枠の上限あり**。超過分は有料 / 配信不可 |
| **multicast / narrowcast / broadcast** | 複数・属性配信・全員配信 | push 同様に枠を消費 |

```ts
// reply の例（@line/bot-sdk）
import { messagingApi } from "@line/bot-sdk";
const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN!,
});
await client.replyMessage({
  replyToken,
  messages: [{ type: "text", text: "受け付けました" }],
});
```

- **push を送れるのは友だちのユーザーのみ。** 未友だちには送れない（LIFF の `getFriendship` で確認 → 友だち追加導線）。
- **無料枠**：LINE 公式アカウントのプランに応じた月次の無料メッセージ通数がある。超えると追加メッセージは有料、または配信不可。**運用前に通数を試算**し、reply（無料）で済むものは reply にする。

## Flex Message

通常のテキストより自由度の高い、カード状のリッチなメッセージ。

- 構造は 3 階層：**コンテナ**（`bubble` / `carousel`）→ **ブロック**（`header` / `hero` / `body` / `footer`）→ コンポーネント（`box` / `text` / `image` / `button` 等）。
- ボタンのアクションに **LIFF の URL** を入れ、トークから LIFF を開く導線にできる。
- レイアウトは **Flex Message Simulator**（公式ツール）で組み立て、JSON を確定してからコード化する。
- JSON が大きくなるので、テンプレート関数（データを受け取り Flex JSON を返す）に切り出して保守する。

## リッチメニュー

トーク画面下部の固定メニュー。LINE 公式アカウントの主要導線。

- メニューのタップ領域に **LIFF の URL を開くアクション**や `postback` を割り当てる。
- **リッチメニューエイリアス**と「リッチメニュー切り替えアクション」でタブ切り替え型メニューを作れる。
- `userId` を指定して**ユーザーごとに別メニュー**を出せる（ログイン前後、会員ランク別など）。
- メニュー画像はサイズ規定がある。差し替えは API で行えるが、頻繁な更新は運用負荷になる（1 名運用では更新頻度を抑える設計に）。

## アカウント連携（LIFF ⇄ Messaging API）

- LIFF で得た本人性（`line_user_id`）と、Messaging API の Webhook で来る `userId` は**同じ LINE ユーザーなら一致する**（同一チャネル群の文脈で）。これにより「LIFF で操作したユーザーに push を送る」がつながる。
- 厳密な連携が要る場合は LINE の **アカウント連携（account link）**機能を使う。

## 設計・レビュー観点

- [ ] Webhook の `x-line-signature` を生ボディで HMAC-SHA256 検証している
- [ ] 署名比較がタイミング安全（`timingSafeEqual`）
- [ ] 重い処理は 200 応答後に非同期、`webhookEventId` で冪等化
- [ ] チャネルシークレット / アクセストークンがサーバ専用
- [ ] reply で済むものを push にして無料枠を浪費していない
- [ ] push 先が友だちであることを確認している
- [ ] 無料メッセージ枠の月次上限を運用試算済み
- [ ] Flex Message を Simulator で検証してからコード化している
- [ ] リッチメニューの更新頻度が運用負荷に見合っている
