# LIFF SDK の機能

LIFF v2 SDK（`@line/liff`）で使える主な API と、実務での使いどころ・注意点。

> API は LIFF のバージョンで増減する。実装時は LINE Developers の「LIFF v2 API reference」と「リリースノート」で最新を確認する。本ファイルは設計判断の指針。

## 初期化・環境判定

| API | 用途 |
|-----|------|
| `liff.init(config)` | 初期化。すべての API はこれの完了後（`references/setup-and-nextjs.md`） |
| `liff.ready` | 初期化完了を表す Promise |
| `liff.isInClient()` | LINE アプリ内か（外部ブラウザとの分岐） |
| `liff.getOS()` | `ios` / `android` / `web` |
| `liff.getLineVersion()` | LINE アプリのバージョン（機能可否の判定に使える） |
| `liff.getAppLanguage()` | 端末の言語設定 |
| `liff.isApiAvailable(name)` | その API がこの環境で使えるか |

> **設計原則**：`liff.isInClient()` と `liff.isApiAvailable()` で**機能の可否を実行時に判定**し、使えない環境では代替 UI を出す。「LINE 内でしか動かない機能」を外部ブラウザで叩いてエラーにしない。

## 認証・ユーザー情報

| API | 用途 | 注意 |
|-----|------|------|
| `liff.isLoggedIn()` | ログイン状態 | |
| `liff.login(config)` | ログイン開始 | `redirectUri` を指定可。URL 制約に注意 |
| `liff.logout()` | ログアウト | |
| `liff.getProfile()` | 表示名・アイコン・userId・ステータスメッセージ | **表示用途のみ**。サーバへ送って信用しない |
| `liff.getDecodedIDToken()` | ID トークンのデコード結果 | 同上。表示用途のみ |
| `liff.getIDToken()` | 生の ID トークン（JWT） | **サーバ送信用**。サーバで検証する |
| `liff.getAccessToken()` | アクセストークン | **サーバ送信用**。アプリを閉じると失効 |

> **最重要**：サーバでユーザーを扱う時は `getProfile()` の結果ではなく **`getIDToken()` / `getAccessToken()` をサーバへ送り、サーバが LINE プラットフォームで検証**する。詳細は `references/auth-and-supabase.md` と `references/testing-and-security.md`。

## メッセージ送信

| API | 用途 | 注意 |
|-----|------|------|
| `liff.sendMessages([...])` | **現在開いているトークルーム**にメッセージを送る | LINE 内で、かつそのトークから起動された LIFF でのみ。テキスト・スタンプ・Flex 等 |
| `liff.shareTargetPicker([...])` | 友だち／グループを選んでメッセージを共有 | 共有先をユーザーが選ぶ。拡散・招待導線に有効 |

- `sendMessages()` は「トークから開いた LIFF」が前提。リッチメニューやプロフィール経由で開いた場合は使えないことがある → `isApiAvailable()` で確認。
- 能動的な一斉配信・あとから送る通知は LIFF ではなく **Messaging API の push**（`references/messaging-api.md`）。

## 画面・ウィンドウ制御

| API | 用途 |
|-----|------|
| `liff.openWindow({ url, external })` | 外部 URL を開く。`external: true` で外部ブラウザ、`false` で LINE 内ブラウザ |
| `liff.closeWindow()` | LIFF を閉じる（トーク画面に戻る） |
| `liff.scanCodeV2()` | QR / バーコードをスキャン（カメラ）。`scanCode` は非推奨、`scanCodeV2` を使う |

- アプリ内の遷移は Next.js ルーティング、**外部サイトは `openWindow`**。`<a href>` で直接飛ばすと LIFF の文脈が切れる。
- `closeWindow()` 後の体験（トークに戻る、サービスメッセージが届く等）を設計する。

## デバイス機能

| API | 用途 |
|-----|------|
| `liff.scanCodeV2()` | QR / バーコード読み取り |
| `liff.permission` | 権限の確認・要求（プラットフォーム依存） |
| Bluetooth 系 API | LINE Things 連携（IoT 案件向け。通常案件では不要） |

- カメラ等は LINE アプリ内でのみ。外部ブラウザでは `isApiAvailable()` が false になりうる。

## 友だち追加・公式アカウント連携

| API | 用途 |
|-----|------|
| `liff.requestFriendship()` | LINE 公式アカウントの友だち追加（またはブロック解除）を促すサブウィンドウを表示（LIFF v2.28.0〜） |
| `liff.getFriendship()` | LIFF を開いているユーザーが、LIFF に紐づく公式アカウントの友だちかを判定 |

- Messaging API で push を送るには**友だちであること**が前提。`getFriendship()` で未友だちを検出し、`requestFriendship()` や友だち追加ボタンへ誘導する。
- LINE ミニアプリは友だち追加なしで使えるが、push 通知を送りたいなら別途友だち化が要る。

## 機能設計のチェックリスト

- [ ] LINE アプリ内専用 API を、外部ブラウザで叩いてエラーにしていない（`isInClient` / `isApiAvailable` で分岐）
- [ ] サーバへ送るのはトークンで、`getProfile()` の生データではない
- [ ] 外部 URL は `openWindow`、アプリ内は Next.js ルーティングで遷移
- [ ] `scanCode`（非推奨）ではなく `scanCodeV2` を使用
- [ ] `closeWindow()` 後のユーザー体験が設計されている
- [ ] push 通知が要るなら友だち状態（`getFriendship`）を確認する導線がある
