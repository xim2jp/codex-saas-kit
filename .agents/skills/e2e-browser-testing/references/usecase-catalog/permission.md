# UC-PERM / UC-RECOVERY / UC-A11Y 標準ユースケースカタログ（横断的リスク）

権限境界・ネットワーク復旧・アクセシビリティの**横断的なリスク**。機能カタログには出にくいが、本番で必ず問題化する領域。

## 目次

- UC-PERM-01: 他人のリソース URL を直叩き → 403（RLS）
- UC-PERM-02: 管理者のみ機能を一般ユーザーで実行 → 403
- UC-RECOVERY-01: ネットワーク失敗時の保存リトライ
- UC-A11Y-01: キーボードのみでサインアップ完遂

---

## UC-PERM-01: 他人のリソース URL を直叩き → 403（RLS）

**業務的意義**：**IDOR (Insecure Direct Object Reference) 防止**。OWASP Top 10 の常連。Supabase RLS の動作担保。

**対応 FunctionalID**：`F-PERM-001` (RLS ポリシー)、`F-AUTH-080` (リソース所有者検証)

**対応 swim lane**：認証済みユーザー（他人） / Supabase Database (RLS) / API

**前提**：
- ユーザー A、B が存在
- A が所有するリソース（例：プロジェクト project_abc）が存在

**シナリオ**：

```
Given: ユーザー B でログイン済み、storageState=user-b
       project_abc は A の所有（B にはアクセス権無し）
When:  B のブラウザで /projects/project_abc を直接開く
Then:  - 403 Forbidden 画面 or 「アクセス権がありません」表示
       - 404 Not Found でも可（存在を隠すパターン）
       - リソースのデータが画面に一切表示されていない
       - API レスポンスでも内容が返っていない（network 監視）
```

**横展開**：
- API エンドポイントの直叩き：`/api/projects/project_abc` を fetch
  → 401 / 403 / 404 のいずれかが返る
- 更新エンドポイント：`PUT /api/projects/project_abc` を試行 → 403
- 削除エンドポイント：`DELETE /api/projects/project_abc` を試行 → 403

**RLS の検証**：
- Supabase の Service Role Key を使わず、認証済みクライアントから直接 select
- `select * from projects where id='project_abc'` が空行を返す（ユーザー B のセッションで）

**Critical な実装ミス**：
- RLS ポリシー漏れ → 他人のデータが見える / 操作できる
- API ルートで認可チェック忘れ → URL パラメータの ID を信用
- 「404 と 403 を区別しない」設計が一貫していない → 列挙攻撃で存在が分かる

**優先度**：🔴 Critical

**実装ファイル**：`tests/e2e/usecases/perm-other-user-resource.spec.ts`

---

## UC-PERM-02: 管理者のみ機能を一般ユーザーで実行 → 403

**業務的意義**：管理者専用機能（ユーザー一覧、課金状況、システム設定等）の権限境界。

**対応 FunctionalID**：`F-PERM-002` (ロールベース認可)、`F-ADMIN-001` (管理画面)

**前提**：
- 一般ユーザー（role='user'）と管理者（role='admin'）が分離
- /admin/* が管理者のみアクセス可

**シナリオ**：

```
Given: 一般ユーザーでログイン、storageState=user
When:  1. /admin/users を直接開く
       2. /admin/billing を直接開く
       3. /api/admin/users を fetch で叩く
Then:  - 1, 2: /403 or /dashboard にリダイレクト、管理画面が表示されない
       - 3: API レスポンス 403
       - middleware で適切にブロックされている（network 監視）
       - DB 直アクセスでも一般ユーザーのセッションでは admin 用テーブル取得不可
```

**ロール詐称テスト**：
- `localStorage.setItem('role', 'admin')` を実行しても権限が変わらない
- JWT トークンの payload を改ざんしても署名検証で弾かれる
- これらの「クライアント側の改ざんが効かない」ことを E2E で確認

**優先度**：🔴 Critical

**実装ファイル**：`tests/e2e/usecases/perm-admin-only-routes.spec.ts`

---

## UC-RECOVERY-01: ネットワーク失敗時の保存リトライ

**業務的意義**：モバイル回線・社内 LAN 不安定環境での UX。データロス防止。

**対応 FunctionalID**：`F-DATA-001` (保存処理)、`F-RECOVERY-001` (リトライ機構)

**対応 swim lane**：認証済みユーザー / クライアント側リトライ機構 / API

**前提**：
- フォーム編集機能（例：プロジェクト名変更）

**シナリオ**：

```
Given: ログイン済み、編集フォームを開いた状態
When:  1. フォームに変更を入力
       2. page.route で `/api/projects/*` を 1 回失敗（500）させる
       3. 「保存」をクリック → エラー表示「保存に失敗しました、再試行中」
       4. 2 回目以降は通常通り 200 を返すよう route 解除
       5. 自動リトライ or ユーザーが「再試行」ボタンをクリック
Then:  - 最終的に保存成功
       - 「保存しました」表示
       - DB に変更が反映されている
       - リトライ中も画面が壊れない（フォーム値が消えない）
```

**Playwright で network 失敗を模擬**：
```ts
let failCount = 0;
await page.route('**/api/projects/**', (route) => {
  if (failCount < 1 && route.request().method() === 'PUT') {
    failCount++;
    return route.fulfill({ status: 500, body: 'Internal Server Error' });
  }
  return route.continue();
});
```

**Critical な観点**：
- フォーム値の保持（編集中の内容が失敗時にクリアされない）
- 二重送信防止（リトライ中に再度クリックしても 1 リクエストにまとめる）
- 楽観的 UI 更新 → ロールバック（失敗時に元の値に戻す）

**優先度**：🟡 Major

**実装ファイル**：`tests/e2e/usecases/recovery-network-retry.spec.ts`

---

## UC-A11Y-01: キーボードのみでサインアップ完遂

**業務的意義**：アクセシビリティ要件（WCAG 2.1 AA）の最低限。法人向け / 公的機関向けで必須。

**対応 FunctionalID**：`F-A11Y-001` (キーボード操作)、`F-AUTH-002`

**シナリオ**：

```
Given: マウス操作なし、Tab/Enter のみで操作
When:  1. /signup を開く
       2. Tab で メアド入力欄にフォーカス → メアド入力
       3. Tab でパスワード入力欄にフォーカス → パスワード入力
       4. Tab で利用規約チェックボックスにフォーカス → Space でチェック
       5. Tab で「登録」ボタンにフォーカス → Enter で送信
       6. 続けて Tab/Enter のみで メアド検証完了まで進む
Then:  - 全フォーム要素にキーボードでフォーカス可
       - フォーカスインジケータが可視（outline / ring）
       - Tab 順序が論理的（上から下、左から右）
       - Skip Link で main へジャンプ可能
       - aria-label / aria-describedby が適切に設定
       - axe-core でアクセシビリティ違反 0 件（Critical/Serious のみ）
```

**axe-core 連携**：
```ts
import AxeBuilder from '@axe-core/playwright';

const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa'])
  .analyze();
expect(results.violations).toEqual([]);
```

**優先度**：🟢 Minor（要件で A11y 要求がある場合は Major / Critical 昇格）

**実装ファイル**：`tests/e2e/usecases/a11y-keyboard-signup.spec.ts`

---

## カタログ全体の運用ルール

1. **UC-PERM は最も見落とされやすい**：機能が正しく動く＝権限境界が正しいとは限らない。**必ず実施**
2. **RLS の検証は admin client を使わず、認証済みクライアントで**：Service Role Key で叩くと RLS が bypass される
3. **403 vs 404 の方針を統一**：要件次第。途中で混在しないよう実装と E2E で確認
4. **page.route で失敗を再現**：実際に外部依存を落とすより、Playwright の route で意図的に失敗させる
5. **axe-core は Critical/Serious のみ即時 fix**：Moderate/Minor はバックログで対応
6. **Block 条件**：UC-PERM-01 / -02 が fail で実装バグ起因なら**即 No-Go**（セキュリティインシデント直結）
