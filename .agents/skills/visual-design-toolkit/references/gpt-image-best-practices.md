# gpt-image-2 Best Practices

OpenAI gpt-image-2 を SaaS のマーケティング用に効果的に使うためのプロンプト・運用知見。

## モデル選択

```typescript
// 最新モデル名は実行時に確認すること
// 現状の知見：
const models = {
  highQuality: 'gpt-image-1',   // 高品質、コスト高
  standard: 'dall-e-3',          // 安定、コストやや高
  fast: 'dall-e-2',              // 低コスト、品質劣る
};
```

**実行時の確認**：API バージョンが変わっている可能性あり。エージェントは初回起動時に WebSearch で「gpt-image-2 OpenAI API current pricing」を確認してから使う。

## サイズと用途の対応

| 用途 | サイズ | 品質 | 概算コスト |
|------|-------|------|----------|
| ムードボード（試作） | 1024x1024 | low | ¥1.5/枚 |
| Hero背景 | 1792x1024 | high | ¥25/枚 |
| 機能セクション挿絵 | 1024x1024 | medium | ¥6/枚 |
| OGP/Twitter Card | 1792x1024 → crop 1200x630 | high | ¥25/枚 |
| Blog サムネ | 1792x1024 | medium | ¥6/枚 |
| 装飾アイコン | 1024x1024 | low | ¥1.5/枚 |

※ 概算は2026年5月時点。実行時に必ず確認。

## プロンプト構造のベストプラクティス

### 効果的なプロンプトの構成要素

```
[Style] : スタイル指定（モダンフラット、水彩風、3D等）
[Subject] : 主題（何を描くか）
[Composition] : 構図（中心、左寄せ、上下二分等）
[Color palette] : カラーパレット（具体的HEX or 名称）
[Mood] : 雰囲気（楽観的、専門的、温かい等）
[Avoid] : 避けるべき要素（テキスト、写実、複雑背景等）
[Size hint] : サイズの示唆（横長、正方形、縦長）
```

### 例：B2B SaaS の Hero 画像

```
Style: Modern flat illustration with subtle gradients, professional design 
language similar to Stripe or Notion marketing pages.

Subject: Abstract representation of automated shift scheduling - 
a stylized calendar grid with small floating circular elements 
suggesting team members, gently arranged.

Composition: Wide horizontal layout (16:9), main illustration centered 
or slightly right, leaving the left third with breathing room for text overlay.

Color palette: Soft pastel colors with primary blue (#6B9DFF), 
warm peach accent (#FFB088), and sage green highlights (#88C9A1). 
Background: very light cream (#FAFAFA).

Mood: Optimistic, organized, forward-looking. Conveys both technical 
sophistication and approachable warmth.

Avoid: Photorealistic humans, text or letters in the image, dark or moody 
aesthetics, complex backgrounds, harsh shadows, neon colors, glassmorphism, 
generic stock-photo aesthetic.

Aspect: 1792x1024
```

### よくある失敗とその修正

| 失敗パターン | 原因 | 修正 |
|-----------|------|------|
| 文字が含まれる | "no text" を入れていない | "Avoid: any text, letters, numbers, or written words" を強調 |
| リアルすぎる人物 | "professional" だけで指定不足 | "Avoid: photorealistic humans" を明示 |
| 雰囲気が違う | mood の指定が抽象的 | mood に具体的な参考（"like Notion's marketing"）を入れる |
| 毎回違う色合い | カラーパレットの指定が緩い | HEX値で具体的に指定 |
| 暗くて重い | 背景・雰囲気の指定なし | 背景色と "light/airy" を明示 |

## プロンプトの再現性向上

### Seed（再現性）について

DALL-E 3 / gpt-image-1 では seed パラメータが完全には機能しない。**完全な再現は期待しない**。

### 一貫性を保つ工夫

1. **ベースプロンプトを完全に固定**：色・スタイル・avoidを毎回コピペ
2. **subject だけ変更**：「何を描くか」だけプロンプト末尾で差し替え
3. **同じセッション内で生成**：API的には独立だが、運用上連続して生成すると揃いやすい
4. **採用画像をリファレンスとして「参考スタイル」と書く**：例 "in the same style as <description>"

## 実装サンプル

### Node.js + OpenAI SDK

```typescript
// scripts/visual/generate.ts
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ImageGenOptions {
  prompt: string;
  outputPath: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'low' | 'medium' | 'high';
  recordToHistory?: boolean;
}

export async function generateImage(opts: ImageGenOptions) {
  const { prompt, outputPath, size = '1024x1024', quality = 'medium' } = opts;
  
  const startTime = Date.now();
  
  try {
    const result = await openai.images.generate({
      model: 'gpt-image-1',  // 起動時に最新確認
      prompt,
      size,
      quality,
      n: 1,
    });
    
    const imageData = result.data?.[0];
    if (!imageData?.b64_json) {
      throw new Error('No image data');
    }
    
    // ディレクトリ作成
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    // 保存
    const buffer = Buffer.from(imageData.b64_json, 'base64');
    fs.writeFileSync(outputPath, buffer);
    
    // 履歴記録
    if (opts.recordToHistory !== false) {
      await recordHistory({
        timestamp: new Date().toISOString(),
        prompt,
        size,
        quality,
        outputPath,
        durationMs: Date.now() - startTime,
      });
    }
    
    return outputPath;
  } catch (err) {
    console.error('Image generation failed:', err);
    throw err;
  }
}

async function recordHistory(entry: any) {
  const historyPath = 'docs/15-marketing-site/prompt-history.md';
  const line = `| ${entry.timestamp} | ${entry.quality} | ${entry.size} | ${entry.outputPath} | (${entry.durationMs}ms) |\n`;
  fs.appendFileSync(historyPath, line);
}
```

### ムードボードの一括生成

```typescript
// scripts/visual/generate-moodboard.ts
const styles = [
  {
    name: 'option-1-corporate',
    suffix: 'Style: Clean corporate, navy and silver, geometric, formal.',
  },
  {
    name: 'option-2-warm',
    suffix: 'Style: Warm pastel illustration, soft and approachable.',
  },
  {
    name: 'option-3-tech',
    suffix: 'Style: Modern tech, blue gradients, abstract geometric shapes.',
  },
  {
    name: 'option-4-organic',
    suffix: 'Style: Organic shapes, hand-drawn feel, earth tones.',
  },
];

const basePrompt = `Hero image for B2B SaaS landing page about <product description>.
No text, no realistic humans, white background.`;

for (const style of styles) {
  await generateImage({
    prompt: `${basePrompt}\n${style.suffix}`,
    outputPath: `docs/15-marketing-site/moodboard/${style.name}.png`,
    size: '1024x1024',
    quality: 'low',  // ムードボードはlowで十分
  });
}
```

## 環境変数

```bash
# .env.local
OPENAI_API_KEY=sk-...

# コスト管理用
AI_IMAGE_BUDGET_JPY=5000
AI_IMAGE_BUDGET_PROJECT=<project-name>
```

## 留意事項

### ライセンス

- gpt-image-2 で生成した画像の著作権はユーザーに帰属（OpenAI規約に従う）
- ただし、商標・実在人物・既存キャラクターを含むプロンプトは避ける
- 商用利用は規約の範囲内で可

### コンテンツポリシー

OpenAI のコンテンツポリシーで以下は生成されない/フィルタされる：
- 暴力・性的内容
- 著作権で保護された具体的キャラクター
- 実在人物の似顔絵
- 政治的に敏感な内容

**B2B SaaSのマーケ用途では基本問題なし**だが、業界によっては注意（医療系で身体描写等）。

### レートリミット

- OpenAI APIにはレートリミットあり（Tier に依存）
- 一度に20枚以上連続生成する場合は wait を入れる：

```typescript
await new Promise(r => setTimeout(r, 2000));  // 2秒待つ
```

## トラブルシューティング

### 「テキストが入ってしまう」

```
プロンプト末尾に：
"CRITICAL: Do not include any text, letters, numbers, words, or written 
characters of any kind. The image must be purely visual without typography."
```

### 「人物が写実的になる」

```
"Abstract human silhouettes only, or no humans at all. 
If figures are present, they should be simplified geometric shapes, 
not realistic portraits."
```

### 「色が指示と違う」

```
カラーパレットを具体的に：
"Color palette MUST include:
- Primary: exactly #6B9DFF (medium blue)
- Accent: exactly #FFB088 (soft peach)
- Background: exactly #FAFAFA (off-white)
Do not use any other primary colors."
```

### 「雰囲気が業務SaaSに合わない」

```
参考スタイルを明示：
"Visual style should be similar to marketing pages of Notion, Linear, 
or Stripe - professional but approachable, with subtle warmth."
```

## チェックリスト

生成前：
- [ ] visual-style-guide.md を確認
- [ ] prompt-template.md のベースプロンプトを使用
- [ ] サイズ・品質を用途に合わせて設定
- [ ] 予算残額を確認

生成後：
- [ ] テキストが含まれていないか確認
- [ ] スタイルが既存採用画像と一貫しているか確認
- [ ] 採用なら `public/images/` へ、不採用なら `tmp/ai-drafts/` へ
- [ ] prompt-history.md に記録
