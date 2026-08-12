# AI一次応答設計（Claude API）

問い合わせフォーム・受信メールに対して Claude API (claude-sonnet-4) で一次応答を自動生成する設計。1名運用で複数SaaSの問い合わせ量をさばくための中核機能だが、**誤回答リスクとAPIコストの両方を制御する設計**が前提になる。

## 全体フロー

```
問い合わせ受信（フォーム送信 / メール転送）
   ↓
① 前処理：PIIの識別・不適切内容チェック
   ↓
② 回答範囲判定：ヘルプ記事・FAQで答えられる範囲か（RAG的に参照）
   ↓
③-a 範囲内 → Claude APIで一次応答ドラフト生成 → 信頼度チェック → 自動送信 or 野口さんレビュー後送信
③-b 範囲外/低信頼度/エスカレーション条件該当 → 即座に野口さんへ通知、AIは定型の「確認中」返信のみ
```

「AIが答える」を目的化せず、**「AIが安全に答えられる範囲を正確に見極める」ことを最優先の設計目標**にする。

## Claude API 呼び出しの基本実装（Next.js Route Handler）

```ts
// app/api/support/ai-response/route.ts
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { searchHelpArticles } from "@/lib/help/search";
import { checkRateLimit } from "@/lib/support/rate-limit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { inquiryId, productSlug, message } = await req.json();

  // コスト制御：プロダクト横断で月次予算に達していないか先にチェック
  const withinBudget = await checkRateLimit(productSlug);
  if (!withinBudget) {
    return NextResponse.json({ status: "escalated", reason: "budget_exceeded" });
  }

  // 回答根拠となるヘルプ記事のみを渡す（RAG的な範囲限定）
  const context = await searchHelpArticles(productSlug, message, { limit: 5 });
  if (context.length === 0) {
    // 参照できる記事がない = AIの守備範囲外とみなし即エスカレーション
    return NextResponse.json({ status: "escalated", reason: "no_matching_context" });
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    system: buildSystemPrompt(productSlug, context),
    messages: [{ role: "user", content: message }],
  });

  const draft = extractText(response);
  const escalation = judgeEscalation(message, draft, context);

  return NextResponse.json({
    status: escalation.required ? "escalated" : "draft_ready",
    draft,
    escalationReason: escalation.reason,
  });
}
```

### システムプロンプトの設計（回答範囲の明示的な限定）

```ts
function buildSystemPrompt(productSlug: string, context: HelpArticle[]) {
  return `
あなたは SaaS「${productSlug}」のカスタマーサポート一次応答アシスタントです。

# 厳守事項
- 以下「参照可能な情報」に明記されている内容のみを根拠に回答してください。
- 参照可能な情報に答えがない場合、絶対に推測や一般論で回答せず
  「担当者が確認のうえご連絡します」という定型文のみを返してください。
- 返金・解約・契約内容の変更・法的な質問には一切回答せず、必ずエスカレーションしてください。
- 価格・料金プランの具体的な数値は参照可能な情報にある場合のみ回答してください。

# 参照可能な情報
${context.map((c) => `## ${c.title}\n${c.bodyMarkdown}`).join("\n\n")}
`;
}
```

**回答の根拠を渡した文書だけに縛る**（Closed-domain QA）ことが、ハルシネーション対策の中心。モデルの一般知識で「それっぽく」答えさせない。

## エスカレーション基準（AIが答えるべきでない/答えられない場合）

以下のいずれかに該当すれば、AIの自動応答を止めて野口さんへ即エスカレーションする。

| 区分 | 判定基準 | 理由 |
|------|---------|------|
| **範囲外** | ヘルプ記事/FAQに関連情報が見つからない | 根拠なき回答はハルシネーションリスクが高い |
| **金銭・契約** | 返金・解約・請求金額の争い・契約条項の解釈を含む | 誤回答時の実害が大きく、必ず人間判断が必要 |
| **感情的・クレーム** | 強い不満・怒りの表現、法的措置への言及 | AIの定型応答が火に油を注ぐリスク |
| **低信頼度** | モデル自身が「不確実」「わからない」旨を含む応答を生成 | 自己申告の不確実性は尊重する |
| **セキュリティ/個人情報** | アカウント乗っ取り疑い、他ユーザーの情報開示要求 | 機微な判断のため必ず人間が介在 |
| **繰り返し不満** | 同一ユーザーからの再問い合わせ（AI応答後も未解決） | 一次応答が機能しなかったサイン |

```ts
function judgeEscalation(message: string, draft: string, context: HelpArticle[]) {
  if (/返金|解約|退会|訴訟|弁護士/.test(message)) {
    return { required: true, reason: "sensitive_topic" };
  }
  if (/確認中|担当者が.*ご連絡/.test(draft)) {
    return { required: true, reason: "low_confidence" };
  }
  if (context.length === 0) {
    return { required: true, reason: "no_matching_context" };
  }
  return { required: false, reason: null };
}
```

キーワードベースの一次フィルタは簡易だが、**「疑わしきはエスカレーション」を機械的に担保する最後の砦**として有効。より高度な分類が必要なら別途Claude APIで意図分類を挟んでもよいが、コストとのトレードオフを意識する。

## 誤回答防止のガードレール

1. **回答範囲の限定（Closed-domain）**：システムプロンプトで「渡した文書のみ根拠にする」ことを明示（上記参照）
2. **人間レビュー導線をデフォルトにする**：立ち上げ初期は「AI下書き → 野口さんが確認して送信ボタンを押す」半自動運用を基本とし、精度が安定してから完全自動送信へ段階移行する
3. **送信前の自己検証プロンプト**：生成した回答が参照文書の範囲を超えていないか、同じClaude APIで簡易チェックさせる（コストと精度のトレードオフのため任意）
4. **監査ログの保存**：どの問い合わせにどの根拠文書でどう回答したかをSupabaseに記録し、誤回答が起きた際に原因追跡できるようにする
5. **温度（temperature）を低めに設定**：事実応答が主目的のため `temperature: 0`〜`0.3` 程度で創造的な逸脱を抑える

```ts
// 監査ログ用テーブル例
create table support_ai_responses (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null,
  inquiry_id uuid not null,
  context_article_ids uuid[] not null,
  draft text not null,
  status text not null,          -- draft_ready / escalated / sent / rejected
  escalation_reason text,
  reviewed_by text,               -- 野口さん本人 or 'auto'
  created_at timestamptz not null default now()
);
```

## 人間レビュー導線（半自動運用の実装）

```tsx
// app/(admin)/support/inbox/page.tsx（骨子）
// - status = 'draft_ready' の問い合わせを一覧表示
// - AIドラフトを表示し、野口さんが「そのまま送信」「編集して送信」「エスカレーション対応に切替」を選択
// - 送信後は support_ai_responses.status を 'sent' に更新し reviewed_by を記録
```

1名運用なので**通知（メール/Slack Webhook等の無料枠内手段）で「レビュー待ちがN件」を都度知らせる**導線を必ず作る。ダッシュボードを見に行く運用は取りこぼしが発生する。

## 野口Profile財務制約：Claude APIコストの管理

Claude APIには無料枠がなく、**問い合わせ件数に比例してコストが発生**する。複数SaaSを並行運用すると合算コストが読みにくくなるため、以下を必須とする。

1. **プロダクト単位・全体単位の月次予算上限を設定**：予算に近づいたら自動応答を停止し、全件人間対応にフォールバック（上記 `checkRateLimit` 相当）
2. **1件あたりのトークン量を制御**：`max_tokens` を必要十分な値に抑え、渡すコンテキスト（ヘルプ記事）も関連度上位数件に絞る
3. **プロンプトキャッシュの活用**：システムプロンプト（製品情報・ガードレール文）が同一プロダクトで繰り返し使われる場合、Claude APIのプロンプトキャッシュ機能でコストと遅延を削減できないか検討する
4. **重複問い合わせの検知でAPI呼び出しを削減**：同一内容の問い合わせが既知のFAQと一致する場合はAPI呼び出しをせずFAQ回答を即返す
5. **モデル選定はコストと精度のバランスで判断**：一次応答の多くは定型的な内容のため、必要に応じて軽量モデルとのハイブリッド運用（一次スクリーニングは軽量モデル、根拠付き回答生成のみ claude-sonnet-4）も検討対象

> **基本方針：無料枠が存在しない前提で、予算アラート・使用量上限・レビュー必須の3点セットを実装してから自動応答を有効化する。上限に達したら自動的に「全件人間対応」に落ちる設計とし、想定外の高額請求を構造的に防ぐ。**

## 野口Profile上の注意

- AIの完全自動応答は精度が安定するまで有効化しない（半自動＝人間の最終確認をデフォルトにする）
- 返金・解約等の金銭・契約に関わる問い合わせはAI単独で完結させない
- 予算上限に達した場合のフォールバック（人間対応への切替）を必ず実装する
- 監査ログを残し、誤回答が起きた際に迅速に原因を追跡・是正できる体制にする

## 出典

- Anthropic API ドキュメント: https://docs.anthropic.com/
- Anthropic Messages API リファレンス: https://docs.anthropic.com/en/api/messages
- Anthropic プロンプトキャッシュ: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Anthropic モデル一覧・料金: https://docs.anthropic.com/en/docs/about-claude/models
- Next.js Route Handlers: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
