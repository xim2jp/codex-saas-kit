# UC-PROFILE 標準ユースケースカタログ（会員管理）

ユーザー自身による**プロフィール・認証情報の自己管理**。サポート工数削減の要。

## 目次

- UC-PROFILE-01: プロフィール編集（氏名・会社名等）
- UC-PROFILE-02: メアド変更 → 検証メール → 確定
- UC-PROFILE-03: パスワード変更
- UC-PROFILE-04: 連携プロバイダ追加（OAuth 連携）
- UC-PROFILE-05: 連携プロバイダ解除（最後の identities は不可）

---

## UC-PROFILE-01: プロフィール編集（氏名・会社名等）

**業務的意義**：基本属性の自己更新。請求書宛名にも反映されるため、**間接的に売上関連**。

**対応 FunctionalID**：`F-PROF-001` (プロフィール更新)、`F-BILL-010` (請求書宛名同期)

**対応 swim lane**：認証済みユーザー / Supabase Database / Stripe API

**前提**：
- ログイン済みユーザー（storageState 利用）
- 既存 profiles レコード：display_name="旧名前"、company_name="旧会社"

**シナリオ**：

```
Given: ログイン済みユーザー、/dashboard/profile を開いた状態
When:  1. 表示名を "新しい名前" に変更
       2. 会社名を "新会社株式会社" に変更
       3. 「保存」をクリック
Then:  - 「保存しました」トーストが表示される
       - profiles.display_name が "新しい名前"
       - profiles.company_name が "新会社株式会社"
       - profiles.updated_at が更新されている
       - 適格請求書要件があるなら：
         stripe.customers.retrieve でも customer.name が "新会社株式会社" に同期
       - ページリロード後も値が保持されている
```

**DB 検証ポイント**：
- `profiles` の更新確認
- 楽観ロック / `updated_at` トリガが正しく動作

**バリデーション系の派生テスト**：
- 表示名が空 → 「必須項目です」エラー
- 表示名が 100 文字超 → 「100文字以内で入力」エラー
- 危険文字（HTML タグ）入力 → サニタイズされて保存 or エラー

**想定ロケータ案**：
```ts
page.getByLabel('表示名')
page.getByLabel('会社名')
page.getByRole('button', { name: '保存' })
page.getByRole('alert').or(page.getByRole('status'))  // トースト
```

**優先度**：🟡 Major

**実装ファイル**：`tests/e2e/usecases/profile-edit.spec.ts`

---

## UC-PROFILE-02: メアド変更 → 検証メール → 確定

**業務的意義**：転職・退職・ドメイン変更に伴う重要操作。失敗するとアカウント乗っ取り扱いになりかねない。

**対応 FunctionalID**：`F-PROF-002` (メアド変更)、`F-MAIL-003` (変更確認メール)

**シナリオ**：

```
Given: ログイン済みユーザー、現メアド old@example.test
When:  1. /dashboard/profile/email を開く
       2. 新メアド new@example.test を入力 → 「変更」
       3. 「確認メールを new@example.test に送信しました」表示
       4. Inbucket / Mailosaur で new@example.test 宛の確認メールを取得
       5. メール本文の URL `${SITE_URL}/auth/confirm-email-change?token_hash=...` を開く
       6. 「メアド変更が完了しました」画面
Then:  - auth.users.email が new@example.test に更新
       - profiles.email も同期更新
       - stripe.customers.email も new@example.test に同期
       - 旧メアド old@example.test ではログイン不可（後続テストで確認）
       - セキュリティ通知メールが旧メアドにも届く（要件次第）
```

**Critical な実装ミス**：
- Supabase の email 更新と profiles / stripe の同期漏れ
- 確認前に DB を書き換えてしまい、確認失敗時に元に戻せない
- 旧メアド宛のセキュリティ通知が無い → アカウント乗っ取り時に気付けない

**優先度**：🔴 Critical

**実装ファイル**：`tests/e2e/usecases/profile-change-email.spec.ts`

---

## UC-PROFILE-03: パスワード変更

**業務的意義**：定期変更・漏洩疑い時の自己対応。

**対応 FunctionalID**：`F-PROF-003` (パスワード変更)

**シナリオ**：

```
Given: ログイン済みユーザー（Email/Password 経路）、現パス "oldpass"
When:  1. /dashboard/profile/password を開く
       2. 現パス "oldpass"、新パス "newpass123!"、新パス（確認）"newpass123!" を入力
       3. 「変更」をクリック
Then:  - 「パスワードを変更しました」表示
       - 旧パス "oldpass" ではログイン不可
       - 新パス "newpass123!" でログイン可
       - セキュリティ通知メールが届く
       - 他のセッション（別ブラウザ）を強制ログアウトする実装なら、それも検証
```

**バリデーション**：
- 現パス間違い → エラー
- 新パスと確認の不一致 → エラー
- 新パスが既存と同じ → エラー（要件次第）
- パスワード強度ポリシー違反 → エラー

**優先度**：🟡 Major

**実装ファイル**：`tests/e2e/usecases/profile-change-password.spec.ts`

---

## UC-PROFILE-04: 連携プロバイダ追加（OAuth 連携）

**業務的意義**：ログイン経路の冗長化。Email でログインしている人が後から Google 連携、など。

**対応 FunctionalID**：`F-PROF-010` (プロバイダ追加)

**前提**：
- Email/Password で登録済みのユーザー（auth.identities に email のみ）

**シナリオ**：

```
Given: ログイン済み（Email 経路）、まだ Google 連携していない
When:  1. /dashboard/profile/connections を開く
       2. 「Google を連携」をクリック
       3. Google OAuth 承認（or admin で identities 追加）
       4. アプリに戻る
Then:  - auth.identities に provider='google' のレコードが追加
       - 同じ user_id に紐付いている（別ユーザーが作られていない）
       - profiles レコードが二重作成されていない
       - 画面に「Google 連携済み」表示
       - 次回 Google でログインすると同じユーザーとして認識される
```

**Critical な実装ミス**：
- メアド一致での自動連携が無いと、別ユーザー扱いになる
- profiles 二重作成、Stripe Customer 二重作成

**優先度**：🟡 Major

**実装ファイル**：`tests/e2e/usecases/profile-link-provider.spec.ts`

---

## UC-PROFILE-05: 連携プロバイダ解除（最後の identities は不可）

**業務的意義**：プロバイダの管理。**最後の identity を解除されるとログイン不能アカウントが残る**ため、必ずブロックする必要がある。

**対応 FunctionalID**：`F-PROF-011` (プロバイダ解除)、`F-AUTH-070` (ログイン不能防止)

**シナリオ A: 複数連携 → 1 つ解除可**：

```
Given: ログイン済み、email + google の 2 つの identity あり
When:  /dashboard/profile/connections で「Google 連携を解除」
Then:  - auth.identities から google 削除
       - email identity は残存
       - 引き続き Email/Password でログイン可
```

**シナリオ B: 1 つだけ → 解除不可**：

```
Given: ログイン済み、google のみの 1 identity
When:  /dashboard/profile/connections で「Google 連携を解除」をクリック
Then:  - エラー「最後のログイン手段は解除できません」表示
       - 「先にパスワード設定 or 別プロバイダ連携してください」リンク提示
       - auth.identities が変更されていない
       - ユーザーがログイン不能状態にならない
```

**Critical な実装ミス**：
- 最後の identity を解除 → ログイン不能アカウントが残る → サポート対応コスト爆発

**優先度**：🔴 Critical（シナリオ B が特に Critical）

**実装ファイル**：`tests/e2e/usecases/profile-unlink-provider.spec.ts`

---

## カタログ全体の運用ルール

1. **メール変更は最も慎重に**：旧メアド・新メアド双方に通知、確認前に DB 更新しない
2. **identity 解除のブロックは E2E 必須**：これが壊れていると本番でアカウント lock-out 発生
3. **Stripe 同期は会員管理の隠れたリスク**：プロフィール変更時に Stripe Customer 同期忘れ → 請求書宛名が古いまま
4. **storageState はテストごとに再生成 or プロパティ変更のないテストだけ共有**：UC-PROFILE-02 / -03 はメアド/パスを変えるので、共有 storageState 不可
5. **Critical の Block 条件**：UC-PROFILE-02 / -05 が fail かつ実装バグ起因なら、即 No-Go
