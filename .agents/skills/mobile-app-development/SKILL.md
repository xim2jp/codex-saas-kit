---
name: mobile-app-development
description: Android / iOS ネイティブアプリを Expo + React Native（TypeScript）で高品質に開発・テスト・ストア公開するための知識集。野口さんの Web SaaS スタック（Supabase + Stripe）を再利用しつつ、Expo Router・EAS Build/Submit/Update・Jest/RN Testing Library/Maestro・App Store / Google Play 申請までを網羅する。実装フェーズ（Phase 11）・テストフェーズ（Phase 12）・本番公開で参照する。「モバイルアプリ」「iOSアプリ」「Androidアプリ」「React Native」「Expo」「アプリストア」「EAS」で起動。
---

# Mobile App Development Skill

Android と iOS の**ネイティブアプリを 1 コードベースで高品質に量産**するための知識集。野口さんの SaaS 量産戦略を、Web からモバイルへ拡張する基盤 Skill。

**主軸スタック：Expo SDK + React Native（New Architecture）+ TypeScript。** Web 側（Next.js + Supabase + Stripe）の資産・型・ドメインロジックを最大限再利用する。

> この Skill が前提とする方式選定の結論は [tech-stack-architect](#tech-stack-architect) 節を参照。Flutter / フルネイティブ（Kotlin・Swift）を選ぶ案件では本 Skill は適用外で、その旨を ADR に明記する。

## いつこの Skill を参照するか

以下の場面で必ず読む：

- **技術スタック選定**（Phase 3）：モバイル要件がある案件で Expo/RN の採否を ADR 化する時
- **外部設計**（Phase 5）：画面遷移・ナビゲーション・プッシュ通知・ディープリンク設計時
- **内部設計**（Phase 7）：プロジェクト構造・状態管理・データ層・オフライン設計時
- **テスト計画**（Phase 9）：モバイル特有のテストピラミッド・端末マトリクス策定時
- **実装**（Phase 11）：Expo プロジェクトのコードを書く時（implementation-worker / mobile-app-specialist）
- **テスト**（Phase 11-12）：Jest / RN Testing Library / Maestro でのテスト実装・実行時
- **本番公開**：EAS Build / Submit、App Store / Google Play 申請、OTA 配信設計時
- **レビュー**（Phase 14）：モバイル実装・テスト・公開準備の妥当性検証時

## 重要原則（必読）

### 1. Expo を「使わない理由がない限り」標準採用する

かつての「Expo は制約が多い」は過去の話。**Dev Client（Custom Development Build）**により任意のネイティブモジュールを組み込め、**Expo Prebuild** で `ios/` `android/` ディレクトリを継続生成（CNG = Continuous Native Generation）できる。EAS（Expo Application Services）がビルド・署名・ストア提出・OTA 更新をクラウドで肩代わりするため、**1 名運用でも macOS マシンや Xcode/Gradle の運用なしに iOS/Android を出荷できる**。

> **基本方針：野口さんスタックでは「Expo（Dev Client + EAS）」を標準とする。bare React Native への eject は最終手段。**

### 2. New Architecture は必須・前提

Expo SDK 55 以降は **New Architecture（Fabric レンダラ + TurboModules + JSI）が常時有効で無効化できない**。採用するサードパーティライブラリは New Architecture 対応のものに限定する（[React Native Directory](https://reactnative.directory/) で対応状況を確認）。SDK 56 からは Hermes v1 が既定エンジン。

> **基本方針：ライブラリ選定時に必ず New Architecture 互換を確認する。非対応ライブラリは採用しない。**

### 3. SDK バージョンは保守的に固定し、計画的に上げる

Expo SDK は年数回メジャーが出る。**プロジェクトでは最新安定版にピン留めし、`beta` は本番採用しない**。アップグレードは `npx expo install expo@latest --fix` + Expo の公式アップグレードガイドに従い、専用ブランチで実施。SDK は最大 1 年程度でサポート外になるため、放置しない。

### 4. ストアの IAP（アプリ内課金）規約を最初に設計へ織り込む

**アプリ内で消費されるデジタルコンテンツ・サブスクは、Apple / Google の IAP を経由しなければストア審査でリジェクトされる**（Stripe で課金してはいけない）。物理商品・実世界サービスは Stripe で課金してよい。野口さんの SaaS サブスクをモバイルで売る場合は **RevenueCat（IAP のラッパー）** を使い、Web 課金（Stripe）とエンタイトルメントを統合する。詳細は `references/supabase-stripe-mobile.md`。

> **基本方針：課金モデルは要件定義の段階で「IAP 対象か Stripe 対象か」を必ず切り分ける。後から変えると審査落ち・設計やり直しになる。**

### 5. シークレットを安全に扱う（モバイルは「全部見られる」前提）

配布されたアプリバイナリは**逆コンパイル可能**。`service_role` キー・Stripe シークレット・任意の管理者権限トークンを**アプリに同梱しない**。Supabase は publishable（公開可）キーのみをアプリに置き、特権操作は Edge Function / サーバ経由。セッショントークン等の機微情報は `expo-secure-store`（iOS Keychain / Android Keystore）に保存する。詳細は `references/native-capabilities.md`。

### 6. ユーザー視点・プラットフォーム規約を尊重した UI

iOS は Human Interface Guidelines、Android は Material Design に沿う。**WebView でサイトを表示しただけのアプリは Apple に確実にリジェクトされる**。タッチターゲット最小 44pt、システムフォントスケール尊重、ダークモード対応、Safe Area 対応は必須。詳細は `references/ui-accessibility-performance.md`。

### 7. テストは「Unit/Component は Jest、E2E は Maestro」

モバイルのテストピラミッド：**Jest 30 + React Native Testing Library** でユニット・コンポーネントテスト、**Maestro**（YAML ベース）で実機/シミュレータの E2E。`react-test-renderer` は非推奨なので使わない。CI ではユニットを先に、E2E を後に走らせる。詳細は `references/testing-strategy.md`。

### 8. リリースは EAS の 3 本柱を分けて使う

- **EAS Build**：クラウドでネイティブビルド（`development` / `preview` / `production` プロファイル）
- **EAS Submit**：App Store Connect / Google Play へ自動提出
- **EAS Update**：JS バンドルの OTA 更新（**ネイティブコードを変えない修正のみ**。ネイティブ変更時はストア再申請が必要）

> **基本方針：OTA で「審査を回避してネイティブ機能を入れる」ことはしない（規約違反）。OTA はバグ修正・JS レベルの改善に限定する。**

## この Skill の構成

```
mobile-app-development/
├── SKILL.md                              # 本ファイル
└── references/
    ├── setup-and-tooling.md              # Expo プロジェクト初期化、Dev Client、eas.json、Web 資産共有
    ├── architecture-patterns.md          # Expo Router、ディレクトリ構造、状態管理、データ層、オフライン
    ├── supabase-stripe-mobile.md         # Supabase Auth on RN、IAP/RevenueCat、Stripe との切り分け
    ├── native-capabilities.md            # プッシュ通知、ディープリンク、生体認証、権限、SecureStore、カメラ等
    ├── ui-accessibility-performance.md   # プラットフォーム UX、アクセシビリティ、ダークモード、性能最適化
    ├── testing-strategy.md               # Jest 30 + RN Testing Library + Maestro、端末マトリクス、CI
    └── store-release.md                  # EAS Build/Submit/Update、App Store/Play 申請、審査リジェクト回避
```

## エージェント別の使い方ガイド

### tech-stack-architect

モバイル要件のある案件で、方式選定を `docs/11-tech-stack/adr/NNNN-mobile-stack.md` に記録：

- **方式選定の判断軸**：
  - 既存 Web 資産（TypeScript・Supabase・ドメインロジック）の再利用 → **Expo/RN 有利**
  - 1 名運用での保守コスト最小化 → **Expo/RN 有利**（1 コードベース）
  - 極限のネイティブ性能・最新 OS API 即対応・重量級 3D/AR → ネイティブ検討
  - 既存に Flutter/Dart 資産がある → Flutter 検討
- **野口さん標準**：Expo（Dev Client + EAS）+ React Native + TypeScript
- ADR には「IAP 対象の課金があるか」「対応 OS バージョン下限」「対象端末」を必ず明記
- `references/setup-and-tooling.md` の前提条件（Apple Developer Program $99/年、Google Play $25 一度）を費用としてユーザーに提示

### external-designer

- 画面一覧に**ネイティブ特有の画面**を含める：オンボーディング、権限リクエスト画面、プッシュ通知許諾、生体認証、オフライン状態表示、アプリ更新導線
- 画面遷移図は **Expo Router のファイルベース構造**（タブ / スタック / モーダル）にマッピング
- ディープリンク / ユニバーサルリンクの URL スキーム設計を `references/native-capabilities.md` に従って明記
- 課金画面は IAP（RevenueCat Paywall）か Stripe かを `references/supabase-stripe-mobile.md` に従って切り分け

### internal-designer

- `references/architecture-patterns.md` に従いプロジェクト構造（`app/` ルーティング、`src/` 機能別）を設計
- 状態管理（Zustand）・サーバ状態（TanStack Query）・ローカル永続化（MMKV）・オフライン戦略を設計
- Web とのコード共有層（`packages/shared` 等の型・Zod スキーマ・API クライアント）を設計

### test-planner / tester

- `references/testing-strategy.md` のモバイル版テストピラミッドを採用
- Unit/Component（Jest + RN Testing Library）、E2E（Maestro）の比率と対象を計画
- 端末マトリクス（iOS/Android の OS バージョン・画面サイズ）を `docs/40-test-plan/test-strategy.md` に明記
- ネイティブ権限・プッシュ通知・ディープリンク・オフラインのテスト観点を網羅

### e2e-usecase-tester（Phase 12）

- モバイルアプリ案件では Web の Playwright に代えて、または加えて **Maestro フロー**でユースケース E2E を実装
- `references/testing-strategy.md` の Maestro パターンに従い `.maestro/` 配下にフローを生成
- 新規登録・ログイン・課金（IAP サンドボックス）・退会の実機/シミュレータ通しテスト

### implementation-worker

- `references/setup-and-tooling.md` でプロジェクト初期化
- `references/architecture-patterns.md` のディレクトリ・命名規約を厳守
- New Architecture 非対応ライブラリを入れない
- シークレットをアプリに同梱しない（原則 5）

### implementation-reviewer

- New Architecture 互換、シークレット同梱の有無、IAP/Stripe 切り分け、a11y、`references/store-release.md` の審査リジェクト要因を確認
- EAS の `production` プロファイルとバージョニング設定の妥当性を確認

### mobile-app-specialist（専任エージェント）

モバイル開発・実機テスト・ストア申請を横断的に担当。詳細は `agents/mobile-app-specialist.md` 参照。本 Skill 全体を必読とする。

### auth-integration-specialist / payment-integration-specialist

- 認証：`references/supabase-stripe-mobile.md` のモバイル版 Supabase Auth（SecureStore セッション、OAuth のディープリンクコールバック、Sign in with Apple 必須要件）を参照
- 決済：同ファイルの IAP / RevenueCat / Stripe 切り分けを参照。**iOS でデジタル課金を Stripe で実装すると審査落ち**するため、両 specialist は必ず連携する

## 参照ファイルの読み方

| ファイル | 必読タイミング |
|---------|--------------|
| `setup-and-tooling.md` | プロジェクト初期化時、EAS セットアップ時、SDK アップグレード時 |
| `architecture-patterns.md` | 内部設計時、実装開始時（必読） |
| `supabase-stripe-mobile.md` | 認証・課金の設計/実装時（IAP 規約は要件定義時にも） |
| `native-capabilities.md` | プッシュ通知・ディープリンク・権限・生体認証・センサー実装時 |
| `ui-accessibility-performance.md` | UI 実装時、性能課題が出た時、a11y 要件がある時 |
| `testing-strategy.md` | テスト計画時、テスト実装時、CI 設定時 |
| `store-release.md` | ストア申請準備時、EAS Submit/Update 設定時、審査リジェクト対応時 |

## 野口さん固有のチェック

- [ ] モバイル方式を ADR 化（Expo/RN 採用、または非採用の理由を明記）
- [ ] Apple Developer Program（$99/年）/ Google Play Console（$25 一度）の費用をユーザーに事前提示
- [ ] 一括払い前提・民事再生中の財務制約 → 年額課金が発生する Apple Developer Program の更新を運用コストに計上
- [ ] デジタルサブスクは IAP（RevenueCat）、物理/サービスは Stripe を要件定義で切り分け済み
- [ ] Web（Next.js）と型・Zod スキーマ・ドメインロジックを共有する構成になっている
- [ ] Supabase は publishable キーのみアプリ同梱、特権操作は Edge Function 経由
- [ ] 1 名運用前提：対応 OS バージョン下限を引き上げて検証端末数を絞る
- [ ] EAS の無料枠・課金プランを把握（ビルド本数で課金が発生）
- [ ] Google Play 個人アカウントの場合、公開前テスト（20 名 / 14 日連続）の要件を計画に織り込み済み

## SaaS 量産戦略への貢献

### Web とモバイルの 1 ソース化

複数 SaaS を量産するため、Web（Next.js）とモバイル（Expo）で**共有可能な層をパッケージ化**：

- `packages/shared`：ドメイン型、Zod スキーマ、定数、ユーティリティ
- `packages/api-client`：Supabase クライアント生成、データアクセス関数
- 認証・課金のエンタイトルメント判定ロジック

将来的に `@noguchi/saas-mobile`（Expo テンプレート）として再利用可能化（ROADMAP Phase 3 と整合）。

### 売上直結フローをモバイルでも保証

- **新規登録**：OAuth（ディープリンクコールバック）→ プロフィール → ホーム
- **課金成功**：Paywall（RevenueCat）→ IAP 購入 → エンタイトルメント反映
- **退会**：アカウント削除 → サブスク扱い（ストア解約導線の案内）→ データ論理削除

これらは Maestro の E2E で必ずガードする（Phase 12）。

## アンチパターン（よくある失敗）

1. **iOS のデジタルサブスクを Stripe で実装**：App Store 審査で確実にリジェクト。IAP / RevenueCat を使う
2. **WebView でサイトを表示しただけのアプリ**：Apple にリジェクトされる。ネイティブ価値を持たせる
3. **`service_role` キーやサーバシークレットをアプリに同梱**：逆コンパイルで漏洩
4. **New Architecture 非対応ライブラリを採用**：SDK 55+ で動かない
5. **`react-test-renderer` でコンポーネントテスト**：非推奨。RN Testing Library を使う
6. **OTA（EAS Update）でネイティブ機能を後入れ**：ストア規約違反。OTA は JS レベルの修正のみ
7. **`expo` SDK の `beta` を本番採用**：安定版にピン留めする
8. **権限（カメラ・位置・通知）を起動時に一括要求**：iOS で嫌われる。文脈が生じた時に要求
9. **アプリ内課金画面を自前で作り込む**：RevenueCat の Paywall / ストアの仕組みに乗る
10. **Safe Area / ノッチ / ダイナミックアイランドを無視**：UI が切れる。`react-native-safe-area-context` を使う
11. **画像リストを `ScrollView` + `map` で描画**：メモリ枯渇。`FlatList` / `FlashList` を使う
12. **ストア申請メタデータ（プライバシー、データセーフティ）を後回し**：審査で止まる。設計時から準備
13. **検証を全部シミュレータで済ませる**：プッシュ通知・生体認証・カメラ・課金は実機必須
14. **iOS 専用 / Android 専用機能を `Platform` 分岐なしで実装**：もう一方でクラッシュ

## 関連 Skill

- `auth-integration`：Supabase Auth の前提知識（モバイル差分は本 Skill の `supabase-stripe-mobile.md`）
- `stripe-integration`：Web 課金の前提知識（モバイル IAP との切り分けは本 Skill）
- `e2e-browser-testing`：Web の E2E（Playwright）。モバイルは Maestro に置き換え／併用
- `sdlc-toolkit`：成果物配置、レビュー方法論、技術スタック Tier
