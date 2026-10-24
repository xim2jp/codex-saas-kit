#!/bin/bash
# loop-metrics.sh - ループ計測（lifecycle-loop.md 準拠、v0.13.0）
# status.md / reviews/ / bug-escape-ledger.md から PDCA の Check 材料を機械集計し、
# docs/60-operations/loop-metrics-YYYY-MM.md に出力する。
# 使い方: プロジェクトルートで bash scripts/loop-metrics.sh

set -e

STATUS="docs/99-pm/status.md"
LEDGER="docs/41-test-results/bug-escape-ledger.md"
OUT_DIR="docs/60-operations"
OUT="$OUT_DIR/loop-metrics-$(date +%Y-%m).md"

mkdir -p "$OUT_DIR"

{
  echo "# ループ計測レポート $(date +%Y-%m)"
  echo ""
  echo "- 生成日時: $(date '+%Y-%m-%d %H:%M')"
  echo "- 生成: scripts/loop-metrics.sh（lifecycle-loop.md 準拠）"
  echo ""

  # 1. フェーズ別ループ回数（status.md の「ループ」列 = N/5 形式）
  echo "## 1. フェーズ別ループ回数（status.md より）"
  echo ""
  if [ -f "$STATUS" ]; then
    echo "| Phase | ループ記録 |"
    echo "|-------|-----------|"
    grep -E '^\|\s*[0-9]+(\.[0-9]+)?\s*\|' "$STATUS" | while IFS='|' read -r _ phase name _ _ _ _ loop _; do
      loop_trim=$(echo "$loop" | tr -d ' ')
      if [ -n "$loop_trim" ] && [ "$loop_trim" != "-" ]; then
        echo "| $(echo "$phase" | tr -d ' ') $(echo "$name" | sed 's/^ *//;s/ *$//') | $loop_trim |"
      fi
    done
    echo ""
    echo "（記録が無い＝ループ列未記入。3回以上のフェーズは L0 Self-Check か上流品質の見直し候補）"
  else
    echo "⚠️ $STATUS が見つかりません"
  fi
  echo ""

  # 2. Verdict 分布（reviews/ 配下の機械可読 Verdict ブロック）
  echo "## 2. Verdict 分布（reviews/ 配下）"
  echo ""
  BLOCKS=$(grep -rh "^VERDICT: BLOCK" docs/*/reviews/*.md 2>/dev/null | wc -l)
  WARNS=$(grep -rh "^VERDICT: WARNING" docs/*/reviews/*.md 2>/dev/null | wc -l)
  APPROVES=$(grep -rh "^VERDICT: APPROVE" docs/*/reviews/*.md 2>/dev/null | wc -l)
  echo "| Verdict | 件数 |"
  echo "|---------|------|"
  echo "| BLOCK | $BLOCKS |"
  echo "| WARNING | $WARNS |"
  echo "| APPROVE | $APPROVES |"
  echo ""

  # 3. バグ・エスケープ台帳の集計（混入フェーズ × 発見フェーズ）
  echo "## 3. バグ・エスケープ集計（bug-escape-ledger.md より）"
  echo ""
  if [ -f "$LEDGER" ]; then
    TOTAL=$(grep -cE '^\|\s*BUG-' "$LEDGER" 2>/dev/null || echo 0)
    UNREFLECTED=$(grep -E '^\|\s*BUG-' "$LEDGER" 2>/dev/null | awk -F'|' '{gsub(/ /,"",$9); if ($9=="" || $9=="-") print}' | wc -l)
    echo "- 記録バグ総数: $TOTAL 件"
    echo "- チェックリスト反映が空欄の行: $UNREFLECTED 件（**0 でなければ Phase 18 / デプロイ Go の Block 対象**）"
    echo ""
    echo "### 発見フェーズ別件数"
    echo ""
    grep -E '^\|\s*BUG-' "$LEDGER" 2>/dev/null | awk -F'|' '{gsub(/^ +| +$/,"",$4); print $4}' | sort | uniq -c | sort -rn | while read -r cnt ph; do
      echo "- $ph: $cnt 件"
    done
    echo ""
    echo "### 混入フェーズ別件数（多いフェーズ＝弱点。レビュー観点/Self-Check の強化候補 → L3 還流）"
    echo ""
    grep -E '^\|\s*BUG-' "$LEDGER" 2>/dev/null | awk -F'|' '{gsub(/^ +| +$/,"",$5); print $5}' | sort | uniq -c | sort -rn | while read -r cnt ph; do
      echo "- $ph: $cnt 件"
    done
  else
    echo "（台帳なし。バグ記録が 1 件も無い場合は正常）"
  fi
  echo ""
  echo "## 4. 解釈メモ（retrospective-facilitator が記入）"
  echo ""
  echo "- "
} > "$OUT"

echo "✅ 出力: $OUT"
