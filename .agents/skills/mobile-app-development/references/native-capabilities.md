# ネイティブ機能

プッシュ通知、ディープリンク、権限、生体認証、セキュアストレージ、センサー・カメラなど、モバイルならではの機能の実装指針。

## 権限（Permissions）の扱い方

**起動直後に権限をまとめて要求しない。** iOS では特に嫌われ、拒否率が上がる。

- **文脈が生じた瞬間に要求する**：通知は「リマインダー設定時」、カメラは「写真を撮るボタン押下時」、位置は「地図を開いた時」。
- 要求前に「なぜ必要か」を説明する画面（プリパーミング）を挟むと許諾率が上がる。
- iOS は権限の用途文字列（`NSCameraUsageDescription` 等）が**必須**。空だとクラッシュ／審査落ち。`app.config.ts` の config plugin で日本語の具体的な文言を設定する。
- 拒否されても**アプリが機能停止しない**フォールバックを用意。拒否後は OS 設定画面へ誘導（`Linking.openSettings()`）。

```ts
// 文脈に応じた要求の例
import * as ImagePicker from "expo-image-picker";

async function pickImage() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    // 説明 + 設定アプリへの導線を出す
    return;
  }
  // ...
}
```

## セキュアストレージ

| 用途 | API | 備考 |
|------|-----|------|
| トークン・暗号鍵・小さな機微値 | `expo-secure-store`（iOS Keychain / Android Keystore） | **2048 バイト上限**。大きい値は不可 |
| 高速 KV・設定・軽量キャッシュ | `react-native-mmkv`（暗号化可） | セッション JSON はここ＋鍵を SecureStore（`supabase-stripe-mobile.md`） |
| 構造化・オフラインデータ | `expo-sqlite` | Local-first（`architecture-patterns.md`） |

- **やってはいけない**：トークンを平文 `AsyncStorage` に保存、シークレットをソースに直書き、機微情報をログ出力。
- `AsyncStorage` は「機微でない」設定の保存にのみ使う。

## 生体認証

`expo-local-authentication` で Face ID / Touch ID / 指紋 / 顔認証を使う。

- 生体認証は**「再認証ゲート」**として使う（アプリ復帰時、機微画面の前）。**生体情報自体は取得・保存できない**（OS が結果の真偽だけ返す）。
- 生体認証だけを唯一のログイン手段にしない。OS 側で生体が未登録／失敗した場合のフォールバック（パスコード、再ログイン）を必ず用意。
- 機微なトークンを SecureStore に置く際、`requireAuthentication` 系オプションでアクセス時に生体を要求できる。

```ts
import * as LocalAuthentication from "expo-local-authentication";

async function authenticate(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !isEnrolled) return true; // 生体未対応端末はゲートを通す等の方針を決める
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "ロックを解除",
  });
  return result.success;
}
```

## プッシュ通知

`expo-notifications` を使う。Expo の Push サービス（EAS）が、iOS の APNs / Android の FCM への配信を仲介する。

**実装の流れ：**

1. **権限要求**（文脈に応じて）→ `Notifications.requestPermissionsAsync()`
2. **トークン取得** → `Notifications.getExpoPushTokenAsync()`（EAS Project ID 必須）
3. トークンを **Supabase に保存**（`device_tokens` テーブル、ユーザー × 端末）
4. サーバ（Edge Function 等）から Expo Push API、または直接 FCM / APNs へ送信
5. 受信ハンドラとタップ時の遷移を設定

```ts
import * as Notifications from "expo-notifications";

// フォアグラウンド受信時の表示方針
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// トークン取得
const token = (await Notifications.getExpoPushTokenAsync({
  projectId: Constants.expoConfig?.extra?.eas?.projectId,
})).data;
```

- **Android はチャンネル設定が必須**（`setNotificationChannelAsync`）。重要度・音・バイブを定義。
- **本番の高信頼配信**：規模が大きい・低遅延が要るなら FCM / APNs を直接叩く構成にする。小〜中規模・PoC は Expo Push サービスで十分。
- 検証は**実機必須**。シミュレータ／エミュレータではプッシュは原則届かない。
- iOS のバッジ・通知サウンド・Provisional 通知（許諾なしで静かに届く）も検討。

### 通知タップ → 画面遷移（ディープリンクと連携）

通知ペイロードに遷移先情報（`data.url` や `data.type` + `id`）を入れ、タップ時に Expo Router で遷移する。

```ts
// ルートレイアウトで通知レスポンスを購読
useEffect(() => {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url as string | undefined;
    if (url) router.push(url);
  });
  return () => sub.remove();
}, []);
```

- アプリ起動のきっかけになった通知は `getLastNotificationResponseAsync()` で初期表示時に拾う。

## ディープリンク / ユニバーサルリンク

2026 年現在、ディープリンクは「あれば良い」ではなく**基盤インフラ**。Firebase Dynamic Links は 2025 年 8 月に終了済みなので使わない。

### 2 種類のリンク

| 種類 | 形式 | 用途 |
|------|------|------|
| カスタムスキーム | `myapp://item/123` | アプリ間連携、OAuth コールバック |
| ユニバーサルリンク（iOS）/ App Links（Android） | `https://example.com/item/123` | Web と同じ URL でアプリを開く。**信頼性が高くこちらが本命** |

### 設定

- `app.config.ts` に `scheme`（カスタムスキーム）と `ios.associatedDomains` / `android.intentFilters` を設定。
- ユニバーサルリンク / App Links は**ドメイン所有の検証ファイル**が必要：
  - iOS：`https://example.com/.well-known/apple-app-site-association`
  - Android：`https://example.com/.well-known/assetlinks.json`
- Expo Router を使っていれば、**ファイル構造に一致する URL は自動でその画面に解決される**。`app/item/[id].tsx` があれば `https://example.com/item/123` がそのまま届く。
- 複雑な正規化（旧 URL → 新ルートのマッピング等）は `app/+native-intent.tsx` で吸収。

> **テスト**：`npx uri-scheme open myapp://item/123 --ios` 等で疎通確認。コールド起動・バックグラウンド起動の両方を実機で確認する。

## カメラ・メディア・センサー

| 機能 | Expo モジュール |
|------|----------------|
| 写真選択・撮影 | `expo-image-picker` / `expo-camera` |
| 画像表示（高速・キャッシュ） | `expo-image` |
| 位置情報 | `expo-location` |
| ファイル | `expo-file-system` |
| 連絡先・カレンダー | `expo-contacts` / `expo-calendar` |
| ハプティクス | `expo-haptics` |
| 端末情報 | `expo-device` / `expo-constants` |

- いずれも対応する権限と用途文字列が必要。
- 写真・大きな画像は `expo-image` でキャッシュし、メモリを節約。

## バックグラウンド処理

- `expo-task-manager` + `expo-background-task` で定期同期等。**OS が実行タイミングを決める**ので「正確な時刻に必ず動く」ことは保証されない。
- 確実な時刻起動が要るならローカル通知（スケジュール通知）かサーバ起点のプッシュを使う。
- iOS はバックグラウンド実行に厳しい。長時間処理を前提にしない。

## レビュー観点

- [ ] 権限を起動時一括ではなく文脈ごとに要求している
- [ ] iOS の権限用途文字列がすべて具体的な日本語で設定済み
- [ ] 権限拒否時のフォールバックと設定誘導がある
- [ ] トークン等が平文保存されていない（SecureStore / 暗号化 MMKV）
- [ ] 生体認証に未対応・失敗時のフォールバックがある
- [ ] プッシュトークンをユーザー × 端末で保存し、ログアウト時に失効させている
- [ ] Android の通知チャンネルが定義されている
- [ ] ユニバーサルリンク / App Links の検証ファイルがドメインに配置済み
- [ ] ディープリンクをコールド起動・バックグラウンド起動の両方で実機確認した
