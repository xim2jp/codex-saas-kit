---
name: local-dev-environment
description: SaaS の全機能（アプリ本体・営業ポータル・認証・決済・AI・メール）を Docker ベースでローカルのみで起動・テストできる開発環境の知識集。Supabase CLI ローカルスタック、Stripe CLI / モック、AI API のモック戦略、シードデータ、dev-setup.sh / dev-check.sh、Playwright との接続、WSL2 の注意点、検証レポートの書式を収録する。テスト計画でのローカル環境要件の宣言、実装タスク0の環境構築、ローカルでのテスト実行時に参照する。「開発環境」「ローカル環境」「環境構築」「Docker」「docker compose」「Supabaseローカル」「ローカルテスト」「dev-setup」で参照。
paths: ["docker-compose.yml", "supabase/**", "scripts/dev-*.sh"]
---

# Local Dev Environment Skill

SaaS の**全機能をローカルのみでテストできる Docker ベースの開発環境**を、案件ごとに迷いなく構築するための共通基盤 Skill。

**「ローカルで動かないものは作らない」**。クラウド（Vercel / Supabase Cloud / Stripe 本番 / AI API）に接続しなくても、アプリ本体・営業ポータル・認証・決済フロー・AI機能・メール送信のすべてが起動し、Unit / Integration / E2E テストが完走する状態を Phase 15 の入口で確立する。

## 参照ファイル

| ファイル | 内容 | いつ読むか |
|---------|------|-----------|
| `references/local-dev-setup.md` | 構成標準（Tier A/B）、docker-compose.yml / dev-setup.sh / dev-check.sh の雛形、Supabase ローカル、Stripe / AI / メールのモック戦略、シードデータ、Playwright 接続、WSL2 注意点、検証レポートテンプレート、トラブルシューティング | 環境要件の宣言・構築・トラブル対応のとき |

## 原則

1. **環境要件はテスト計画で先に宣言する**。Phase 13 の test-strategy.md に「ローカル完結テスト環境要件」節を設け、何をローカル実体で動かし何をモックにするかを決めておく（構築時の判断ブレを防ぐ）
2. **Phase 15 のタスク0は環境構築**。機能実装より先に `bash scripts/dev-setup.sh` 一発で全サービスが起動する状態を作り、`docs/41-test-results/local-env-verification-YYYYMMDD-HHMM.md` に検証結果を残す（このレポートが無ければ Phase 16 に進めない）
3. **営業ポータルも対象**。`(marketing)` ルート（トップ〜法務の8ページ）がローカルで表示・スクショ撮影できること
4. **実体 > エミュレータ > モックの優先順**。DB/認証/ストレージ/メールは Supabase CLI のローカルスタック（実体相当）、Stripe はテストモード + Stripe CLI 転送（オフライン時のみモック）、AI API はモック既定（コスト・再現性）
5. **シードデータで再現可能に**。手作業でのデータ投入を前提にしない。`supabase/seed.sql` + factory で、クリーンな状態から E2E が回る
6. **クラウドの認証情報をローカル環境ファイルに置かない**。`.env.local` はローカルスタックのキーのみ。`.env.local.example` をコミットし、実ファイルは gitignore
7. **1名運用に耐える軽さ**。常時起動が必要なコンテナを最小限にし、`dev-check.sh` で状態が一目で分かるようにする
