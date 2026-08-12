# セットアップとツーリング

Expo プロジェクトの初期化、開発ビルド（Dev Client）、EAS の構成、Web 資産との共有までの実務手順。

## 前提・アカウント

| 項目 | 内容 | 費用 |
|------|------|------|
| Expo アカウント | EAS 利用に必須 | 無料枠あり（ビルド本数で従量課金） |
| Apple Developer Program | iOS の実機配布・ストア公開に必須 | **$99 / 年（更新必須）** |
| Google Play Console | Android のストア公開に必須 | **$25 / 一度きり** |
| macOS マシン | EAS Build を使えば**不要**（クラウドビルド）。ローカルでネイティブビルドする場合のみ必要 | — |

> 野口さん固有：Apple の年額更新は民事再生中の財務制約上「毎年発生する固定費」として運用コストに計上する。失効するとアプリがストアから消える。

## SDK バージョン方針

- **最新の安定版にピン留め**する（2026年5月時点：Expo SDK 55 が安定版、SDK 56 はベータ）。
- `beta` は本番採用しない。検証ブランチでのみ試す。
- New Architecture は SDK 55+ で常時有効・無効化不可。
- アップグレードは専用ブランチで、Expo 公式アップグレードガイド + `npx expo install expo@latest --fix` に従う。
- SDK は概ね 1 年でサポート外。放置せず計画的に上げる。

## プロジェクト初期化

```bash
# 最新の推奨テンプレート（TypeScript + Expo Router + 既定の New Architecture）
npx create-expo-app@latest my-app

cd my-app

# 依存をプロジェクトの SDK に整合したバージョンで入れる（必ず expo install を使う）
npx expo install <package>

# 健全性チェック（SDK 整合・設定の問題を検出）
npx expo-doctor
```

> **重要**：依存追加は `npm install` ではなく **`npx expo install`** を使う。SDK と互換のバージョンが選ばれる。

## Expo Go vs Dev Client（Custom Development Build）

| | Expo Go | Dev Client |
|--|---------|-----------|
| 用途 | ごく初期のプロトタイプ | **実プロジェクトの標準** |
| ネイティブモジュール | Expo Go 同梱のものに限定 | 任意のネイティブモジュール可 |
| カスタムネイティブ設定 | 不可 | config plugin で可 |
| 本番との一致度 | 低い | 高い |

> **基本方針：実案件は最初から Dev Client を使う。** Expo Go で動いていたものが本番ビルドで動かない事故を避ける。

```bash
# Dev Client ビルドを EAS で作成
eas build --profile development --platform ios
eas build --profile development --platform android

# 開発サーバ起動（Dev Client 向け）
npx expo start --dev-client
```

## Continuous Native Generation（CNG）と Prebuild

Expo は `app.json` / `app.config.ts` と config plugin から `ios/` `android/` を生成する（CNG）。

- **`ios/` `android/` は原則 Git にコミットしない**（生成物）。`.gitignore` に追加。
- ネイティブ設定（権限文言、URL スキーム、スプラッシュ等）は **config plugin** で宣言する。
- どうしてもネイティブを直接編集する必要が出たら、その時点で「bare workflow に踏み出す判断」をユーザーに確認する。

```bash
# ローカルでネイティブプロジェクトを生成（確認・デバッグ用）
npx expo prebuild --clean
```

## eas.json（ビルドプロファイル）

```jsonc
{
  "cli": { "version": ">= latest", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",     // iOS: ad-hoc / Android: 共有可能な APK
      "channel": "preview",
      "ios": { "simulator": false }
    },
    "production": {
      "channel": "production",
      "autoIncrement": true,           // ビルド番号を自動採番
      "android": { "buildType": "app-bundle" }  // .aab（ストア提出形式）
    }
  },
  "submit": {
    "production": { /* App Store Connect / Play Console の認証情報を参照 */ }
  }
}
```

- **3 プロファイル運用**：`development`（Dev Client）/ `preview`（QA 配布）/ `production`（ストア提出）。
- `distribution: "internal"` は QA に強力。iOS は ad-hoc プロビジョニング、Android は共有リンク付き APK。
- `channel` は EAS Update（OTA）の配信先と対応させる（`references/store-release.md`）。
- `appVersionSource: "remote"` でバージョン採番を EAS に一元管理させると、複数人・CI でも事故りにくい。

## 環境変数・設定

- クライアントに埋め込んでよい値（Supabase publishable キー、API のベース URL 等）は `EXPO_PUBLIC_` プレフィックスの環境変数で扱う。**`EXPO_PUBLIC_` はバイナリに埋め込まれる＝公開情報**として扱う。
- シークレット（`service_role`、Stripe シークレット等）は**アプリに置かない**。EAS の Secrets はビルド時にのみ使い、実行時にアプリへ露出させない。
- 環境ごとの差し替えは `app.config.ts`（JS で動的に組める）+ `APP_ENV` で行う。

```ts
// app.config.ts の例
export default ({ config }) => ({
  ...config,
  name: process.env.APP_ENV === "production" ? "MyApp" : "MyApp (Dev)",
  ios: { bundleIdentifier: "jp.co.example.myapp" },
  android: { package: "jp.co.example.myapp" },
  extra: { apiUrl: process.env.EXPO_PUBLIC_API_URL },
});
```

## Web 資産との共有（野口さんスタックの肝）

Web（Next.js）と型・スキーマ・ドメインロジックを共有して二重実装を避ける。

**選択肢 A：モノレポ（推奨・新規案件）**

```
repo/
├── apps/
│   ├── web/        # Next.js
│   └── mobile/     # Expo
└── packages/
    ├── shared/         # ドメイン型、Zod スキーマ、定数
    └── api-client/     # Supabase クライアント、データアクセス関数
```

- pnpm workspaces または npm workspaces + Turborepo。
- Metro（Expo のバンドラ）はモノレポ対応済み。`metro.config.ts` の `watchFolders` でワークスペース解決を有効化。

**選択肢 B：別リポジトリ + 共有 npm パッケージ**

- Web が既存で動いている既存案件向け。`@noguchi/saas-shared` 等を private npm or git submodule で共有。

> **共有してよいもの**：型、Zod スキーマ、定数、純粋なドメインロジック。
> **共有しないもの**：UI コンポーネント（DOM の `div` と RN の `View` は別物）、ルーティング、プラットフォーム固有 API。

## TypeScript・Lint・整形

- `tsconfig.json` は `expo/tsconfig.base` を継承。`strict: true`。
- ESLint は `eslint-config-expo`。
- 型付きルーティング（Expo Router の typed routes）を有効化し、リンク切れをコンパイル時に検出。

## 起動時チェックリスト（implementation-worker / mobile-app-specialist）

- [ ] `npx expo-doctor` が green
- [ ] Dev Client ビルドが iOS / Android 両方で起動する
- [ ] `eas.json` に development / preview / production の 3 プロファイル
- [ ] `ios/` `android/` が `.gitignore` 済み（CNG 運用）
- [ ] シークレットが `EXPO_PUBLIC_` に紛れていない
- [ ] New Architecture 前提でライブラリを選定（[reactnative.directory](https://reactnative.directory/) で確認）
- [ ] Web と共有する `packages/shared` の解決が Metro で通る
