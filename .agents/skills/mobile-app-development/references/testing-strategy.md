# テスト戦略（モバイル）

Expo / React Native アプリのテストピラミッド、ツール選定、端末マトリクス、CI 連携。

## モバイル版テストピラミッド

```
        ╱╲        E2E（Maestro）— Critical ユースケースのみ 10〜20 本
       ╱──╲       実機/シミュレータで通しテスト
      ╱────╲      コンポーネントテスト（Jest + RN Testing Library）
     ╱──────╲     画面・UI 部品のユーザー視点テスト
    ╱────────╲    ユニットテスト（Jest）
   ╱──────────╲   ドメインロジック・フック・ユーティリティ
```

- **ユニット / コンポーネントを厚く、E2E を薄く。** E2E は遅く壊れやすいので Critical な業務フローに絞る。
- CI ではユニットを先に、E2E を後に走らせる（速いものから回し早期フィードバック）。

## ツール選定（2026 年の標準構成）

| 層 | ツール | 役割 |
|----|--------|------|
| ユニット / コンポーネント | **Jest 30** + **React Native Testing Library (RNTL)** | ロジック・フック・画面部品。Jest 30 はネイティブ TS 対応・高速 |
| E2E | **Maestro** | YAML ベース。実機/シミュレータでの通しテスト。セットアップが軽い |
| E2E（高度） | Detox（必要時のみ） | 複雑な同期制御が要る場合の選択肢。設定コストは高い |

- **`react-test-renderer` は使わない**（非推奨）。コンポーネントテストは RNTL。
- 野口さんスタックでは **Jest + RNTL + Maestro** を標準とする。Detox は原則使わない（1 名運用で保守しきれない）。

## ユニット / コンポーネントテスト（Jest + RNTL）

```bash
npx expo install -- --save-dev jest jest-expo @testing-library/react-native
```

`package.json`：

```jsonc
{
  "scripts": { "test": "jest", "test:watch": "jest --watch" },
  "jest": { "preset": "jest-expo" }
}
```

### ユニットテストの対象

- ドメインロジック、Zod スキーマ、純粋関数、フォーマッタ。
- カスタムフック（`@testing-library/react-native` の `renderHook`）。
- **Web と共有するロジック（`packages/shared`）はそちらで一度テストすれば足りる**。モバイル側で重複させない。

### コンポーネントテスト（ユーザー視点）

CSS セレクタ的な内部実装に依存せず、**ユーザーが見る・操作するもの**でクエリする。

```tsx
import { render, screen, userEvent } from "@testing-library/react-native";
import { SignInScreen } from "@/features/auth/SignInScreen";

test("メール未入力ならエラーを表示する", async () => {
  const user = userEvent.setup();
  render(<SignInScreen />);

  await user.press(screen.getByRole("button", { name: "ログイン" }));

  expect(screen.getByText("メールアドレスを入力してください")).toBeVisible();
});
```

- クエリ優先度：`getByRole` / `getByLabelText` / `getByText` ＞ `getByTestId`。
- `testID` は最後の手段。E2E（Maestro）の要素特定用に**安定したアクセシビリティ情報（label / role）を付ける**ことが、テスト容易性と a11y を同時に満たす。
- ネットワークは **MSW（`msw/native`）** または `jest.mock` でモック。Supabase / RevenueCat はラッパー越しにモックする。
- ナビゲーションが絡む画面は Expo Router のテスト用ユーティリティでルータをラップ。

### モック方針

- `expo-secure-store`、`expo-notifications`、`react-native-purchases` 等のネイティブモジュールは `jest.mock` でモック。
- 多くは `jest-expo` がモックを提供。足りない分は `__mocks__/` に置く。

## E2E テスト（Maestro）

Maestro は **YAML でフローを書く**。プログラミング不要で読みやすく、flaky になりにくい（自動待機を内蔵）。

```yaml
# .maestro/signup.yaml
appId: jp.co.example.myapp
---
- launchApp:
    clearState: true
- tapOn: "新規登録"
- tapOn:
    id: "email-input"          # accessibilityLabel / testID で特定
- inputText: "test+${timestamp}@example.com"
- tapOn:
    id: "password-input"
- inputText: "Passw0rd!"
- tapOn: "登録する"
- assertVisible: "ようこそ"      # ホーム到達を確認
```

```bash
maestro test .maestro/                 # フォルダ一括
maestro test .maestro/signup.yaml      # 個別
maestro studio                          # 対話的にフローを作成
```

- フローは `.maestro/` 配下に置き、ユースケース単位でファイル分割。
- **要素特定**：`accessibilityLabel` / `testID` を実装側に用意しておく（`ui-accessibility-performance.md` の a11y と両立する）。
- `clearState: true` でテスト独立性を担保。テストごとに一意なデータ（`${timestamp}` 等）を使う。
- 環境変数（`-e`）でテストユーザー・環境を差し替え。

### Critical な E2E ユースケース（SaaS 共通）

野口さんの売上直結フローは必ずカバーする：

- 新規登録（OAuth / メール）→ ホーム到達
- ログイン / ログアウト / 再ログイン
- 課金（**IAP サンドボックス**での購入 → エンタイトルメント反映）
- プロフィール編集
- 退会（アカウント削除 → サブスク解約案内の表示）
- プッシュ通知タップ → 該当画面遷移（ディープリンク）
- オフライン時の表示（要件にある場合）

## 端末・OS マトリクス

1 名運用では検証対象を絞る。要件で対応下限を決め、`docs/40-test-plan/test-strategy.md` に明記する。

| 区分 | 推奨カバレッジ |
|------|--------------|
| iOS | 対応最小バージョン + 最新。実機は最低 1 台（できれば旧端末も） |
| Android | 対応最小 API + 最新。**中位〜廉価端末を必ず 1 台**（性能の現実が見える） |
| 画面 | 小型（iPhone SE 級）/ 標準 / 大型・タブレット |

- **シミュレータ/エミュレータで十分なもの**：UI レイアウト、ナビゲーション、一般ロジック。
- **実機必須のもの**：プッシュ通知、生体認証、カメラ、IAP 購入、ディープリンクのコールド起動、性能計測。

## CI 連携

- **ユニット / コンポーネント（Jest）**：通常の CI（GitHub Actions）で毎 PR 実行。速い。
- **Maestro E2E**：
  - **Maestro Cloud**（マネージドの実機/仮想端末ファーム）で実行、または
  - **EAS Workflows** にビルド → E2E ジョブを組む（Expo 公式の CI/CD）。
- **EAS Build / Submit / Update も EAS Workflows でパイプライン化**できる（`store-release.md`）。
- 推奨フロー：`PR → Jest → preview ビルド → Maestro E2E → （main マージ）→ production ビルド → Submit`。

```yaml
# .github/workflows/test.yml（ユニット層の例）
name: test
on: [pull_request]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm test -- --ci --coverage
```

## SDLC との接続

- **Phase 9（test-planner）**：本ファイルのピラミッド・端末マトリクスで `test-strategy.md` / `test-cases.md` を作成。E2E は `e2e-scenarios.md` に Maestro フロー前提で記述。
- **Phase 11（tester）**：Jest + RNTL の Unit / Component を実装・実行。
- **Phase 12（e2e-usecase-tester）**：`.maestro/` にユースケース E2E を生成・実行し、`docs/41-test-results/usecase-e2e-*.md` にレポート。Web 案件の Playwright を Maestro に読み替える。
- **Phase 13（requirement-traceability-auditor）**：FunctionalID × Maestro フロー、業務フロー分岐 × E2E で突合。
- **Phase 14（implementation-reviewer）**：カバレッジ・E2E のブロッカー有無を確認。

## アンチパターン

- `react-test-renderer` でコンポーネントテストする（非推奨）
- E2E で全機能を網羅しようとする（遅い・壊れる。Critical に絞る）
- `testID` だらけにする（label / role を使い a11y と両立させる）
- 検証を全部シミュレータで済ませる（プッシュ・課金・生体は実機必須）
- 性能を Dev ビルドで計測する（production / preview ビルドで計測）
- 最新 iPhone だけで確認する（中位 Android を必ず入れる）
- テスト間でデータを共有する（`clearState` + 一意データで独立性確保）
