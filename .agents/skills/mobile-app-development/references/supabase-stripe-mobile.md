# Supabase 認証と課金（モバイル版）

野口さん Web スタック（Supabase Auth + Stripe）をモバイルに移す際の差分と、**ストア IAP 規約に沿った課金設計**。

---

## Part 1: Supabase Auth on React Native

### クライアント生成

Web の `@supabase/ssr` は使わない。RN では `@supabase/supabase-js` を直接使い、**ストレージとセッション挙動をモバイル向けに設定**する。

```ts
// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { sessionStorage } from "./session-storage"; // 下記参照

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, // 公開可キーのみ
  {
    auth: {
      storage: sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,   // ★ モバイルでは必ず false（URL ベースの検出は Web 用）
    },
  },
);

// アプリがフォアグラウンドの間だけトークンを自動リフレッシュ
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

### API キー方針（2026 年の移行）

- 新形式の **publishable キー（`sb_publishable_...`）** と **secret キー（`sb_secret_...`）** に移行する。旧 `anon` / `service_role` は 2026 年末まで動くが新規は新形式で。
- **アプリに同梱してよいのは publishable キーのみ。** `secret` / `service_role` は絶対に同梱しない（バイナリは逆コンパイル可能）。
- 特権操作（他人のデータ操作、管理処理）は **Supabase Edge Function** にまとめ、アプリからは認証付きで呼ぶ。
- RLS は Web と同じポリシーがそのまま効く。テーブルは必ず RLS 有効。

### セッションの保存先（重要な落とし穴）

`expo-secure-store` は **2048 バイトの値サイズ上限**があり、Supabase のセッション JSON は既定でこれを超える。素朴に SecureStore へ入れると保存に失敗する。

**推奨パターン：MMKV（暗号化）でセッション本体を保存し、暗号鍵を SecureStore に置く**

```ts
// src/lib/session-storage.ts
import { MMKV } from "react-native-mmkv";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

// 暗号鍵を SecureStore（Keychain / Keystore）に保管。無ければ生成
function getEncryptionKey(): string {
  let key = SecureStore.getItem("mmkv-encryption-key");
  if (!key) {
    key = Crypto.randomUUID() + Crypto.randomUUID();
    SecureStore.setItem("mmkv-encryption-key", key);
  }
  return key;
}

const storage = new MMKV({ id: "supabase-session", encryptionKey: getEncryptionKey() });

// supabase-js が期待する {getItem,setItem,removeItem} 形に適合
export const sessionStorage = {
  getItem: (k: string) => storage.getString(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
};
```

- 代替：`aes-js` + `react-native-get-random-values` で AES 暗号化し、暗号鍵だけ SecureStore、暗号文を AsyncStorage に置く構成も可。MMKV 版の方が高速で簡潔。
- `AsyncStorage` を素のまま使うと**平文**でトークンが残る。最低でも上記の暗号化を行う。

### OAuth（Google / Apple / LINE 等）のディープリンクコールバック

Web は URL リダイレクトでコールバックを受けるが、モバイルは**アプリのディープリンクスキーム**で受ける。

```ts
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

async function signInWithOAuth(provider: "google" | "apple") {
  const redirectTo = Linking.createURL("/auth/callback"); // myapp://auth/callback
  const { data } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  // セキュアな認証セッション（iOS: ASWebAuthenticationSession）でブラウザを開く
  const result = await WebBrowser.openAuthSessionAsync(data.url!, redirectTo);
  if (result.type === "success") {
    // result.url からトークンを取り出し supabase.auth.setSession()
  }
}
```

- Supabase ダッシュボードの **Redirect URLs にアプリのスキーム**（`myapp://auth/callback`）を登録する。
- `app.config.ts` の `scheme` を設定（`scheme: "myapp"`）。

### Sign in with Apple（iOS の必須要件）

**他社 SNS ログイン（Google / Facebook 等）を提供する iOS アプリは、Sign in with Apple も提供しなければストア審査でリジェクトされる。** ネイティブの Apple 認証は `expo-apple-authentication` を使う（Web の OAuth リダイレクトより UX が良い）。Android では不要。

### ネイティブ Google ログイン

`@react-native-google-signin/google-signin` でネイティブの Google サインインシートを使うと、ブラウザ往復のない滑らかな UX になる。取得した ID トークンを `supabase.auth.signInWithIdToken()` に渡す。

### 退会フロー

- アプリ内に**アカウント削除導線を必ず置く**（Apple は「アカウント作成できるアプリは削除もできること」を要求）。
- 削除は Edge Function で実行（`auth.admin.deleteUser` は secret キー必須＝サーバ側）。
- **課金中のユーザーの退会**：IAP サブスクはアプリ側から解約できない。ユーザーに「サブスクは App Store / Google Play の設定から解約してください」と明示案内する（`references/store-release.md`）。

---

## Part 2: 課金 — IAP と Stripe の切り分け（最重要）

### 規約：何を IAP で、何を Stripe で売るか

| 売るもの | 課金方法 | 理由 |
|---------|---------|------|
| アプリ内で消費するデジタル機能・サブスク・コンテンツ解放 | **必ず IAP（App Store / Google Play）** | Apple / Google の規約。Stripe で売ると審査リジェクト |
| 物理商品・実世界のサービス（配送、対面サービス、宿泊予約等） | **Stripe で可** | 規約上 IAP 対象外 |
| 他媒体で購入済みのものをアプリで利用するだけ | IAP 不要 | 「リーダーアプリ」的な扱い |

> **設計の鉄則**：要件定義の段階で課金対象を上表で分類する。野口さんの「月額定額 SaaS」をモバイルアプリ内で売る場合、その機能がアプリ内で消費されるなら **IAP 必須**。後から気づくと審査落ち＋設計やり直しになる。

### IAP は RevenueCat 経由で実装する

生の StoreKit / Google Play Billing は、レシート検証・更新・トライアル・猶予期間・復元の扱いが煩雑。**RevenueCat** が IAP の上に乗り、これらを抽象化する。1 名運用と相性が良い。

```ts
// src/lib/revenuecat.ts
import Purchases from "react-native-purchases";

export function initRevenueCat() {
  Purchases.configure({
    apiKey: Platform.select({
      ios: process.env.EXPO_PUBLIC_RC_IOS_KEY!,
      android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY!,
    })!,
  });
}

// 購入
async function purchase(pkg: PurchasesPackage) {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo.entitlements.active["pro"] !== undefined;
}

// 復元（iOS は「購入を復元」導線が審査上ほぼ必須）
async function restore() {
  await Purchases.restorePurchases();
}
```

- **Paywall**：購入画面を自前で作り込まず、RevenueCat の Paywall（リモート設定可能な購入 UI）を使う。
- `react-native-purchases` は New Architecture 対応。`expo-iap` 等の選択肢もあるが、サブスク中心なら RevenueCat を標準とする。
- 設定 plugin（config plugin）で StoreKit / Billing の権限を有効化。

### エンタイトルメントの統合（Web=Stripe / モバイル=IAP）

同一ユーザーが Web では Stripe、モバイルでは IAP で課金しうる。**「どの経路で買ったか」ではなく「Pro 権限を持つか」をアプリの真実とする。**

- RevenueCat の **顧客 ID をアプリのユーザー ID（Supabase の `user.id`）に揃える**（`Purchases.logIn(userId)`）。
- RevenueCat の Webhook → Supabase（`profiles.entitlement` 等）へ反映。Stripe の Webhook も同じテーブルへ反映。
- アプリは Supabase 上の権限フラグ＋ RevenueCat の `customerInfo` の両方を見て、最新の権限で UI を出し分ける。
- RevenueCat Web Billing（Stripe を決済基盤に使う Web 課金）を使えば、Web/モバイルのエンタイトルメントを RevenueCat 一元で扱える。Web を既存 Stripe 実装で進める場合は Webhook 統合で揃える。

### サンドボックステスト

- iOS：App Store Connect の Sandbox テスター、Android：ライセンステスター。実機で購入・更新・復元・解約を確認。
- 価格・トライアル・更新は IAP サンドボックスでのみ検証できる（`testing-strategy.md`）。

---

## 設計・レビュー観点

- [ ] 課金対象が「IAP 必須 / Stripe 可」で要件定義時に分類済み
- [ ] iOS のデジタル課金が Stripe になっていない（＝審査リジェクト要因）
- [ ] Supabase クライアントが `detectSessionInUrl: false`
- [ ] セッションが平文 AsyncStorage に保存されていない（暗号化 MMKV + SecureStore 鍵）
- [ ] publishable キーのみ同梱、特権操作は Edge Function
- [ ] 他社 SNS ログイン提供時、iOS に Sign in with Apple がある
- [ ] アプリ内にアカウント削除導線がある
- [ ] RevenueCat 顧客 ID = Supabase user.id で揃えてエンタイトルメント統合
- [ ] 「購入を復元」導線がある（iOS）
- [ ] 退会時に IAP サブスク解約の案内文がある
