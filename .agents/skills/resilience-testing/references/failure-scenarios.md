# 外部依存障害の演習（Failure Scenarios）

野口さんスタック（Vercel + Supabase + Stripe + AI API）は**マネージドサービスへの依存度が高い**構成。どれか1つが落ちても、SaaS 全体が道連れで止まらないことを検証・設計するための演習集。

## なぜ負荷試験より優先度が高いのか

Tier A（Vercel + Supabase）は基本的にオートスケールするため、想定内の負荷で性能が破綻するケースは比較的少ない。一方で、**外部SaaS依存（Supabase / Stripe / AI API）の障害は野口さんの制御が及ばない**上に、実際に発生した際の影響範囲を事前に検証していないケースが大半。ここを手当てするほうが実利が大きい。

## 必須シナリオ集（MVP は最低限これだけ検証する）

### シナリオ1：「Supabase が落ちても、キャッシュ済み画面は見られるか」

**想定する障害**：Supabase の DB/Auth が一時的に応答不能（メンテナンス、障害、ネットワーク分断）。

- [ ] DB 接続失敗時、アプリ全体が白画面/500エラーにならず、**エラーメッセージ付きの画面**が出るか
- [ ] 静的コンテンツ（LP、料金表、ヘルプページ）は Supabase 接続なしで表示できるか（SSG/ISR化されているか）
- [ ] 既にログイン済みのセッション（Cookie ベース）で、Auth 疎通不可時にどう振る舞うか（即ログアウトさせるか、猶予を持たせるか）を意図的に設計しているか
- [ ] Supabase Realtime を使う機能がある場合、切断時にポーリングへフォールバックするか、単にエラー表示に留めるか方針が決まっているか

**検証方法（MVPレベル）**：
```typescript
// Vitest: Supabase クライアントのエラーを模擬
import { vi } from 'vitest';

it('DB接続失敗時、ダッシュボードはエラー画面を表示し白画面にならない', async () => {
  vi.spyOn(supabaseClient, 'from').mockImplementation(() => {
    throw new Error('fetch failed');
  });
  const res = await fetch('/dashboard');
  expect(res.status).not.toBe(500); // catch されエラーページに変換されているか
});
```

実運用に近い確認は、ローカルの `supabase stop` でローカル Supabase を落とした状態でアプリを操作するだけでも十分効果がある。

### シナリオ2：「Stripeが落ちても既存ユーザーは使い続けられるか」

**想定する障害**：Stripe API が一時的にタイムアウト/5xxを返す（Checkout作成、Webhook受信、Customer Portal のいずれか）。

- [ ] **既存の有料ユーザー**は、Stripe API 疎通不可の間もアプリの主要機能を使い続けられるか（課金状態はDB側にキャッシュされたプラン情報で判定し、毎リクエスト Stripe に問い合わせていないか）
- [ ] 新規登録・アップグレード時に Stripe Checkout 作成が失敗したら、ユーザーに分かるエラー表示がされ、リトライ導線があるか（無言で固まらないか）
- [ ] Webhook 受信が一時的に失敗しても、Stripe 側のリトライ（最大3日間）で後追い反映される設計になっているか、それとも手動リカバリが必要か
- [ ] Customer Portal（請求書DL・カード変更）が落ちていても、それ以外の機能（本来の業務機能）は影響を受けないか

**検証方法**：
```typescript
// msw で Stripe API をタイムアウトさせる
import { http, HttpResponse } from 'msw';

export const stripeDownHandlers = [
  http.post('https://api.stripe.com/v1/checkout/sessions', () => {
    return HttpResponse.json({ error: { message: 'timeout' } }, { status: 503 });
  }),
];

it('Stripe障害時、既存有料ユーザーはダッシュボードにアクセスできる', async () => {
  // プラン判定はDBキャッシュ（profiles.plan等）で行われ、Stripe疎通不要であることを確認
  const res = await getDashboardAccess({ userId: 'paid-user-id' });
  expect(res.allowed).toBe(true);
});
```

**設計上の原則**：課金状態の真実の源は Stripe だが、**リクエストのたびに Stripe に問い合わせるのではなく、Webhook で同期した DB 側の状態を参照する**（Stripe をキャッシュのソースではなくイベント発信源として扱う）。これにより Stripe 障害時もアプリの大半は動き続けられる。

### シナリオ3：「AI API がレート制限/障害時、機能は個別に落ちるか、全体が落ちるか」

**想定する障害**：Claude API 等の AI API がレート制限超過、タイムアウト、5xx を返す。

- [ ] AI 機能を呼び出す箇所にタイムアウト設定があるか（無制限待機で他のリクエスト処理まで詰まらせていないか）
- [ ] AI API 障害時、**AI機能だけがエラー表示になり、他の非AI機能（一覧・検索・設定等）は正常に動くか**（同期的に道連れブロッキングしていないか）
- [ ] レート制限（429）時に指数バックオフでリトライしているか、それとも即座にユーザーへエラーを返しているか（両方あり得るが、方針が意図的か）
- [ ] AI 機能がアプリの中核（例：AI診断が主機能）の場合、フォールバックとして「後で結果を通知」等の非同期化ができないか検討したか

**検証方法**：
```typescript
it('AI API障害時、AI機能はエラー表示になるが一覧画面は正常表示される', async () => {
  vi.spyOn(aiClient, 'generate').mockRejectedValue(new Error('rate_limit_exceeded'));

  const aiRes = await callAiFeature();
  expect(aiRes.status).toBe('error'); // AI機能はエラーだが例外を投げてページ全体を落とさない

  const listRes = await fetch('/api/items'); // 無関係な機能
  expect(listRes.status).toBe(200);
});
```

## Graceful Degradation パターン（実装時に組み込む）

障害耐性は「テストで検出して直す」より「最初から壊れにくく作る」ほうが低コスト。実装フェーズで以下を標準パターンとして組み込む。

### 1. タイムアウトを必ず設定する

```typescript
// 外部API呼び出しにタイムアウトを必ず設定（無制限待機を避ける）
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);
try {
  const res = await fetch(externalApiUrl, { signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```

### 2. 機能単位でエラーを閉じ込める（Bulkhead 的発想）

1つの外部API障害が無関係な機能まで巻き込まないよう、**呼び出し箇所単位で try-catch し、UIコンポーネント単位でエラー境界を作る**。

```tsx
// Next.js: AI機能だけを Error Boundary で囲み、周囲は道連れにしない
<ErrorBoundary fallback={<AiFeatureUnavailable />}>
  <AiSuggestionPanel />
</ErrorBoundary>
<ItemList /> {/* AI機能とは独立して表示され続ける */}
```

### 3. 課金状態・権限判定は DB キャッシュを正とする

前述（シナリオ2）の通り、Stripe/外部認証プロバイダの状態は Webhook 経由で DB に同期し、リクエストごとに外部に問い合わせない設計にする。

### 4. リトライは指数バックオフ＋上限回数

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise((r) => setTimeout(r, 2 ** i * 500)); // 500ms, 1s, 2s...
    }
  }
  throw new Error('unreachable');
}
```

無限リトライや `waitForTimeout` 相当の固定長待機は避ける（障害時にリクエストが滞留し二次障害を招く）。

### 5. ユーザーへの誠実なフィードバック

「エラーが起きました」だけでなく、**何が使えて何が使えないか**を伝える。例：「AI提案機能は一時的に利用できません。他の機能は通常通りご利用いただけます」。ユーザーの離脱防止にも直結する。

## MVPでのスコープ（過剰にやらない）

- 上記3シナリオ（Supabase / Stripe / AI API）で MVP としては十分。カオスエンジニアリング的な無作為障害注入・本番環境での実障害注入（Chaos Monkey 相当）は、契約でSLAが明記される規模になってから検討する
- 障害シナリオのテストは**手動実行で十分**なことが多い（CI に毎回組み込む必要はない）。リリース前チェックリストの1項目として運用する
- サーキットブレーカーライブラリの導入等、本格的な耐障害性基盤は個人開発規模では過剰投資になりやすい。まずは上記の軽量パターン（タイムアウト・try-catch境界・DBキャッシュ・指数バックオフ）で足りる

## デプロイ前チェックリスト（security-auditor / implementation-reviewer と共有）

- [ ] Supabase 疎通不可時、静的ページ（LP等）は表示され続けるか確認済み
- [ ] Stripe 疎通不可時、既存有料ユーザーの主要機能アクセスが継続することを確認済み
- [ ] AI API 障害時、AI機能以外が巻き込まれず動作することを確認済み
- [ ] 外部API呼び出し箇所すべてにタイムアウトが設定されている（grep等で確認）
- [ ] リトライに無限ループ・無制限待機がない

## 出典（一次ソース）

- Supabase Status / Incident 対応方針: https://supabase.com/docs/guides/platform/going-into-prod
- Stripe Webhook のリトライ仕様: https://docs.stripe.com/webhooks#retries
- Stripe API のエラーハンドリング指針: https://docs.stripe.com/error-handling
