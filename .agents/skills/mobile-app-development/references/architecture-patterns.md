# アーキテクチャパターン

Expo Router を中核とした、プロジェクト構造・ナビゲーション・状態管理・データ層・オフライン戦略。

## プロジェクトディレクトリ構造

```
mobile/
├── app/                      # Expo Router のルート（ファイル = ルート）
│   ├── _layout.tsx           # ルートレイアウト（Provider 群、認証ガード）
│   ├── (auth)/               # 未ログイン向けグループ
│   │   ├── _layout.tsx
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (app)/                # ログイン後グループ
│   │   ├── _layout.tsx       # 認証ガード（未ログインなら (auth) へ）
│   │   ├── (tabs)/           # タブナビゲーション
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx     # ホーム
│   │   │   └── settings.tsx
│   │   └── item/[id].tsx     # 動的ルート
│   ├── +not-found.tsx        # 404
│   └── +native-intent.tsx    # ディープリンクの正規化（任意）
├── src/
│   ├── components/           # 再利用 UI（ui/ = プリミティブ、feature 別）
│   ├── features/             # 機能単位（hooks・API・型をコロケーション）
│   ├── lib/                  # supabase / revenuecat / notifications クライアント
│   ├── hooks/                # 汎用フック
│   ├── stores/               # Zustand ストア
│   └── theme/                # カラー・タイポ・スペーシングのトークン
├── assets/                   # 画像・フォント・アイコン
├── .maestro/                 # E2E フロー（testing-strategy.md 参照）
├── app.config.ts
└── eas.json
```

> **原則**：`app/` には**ルーティングだけ**を置き、画面の中身は `src/features/` の実体を import する薄い構成にすると、ルーティングとロジックが分離されてテスト・再利用しやすい。

## Expo Router（ファイルベースルーティング）

Next.js App Router に近い思想。**ファイル構造がそのままナビゲーション構造**になり、ディープリンクが標準で機能する。

- **グループ `(name)`**：URL に出ない論理グループ。認証前後の出し分けに使う。
- **動的ルート `[id].tsx`**：パラメータは `useLocalSearchParams()` で取得。
- **レイアウト `_layout.tsx`**：`<Stack>` / `<Tabs>` / `<Drawer>` を宣言。Provider の設置場所。
- **typed routes** を有効化し、`<Link href>` / `router.push()` の不正パスをコンパイル時に検出。

```tsx
// app/_layout.tsx — Provider とスプラッシュ制御の定番形
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

### 認証ガード

ログイン状態でルートグループを出し分ける。`(app)/_layout.tsx` でセッションを確認し、未ログインなら `(auth)` にリダイレクトする。`Stack.Protected`（新しめの API）またはレイアウトでの `<Redirect>` を使う。

```tsx
// app/(app)/_layout.tsx
import { Redirect, Stack } from "expo-router";
import { useSession } from "@/features/auth/useSession";

export default function AppLayout() {
  const { session, isLoading } = useSession();
  if (isLoading) return null;              // スプラッシュ維持
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  return <Stack />;
}
```

## ナビゲーションパターン

| パターン | 使いどころ |
|---------|-----------|
| Stack | 階層的な「進む / 戻る」。詳細画面など |
| Tabs（Bottom Tabs） | アプリの主要セクション切り替え（3〜5 個） |
| Modal（`presentation: "modal"`） | 作成・編集・確認など一時的な作業 |
| Drawer | 項目が多い管理系。B2C ではタブを優先 |

- 戻る挙動・Android のハードウェアバックキーは Expo Router が処理。独自に握る場合のみ `BackHandler`。
- ディープリンク・プッシュ通知からの遷移は `references/native-capabilities.md` を参照。

## 状態管理

レイヤを混同しない。**「サーバ状態」と「クライアント状態」を分けるのが最重要**。

| 種類 | 推奨 | 例 |
|------|------|-----|
| サーバ状態（API データ） | **TanStack Query** | 一覧、詳細、ユーザープロフィール |
| クライアント UI 状態 | **Zustand**（軽量・ボイラープレート少） | テーマ、フィルタ、モーダル開閉 |
| フォーム | React Hook Form + Zod | 入力画面 |
| 永続化（高速 KV） | **react-native-mmkv** | 設定、軽量キャッシュ、オンボーディング済みフラグ |
| 機微情報 | **expo-secure-store** | トークン、暗号鍵（`native-capabilities.md`） |

- **`Context` をグローバル状態の主役にしない**：再レンダリングが広範囲に波及する。Provider は DI 用途に留め、状態は Zustand へ。
- TanStack Query はリトライ・キャッシュ・`refetchOnReconnect` を持ち、モバイルの不安定回線と相性が良い。

```ts
// サーバ状態の定番（features/items/useItems.ts）
export function useItems() {
  return useQuery({
    queryKey: ["items"],
    queryFn: () => api.items.list(),
    staleTime: 30_000,
  });
}
```

## データ層と Web 共有

- データアクセス関数は `packages/api-client`（または `src/lib/api`）に集約し、画面から直接 Supabase SDK を呼ばない。
- 入出力は **Zod スキーマ**で実行時バリデーション。スキーマと型は Web と共有（`setup-and-tooling.md` の共有層）。
- API レスポンスを `src/features/*/types.ts` でドメイン型に正規化してから UI に渡す。

## オフライン / Local-first 戦略

モバイルは「圏外・不安定回線が常態」。最初から考慮する。

**段階的に選ぶ：**

1. **最小**：TanStack Query の `gcTime` を伸ばし、`onlineManager` を `@react-native-community/netinfo` と接続。読み取りはキャッシュで耐え、書き込みは失敗時にユーザーへ通知。
2. **中程度**：TanStack Query の永続化（MMKV に persist）+ Mutation の楽観的更新 + 失敗 Mutation のリトライキュー。
3. **本格的 Local-first**：端末内 SQLite（`expo-sqlite`）を真実のソースにし、双方向同期する。Expo の Local-first ガイド、または Turso（SQLite + Offline Sync、競合解決内蔵）等を採用。**要件が「完全オフライン動作」を要求する時のみ**。

> **判断基準**：オフライン要件が「一覧の閲覧が続けられればよい」なら 1〜2 で十分。「圏外で入力・編集して後で同期」が必須業務なら 3。3 は実装・テストコストが大きいので要件定義で必ず握る。

- ネットワーク状態は画面上で可視化（オフラインバナー等）し、ユーザーに「同期されていない」ことを必ず知らせる。

## エラーハンドリング

- **Error Boundary**：Expo Router は `app/` 各階層に `ErrorBoundary` を export 可。画面単位でクラッシュを封じ込め、再試行 UI を出す。
- **クラッシュ監視**：本番は Sentry（`@sentry/react-native`）等を必ず入れる。**クラッシュはストア審査の最大のリジェクト要因**であり、放置すると評価が下がる。
- **ネットワークエラー**：握りつぶさず、再試行可能な UI（TanStack Query の `refetch`）を提示。
- ユーザー向けメッセージと内部ログを分離。`console.log` を本番に残さない。

## 設定・テーマ

- カラー・タイポ・スペーシングを `src/theme/` のトークンに集約。ダークモードは `useColorScheme()` で分岐（`ui-accessibility-performance.md`）。
- マジックナンバー（余白・サイズ）を散らさず、スケール（4 / 8 / 12 / 16 …）に乗せる。

## 内部設計レビュー観点

- [ ] `app/` がルーティングに専念し、画面ロジックが `src/features/` に分離されている
- [ ] サーバ状態（TanStack Query）とクライアント状態（Zustand）が混ざっていない
- [ ] 認証ガードがレイアウトで一元化され、各画面に散っていない
- [ ] オフライン挙動が要件レベルに見合っている（過剰でも過小でもない）
- [ ] Web との共有層（型・Zod）が定義され、二重実装になっていない
- [ ] Error Boundary とクラッシュ監視が組み込まれている
