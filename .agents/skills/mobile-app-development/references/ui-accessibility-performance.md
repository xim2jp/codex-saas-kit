# UI・アクセシビリティ・パフォーマンス

「高品質」を支える 3 本柱：プラットフォーム規約に沿った UI、アクセシビリティ、実機での性能。

---

## Part 1: プラットフォーム UX

### iOS / Android の規約を尊重する

- **iOS**：Human Interface Guidelines（HIG）。Apple は審査でデザイン品質を見る。
- **Android**：Material Design（Material 3）。
- 「両 OS で完全に同じ見た目」を目指さない。**戻る操作、共有シート、日付ピッカー、スイッチの見た目**などはプラットフォーム標準に寄せると馴染む。
- `Platform.select()` / `Platform.OS` で差分を明示的に扱う。OS 固有の値を分岐なしで使うともう一方でクラッシュする。

> **絶対にやってはいけない**：WebView でサイトを表示しただけのアプリ。Apple に確実にリジェクトされる。ネイティブ UI・ネイティブ機能で価値を出す。

### UI コンポーネントの選択

| 方針 | 内容 |
|------|------|
| 標準 + デザインシステム | `react-native` プリミティブ（`View` `Text` `Pressable`）+ 自前トークンで構築。最も制御しやすい |
| Expo UI | SDK 56 以降、SwiftUI（iOS）/ Jetpack Compose（Android）のネイティブ UI を React から使える。プラットフォーム純正の見た目 |
| コンポーネントライブラリ | Tamagui、gluestack、React Native Paper（Material）等。量産時の初速が出る |

- 野口さんの量産戦略では、**自前トークン + 薄い共通コンポーネント層**（`src/components/ui/`）を整え、案件間で再利用するのが基本。
- どれを選ぶにせよ **New Architecture 対応**を確認。

### レイアウトの必須事項

- **Safe Area**：`react-native-safe-area-context` の `useSafeAreaInsets()` / `SafeAreaView` でノッチ・ダイナミックアイランド・ホームインジケータを避ける。これを怠ると UI が切れる。
- **タッチターゲット最小 44×44pt**（iOS）/ 48×48dp（Android）。小さいボタンは `hitSlop` で当たり判定を広げる。
- **キーボード回避**：`KeyboardAvoidingView` または `react-native-keyboard-controller` で入力欄がキーボードに隠れないように。
- **画面サイズの幅**：小型 SE 〜 大型タブレットまで。固定 px を避け、Flexbox とパーセンテージ、`Dimensions` / `useWindowDimensions()` で適応。
- **ダークモード**：`useColorScheme()` でライト／ダークを出し分け。2026 年は多くのユーザーがダークモードを常用。`app.config.ts` の `userInterfaceStyle: "automatic"`。
- **スプラッシュ → コンテンツ**の遷移：`expo-splash-screen` で、初期データ・フォント読込が終わるまでスプラッシュを維持し、チラつきを防ぐ。

---

## Part 2: アクセシビリティ（a11y）

アクセシビリティは「対応すると良い」ではなく**品質要件・法令要件**。EU アクセシビリティ法（European Accessibility Act）は 2025 年 6 月 28 日施行済みで、EU 向けに配布するなら対象になりうる。

### 必須対応

- **スクリーンリーダー対応**（iOS VoiceOver / Android TalkBack）：
  - 操作可能な要素に `accessibilityLabel`（読み上げ名）と `accessibilityRole`（`button` `link` `header` `image` 等）を付ける。
  - `accessibilityHint` で操作結果を補足。
  - 装飾用の要素は `accessibilityElementsHidden` / `importantForAccessibility="no"` で読み飛ばす。
  - アイコンのみのボタンは必ずラベルを付ける（読み上げると無音になる）。
- **コントラスト比**（WCAG 2.2）：通常テキスト 4.5:1 以上、大きいテキスト 3:1 以上。
- **動的フォントサイズ**：フォントサイズをハードコードせず、OS のフォントスケール設定を尊重する（`allowFontScaling` を無効化しない／レイアウトを文字拡大に耐える設計に）。
- **タッチターゲット**：44pt 以上（上述）。
- **色だけに依存しない**：状態（エラー・成功）を色のみで伝えず、アイコン・テキストも併用。
- **フォーカス順序・モーダル**：モーダル表示時にフォーカスを閉じ込め、背景を読み上げ対象から外す。
- **Reduce Motion**：`AccessibilityInfo.isReduceMotionEnabled()` を尊重し、過剰なアニメーションを抑制。

```tsx
<Pressable
  accessibilityRole="button"
  accessibilityLabel="お気に入りに追加"
  accessibilityHint="この項目をお気に入り一覧に保存します"
  hitSlop={8}
  onPress={onFavorite}
>
  <HeartIcon />
</Pressable>
```

### 検証

- 実機で VoiceOver / TalkBack を実際に有効化して操作する。
- iOS の Accessibility Inspector、Android の Accessibility Scanner を使う。
- 文字を最大サイズにしてレイアウト崩れがないか確認。

---

## Part 3: パフォーマンス

「高品質」の体感はほぼ性能で決まる。**3 秒で半数のユーザーが離脱**する。

### リスト描画（最頻出のボトルネック）

- **`ScrollView` + `map` で大量項目を描画しない**：全要素をマウントしメモリが枯渇する。
- **`FlatList`**：仮想化でメモリほぼ一定。`keyExtractor`、`getItemLayout`（固定高さ時）、適切な `windowSize` を設定。
- **`@shopify/flash-list`**：FlatList より高速。大規模・複雑なリストはこちらを推奨。
- リストアイテムは `React.memo` 化し、`renderItem` 内でインライン関数・インラインスタイルを毎回生成しない。

### 再レンダリング・JS スレッド

- **React Compiler**：有効化すると自動メモ化され、手書きの `useMemo` / `useCallback` を大幅に減らせる。Expo の新しい SDK で利用可。
- グローバル状態を `Context` で配らない（`architecture-patterns.md`）。
- 重い計算は `useMemo`、または別スレッド（後述）へ。

### アニメーション

- **`react-native-reanimated`** を使い、アニメーションを **UI スレッド（worklet）** で動かす。JS スレッドが詰まってもカクつかない。
- ジェスチャは `react-native-gesture-handler`。
- `Animated`（旧 API）の `useNativeDriver: true` を最低限使う。レイアウト系プロパティのアニメーションは避ける。

### 画像

- `expo-image` を使う（キャッシュ、プレースホルダ、`contentFit`）。
- 適切な解像度の画像を配信する。巨大画像をそのまま表示しない。
- アイコンはベクター（`@expo/vector-icons` / SVG）。

### 起動時間・バンドル

- New Architecture + Hermes（SDK 56 で Hermes v1 が既定）でコールド起動が大きく改善。
- 初期画面に不要なモジュールを import しない（コード分割・遅延読込）。
- スプラッシュ中に必要最小限のデータだけ読み込み、残りは画面表示後に。
- `npx expo-atlas` 等でバンドル構成を可視化し、肥大した依存を発見する。

### 計測

- **体感ではなく計測する**。React DevTools Profiler、Flipper / 新しい RN DevTools、Reanimated のパフォーマンスモニタ。
- **必ず production ビルド（または preview ビルド）の実機で計測する**。Dev Client / 開発モードは遅く、判断を誤る。
- 端末は「中位〜廉価 Android」で確認する。最新 iPhone だけで見ると低スペック端末の遅さを見落とす。

---

## レビュー観点

- [ ] Safe Area が全画面で考慮されている（UI 切れがない）
- [ ] タッチターゲットが 44pt 以上 / `hitSlop` で補正
- [ ] ダークモード対応、システムフォントスケール尊重
- [ ] WebView だけのアプリになっていない
- [ ] 操作要素に `accessibilityLabel` / `accessibilityRole` がある
- [ ] アイコンのみのボタンにラベルがある
- [ ] コントラスト比が WCAG 2.2 を満たす
- [ ] 長いリストが FlatList / FlashList で仮想化されている
- [ ] アニメーションが Reanimated（UI スレッド）で実装されている
- [ ] production / preview ビルドの実機（中位 Android 含む）で性能確認した
