# FAQ自動更新フロー

問い合わせログからFAQ候補を自動抽出し、野口さん1人の軽量な承認フローで継続的にFAQを更新する仕組み。複数SaaS間でのテンプレート再利用も扱う。

## 全体フロー

```
問い合わせログ（Supabase: support_inquiries / support_ai_responses）
   ↓
① 定期バッチ：直近N日分の問い合わせをクラスタリング（頻出質問の抽出）
   ↓
② Claude APIで各クラスタを要約・カテゴライズ → FAQ候補ドラフト生成
   ↓
③ 野口さんへ通知（週次/月次でレビュー待ち件数を提示）
   ↓
④ 野口さんが確認 → 承認（そのまま公開/編集して公開）or 却下
   ↓
⑤ help_articles（faqカテゴリ）へ反映、既存記事との重複はマージ
```

1名運用の前提上、**②までは完全自動、③④のみ人間が介在する一段階承認**にとどめる。

## 問い合わせログのスキーマ

```sql
create table support_inquiries (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null,
  channel text not null,             -- 'form' | 'email'
  message text not null,
  ai_response_id uuid references support_ai_responses(id),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index support_inquiries_product_created_idx
  on support_inquiries (product_slug, created_at desc);
```

`product_slug` を持たせ、単一のSupabaseスキーマで複数SaaSの問い合わせログを横断集計できるようにしておく。

## 頻出質問のクラスタリング

1名運用・無料枠優先の観点で、専用のクラスタリング基盤（ベクトルDB等の追加コスト）は避け、**Supabase pgvector + Claude APIによる要約**で完結させる。

### ステップ1：埋め込みベクトルの生成・保存

```sql
-- pgvector拡張（Supabase標準で有効化可能）
create extension if not exists vector;

alter table support_inquiries add column embedding vector(1536);
create index support_inquiries_embedding_idx
  on support_inquiries using ivfflat (embedding vector_cosine_ops);
```

```ts
// 問い合わせ受信時に埋め込みを生成して保存（バッチでも可）
// 埋め込みモデルはAnthropic以外（OpenAI text-embedding等）の利用も一般的。
// コスト優先なら軽量な埋め込みモデルを選定し、Claude APIは要約専用に温存する
```

### ステップ2：類似度ベースのクラスタリング（バッチ処理）

```ts
// scripts/faq/cluster-inquiries.ts（骨子）
// 1. 直近30日分の未解決/解決済み問い合わせを embedding とともに取得
// 2. コサイン類似度が閾値以上のものをグループ化（単純な貪欲法で十分、1名運用にk-meansは過剰）
// 3. 件数が閾値（例: 3件）以上のクラスタのみFAQ候補対象とする
```

高度なクラスタリングアルゴリズムは不要。**「似た質問がN件以上たまったら候補にする」程度のシンプルなロジック**で運用コストと分析コストのバランスを取る。

### ステップ3：Claude APIでの要約・カテゴライズ

```ts
// scripts/faq/generate-faq-draft.ts
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function draftFaqFromCluster(productSlug: string, inquiries: string[]) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    system: `
あなたはSaaS「${productSlug}」のFAQ作成アシスタントです。
類似した複数の問い合わせ文から、以下のJSON形式でFAQ候補を1件作成してください。
- question: ユーザー視点の簡潔な質問文
- answer: 回答（事実に基づく一般化された内容。個別の問い合わせ固有の情報は含めない）
- category: billing / account / getting-started / troubleshooting / その他機能カテゴリ から選択
- confidence: この候補をそのまま公開してよいと考える自信度（low/medium/high）
`,
    messages: [{ role: "user", content: inquiries.map((q, i) => `${i + 1}. ${q}`).join("\n") }],
  });
  return parseJsonResponse(response); // { question, answer, category, confidence }
}
```

`confidence` フィールドを持たせることで、野口さんのレビュー画面で **「high は軽く確認するだけ、low はしっかり読む」といった重み付けレビュー**ができる。

## 承認フロー（1名運用の軽量設計）

多段階承認は不要。**候補テーブルへの蓄積 → 通知 → 野口さんの一括レビュー画面 → ワンクリック承認/編集/却下**の一段階で完結させる。

```sql
create table faq_drafts (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null,
  question text not null,
  answer text not null,
  category text not null,
  confidence text not null,          -- low / medium / high
  source_inquiry_ids uuid[] not null,
  status text not null default 'pending', -- pending / approved / rejected / merged
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
```

```tsx
// app/(admin)/support/faq-review/page.tsx（骨子）
// - status = 'pending' の faq_drafts を confidence 降順で一覧表示
// - 各行に「承認して公開」「編集して公開」「却下」ボタン
// - 承認時は help_articles（category: 'faq'）へ INSERT、faq_drafts.status を更新
```

### 通知タイミング

- **週次バッチ**：小規模SaaS・立ち上げ初期は週1回のレビューで十分
- **閾値超過時の即時通知**：`high confidence` かつ同一クラスタが一定件数（例：10件）を超えたら緊急度が高いとみなし即通知
- 通知手段はメール or Slack Webhook（無料枠内）を使い、専用の通知SaaSは導入しない

## 既存FAQとの重複マージ

新規クラスタが既存の `help_articles`（category: 'faq'）と意味的に重複する場合、新規記事を増殖させず**既存記事の更新候補として提示**する。

```ts
// 承認画面で、新規候補のembeddingと既存FAQ記事のembeddingを比較
// 類似度が高い（例: 0.85以上）場合は「新規作成」ではなく「既存記事の更新提案」として表示
```

FAQが増えすぎると検索性・保守性が落ちるため、**「似た質問は1つの記事にまとめる」**方針を常に優先する。

## 複数SaaS間でのFAQテンプレート再利用

プロダクト非依存の一般的なFAQ（アカウント・支払い・退会等）はテンプレート化し、新規SaaS立ち上げ時に流用する。

| 再利用レベル | 対象 | 運用方法 |
|-------------|------|---------|
| **完全共通テンプレート** | 「支払い方法の変更方法」「退会手順」等、Stripe/Supabase Authの標準機能に紐づくFAQ | 骨格を `templates/faq/common/` に保持し、新規SaaS作成時にプロダクト名だけ差し替えて投入 |
| **半共通（要調整）** | 「無料トライアルの条件」等、プラン設計に依存するFAQ | 共通テンプレートをベースに野口さんが値を調整 |
| **プロダクト固有** | 機能一覧から自動生成されるFAQ | クラスタリング・生成フローで都度作成（本ドキュメントの主題） |

```
templates/
└── faq/
    └── common/
        ├── billing-change-payment-method.md
        ├── account-cancel.md
        └── account-data-export.md
```

新規SaaS立ち上げ時のチェック項目として「共通FAQテンプレートを投入したか」を`sdlc-toolkit`のフェーズチェックに含めることを推奨する（本Skill外・運用者側で管理）。

## 野口Profile上の注意

- クラスタリング・要約のためだけに専用SaaS（Zendesk AI等の高額ツール）を追加導入しない。Supabase pgvector + Claude APIで完結させる
- 承認フローは野口さん1人の一段階レビューにとどめ、複数承認者を前提とした設計にしない
- 週次バッチ等の定期実行はVercel Cron（無料枠内）等、追加コストのない仕組みで実装する
- FAQ増殖を防ぎ、複数SaaS共通の記事は積極的にテンプレート化して量産効率を優先する

## 出典

- Supabase pgvector（Vector/AI Toolkit）: https://supabase.com/docs/guides/ai
- Supabase Cron拡張 / Vercel Cron Jobs: https://supabase.com/docs/guides/cron ・ https://vercel.com/docs/cron-jobs
- Anthropic Messages API リファレンス: https://docs.anthropic.com/en/api/messages
- Anthropic 構造化出力（JSON生成のベストプラクティス）: https://docs.anthropic.com/en/docs/build-with-claude/tool-use
