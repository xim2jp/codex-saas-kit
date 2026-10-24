# 上流突合表（docs/03-requirements/upstream-reconciliation.md）

> この文書について：企画書（docs/01-concept/concept.md）・ビジネス・マーケティング戦略書（docs/02-business-strategy/business-strategy.md）・RFP（docs/00-inputs/rfp.md）の 3 入力を 1 項目ずつ突合し、要件定義の採用方針と矛盾の OQ を確定する。requirements-architect がヒアリング開始前に作成する。想定読者：PM・requirements-reviewer・発注者。
> 関連文書：持ち込み資料一覧（docs/00-inputs/INDEX.md）／決定ログ（docs/03-requirements/decision-log.md）／要確認事項一覧（docs/03-requirements/open-questions.md）

- **作成日**：YYYY-MM-DD　**作成者**：requirements-architect
- **RFP の有無**：あり（docs/00-inputs/rfp.md）／ なし（企画×戦略の 2 入力で突合）

## 1. 突合表

判定の凡例：一致 ／ 補完（片方のみ・矛盾なし）／ 矛盾（OQ 必須）／ 上流欠落（RFP にあるが企画・戦略に無い。OQ 必須・要件には入れない）

| # | 項目 | 企画書の記載 | 戦略書の記載 | RFP の記載 | 判定 | 要件定義での扱い | OQ |
|---|------|-------------|-------------|-----------|------|-----------------|-----|
| 1 | 達成目標 OBJ-01 | | | | | | |
| 2 | ターゲット（SEG-01） | | | | | | |
| 3 | 成果物スコープ：営業ポータル | 含める | 必要 | 記載なし | 補完 | スコープ節に「営業ポータルあり」を明記 | |
| 4 | 収益モデル | | | | | | |
| 5 | 価格帯 | | | | | | |
| 6 | 想定規模（SOM） | | | | | NFR の規模根拠 | |
| 7 | 期限 | | | | | | |
| 8 | RFP 要求：〈機能名〉 | 記載なし | 記載なし | あり | 上流欠落 | 要件に入れず OQ | OQ-00N |

## 2. 矛盾・上流欠落の一覧（OQ へ転記済み）

| OQ | 内容 | 仮決め（優先順位ルール） | ユーザー判断 | 差し戻し候補 |
|----|------|------------------------|-------------|-------------|
| OQ-00N | | | 未 | Phase 1 ／ Phase 3 ／ なし |

## 3. 上流差し戻し候補（PM 判定用）

- Phase 1（企画）へ：
- Phase 3（戦略）へ：
- 差し戻し不要（差分追記で済む）：
