# テスト戦略とセキュリティ

LIFF / ミニアプリ / Messaging API のテストの組み立て方と、セキュリティチェックリスト。

---

## Part 1: テスト戦略

### テストピラミッド

```
        ╱╲        E2E
       ╱──╲       外部ブラウザで動く範囲を Playwright、LINE 内固有はモック / 手動
      ╱────╲      コンポーネントテスト（Testing Library）
     ╱──────╲     LIFF SDK をモックして画面の分岐を検証
    ╱────────╲    ユニットテスト（Vitest 等）
   ╱──────────╲   トークン検証・Webhook 署名・Flex 生成・ドメインロジック
```

LIFF アプリは Next.js Web アプリなので、`e2e-browser-testing` skill のピラミッド・ツールを基本としつつ、**LINE アプリ内でしか再現できない部分**を切り分けるのが要点。

### LINE 環境ごとのテスト対象

| 環境 | テストできること | 方法 |
|------|----------------|------|
| 通常ブラウザ（`localhost` / Vercel） | UI、ルーティング、サーバ API、Supabase 連携 | Vitest / Testing Library / Playwright |
| 外部ブラウザで開いた LIFF（`withLoginOnExternalBrowser`） | LIFF 初期化、ログイン、画面遷移の大半 | Playwright（`e2e-browser-testing`） |
| LINE アプリ内 | `sendMessages` / `scanCodeV2` / `shareTargetPicker` 等、LINE 固有 API | **実機での手動確認**＋ LIFF Inspector |

> **方針**：自動テストは「外部ブラウザで動く範囲」を最大化し、LINE 固有 API は `liff.isApiAvailable()` 分岐の両側をユニット／コンポーネントテストで担保しつつ、最終確認は実機で行う。

### LIFF SDK のモック

ユニット／コンポーネントテストでは `@line/liff` をモックし、状態ごとの分岐を検証する。

```ts
// 例：liff をモックして「未ログイン」「ログイン済み」「API 利用不可」を切り替える
vi.mock("@line/liff", () => ({
  default: {
    init: vi.fn().mockResolvedValue(undefined),
    isLoggedIn: vi.fn().mockReturnValue(true),
    isInClient: vi.fn().mockReturnValue(true),
    isApiAvailable: vi.fn().mockReturnValue(true),
    getIDToken: vi.fn().mockReturnValue("dummy.jwt.token"),
    getProfile: vi.fn().mockResolvedValue({ userId: "U123", displayName: "テスト" }),
    login: vi.fn(),
    closeWindow: vi.fn(),
  },
}));
```

- `LiffProvider` の「初期化中／失敗／成功」「ログイン要求」の分岐を網羅。
- LINE 固有 API（`scanCodeV2` 等）は `isApiAvailable` が false の代替 UI も必ずテスト。

### サーバ側のテスト（重要）

- **ID トークン検証**：LINE の `verify` エンドポイントをモックし、正常／改ざん／期限切れの分岐を検証。
- **Webhook 署名検証**：正しい署名・誤った署名・署名なしのリクエストでハンドラの挙動を検証（誤りは 401）。
- **Flex Message 生成**：データ → Flex JSON 関数を、スナップショット or 構造アサーションでテスト。
- **Supabase ブリッジ**：LINE userId のマッピング、新規作成 / 既存引き当ての分岐。

### Webhook のローカルテスト

- ローカルの Webhook ハンドラを **ngrok 等で公開**し、Messaging API チャネルの Webhook URL に一時設定して実イベントを受ける。
- LINE Developers Console の **Webhook 検証**ボタンで疎通確認。
- イベント JSON を保存しておき、ユニットテストのフィクスチャに使う。

### e2e-usecase-tester（Phase 16）向け

- LIFF アプリの売上直結フロー（利用開始 → ログイン → コア操作 → 完了）を、**外部ブラウザで動く範囲**で Playwright 化。
- LINE 内固有（トークへの送信、QR スキャン）はシナリオに「実機手動確認」として明記し、`docs/41-test-results/usecase-e2e-*.md` にカバレッジと手動確認項目を残す。

---

## Part 2: セキュリティチェックリスト

LIFF / ミニアプリ案件のレビュー（implementation-reviewer / line-platform-specialist）で必ず通す。

### トークン・認証

- [ ] サーバで使うユーザー情報は **ID トークン／アクセストークンをサーバ検証**して得ている
- [ ] `liff.getProfile()` / `getDecodedIDToken()` の結果をフロントからサーバへ送って認可判断に使っていない
- [ ] `verify` の `client_id` が LIFF アプリの属するチャネル ID と一致
- [ ] ID トークンの署名・有効期限・`aud` を検証している（LINE の verify エンドポイント or 自前検証）
- [ ] アクセストークンは「アプリを閉じると失効」する前提で設計されている

### シークレット管理

- [ ] フロントに出てよいのは `NEXT_PUBLIC_LIFF_ID` のみ
- [ ] チャネルシークレット・チャネルアクセストークン・Supabase `service_role`/`secret`・JWT シークレットが**サーバ専用**
- [ ] シークレットがリポジトリ・JS バンドル・ログに混入していない
- [ ] チャネルを複数使う場合、環境変数名で取り違えを防いでいる

### Webhook

- [ ] `x-line-signature` を**生ボディ**で HMAC-SHA256 検証している
- [ ] 署名比較がタイミング安全（`crypto.timingSafeEqual`）
- [ ] 検証失敗時に 401 で拒否し、イベントを処理しない
- [ ] `webhookEventId` で冪等化（再送対策）

### データ・認可

- [ ] Supabase の全テーブルで RLS が有効、本人データのみ操作可
- [ ] `service_role`/`secret` を使う特権操作がサーバの Route Handler / Edge Function に閉じている
- [ ] `line_user_id` にユニーク制約があり、なりすまし登録ができない

### 通信・その他

- [ ] すべて HTTPS（LIFF は HTTP 不可）
- [ ] 外部 URL を開く時は `liff.openWindow`、`postMessage` 等で受け取る値を検証
- [ ] LIFF SDK のバージョンが固定され、定期更新の運用がある
- [ ] LINE Messaging API の無料枠超過による配信停止のリスクを把握

### よくある脆弱性

1. **フロントの `userId` を信用**：`getProfile().userId` を送って「この人のデータ」と判断 → なりすまし。トークン検証必須
2. **Webhook 署名なし**：偽の `follow` / `message` イベントを注入される
3. **チャネルアクセストークンをフロントに同梱**：公式アカウントを乗っ取られる
4. **検証を `getDecodedIDToken()` で済ます**：クライアントのデコードは改ざん検知にならない
5. **`service_role` キーを LIFF アプリに置く**：RLS を全バイパスされる
