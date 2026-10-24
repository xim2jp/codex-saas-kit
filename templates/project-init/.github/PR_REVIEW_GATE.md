# main への PR 二重レビューゲート

このリポジトリは、`main` への Pull Request を **2つのレビューゲート**で守る。
野口さんフレームワークの「レビュワーエージェント × Amazon Q」二重構造を、生成された
各 SaaS リポジトリ上で実運用するための仕組み。

```
PR を main に向けて作成
   │
   ├─ ① レビュワーエージェント側（人間/AIレビュワーの最終承認）
   │     - 開発中: Phase 18 implementation-reviewer のレビュー（docs/41-test-results 等）
   │     - PR上: Code Owner の approve を必須化（CODEOWNERS + branch protection）
   │
   └─ ② Amazon Q Developer 側（CI: amazon-q-review-gate）
         - PR 作成後「少し時間をおいて」Amazon Q が自動でコードレビュー
         - CI が 3 分間隔 × 3 回ポーリングして Q のレビューを待機・評価
         - CHANGES_REQUESTED ならブロック / 検出できればパス / 3回無反応なら fail-open でパス
   │
   ▼
 両ゲートを満たすとマージ可能
```

## セットアップ（リポジトリ作成後に一度だけ）

### 1. Amazon Q Developer GitHub App を導入

1. GitHub Marketplace で **Amazon Q Developer** をこのリポジトリにインストールする。
   - <https://github.com/marketplace/amazon-q-developer>
2. AWS 側で GitHub 連携を有効化する（Amazon Q Developer for GitHub のドキュメント参照）。
   - <https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/github-code-reviews.html>
3. インストール後、新規 PR を 1 本作って **Amazon Q が自動でレビューを付ける**ことを確認する。
   - Amazon Q のレビューに表示される**ボットのアカウント名（login）**を控える。
   - 既定の検出パターン `amazon-?q|q-developer` で拾えない場合は、ワークフローの
     `Q_BOT_LOGIN_REGEX` を実際の login に合わせて調整する
     （`.github/workflows/amazon-q-review-gate.yml`）。

> branch protection で「ブランチ作成を制限」している場合、Amazon Q の機能開発（`/q dev`）が
> ブランチを作れるよう、App を allow list に追加する必要がある。コードレビューのみなら不要。

### 2. CODEOWNERS を設定

`.github/CODEOWNERS` の `@OWNER_PLACEHOLDER` を、実際の GitHub ユーザー/チームに置き換える。
1 名運用なら自分自身を指定する。

### 3. branch protection を有効化（パス必須化）

`amazon-q-review-gate` チェックと Code Owner approve を **マージ必須**にする。

```bash
# gh CLI で main を保護（要 admin 権限）
bash scripts/setup-branch-protection.sh            # 既定: 現在のリポジトリの main
bash scripts/setup-branch-protection.sh owner/repo main
```

手動で設定する場合は GitHub の Settings → Branches → Branch protection rules で `main` に対し:

- ✅ Require a pull request before merging
  - ✅ Require approvals（1 以上）
  - ✅ Require review from Code Owners
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date
  - ✅ 必須チェックに **`amazon-q-review-gate`** を追加
    （初回は一度ワークフローを走らせると候補に出る）

## ゲートの挙動（amazon-q-review-gate ジョブ）

`.github/workflows/amazon-q-review-gate.yml` の `env` で調整できる。

| 変数 | 既定 | 意味 |
|------|------|------|
| `Q_BOT_LOGIN_REGEX` | `amazon-?q\|q-developer` | Amazon Q ボットを login で識別する正規表現（大小無視） |
| `POLL_ATTEMPTS` | `3` | ポーリング回数 |
| `POLL_INTERVAL_SECONDS` | `180` | ポーリング間隔（秒）＝ 3 分 |
| `ENFORCE_CHANGES_REQUESTED` | `true` | Q が CHANGES_REQUESTED ならブロック |
| `PASS_ON_TIMEOUT` | `true` | 既定回数ポーリングしても Q のレビューが無ければパス（fail-open） |

- **検出できた場合**: パス（ただし Amazon Q が `CHANGES_REQUESTED` を出していればブロック）。
- **3 回とも検出できなかった場合**: `PASS_ON_TIMEOUT=true` ならパス（プレビュー版の Q が
  無反応でも PR を永久ブロックしないため）。厳格運用にしたい場合は `false` にする。
- 各 push（`synchronize`）でも再実行され、Amazon Q の再レビューを待つ。

## なぜ fail-open なのか

Amazon Q Developer for GitHub はプレビュー段階で、レビューの付与に時間がかかったり
無反応のことがある。永久ブロックを避けるため既定は fail-open。Amazon Q の指摘を
「必ず反映させる」厳格運用に切り替えたい場合は `PASS_ON_TIMEOUT=false` にし、
さらに必要なら Code Owner approve（①）でマージ判断を締める。

## 参考

- Amazon Q Developer in GitHub（プレビュー）: <https://aws.amazon.com/blogs/aws/amazon-q-developer-in-github-now-in-preview-with-code-generation-review-and-legacy-transformation-capabilities/>
- コードレビュー機能: <https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/github-code-reviews.html>
