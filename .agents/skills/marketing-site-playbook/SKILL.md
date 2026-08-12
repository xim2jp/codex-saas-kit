---
name: marketing-site-playbook
description: SaaS の月額定額モデルを売るための営業ポータルサイト（LP・価格ページ・FAQ・CTA・Stripe Checkout 導線）を設計・構築する方法論。ターゲット分析、コピーライティング、LP構成、価格表、コンバージョン導線までを一気通貫で扱う。営業サイト構築フェーズで marketing-site-builder が必ず参照し、visual-director のスタイルガイドと組み合わせて実装する。「営業サイト」「LP」「ランディングページ」「価格ページ」「マーケサイト」「ポータルサイト」で参照。
---

# Marketing Site Playbook Skill

SaaS の**月額定額モデルを売る**ための営業ポータルサイト設計の方法論。集客 → 訴求 → 価格提示 → Checkout までのコンバージョン導線を、野口さんの「SaaS 量産」戦略に合わせて低コストで構築する。

## いつこのSkillを参照するか

- **marketing-site-builder**：営業サイトの企画・設計・実装の全過程（起動時に必読）
- **visual-director / page-designer**：サイト構成とビジュアルアセットの整合を確認するとき
- **seo-specialist / promo-video-producer**：LP の構成・CTA 配置を前提に SEO・動画埋め込みを設計するとき

## references 一覧

| ファイル | 内容 |
|---------|------|
| `references/marketing-site-playbook.md` | 営業ポータルサイトの構成要素、ターゲット分析、コピーライティング、LP構成、価格表・FAQ・CTA 設計、Stripe Checkout 連携パターン |

## 関連 Skill・エージェントとの役割分担

- **スタイルの正**：`docs/15-marketing-site/visual-style-guide.md`（visual-director）→ `docs/12-brand-design/design-system.md` の順に優先。本 Skill はサイト構成・コピー・導線を担当
- **SEO/AIO の深掘り**：`seo-toolkit` Skill / seo-specialist に委譲
- **動画**：`promo-video-toolkit` Skill / promo-video-producer に委譲（埋め込み実装は marketing-site-builder）
- **決済導線の実装詳細**：`stripe-integration` Skill を参照
- **成果物は `docs/15-marketing-site/` に配置**（sdlc-toolkit の artifact-layout.md に従う）
