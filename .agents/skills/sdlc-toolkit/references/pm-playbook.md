# PM プレイブック（フェーズ表・status.md・Go/No-Go・文書セット）

project-manager（Codex のルートセッション自身）がフェーズを進めるための正本。共通契約は `SKILL.md`、修正ループは `rework-loop.md`。

## 1. フェーズ表

| Phase | 名称 | producer | reviewer / ゲート | 主な成果物 | 並列・備考 |
|------:|------|----------|-------------------|-----------|-----------|
| 0 | 持ち込み資料 | （ユーザー） | — | `docs/00-inputs/{rfp.md,existing-concept.md,materials/}` | 無くても可。PM が Glob で確認し、一度だけ案内 |
| 1 | 企画 | concept-planner | — | `docs/01-concept/concept.md`, `docs/00-inputs/INDEX.md` | 既存企画書があれば取り込む |
| 2 | 企画レビュー | — | concept-reviewer | `docs/01-concept/reviews/` | Approve 後に**文書セット確定**（§4） |
| 3 | ビジネス・マーケティング戦略 | business-strategist | — | `docs/02-business-strategy/business-strategy.md` | 広告が主戦チャネルなら Approve 後に ad-strategy-specialist を早期起動可 |
| 4 | 戦略レビュー | — | business-strategy-reviewer | `docs/02-business-strategy/reviews/` | |
| 5 | 要件定義 | requirements-architect | — | `docs/03-requirements/{upstream-reconciliation,requirements,business-requirements,use-cases,non-functional,permissions-matrix,glossary,open-questions,decision-log}.md` | 起動条件：Phase 2・4 が Approve。突合表を先に作る |
| 6 | 要件レビュー | — | requirements-reviewer | `docs/03-requirements/reviews/` | Approve 後、Handoff の完了判断材料で **Phase 7 着手判断**（着手／縮小／棚上げ／中止） |
| 7 | 業務設計・技術選定・ブランド | business-flow-designer, tech-stack-architect, brand-design-strategist | — | `docs/10-business-design/`, `docs/11-tech-stack/`, `docs/12-brand-design/` | 3 体並列。pricing-strategist / cost-guardian はここ以降オンデマンド |
| 8 | 同レビュー | — | planning-reviewer | 各 `reviews/` | 指摘ごとに差し戻し先を分ける |
| 9 | 外部設計 | external-designer, marketing-site-builder（モックアップモード） | — | `docs/20-external-design/`（mockups/ 含む）, `docs/15-marketing-site/mockups/` | 2 体並列。営業ポータルモックは document-set で除外した案件以外は必須。MCP 面がある案件は mcp-server-specialist も |
| 10 | 外部設計レビュー | — | external-design-reviewer ＋ ui-mockup-reviewer（＋agent-experience-reviewer） | 各 `reviews/` | **全員 Approve** で通過。ループは reviewer ごとに独立。差し戻し先：文書・アプリ画面 → external-designer、営業ポータル → marketing-site-builder、MCP → mcp-server-specialist |
| 11 | 内部設計 | internal-designer | — | `docs/30-internal-design/` | |
| 12 | 内部設計レビュー | — | internal-design-reviewer | `reviews/` | |
| 13 | テスト計画 | test-planner, test-case-adversary | — | `docs/40-test-plan/`（test-strategy / test-cases / case-derivation-matrix / adversarial-cases / case-reconciliation / e2e-scenarios / test-data / non-functional-tests） | 並列起動 → 両者完了 → test-planner を**突合モード**で再起動。adversary には「docs/40-test-plan/ を読まない」と伝える。test-strategy に「ローカル完結テスト環境要件」節が要る |
| 14 | テスト計画レビュー | — | test-plan-reviewer | `reviews/` | |
| 15 | 実装＋Unit/Integration | implementation-worker, tester | — | コード, `docs/41-test-results/{local-env-verification,unit-integration,mutation}-*.md` | **タスク0＝ローカル開発環境**を機能実装より先に。検証レポートが無ければ 16 に進めない。tester は仕様のみから先に書く（ブラックボックス・ファースト） |
| 16 | ユースケース E2E | e2e-usecase-tester | （自身がブロッカー判定） | `tests/e2e/usecases/`, `docs/41-test-results/usecase-e2e-*.md` | 3 回連続 Green で通過。実装バグは 15 へ |
| 16.5 | 探索的・敵対的テスト | exploratory-tester | （Critical で Block） | `docs/41-test-results/exploratory-*.md`, 再現テスト, `bug-escape-ledger.md` | 17 と並列可 |
| 17 | 要件トレーサビリティ監査 | — | requirement-traceability-auditor | `docs/41-test-results/traceability-audit-*.md` | MUST 機能の E2E 未カバーで Block → 16 へ。計画の宣言不足なら 13 へ |
| 18 | 実装＋全テスト結果レビュー | — | implementation-reviewer ＋ security-auditor | `reviews/`, `docs/41-test-results/security-audit-*.md` | 並列。16 / 16.5 / 17 のレポートが無ければ Block |
| — | デプロイ判断 | PM | Go/No-Go（§3） | | |
| 19 | リリース・計測開始 | PM ＋ observability-integration-specialist | — | `docs/60-operations/{release-log,kpi-baseline}.md` | kpi-baseline の目標値は戦略書の KPI-NN。無ければ 20 に進めない |
| 20 | 運用レビュー | operations-analyst | — | `docs/60-operations/ops-review-YYYY-MM.md` | 月次（成長期は週次）。cost-guardian 月次と同時起動が効率的 |
| 21 | 改善起票 | retrospective-facilitator | — | `docs/60-operations/{retrospective-YYYY-MM,improvement-backlog}.md`, PROJECT_LEARNINGS 転記 | バックログ上位の着手判断はユーザーに提示。種別：フル（5 から／企画見直しは 1 から／戦略見直しは 3 から）・軽量（`changes/CR-NNN.md`）・ホットフィックス |

### オンデマンド（固定フェーズなし。PM が必要性を見て起動・提案する）

| エージェント | 目安 | 成果物 |
|--------------|------|--------|
| pricing-strategist | Phase 7 以降、営業サイト・決済設計の前 | `docs/10-business-design/pricing-strategy.md` |
| cost-guardian | 技術選定直後、運用開始後は月次 | `docs/11-tech-stack/cost-estimate.md` |
| mcp-server-specialist / agent-experience-reviewer | AI 向け提供が決まった案件の Phase 9〜15 | `docs/20-external-design/agent-interface.md` |
| onboarding-designer | Phase 9 で主要画面が固まった後 | `docs/20-external-design/onboarding-flow.md` |
| visual-director → page-designer | 営業サイト本実装の前 | `docs/15-marketing-site/{moodboard/,visual-style-guide.md}` |
| seo-specialist → blog-content-producer | 営業サイト設計以降、公開後も継続 | `docs/15-marketing-site/{seo-plan,content-calendar}.md` |
| ad-strategy-specialist | 戦略書で広告が主戦チャネル、または SEO 飽和が見えたとき | `docs/15-marketing-site/ad-strategy.md` |
| promo-video-producer | LP・広告に動画が要るとき | `docs/15-marketing-site/promo-video-plan.md` |
| legal-docs-generator | 営業サイト公開前、データモデル確定後 | `docs/50-legal/` |
| auth / payment / line / mobile / observability の各 specialist | 該当機能の設計・実装・レビュー時に producer から委譲、または PM が直接 | 各設計文書への節追加・実装支援 |
| security-auditor | Phase 18 と並列（準必須）、単発監査にも | `docs/41-test-results/security-audit-*.md` |

## 2. status.md

`docs/99-pm/status.md` がプロジェクトの単一の真実。初回起動時に無ければ作る（`.framework-version` を記録）。

```markdown
# プロジェクト進捗
- プロジェクト名 / 開始日 / 最終更新 / 現在フェーズ: Phase X / 21 / 次のアクション / フレームワーク版

## フェーズ別ステータス
| Phase | 名称 | ステータス | 担当 | 成果物 | Verdict | ループ | 完了日 |
（0〜21 を全行。ループ列は N/5。複数 reviewer は「文書 2/5・モック 3/5」のように併記）

## オンデマンド系ステータス
| エージェント | ステータス | 成果物 | Verdict | ループ | 完了日 |（起動したものだけ）

## 運用サイクル
| サイクル | 期間 | ops-review | 改善起票 | 種別 | 状態 |

## エスカレーション履歴 / リスク・課題 / 意思決定ログ / 還流ループ記録
```

凡例：⏳ 待機・🚧 進行中・🔄 レビュー中・🔁 再レビュー中・⛔ Block 中・✅ 完了・⚠️ エスカレーション。

## 3. デプロイ Go/No-Go

Phase 18 の両レビュワーが Approve したら PM が判定する。**ひとつでも欠ければ No-Go** とし、差し戻し先を示す。

- `docs/41-test-results/` に local-env-verification / usecase-e2e / exploratory / traceability-audit / security-audit の最新レポートがあり、ブロッカー・Critical・Block 項目が残っていない
- E2E が 3 回連続 Green。クリティカルモジュールのミューテーションスコアが目標（80%）に達している
- `bug-escape-ledger.md` の全行に「チェックリスト反映」がある
- `npm test` / `npm run build` / `npm audit --audit-level=high` が通る
- 法務文書（採用案件のみ）、ロールバック手順（runbook）、`htmldocs/` の再生成が済んでいる

Go の直後に Phase 19 へ入る。「案件終了」で止まらない。

## 4. 文書セット（Phase 2 Approve 直後）

concept-planner の Handoff にあるプロファイル候補（`full-saas` / `internal-tool` / `api-mcp` / `minimal`。定義は `document-catalog.md` §3）を初期値に、作成する文書の一覧をユーザーに提示して承認を得る。結果を `docs/99-pm/document-set.md` に書く（除外には理由）。以後、producer には採用文書だけを依頼し、reviewer には除外文書の不存在を指摘させない。営業ポータルモックなど「必須だが除外したい」ものの承認記録もこのファイルが兼ねる。

## 5. PM が判断する場面

- Phase 6 Approve 後の着手判断（requirements-architect の Handoff：決まらない要件・要求量・投資と効果）
- 上流差し戻し（Handoff の候補を見て：OBJ・スコープ・ターゲットが変わる → Phase 1、収益・チャネル・KPI・営業ポータル要否が変わる → Phase 3。ループ回数は上流フェーズの新規ループとして別枠）
- Warning の受容、ループ上限（5 回）到達、上流と下流の矛盾、Phase 21 のバックログ着手。**ここだけユーザーに聞く**。それ以外は進める
- htmldocs の再生成：各レビュー Approve 時・Go 判定時・ops-review 後に `node .agents/skills/sdlc-toolkit/scripts/build-htmldocs.mjs`
- フェーズ完了時に PROJECT_LEARNINGS.md への記録を一行で促す。30 日以上更新が無ければ月次、3 か月以上還流が無ければ四半期の還流レビューを提案する（`docs/operations/feedback-loop.md`）
