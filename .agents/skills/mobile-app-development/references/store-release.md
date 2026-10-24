# ストアリリース（EAS Build / Submit / Update + 審査）

ビルドからストア公開、OTA 更新、審査リジェクト回避までの実務。

## EAS の 3 本柱

| サービス | 役割 |
|---------|------|
| **EAS Build** | クラウドでネイティブビルド（`.ipa` / `.aab`）。macOS / Xcode 不要 |
| **EAS Submit** | App Store Connect / Google Play Console へ自動提出 |
| **EAS Update** | JS バンドルの OTA（Over-The-Air）更新。**ネイティブを変えない修正のみ** |

## ビルド（EAS Build）

```bash
eas build --profile production --platform all
```

- プロファイルは `eas.json` の `development` / `preview` / `production`（`setup-and-tooling.md`）。
- 署名（iOS の証明書・プロビジョニング、Android の keystore）は **EAS に管理させる**のが楽。鍵は EAS 側で安全に保管される。
- iOS の `production` は `.ipa`、Android は **`.aab`（Android App Bundle）**。Google Play は新規アプリで `.aab` を必須とする。

### バージョニング

- **ユーザー向けバージョン（`1.2.0`）= SemVer**。ネイティブの再リリースが必要な変更でのみ上げる。
- **ビルド番号 / versionCode** は毎ビルドで自動増加（`autoIncrement: true`、`appVersionSource: "remote"` で EAS が一元採番）。
- **runtime version**：EAS Update の互換性判定キー。同じ runtime version のビルドにだけ OTA が当たる。ネイティブ構成が変わったら runtime version も変える。

## 提出（EAS Submit）

```bash
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

- 事前に各ストアの開発者アカウントと連携情報（App Store Connect API キー、Google Play サービスアカウント JSON）を設定。
- EAS Workflows に `submit` ジョブを組めば、ビルド → 提出を自動化できる。

## OTA 更新（EAS Update）

```bash
eas update --branch production --message "一覧画面のクラッシュ修正"
```

- **チャンネルとブランチ**：`eas.json` の各プロファイルに `channel`（`preview` / `production` 等）を設定し、Git ブランチと対応させる。`preview` チャンネルで先に配り、問題なければ `production` に昇格。
- **OTA で配ってよいもの**：JS / アセットの変更のみ（バグ修正、文言、UI 調整、JS レベルの機能改善）。
- **OTA で配ってはいけないもの**：ネイティブモジュールの追加・更新、権限の変更、SDK アップグレード → これらは**ストア再申請**が必要。
- **規約上の禁止**：OTA を使って「審査を回避して新しいネイティブ機能や別物のアプリに化けさせる」こと。OTA はあくまで提出済みバイナリの範囲内の改善に使う。
- **運用 tips**：production ビルドを出すたびに同じ runtime version の staging ビルドも作っておくと、本番に当てる前の OTA を本番同等環境で検証できる。

## App Store（iOS）の要件と審査

### アカウント・前提

- Apple Developer Program：**$99 / 年**（更新必須。失効するとアプリが消える）。
- App Store Connect でアプリ登録、メタデータ・スクリーンショット・アイコンを用意。

### 技術要件（2026 年）

- **2026 年 4 月 28 日以降、App Store Connect に提出するアプリは iOS/iPadOS 26 SDK 以降でビルド**されている必要がある（Expo SDK を最新に保てば満たせる）。
- **プライバシー**：App Store Connect の「App Privacy（プライバシー栄養表示ラベル）」で収集データを正確に申告。SDK は「Privacy Manifest（`PrivacyInfo.xcprivacy`）」を要求 — Expo / 主要ライブラリは対応済みだが、自前ネイティブには注意。
- 機微データを扱うならプライバシーポリシーを**公開 URL** でホストし、内容を実態と一致させる。

### よくあるリジェクト要因（回避必須）

1. **クラッシュ・バグ**（リジェクト要因の第 1 位）。審査員がクラッシュに当たれば即リジェクト。提出前に実機で全 Critical フローを通す。
2. **WebView だけのアプリ** / Web サイトの薄いラッパー。
3. **デジタル課金を IAP 以外（Stripe 等）で実装**（`supabase-stripe-mobile.md`）。
4. **他社 SNS ログインがあるのに Sign in with Apple がない。**
5. **アカウント作成できるのに削除導線がない。**
6. **権限の用途文字列が空・不明瞭。**
7. **未完成・プレースホルダ画面、ダミーデータ、リンク切れ。**
8. **メタデータ / スクリーンショットが実際の機能と不一致。**
9. **審査員がログインできない**（テスト用アカウントを審査メモに必ず記載。要 IAP のものはサンドボックス手順も）。

- 初回提出は約 4 割がリジェクトされる前提で、**チェックリストを通してから出す**。
- 審査期間の目安：iOS は数時間〜数日（初回は長め）。

## Google Play（Android）の要件と審査

### アカウント・前提

- Google Play Console：**$25（一度きり）**。
- 提出形式は **`.aab`（Android App Bundle）**。

### 技術要件（2026 年）

- **ターゲット API レベル**：新規・更新アプリは Google が定める最新付近の API レベルをターゲットにする必要がある。Expo SDK を最新に保てば満たせる。
- **データセーフティ（Data Safety）セクション**：収集・共有するデータの申告が**必須**。実態と一致させる。
- 機微データを扱うならプライバシーポリシーの公開 URL が必要。

### 個人開発者アカウントの公開前テスト要件（重要）

**個人（individual）の Google Play 開発者アカウントで新規にアプリを公開する場合、本番公開前に「20 名以上のテスターが 14 日間連続でテストに参加」する要件**がある。リリース計画に必ず織り込む（テスター集めに時間がかかる）。

- クローズドテスト → 本番、という段階を踏む。Internal testing / Closed testing トラックを活用。
- 法人（organization）アカウントでは要件が異なる。アカウント種別を事前に確認。

### よくあるリジェクト要因

- クラッシュ・ANR（応答なし）。
- データセーフティ申告と実挙動の不一致。
- 権限の過剰要求・用途不明。
- 不適切なコンテンツ、誤解を招くメタデータ。

- 審査期間の目安：数時間〜数日。更新は新規より速いことが多い。

## リリース前チェックリスト

### ビルド・構成

- [ ] `production` プロファイルでビルドが iOS / Android 両方成功
- [ ] バージョン（SemVer）とビルド番号の採番が正しい
- [ ] 本番の環境変数・API エンドポイントを指している（テスト環境を向いていない）
- [ ] シークレットがバイナリに含まれていない
- [ ] クラッシュ監視（Sentry 等）が本番ビルドで有効

### 品質

- [ ] 全 Critical ユースケースを**実機**で通した（クラッシュなし）
- [ ] プッシュ通知・ディープリンク・生体認証・IAP を実機で確認
- [ ] 中位 Android 端末でも操作が破綻しない
- [ ] アクセシビリティ（VoiceOver / TalkBack）を確認

### ストア・コンプライアンス

- [ ] アイコン・スプラッシュ・スクリーンショット（各サイズ）を用意
- [ ] プライバシーポリシーを公開 URL でホスト
- [ ] iOS：App Privacy ラベルを正確に申告
- [ ] Android：データセーフティを正確に申告
- [ ] デジタル課金が IAP（RevenueCat）で実装されている
- [ ] iOS：他社 SNS ログイン提供時に Sign in with Apple がある
- [ ] アカウント削除導線がある
- [ ] 審査員向けテストアカウント・手順を審査メモに記載
- [ ] Android 個人アカウント：公開前テスト（20 名 / 14 日）の計画がある

### 公開後

- [ ] EAS Update のチャンネル（preview → production）運用が決まっている
- [ ] クラッシュレート・レビューを監視する運用がある
- [ ] OTA で配れる範囲（JS のみ）/ 配れない範囲（ネイティブ）をチームで共有

## SDLC との接続

- ストア申請準備は **Phase 18 のレビュー後、デプロイ判断**の一部。implementation-reviewer / project-manager は本チェックリストで Go/No-Go を判定する。
- モバイル方式・対応 OS・課金方式は **Phase 7 の ADR**（`docs/11-tech-stack/adr/`）に記録済みであること。
