---
name: local-dev-environment
description: SaaS の全機能（アプリ本体・営業ポータル・認証・決済・AI・メール）を Docker ベースでローカルのみで起動・テストできる開発環境を構築するための知識集。Supabase CLI ローカルスタック、Stripe CLI / モック、AI API のモック戦略、シードデータ、dev-setup.sh / dev-check.sh、Playwright との接続、WSL2 の注意点、検証レポート（docs/41-test-results/local-env-verification-*.md）を収録する。Phase 9 で test-planner がローカル環境要件を宣言し、Phase 11 の最初の必須タスク（タスク0）として implementation-worker が構築、tester / e2e-usecase-tester がその環境上でテストを実行する。「開発環境」「ローカル環境」「環境構築」「Docker」「docker compose」「Supabaseローカル」「ローカルテスト」「dev-setup」で参照。
---

# Local Dev Environment Skill

SaaS の**全機能をローカルのみでテストできる Docker ベースの開発環境**を、案件ごとに迷いなく構築するための共通基盤 Skill。

## 中核原則

**「ローカルで動かないものは作らない」**。クラウド（Vercel / Supabase Cloud / Stripe 本番 / AI API）に接続しなくても、アプリ本体・営業ポータル・認証・決済フロー・AI機能・メール送信のすべてが起動し、Unit / Integration / E2E テストが完走する状態を Phase 11 の入口で確立する。

## いつこのSkillを参照するか

| フェーズ | エージェント | 用途 |
|---------|-------------|------|
| Phase 9（テスト計画） | test-planner | test-strategy.md の「ローカル完結テスト環境要件」節を書くとき（何をローカル実体で動かし、何をモックにするかの宣言） |
| **Phase 11（実装・タスク0）** | **implementation-worker** | **ローカル開発環境の構築（必須・実装タスクの最初）**。docker-compose.yml / supabase/ / scripts/dev-setup.sh / シードの整備と検証レポート作成 |
| Phase 11（テスト並走） | tester | ローカル環境上での Unit / Integration テスト実行。環境起動確認 |
| Phase 12（ユースケースE2E） | e2e-usecase-tester | ローカル環境上での Playwright E2E 実行 |
| 随時 | project-manager | Phase 11 開始時のタスク0挿入、Phase 12 前の検証レポート存在確認 |

## references 一覧

| ファイル | 内容 |
|---------|------|
| `references/local-dev-setup.md` | 構成標準（Tier A/B）、docker-compose.yml / dev-setup.sh / dev-check.sh の雛形、Supabase ローカル、Stripe / AI / メールのモック戦略、シードデータ、Playwright 接続、WSL2 注意点、検証レポートテンプレート、トラブルシューティング |

## 重要原則

1. **Phase 11 のタスク0は環境構築**。機能実装より先に `bash scripts/dev-setup.sh` 一発で全サービスが起動する状態を作り、`docs/41-test-results/local-env-verification-YYYYMMDD-HHMM.md` に検証結果を残す（このレポートが無ければ Phase 12 に進めない）
2. **営業ポータルも対象**。`(marketing)` ルート（トップ〜法務の8ページ）がローカルで表示・スクショ撮影できること
3. **実体 > エミュレータ > モックの優先順**。DB/認証/ストレージ/メールは Supabase CLI のローカルスタック（実体相当）、Stripe はテストモード + Stripe CLI 転送（オフライン時のみモック）、AI API はモック既定（コスト・再現性）
4. **シードデータで再現可能に**。手作業でのデータ投入を前提にしない。`supabase/seed.sql` + factory で、クリーンな状態から E2E が回る
5. **クラウドの認証情報をローカル環境ファイルに置かない**。`.env.local` はローカルスタックのキーのみ。`.env.local.example` をコミットし、実ファイルは gitignore
6. **1名運用に耐える軽さ**。常時起動が必要なコンテナを最小限にし、`dev-check.sh` で状態が一目で分かるようにする
