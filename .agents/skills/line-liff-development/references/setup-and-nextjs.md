# セットアップと Next.js 統合

LIFF アプリを Next.js（App Router / 野口さん Tier A）に組み込む実務手順。SSR の落とし穴と対策が中心。

## 前提・SDK

- **LIFF SDK**：`@line/liff`（npm パッケージ）。SemVer（v2.2.0 以降）。バージョンを `package.json` で固定する。
- CDN でも読めるが、本番では **npm パッケージ**で固定する（CDN を使うなら `fixed` パス。`edge` は最新追従して挙動が変わる）。
- LIFF v2.11.0 以降：`liff.init()` 解決後に URL から認証情報が除去される。ページビュー計測は `liff.init().then()` 内で送る。

```bash
npm install @line/liff
```

## チャネルと LIFF アプリの登録

1. **LINE Developers Console** でプロバイダーを作る。
2. 用途に応じてチャネルを作る（`references/liff-vs-miniapp.md`）：
   - LIFF アプリ → **LINE ログインチャネル**
   - LINE ミニアプリ → **LINE ミニアプリチャネル**
3. チャネル内で LIFF アプリを追加：
   - **エンドポイント URL**：デプロイ先（Vercel の本番 / プレビュー URL）
   - **サイズ**：`full` / `tall` / `compact`
   - **scope**：`profile` `openid`（メール取得は `email`、要審査）
4. 払い出される **LIFF ID** を控える（`1234567890-abcdefgh` 形式）。これは公開情報。

## 環境変数

```bash
# フロントに出してよい（公開情報）
NEXT_PUBLIC_LIFF_ID=1234567890-abcdefgh

# サーバ専用（絶対にフロントに出さない）
LINE_LOGIN_CHANNEL_ID=...
LINE_LOGIN_CHANNEL_SECRET=...
# Messaging API を併用する場合
LINE_MESSAGING_CHANNEL_SECRET=...
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=...
```

- チャネルを複数使う案件では**環境変数名にチャネル種別を入れて取り違えを防ぐ**。
- `NEXT_PUBLIC_` が付くものはバイナリ／JS バンドルに埋まる＝公開情報。シークレットには付けない。

## 最大の落とし穴：SSR で `window is not defined`

LIFF SDK は内部で `window` を参照する。Next.js はデフォルトでサーバ側でもコンポーネントを評価するため、**LIFF を素朴に import / 実行するとサーバ側で落ちる**。

対策は 2 つを併用：

1. LIFF を使うコンポーネントは **Client Component**（`"use client"`）にする。
2. `liff` の import と `liff.init()` は **`useEffect` 内**で行う（＝ブラウザでのみ実行）。dynamic import を使うとさらに堅い。

## 推奨パターン：LiffProvider + useLiff フック

LIFF の初期化状態をアプリ全体で共有する。初期化中・失敗・成功を扱えるようにする。

```tsx
// src/components/LiffProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Liff } from "@line/liff";

type LiffState = {
  liff: Liff | null;
  isReady: boolean;
  isLoggedIn: boolean;
  error: Error | null;
};

const LiffContext = createContext<LiffState>({
  liff: null,
  isReady: false,
  isLoggedIn: false,
  error: null,
});

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LiffState>({
    liff: null,
    isReady: false,
    isLoggedIn: false,
    error: null,
  });

  useEffect(() => {
    // ブラウザでのみ動的 import（SSR 回避）
    import("@line/liff")
      .then((mod) => mod.default)
      .then(async (liff) => {
        await liff.init({
          liffId: process.env.NEXT_PUBLIC_LIFF_ID!,
          // 外部ブラウザで開かれた時に自動でログインさせる場合
          withLoginOnExternalBrowser: true,
        });
        setState({
          liff,
          isReady: true,
          isLoggedIn: liff.isLoggedIn(),
          error: null,
        });
      })
      .catch((error: Error) => {
        setState((s) => ({ ...s, isReady: true, error }));
      });
  }, []);

  return <LiffContext.Provider value={state}>{children}</LiffContext.Provider>;
}

export const useLiff = () => useContext(LiffContext);
```

```tsx
// app/layout.tsx — LIFF が要る範囲を LiffProvider で包む
import { LiffProvider } from "@/components/LiffProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <LiffProvider>{children}</LiffProvider>
      </body>
    </html>
  );
}
```

```tsx
// 画面側での使い方
"use client";
import { useLiff } from "@/components/LiffProvider";

export function HomeScreen() {
  const { liff, isReady, isLoggedIn, error } = useLiff();

  if (!isReady) return <Splash />;          // 初期化中
  if (error) return <LiffError error={error} />;
  if (!isLoggedIn) {
    liff!.login();                           // LINE ログインへ
    return null;
  }
  return <Dashboard />;
}
```

> **`use-line-liff` 等の OSS フック**もある。自前 Provider と同等のことをするので、薄いラッパーが欲しければ採用可。ただし依存追加の保守コストと天秤にかける。

## ログイン状態の扱い

- `liff.isLoggedIn()`：ログイン済みか。
- `liff.login()`：未ログインなら呼ぶ。LINE ログイン画面へ。
- `liff.logout()`：ログアウト。
- `liff.isInClient()`：LINE アプリ内で開かれているか（外部ブラウザとの分岐に使う）。
- **外部ブラウザ対応**：LIFF の URL は LINE アプリ外でも開ける。`withLoginOnExternalBrowser: true` で外部ブラウザでも自動ログインさせられる。要件に応じて、外部ブラウザでは機能制限する／LINE で開くよう促す等を設計する。

## URL の制約（重要）

- `liff.init()` は **エンドポイント URL と完全一致、またはそれ以下の階層**の URL でのみ動作保証される。
- Next.js のルーティングはこの配下に収める。エンドポイント URL を `https://example.com/liff` にしたなら、LIFF 画面はすべてその配下。
- アプリ内の画面遷移は通常の Next.js ルーティング（`<Link>` / `router.push`）でよい。外部サイトへ飛ばす時は `liff.openWindow()` を使う（`references/liff-features.md`）。

## Vercel へのデプロイ

- LIFF アプリは普通の Next.js アプリなので Vercel にそのままデプロイできる。
- **エンドポイント URL を環境ごとに分ける**：本番チャネルは本番 URL、検証用に別の LIFF アプリ（別 LIFF ID）を作りプレビュー URL を割り当てる。
- Vercel のプレビューデプロイは URL が毎回変わる。検証用 LIFF アプリのエンドポイントは固定ドメイン（例：`https://staging.example.com`）に向けるのが運用しやすい。
- HTTPS 必須（LIFF は HTTP 不可）。Vercel は標準 HTTPS なので問題なし。

## 開発環境

- **Create LIFF App CLI**（`npx @line/create-liff-app`）で雛形を作れる。Next.js テンプレートあり。既存プロジェクトに組み込むなら本ファイルの Provider パターンを使う。
- ローカル開発は `localhost` だと LINE アプリ内で開けない。**ngrok 等で HTTPS の公開 URL を作り**、検証用 LIFF アプリのエンドポイントに設定する。
- LIFF Inspector（公式のデバッグツール）で LINE アプリ内の挙動をデバッグできる。

## セットアップ・チェックリスト

- [ ] `@line/liff` のバージョンが固定されている
- [ ] LIFF を使うコンポーネントが Client Component
- [ ] `liff.init()` が `useEffect` 内 / dynamic import でクライアント専用に呼ばれている
- [ ] LiffProvider で初期化状態（中／失敗／成功）を扱えている
- [ ] `NEXT_PUBLIC_LIFF_ID` 以外のシークレットがフロントに出ていない
- [ ] エンドポイント URL が本番／検証で分かれている
- [ ] 外部ブラウザで開かれた時の挙動を決めている
