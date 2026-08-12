---
name: cicd-pipeline
description: SaaS の CI/CD パイプラインを GitHub Actions で構築するための知識集。フレームワークのテスト重厚化（Unit/Integration・E2E 3回連続・ミューテーション・tfsec）と品質ゲートを CI に写像し、PR ゲート（lint/typecheck/テスト/セキュリティ/ビルド）→ プレビューデプロイ → main マージ → 本番デプロイ → ロールバックまでを標準化する。Vercel（Tier A）と AWS ECS/GCP Cloud Run/Azure（Tier B/C、OIDC 認証）のデプロイパターン、Supabase マイグレーションの CI 適用、シークレット管理、キャッシュ最適化、既存の Amazon Q レビューゲート/branch protection との統合を収録する。テスト計画・実装・デプロイ・運用の各フェーズで test-planner / implementation-worker / tester / project-manager らが参照する。「CI/CD」「GitHub Actions」「パイプライン」「自動デプロイ」「プレビュー環境」「ロールバック」「継続的インテグレーション」「デプロイ自動化」で参照。
---

# CI/CD Pipeline Skill

CI/CD はフレームワークの品質ゲート（L1 ループ）を**人が忘れても機械が強制する**仕組みに変換する装置。「ローカルでは通った」を撲滅し、デプロイを CI/CD 経由のみに一本化する（NFR の運用・保守性既定値）。

## いつこのSkillを参照するか

- **test-planner**（Phase 9）：test-strategy.md の「CI/CD連携」節を書くとき
- **implementation-worker**（Phase 11）：`.github/workflows/` の実装（タスク0のローカル環境構築とセットで CI も最初に組む）
- **tester / e2e-usecase-tester**：CI 上でのテスト実行構成
- **project-manager**：デプロイ Go 後の本番リリース手順、ロールバック

## 標準パイプライン（品質ゲートの写像）

フレームワークのゲートと CI ジョブの対応：

```
PR 作成
├── lint + typecheck            （tsc --noEmit / eslint。数分で fail-fast）
├── unit + integration          （Vitest。Integration は Supabase ローカルスタックをサービスコンテナで起動）
├── e2e                         （Playwright --repeat-each=3。3回連続 Green ルール【test-hardening 原則6】）
├── mutation（条件付き）         （Stryker。クリティカルモジュール変更時のみ実行、週次で全量）
├── security                    （npm audit --audit-level=high / secret scan / IaC 変更時は tfsec+Checkov）
├── build                       （next build。ビルド失敗を PR 段階で検知）
├── preview deploy              （Vercel Preview。レビュー時に実物 URL で確認）
└── Amazon Q レビューゲート      （既存 amazon-q-review-gate.yml）＋ Code Owner approve
        ↓ 全て緑 + approve → main マージ
main
├── 上記フルスイート再実行
├── supabase db push            （マイグレーション適用。後述の順序を厳守）
└── production deploy           （Vercel --prod / Tier B は ECR push → ECS サービス更新）
        ↓
リリース記録（release-log.md へ追記【Phase 15 / 軽量サイクル step5】）
```

### 必須 required checks（branch protection）

`lint-typecheck` / `test` / `e2e` / `build` / `amazon-q-review-gate`。設定は既存 `scripts/setup-branch-protection.sh` を拡張して登録する。

## 実装パターン

### ワークフロー骨子（Tier A 標準）

```yaml
name: ci
on:
  pull_request:
jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint && npx tsc --noEmit
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - uses: supabase/setup-cli@v1
      - run: supabase start          # Integration はローカルスタック実体で（local-dev-environment と同じ思想）
      - run: npm test -- --coverage
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - uses: supabase/setup-cli@v1
      - run: supabase start && bash scripts/dev-setup.sh --ci
      - run: npx playwright test --repeat-each=3    # 3回連続 Green ルール
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-traces, path: test-results/ }
```

### デプロイ（Tier 別）

| Tier | 方式 | 要点 |
|------|------|------|
| **A（Vercel）** | Git 連携の自動デプロイを基本（PR→Preview、main→Production） | vercel.json で保護。環境変数は Vercel ダッシュボード管理（`vercel env pull` でローカル同期） |
| **B（AWS）** | GitHub Actions → ECR push → ECS サービス更新 | **OIDC 連携必須**（`aws-actions/configure-aws-credentials` + AssumeRole。長期アクセスキーを Secrets に置かない） |
| GCP | Actions → Artifact Registry → Cloud Run deploy | Workload Identity 連携 |
| Azure | Actions → ACR → Container Apps | Federated Credentials |

### Supabase マイグレーションの順序（事故ポイント）

1. マイグレーションは**後方互換に書く**（カラム削除は「参照除去デプロイ→次リリースで削除」の2段階）
2. main マージ時：`supabase db push`（本番）→ アプリデプロイ、の順。ロールバック時はアプリのみ戻す（DB は前方互換のまま）
3. PR 段階では CI のローカルスタックに適用して整合検証（`supabase db reset` が通ること）

### シークレット管理

- GitHub Environments（production / preview）で環境別に分離、production は承認者必須の protection rule
- クラウド認証は全て OIDC（キーレス）。Stripe/AI API キーは環境別に test/live を厳格分離
- `secret scanning` + push protection を有効化

### 高速化

- `actions/setup-node` の npm キャッシュ＋ Next.js `.next/cache` の actions/cache
- ジョブ並列化（上記構成は全ジョブ並列）。mutation・全ブラウザE2E など重いものは条件付き/夜間スケジュールへ
- `concurrency` で同一 PR の旧実行をキャンセル

## 夜間・定期ジョブ（circadian loop）

| スケジュール | ジョブ | 出力先 |
|-------------|--------|--------|
| 毎夜 | フル E2E（全ブラウザ）＋ flaky 検出 | 失敗時 Issue 自動起票 |
| 週次 | Stryker 全量 / npm audit / IaC ドリフト検出（iac-multicloud 準拠） | ops-review の入力 |
| 月次 | 依存更新 PR（Dependabot/Renovate）まとめ確認 | 軽量サイクルで消化 |

## SDLC への組み込み

- Phase 9：test-planner が test-strategy.md「CI/CD連携」節で required checks とスケジュールジョブを宣言
- Phase 11：implementation-worker が**タスク0（ローカル環境）の直後に CI を構築**（機能実装が積み上がる前に赤/緑の基準線を引く）
- Phase 14：implementation-reviewer が「CI が緑であること」をレビュー前提として確認（起動時 Bash アクションに含まれる）
- Phase 15：本番デプロイと release-log 記録を CI/CD 経由に一本化。ロールバック手順（Vercel: instant rollback / ECS: 前タスク定義に戻す）を release-log.md に明記
- 軽量チェンジサイクル：step 4 の縮約ゲート＝この PR ゲートそのもの（別途の手動確認を増やさない）

## アンチパターン

- ローカルから直接 `vercel --prod` / 手動デプロイ（CI/CD 一本化の破壊。緊急時も CI の workflow_dispatch を使う）
- E2E を CI で1回だけ実行して Green 扱い（3回連続ルールは CI でも適用）
- 長期クラウドキーを GitHub Secrets に保存（OIDC に置換）
- required checks 未設定のまま branch protection「有効」のつもり（チェック名の登録まで確認）
- flaky を `retries: 2` で隠して緑にする（test-hardening 原則6違反。夜間ジョブで検出・修理）
- CI 高速化を後回しにして 20 分パイプライン化（開発ループが死ぬ。10分超えたら分割・キャッシュ見直し）
