# ハーネス執筆ガイド（agents / skills / hooks / MCP / plugin）

このフレームワークの `.codex/`・`.agents/skills/` 配下は、Codex の最新世代モデルを前提に書く。旧世代向けの「手順を一歩ずつ指示し、禁止事項を繰り返して縛る」書き方は捨て、**役割・入出力・品質基準・判断の軸**を簡潔に渡す。モデルは与えられた目的と制約から手順を自分で組める。この文書は、エージェント定義と Skill を新設・改訂するときの正本である。Claude Code 版（noguchi-saas-framework）の同名ガイドを本キットの仕組みに写したもの。

## 1. 設計原則

1. **一度だけ書く**。全エージェント共通の作法（成果物の置き場、Handoff、Self-Check、Verdict、修正ループ、オーナー制約）は `sdlc-toolkit/SKILL.md` にだけ書き、各エージェントは定義冒頭の「作業開始時に読む Skill」の指示で読み込む。エージェント本文で共通作法を再説明しない。
2. **意図と不変条件を書き、手順は書かない**。「第 1 パスで A、第 2 パスで B」のような段取りは不要。何を達成するか、何が満たされていなければ Block か、どこで迷ったら誰に聞くか、を書く。
3. **守らせたい不変条件は 1 か所に一度だけ書く**。Codex には Claude Code 版の hooks に相当する強制の仕組みが無いため、`docs/00-inputs/` の読み取り専用とレビューレポートの Verdict ブロック必須は共通契約に書き、PM がフェーズ完了時に確認する。プロンプトで「絶対禁止」を繰り返さない。
4. **履歴を書かない**。「v0.8.0 で追加」のような版数注記は CHANGELOG の仕事。プロンプトには現在の仕様だけを書く。
5. **描写は短く、判断材料は厚く**。ドメインのチェック観点・Block 条件・固有ノウハウは残す。言い換え・強調・重複は削る。
6. **モデルは固定しない**。エージェント定義に `model` を書かず、セッション既定のモデルを継承する。コスト上の理由で固定したいときだけ案件側で上書きする。
7. **信頼する**。モデルは文脈を読み、必要な参照を自分で開く。「必読」「必ず Read」は、読まないと成果物が壊れる入力に限って書く。

## 2. エージェント定義のテンプレート

```toml
# Codex サブエージェント定義（.claude/agents/<name>.md から移行）
name = "<kebab-case。ファイル名と一致。改名は破壊的変更>"
description = "<1〜3 文、300 字以内。何をする／いつ使う／起動語>"

developer_instructions = '''
> **作業開始時に読む Skill**：`.agents/skills/sdlc-toolkit/SKILL.md`（共通契約）、`.agents/skills/<ドメイン Skill>/SKILL.md`

# <役割名>
<1〜3 段落：責任と姿勢、上流を勝手に変えない線引き>

## 入力 / ## 成果物 / ## 品質基準 / ## 判断の軸 / ## 連携

## ツール権限（Codex 移行注記）   ← レビュワーなど制限が要る役割だけ
'''
```

- 本文は 150 行・8KB 以内を目安。超えるなら知識を Skill の references に移す
- `developer_instructions` の中に `'''` を書かない（TOML の複数行リテラルが閉じる）
- project-manager はルートセッション自身が `AGENTS.md` 経由で読むロール。サブエージェントとして起動しない（Codex のサブエージェントは他のエージェントを起動できない。`.codex/config.toml` の `max_depth = 1`）
- 書いてよいこと／書かないことは Claude Code 版と同じ：成果物パス・Block 条件・固有ノウハウ・判断の軸・連携先を書き、共通作法の再説明・実行手順・版数注記・「必読」の反復・他エージェントの責務説明は書かない

## 3. Skill のテンプレート

```markdown
---
name: <kebab-case。ディレクトリ名と一致>
description: <何の知識集か＋どの場面で参照するか＋起動語。400 字以内>
---

# <Skill 名>

<2〜3 段落：この領域で一貫して守る原則。野口さん固有の判断があればここ>

## 参照ファイル
| ファイル | 内容 | いつ読むか |

## 原則
<番号付き、1 項目 1〜2 行。各項目は「なぜ」を含む>

## アンチパターン
<箇条書き。実際に起きた失敗を優先>
```

- SKILL.md は **500 行以内**。深い知識は `references/`、雛形は `templates/`、実行物は `scripts/` に置く
- 「エージェント別の使い方ガイド」節は書かない（各エージェント定義が自分の入出力を知っている。重複は乖離の元）
- `paths:`（触れたファイルで自動ロード）と `context: fork` は Claude Code 版の拡張。Codex では効かないが、同じ SKILL.md を両方で使うため消さずに残す

## 4. 機械で守れない不変条件の扱い

Claude Code 版は `docs/00-inputs/` の書き込み拒否とレビューレポートの Verdict ブロック検査を hooks で強制している。Codex では次の規約で代える。

| 不変条件 | 守り方 |
|---------|-------|
| `docs/00-inputs/` は INDEX.md 以外書き換え禁止。`htmldocs/` は生成物 | 共通契約に一度だけ書く。PM がフェーズ完了時に `git status docs/00-inputs/` で改変が無いことを確かめる |
| `reviews/*-loopN.md` に Verdict ブロック 4 行 | 共通契約に書式を置く。PM は 4 行が揃わないレポートを書き直させてから分岐する |

## 5. MCP サーバー

- 常時接続は増やさない（ツール定義がコンテキストを食う）。登録は作業単位で付け外す
- 案件に配布する雛形は `templates/project-init/mcp-servers.example.toml`。使うものだけ `.codex/config.toml` の `[mcp_servers.<name>]` に写す
- トークンは `env_http_headers` / `bearer_token_env_var` で環境変数を参照し、値をコミットしない
- 選定基準・候補一覧は `external-tools-catalog` Skill が正本

## 6. 改訂時のチェック

`bash scripts/check-harness.sh` がエージェント定義の name 一致・description・共通契約を読む指示、Skill の frontmatter と description 長、版数注記、サイズ、差し戻し先エージェントの実在を検査する。`scripts/check-layout-drift.sh` と合わせて改訂のたびに走らせる。plugin 配布は Claude Code 版だけの仕組みで、本キットはコピー配布（new-project.sh / update-project.sh）のみ。
