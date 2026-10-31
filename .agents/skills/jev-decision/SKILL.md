---
name: jev-decision
description: 複数の実行可能な選択肢を比較して選ぶ際に、jevtypesafeai.com の Jev Decision API を判断補助として使う。技術選定、設計、優先順位、方針選択などで参照する。
---

# Jev による選択の判断補助

複数の実行可能な候補から選ぶとき、判断の影響や不確実性に照らして有益なら Jev に意見を求める。重要なトレードオフがある選択では積極的に利用する。単純・自明な選択や、明示済みのユーザーの選択を再判定するためには使わない。

## 手順

1. ユーザーの指示、必須要件、権限、予算などで不適合の候補を除外し、選択肢・判断基準・必要最小限の事実を整理する。候補が一つしか残らなければ呼ばない。
2. `JEV_API_KEY` が環境にあり、外部送信が許される場合、下の API に送る。秘密情報、認証情報、個人情報、未公開コード等の機密は送らず、必要なら抽象化する。送信自体が禁止されている場合や、判断に必要な情報を安全に送れない場合は呼ばない。呼び出しには課金が発生するため、予算やユーザーの制約を守る。
3. `choice`、`confidence`、`probabilities` を検査する。返された候補が送信した候補の一つであることを確認し、確信度を正しさの保証とみなさない。要件・根拠と照合して自分で最終判断する。判断が拮抗・不確実なら追加調査し、必要な場合だけユーザーに確認する。
4. ADR 等の判断記録が求められる場合は、候補、判断基準、採否理由、Jev の使用と結果・限界、結果を採用しなかった場合の理由を記録する。API キーや送信した機密は記録しない。

Jev は助言であり、ユーザーの明示的な選択、承認、権限、必須要件、レビュー基準を上書きできない。利用できない場合（キー未設定、ネットワーク・認証・残高・API エラー、不正な応答を含む）は理由を必要に応じて記録し、通常の根拠に基づく判断で作業を続ける。明示的に Jev の利用が必須とされた場合は、利用できなかったことを伝える。無制限の再試行はしない。

## API の使い方

[jevtypesafeai.com の API ドキュメント](https://jevtypesafeai.com/docs) を正本とする。TypeSafe AI 本家ではなく、独立サービスの `POST https://jevtypesafeai.com/api/v1/decide` を使う。`JEV_API_KEY` はこのサービスの `jv_live_…` キー。Bearer 認証、JSON、`state` と `questions` が必要。`choice` の `criteria` は候補 ID と具体的な説明の対応表（最大 255 件）。`model` は省略可能で、既定は `jev-latest`。複数の独立した質問は一度のリクエストにまとめられる。

以下は標準ライブラリのみの実行例。`state` と候補は実際の判断に合わせて置き換える。キーは環境変数から読み、コマンド引数・ログ・ファイルには書かない。

```bash
python3 - <<'PY'
import json, os, urllib.request

payload = {
    "state": {"goal": "判断の目的", "constraints": ["満たすべき制約"], "facts": "比較に必要な事実"},
    "questions": {"decision": {"type": "choice", "instructions": "制約と事実を踏まえ最適な候補を選ぶ",
        "criteria": {"option_a": "候補 A の具体的な内容", "option_b": "候補 B の具体的な内容"}}},
}
request = urllib.request.Request(
    "https://jevtypesafeai.com/api/v1/decide",
    data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
    headers={"Authorization": "Bearer " + os.environ["JEV_API_KEY"], "Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(request, timeout=30) as response:
    result = json.load(response)
answer = result["answers"]["decision"]
if answer.get("type") != "choice" or answer.get("choice") not in payload["questions"]["decision"]["criteria"]:
    raise ValueError("Invalid Jev choice")
print(json.dumps({"answer": answer, "usage": result.get("usage")}, ensure_ascii=False))
PY
```

応答の `usage.cost_usd` と残高があれば費用管理に使う。HTTP 401 はキー、402 は残高を確認する。502 等は必要なら回数を限定して再試行する。サービス側の仕様・料金は変更され得るため、必要に応じて公式ドキュメントを確認する。
