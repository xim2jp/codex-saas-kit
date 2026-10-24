# 要件定義文書ガイド（v0.17.0）

Phase 5 で作る各文書の目的・粒度・完了基準（誰と合意したら完成か）・整合相手を 1 枚にまとめたもの。「フォーマットは合意したが、どこまで書くかで後からもめる」ことを防ぐ。requirements-architect は作成前に、requirements-reviewer は第 1 パス（文書チェック・集合チェック・整合チェック）で参照する。文書の採否は `docs/99-pm/document-set.md`（sdlc-toolkit の document-catalog.md）が正本。

> 出典：IPA『ユーザのための要件定義ガイド 第2版』第 7 章 DD（36 文書）・3.3 文書体系・コラム 8（記載範囲）・事例 9（粒度レベル）・事例 20（形式品質）・事例 25（完了基準）。本フレームワークの文書体系（document-catalog.md）に写像した。

## 1. Phase 5 の文書と IPA 文書の対応

| 本フレームワークの文書（docs/03-requirements/） | テンプレート | IPA の対応文書 | 全件／主要 | 完成の定義（誰と合意） |
|---|---|---|---|---|
| `upstream-reconciliation.md` 上流突合表 | business-strategy-toolkit/templates | 構想・企画の確認（RM.1.1） | 全件（企画・戦略・RFP の全項目） | PM が矛盾・上流欠落の OQ を確認 |
| `requirements.md` 要件定義書（正本） | templates/requirements-doc.md | ビジネスコンセプト確認／ステークホルダ一覧・リッチピクチャ／ビジネスプロセス関連図（スコープ）／概念データモデル／状態遷移図／外部インターフェース一覧／運用要件・移行計画・総合テスト計画の骨子／ビフォーアフター図 | ステークホルダ・外部 I/F は全件。概念データモデルは主要エンティティ＋主要属性。状態遷移は主要管理対象のみ | 発注者（自社なら本人）がレビュー済み。Phase 6 Approve |
| `business-requirements.md` 業務要件一覧 | templates/business-requirements.md | 問題・ニーズ・課題一覧／問題原因分析／要求構造図／要求一覧 | **全件**（全要求に BZ。棄却・先送りも残す） | 要求の提示元（顧客・本人）が採否を確認 |
| `use-cases.md` ユースケース一覧 | templates/use-cases.md | システム化業務一覧／システム化要求仕様／業務処理定義／業務機能構成表（人手作業の行） | 一覧は**全件**（人手のみの作業も）。記述は採用 UC 全件 | 業務担当者が基本・例外シナリオを確認 |
| `non-functional.md` 非機能要件一覧 | templates/non-functional.md | 非機能要件書／運用要件書／全体移行計画書 | 6 カテゴリ全件（対象外も理由付きで行を置く） | 発注者が §0 ビジネス領域を確認。tech-stack-architect が実現性を確認 |
| `permissions-matrix.md` ロール・権限（初版） | templates/permissions-matrix.md | CRUD 図／UI 標準のユーザ定義 | ロールは全件。CRUD は主要エンティティのみ | 発注者が業務ルールとして確認。Phase 9 で確定版 |
| `glossary.md` 用語集 | templates/glossary.md | 業務用語定義／管理対象分類図 | 使った用語は全件（成長型） | 禁止語が他文書に残っていない |
| `open-questions.md` 要確認事項一覧 | templates/open-questions.md | 要件未決事項台帳／変更要求リスト | 全件 | 発注者が未決の先送りに合意 |
| `decision-log.md` 決定ログ | templates/decision-log.md | レビュー記録・変更要求の採否記録 | 全件 | — |
| `user-stories.md`（○・任意） | — | — | 採用時のみ | B2C・UX 重視案件 |

## 2. 下流で作る文書（Phase 5 では作らない。要件で確定する部分だけ書く）

| IPA の文書 | 本フレームワークの正本 | Phase 5 で確定しておくこと |
|---|---|---|
| 業務フロー／システム化業務フロー | `10-business-design/business-flow.md`（Phase 7） | UC の基本フロー、To-Be の変革ポイント、スコープ境界、例外・特殊処理の抽出結果 |
| 業務機能構成表 → 機能一覧 | `10-business-design/feature-list.md`（Phase 7、F-NNN） | BZ の IT 手段行（F の親） |
| 業務処理定義書（案件固有の複雑処理） | `10-business-design/business-rules/PS-NNN-*.md`（Phase 7 → 9） | 業務ルールの表・式（UC 内）、理由 |
| バッチ・通知・外部連携一覧 | `10-business-design/batch-jobs.md` / `notifications.md` / `external-integrations.md` | 外部 I/F 一覧（requirements.md §外部インターフェース）、バッチ UC |
| 画面一覧・画面遷移・画面レイアウト・UI 標準 | `20-external-design/`（Phase 9）＋`12-brand-design/design-system.md` | 権限区分ごとの表示差（permissions-matrix §5）、顧客向け画面のリーガルチェック要否 |
| エンティティ一覧・定義・ドメイン・コード体系 | `20-external-design/data-model.md`（Phase 9） | 主要エンティティと多重度、件数・保存期間（NFR）、ID に意味を持たせない方針、同義語の統一（glossary） |
| 帳票一覧・レイアウト | `20-external-design/`（Phase 9） | 「帳票は作らず CSV／PDF（Stripe 生成）で済ます」判断、外部提供帳票（請求書）のインボイス対応 |
| 総合テスト計画書 | `40-test-plan/`（Phase 13）、E2E（Phase 16） | 受入テスト観点（通常／異常／例外／特殊＋日次／月次／年次サイクル）と完了判断基準（requirements.md §受入基準） |
| 全体移行計画書 | `30-internal-design/data-migration.md`（Phase 11）、runbook | 公開方式（スモールスタート）、並行利用、データ取込とクレンジング責任、切り戻し条件（NFR-MIG） |
| 運用要件書 | `60-operations/runbook.md`（Phase 19） | サービス時間・計画停止・1 名運用体制・サポート SLA・運用スケジュール（NFR-OPS） |
| ビフォーアフター図 | 提案書 §0（クライアント案件）／営業ポータルのコピー素材 | requirements.md §Before/After に 1 枚 |

## 3. 粒度の基準

- **要件定義 vs 外部設計**：要件定義は「何を・なぜ」と業務ルール。画面項目・API・テーブル定義は書かない。概念データモデルは「全エンティティ＋主要属性」まで、外部設計で「全属性」
- **業務機能の階層**：レベル 1＝対象業務全体、レベル 2＝主要業務（UC の業務領域）、レベル 3＝UC、レベル 4＝UC 内の手順（シナリオの行）。要件定義はレベル 4 まで書いて合意する（「総論賛成・各論反対」を防ぐ）
- **全件が必要な一覧**：業務要件一覧、UC 一覧、ロール、外部 I/F、OQ、用語。**主要でよいもの**：概念データモデルの属性、状態遷移の対象、CRUD の対象エンティティ
- **後続で全件を補完する関係**を明示する：要件定義の UC 基本フロー（変わる業務中心）→ Phase 7 の業務フロー（システム化する全業務）
- 記載サンプル（各テンプレートの例示行）で詳細度を合意し、最初の 10 行を書いた時点で粒度を点検する

## 4. 文書間の整合（reviewer の整合チェック）

| チェック | 内容 | Grep の例 |
|---------|------|----------|
| 従属値一致 | 同じ ID に同じ名称（BZ-003 の手段名が requirements.md と business-requirements.md で一致。UC 名が一覧と記述で一致） | `grep -rn "BZ-003" docs/03-requirements` |
| 重複 | 同名の UC・BZ・用語が複数の ID を持っていない | 名称でソートして重複を見る |
| 参照元存在 | UC が参照する BZ・ROLE・用語・NFR が定義されている。requirements.md の MVP スコープが参照する BZ が採用行である | 参照 ID を抽出し定義側に存在するか照合 |
| 方向の整合 | 採用 BZ（IT 手段）に UC か NFR がある（フォワード）。親 BZ の無い UC が無い（バックワード） | |
| 上流整合 | OBJ・SEG・KPI の転記が concept／strategy の原文と一致 | upstream-reconciliation.md §5 |
| 禁止語 | glossary §4 と writing-rules §4 の語が残っていない | `grep -rnE "ユーザ|顧客|…" docs/03-requirements` |

## 5. 文書構成の宣言（requirements.md §0 に書く）

要件定義書の冒頭で、本案件で採用した文書と、各文書がどの文書を参照するかを宣言する。IPA の「成果物関連図」に当たる。

```
requirements.md（正本）
 ├─ 参照：concept.md（OBJ）／business-strategy.md（SEG・KPI）／upstream-reconciliation.md
 ├─ business-requirements.md（BZ：問題・課題 → 目的 → 手段。採否）
 │    └─ use-cases.md（UC：採用 IT 手段の振る舞い）
 │    └─ non-functional.md（NFR：6 カテゴリ）
 ├─ permissions-matrix.md（ROLE × UC × ENT）
 ├─ glossary.md（用語・禁止語）
 ├─ open-questions.md（OQ：矛盾・未決・変更要求）→ decision-log.md
 └─ 下流：feature-list.md（F ← BZ）／business-flow.md／data-model.md／e2e-scenarios.md（← UC）
```

採用しなかった文書（document-set.md で除外）は、ここに「除外（理由）」として 1 行残す。
