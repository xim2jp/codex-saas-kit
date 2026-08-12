# k6 での負荷試験

k6（Grafana Labs）で SaaS の主要エンドポイントに負荷をかけ、性能が破綻しないことを確認する。JavaScript でシナリオを書き、CLI で実行し、閾値（thresholds）で pass/fail を自動判定する。

## インストール・基本実行

```bash
# ローカル実行（macOS）
brew install k6

# ローカル実行（Linux/CI）
sudo apt-get install k6   # または公式バイナリを直接配置

# 実行
k6 run script.js
```

## シナリオ設計の考え方

k6 は VU（Virtual User）という仮想ユーザー単位で負荷を発生させる。**MVP では複雑なシナリオを量産しない**。以下の3種類で足りることが多い。

| シナリオ種別 | 目的 | k6 の options 例 |
|-------------|------|-------------------|
| **smoke** | 最小構成で動作確認（CI で毎回実行） | `vus: 1, duration: '30s'` |
| **average load** | 想定通常時の同時接続を再現 | `stages` で緩やかに増減 |
| **spike** | 想定ピーク（LP掲載直後、キャンペーン等）を再現 | `stages` で急増急減 |

```javascript
// k6/smoke.js — CI で毎回実行する最小テスト
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${__ENV.BASE_URL}/api/health`);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

```javascript
// k6/average-load.js — 想定通常時の同時接続を再現
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // 立ち上げ
    { duration: '3m', target: 10 },   // 定常負荷を維持
    { duration: '1m', target: 0 },    // クールダウン
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<3500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${__ENV.BASE_URL}/dashboard`);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(Math.random() * 3 + 1); // 実ユーザーの操作間隔を模擬
}
```

```javascript
// k6/spike.js — LP掲載直後・キャンペーン直後のアクセス集中を再現
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '10s', target: 5 },
    { duration: '30s', target: 50 },  // 急増
    { duration: '1m', target: 50 },
    { duration: '30s', target: 5 },   // 急減
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // spike 時は緩めの閾値
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  http.get(`${__ENV.BASE_URL}/`);
}
```

## Vercel/Supabase 無料枠での現実的な負荷目標

**汎用的な数値を輸入せず、想定ユーザー数から逆算する**のが原則。目安として：

| 案件規模 | 想定同時接続 | smoke目標 | average load目標 | spike目標 |
|---------|-------------|-----------|-------------------|-----------|
| 個人〜小規模事業者向けMVP | 1〜10 | p95 < 1s, エラー率 <1% | VU 5〜10 で p95 < 2s | VU 30〜50 短時間で p95 < 3s |
| 中小企業向け一般SaaS | 10〜50 | 同上 | VU 30〜50 で p95 < 2s | VU 100 程度で p95 < 3s |

**無料枠を意識した制約**：
- Vercel Hobby / Supabase Free には**レート制限・同時接続数の上限**がある。負荷試験の VU 数がこの上限に達すると「性能問題」ではなく「無料枠の制限」を検出しているだけになるため、事前に上限を確認する
- 本番相当の負荷試験は**必ずステージング/プレビュー環境**に対して行う（本番の無料枠を食いつぶさない、実ユーザーに影響を与えない）
- Supabase 側（DB クエリ）がボトルネックになりやすい。API 経由だけでなく、重いクエリを直接 k6 から叩くシナリオも検討する

## 閾値（thresholds）— pass/fail の自動判定

閾値は k6 のテスト結果を CI で機械的に pass/fail させる仕組み。

```javascript
export const options = {
  thresholds: {
    http_req_duration: ['p(95)<2000'],      // 95%ile が 2秒未満
    http_req_failed: ['rate<0.01'],         // エラー率 1%未満
    'http_req_duration{endpoint:checkout}': ['p(95)<3000'], // タグ別の閾値
  },
};
```

- 閾値に違反すると k6 は非ゼロの exit code で終了する → CI で自動的に fail 扱いにできる
- クラウド実行時は閾値評価が60秒ごとに行われるため、`abortOnFail` の反応が最大60秒遅れる点に注意
- **決済フロー（Checkout API 等）は他エンドポイントより厳しめの閾値**にする。ユーザーが離脱すると売上に直結するため

## CI 組み込み（GitHub Actions）

```yaml
# .github/workflows/load-test.yml
name: Load Test (smoke)
on:
  pull_request:
    branches: [main]

jobs:
  k6-smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run k6 smoke test
        uses: grafana/k6-action@v0.3.1
        with:
          filename: k6/smoke.js
        env:
          BASE_URL: ${{ secrets.PREVIEW_URL }}
```

- **PR時**：smoke のみ（数十秒で完了、レイテンシ回帰の早期検出）
- **main merge時 or 週次**：average load を追加実行（時間がかかるため毎PRでは回さない）
- **spike**：リリース前・大型キャンペーン前に手動実行で十分。CI に毎回組み込むと無料枠を消費しすぎる

## Grafana Cloud k6（クラウド実行）

ローカル/CI runner のマシンスペックに依存せず、分散負荷生成やダッシュボードでの結果可視化が必要になったら検討する。

- **無料枠**：月間 500 k6 VUh（Virtual User時間）、結果の保持期間14日
- 1名運用の MVP では**ローカル/CI 実行の k6 OSS で十分**なことが多い。VUh を消費する分散負荷や長時間試験が必要になった案件（契約でSLAが明記される等）でのみ Grafana Cloud k6 に移行する
- 移行时は `k6 run --out cloud script.js` で結果をクラウドに送信できる（ローカルスクリプトの書き換え不要）

## 結果の読み方（最低限）

```
http_req_duration..............: avg=120ms min=45ms med=98ms max=890ms p(90)=210ms p(95)=340ms
http_req_failed.................: 0.12% ✓ 3      ✗ 2497
```

- `p(95)` / `p(99)`：ユーザー体感に近い指標。平均値だけ見て安心しない
- `http_req_failed`：タイムアウト・5xx・接続エラーの割合。**エラー率の急増は障害耐性（failure-scenarios.md）の論点にも波及するので合わせて確認**

## 野口さんProfileでの運用方針

- MVP では smoke + average load の2種類で十分。spike はリリース前の単発実行で足りることが多い
- 想定ユーザー数が未確定の段階（要件定義直後）では、無理に数値目標を作らず「後で埋める」とプレースホルダにしておく（test-planner が明示）
- 負荷試験のためだけに有料インフラ（分散ロードジェネレータ、Grafana Cloud有料プラン）を契約しない。無料枠で症状が再現できないほどの規模が必要になった時点で、初めて有料化を検討する

## 出典（一次ソース）

- k6 Thresholds: https://grafana.com/docs/k6/latest/using-k6/thresholds/
- k6 公式ドキュメント: https://grafana.com/docs/k6/latest/
- Grafana Cloud k6: https://grafana.com/docs/k6/latest/grafana-cloud-k6/
- Grafana Cloud k6（製品ページ・無料枠）: https://grafana.com/products/cloud/performance-load-testing-k6/
- k6 GitHub: https://github.com/grafana/k6
