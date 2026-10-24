#!/bin/bash
# check-harness.sh - エージェント / Skill 定義がハーネス執筆ガイド（docs/operations/harness-authoring-guide.md）に沿っているかを検査する。
# 失敗は exit 1。警告は exit 0。使い方: bash scripts/check-harness.sh [--strict]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AGENTS="$ROOT/.codex/agents"
SKILLS="$ROOT/.agents/skills"
STRICT=0; [ "$1" = "--strict" ] && STRICT=1
ERR=0; WARN=0
err()  { echo "❌ $1"; ERR=$((ERR+1)); }
warn() { echo "⚠️  $1"; WARN=$((WARN+1)); }
frontmatter() { awk 'NR==1{if($0!="---"){exit 1}; next} /^---$/{exit} {print}' "$1"; }

echo "🔍 ハーネス検査"
echo "── agents"
for f in "$AGENTS"/*.toml; do
  base=$(basename "$f" .toml)
  python3 -c "import tomllib,sys;tomllib.load(open(sys.argv[1],'rb'))" "$f" 2>/dev/null || { err "$base: TOML として読めない"; continue; }
  name=$(sed -n 's/^name = "\(.*\)"$/\1/p' "$f" | head -n1)
  desc=$(sed -n 's/^description = "\(.*\)"$/\1/p' "$f" | head -n1)
  [ "$name" = "$base" ] || err "$base: name:$name がファイル名と一致しない"
  [ -n "$desc" ] || err "$base: description が無い"
  dlen=$(printf '%s' "$desc" | wc -m)
  [ "$dlen" -le 400 ] || warn "$base: description が ${dlen} 字（目安 300、上限 400）"
  grep -q '\.agents/skills/sdlc-toolkit/SKILL\.md' "$f" || err "$base: 共通契約（sdlc-toolkit/SKILL.md）を読む指示が無い"
  for s in $(grep -oE '\.agents/skills/[a-z0-9-]+/SKILL\.md' "$f" | sort -u | sed -E 's#\.agents/skills/([a-z0-9-]+)/SKILL\.md#\1#'); do
    [ -d "$SKILLS/$s" ] || err "$base: 存在しない Skill '$s' を参照"
  done
  grep -qE 'v0\.[0-9]+(\.[0-9]+)?' "$f" && warn "$base: 版数注記が残っている"
  size=$(wc -c < "$f"); [ "$size" -le 11264 ] || warn "$base: ${size} bytes（目安 8KB、上限 10KB＋移行注記）"
done

echo "── skills"
for f in "$SKILLS"/*/SKILL.md; do
  dir=$(basename "$(dirname "$f")")
  if ! frontmatter "$f" >/dev/null 2>&1 || [ -z "$(frontmatter "$f")" ]; then err "$dir: frontmatter が無い"; continue; fi
  name=$(frontmatter "$f" | sed -n 's/^name:[[:space:]]*//p' | head -n1)
  desc=$(frontmatter "$f" | sed -n 's/^description:[[:space:]]*//p' | head -n1)
  [ "$name" = "$dir" ] || err "$dir: name:$name がディレクトリ名と一致しない"
  dlen=$(printf '%s' "$desc" | wc -m); [ "$dlen" -le 500 ] || warn "$dir: description が ${dlen} 字"
  lines=$(wc -l < "$f"); [ "$lines" -le 500 ] || warn "$dir: SKILL.md が ${lines} 行（上限 500）"
  grep -qE 'v0\.[0-9]+(\.[0-9]+)?' "$f" && warn "$dir: SKILL.md に版数注記が残っている"
done

echo "── 差し戻し先・連携先の実在（rework-loop.md / pm-playbook.md）"
for ref in "$SKILLS/sdlc-toolkit/references/rework-loop.md" "$SKILLS/sdlc-toolkit/references/pm-playbook.md"; do
  for a in $(grep -oE '[a-z0-9]+(-[a-z0-9]+)+' "$ref" | sort -u); do
    echo "$a" | grep -qE '(-planner|-reviewer|-strategist|-architect|-designer|-builder|-director|-specialist|-worker|-tester|-auditor|-analyst|-facilitator|-generator|-producer|-guardian|-adversary|-manager)$' || continue
    ls "$AGENTS/$a".* >/dev/null 2>&1 || err "$(basename "$ref"): 存在しないエージェント '$a' を参照"
  done
done

echo ""
echo "結果: エラー $ERR 件 / 警告 $WARN 件"
[ "$ERR" -gt 0 ] && exit 1
[ "$STRICT" = "1" ] && [ "$WARN" -gt 0 ] && exit 1
exit 0
