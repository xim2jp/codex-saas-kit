---
name: marketing-site-playbook
description: SaaS の月額定額モデルを売る営業ポータルサイト（LP・価格ページ・FAQ・CTA・Stripe Checkout 導線）の設計・構築方法論。ターゲット分析、コピーライティング、LP 構成、価格表、コンバージョン導線を一気通貫で扱う。営業ポータルのモック作成・実装時に参照する。「営業サイト」「LP」「ランディングページ」「価格ページ」「マーケサイト」「ポータルサイト」で参照。
---

# Marketing Site Playbook Skill

SaaS の**月額定額モデルを売る**ための営業ポータルサイト設計の方法論。集客 → 訴求 → 価格提示 → Checkout までのコンバージョン導線を、野口さんの「SaaS 量産」戦略に合わせて低コストで構築する。

## 参照ファイル

| ファイル | 内容 |
|---------|------|
| `references/marketing-site-playbook.md` | 営業ポータルサイトの構成要素、ターゲット分析、コピーライティング、LP構成、価格表・FAQ・CTA 設計、Stripe Checkout 連携パターン |

## 原則

1. **スタイルの正は `docs/15-marketing-site/visual-style-guide.md` → `docs/12-brand-design/design-system.md` の順**。本 Skill はサイト構成・コピー・導線だけを扱い、見た目はスタイルガイドに従う（二重定義で乖離させないため）
2. **SEO/AIO の深掘りは `seo-toolkit`、動画は `promo-video-toolkit` に委ねる**。動画の埋め込み実装は営業サイト側で行う
3. **決済導線の実装詳細は `stripe-integration` を参照**する。価格表の金額・プラン名は Stripe の Price と一致させる
4. **成果物は `docs/15-marketing-site/` に置く**（sdlc-toolkit の artifact-layout.md に従う）
