#!/usr/bin/env node
/**
 * build-htmldocs.mjs — docs/（Markdown 正本）から htmldocs/（人間向け HTML）を全量生成する。
 *
 * 使い方（プロジェクトルートで実行）:
 *   node .agents/skills/sdlc-toolkit/scripts/build-htmldocs.mjs [--root <path>]
 *
 * 仕様の正本: .agents/skills/sdlc-toolkit/references/document-catalog.md
 *  - 依存パッケージなし（Node 18+ 標準のみ）
 *  - docs/**\/*.md → htmldocs/**\/*.html（1:1、全量再生成）
 *  - ID（F-NNN / S-XXX-NNN / UC-* 等）を正本文書へ自動リンク化、id-index.html を生成
 *  - Mermaid はローカル同梱（初回にダウンロード試行。失敗時はコード表示にフォールバック）
 *  - docs/ 内の HTML/PNG（モック・スクショ）はコピーせず相対リンクで参照
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------- CLI / ルート解決 ----------

const args = process.argv.slice(2);
let ROOT = process.cwd();
const ri = args.indexOf('--root');
if (ri >= 0 && args[ri + 1]) ROOT = path.resolve(args[ri + 1]);

const DOCS = path.join(ROOT, 'docs');
const OUT = path.join(ROOT, 'htmldocs');

if (!fs.existsSync(DOCS)) {
  console.error(`❌ docs/ が見つかりません: ${DOCS}`);
  console.error('   プロジェクトルートで実行するか --root <path> を指定してください');
  process.exit(1);
}

// ---------- 設定 ----------

const PHASE_TITLES = {
  '00-requirements': '要件定義',
  '10-business-design': '業務設計',
  '11-tech-stack': '技術スタック',
  '12-brand-design': 'ブランド・デザイン',
  '15-marketing-site': '営業サイト',
  '20-external-design': '外部設計',
  '30-internal-design': '内部設計',
  '40-test-plan': 'テスト計画',
  '41-test-results': 'テスト結果・監査',
  '50-legal': '法務（公開文書）',
  '60-operations': '運用',
  '70-manuals': '操作マニュアル',
  '99-pm': 'プロジェクト管理',
};

// ID プレフィックス → 正本（docs/ 相対）。dynamic はファイル探索で解決
const ID_REGISTRY = {
  BZ:   { canonical: '00-requirements/business-requirements.md' },
  F:    { canonical: '10-business-design/feature-list.md' },
  NFR:  { canonical: '00-requirements/non-functional.md' },
  UC:   { canonical: '00-requirements/use-cases.md', fallback: '40-test-plan/e2e-scenarios.md' },
  US:   { canonical: '00-requirements/user-stories.md' },
  ROLE: { canonical: '00-requirements/permissions-matrix.md' },
  PS:   { dynamicDir: '10-business-design/business-rules' },
  JOB:  { canonical: '10-business-design/batch-jobs.md' },
  NTF:  { canonical: '10-business-design/notifications.md' },
  EXT:  { canonical: '10-business-design/external-integrations.md' },
  S:    { dynamicDir: '20-external-design/screen-specs', fallback: '20-external-design/screen-list.md' },
  API:  { canonical: '20-external-design/api-spec.md' },
  ENT:  { canonical: '20-external-design/data-model.md' },
  ERR:  { canonical: '20-external-design/error-catalog.md' },
  RSK:  { canonical: '99-pm/risk-register.md' },
  OQ:   { canonical: '00-requirements/open-questions.md' },
  CR:   { dynamicDir: '60-operations/changes' },
  BUG:  { canonical: '41-test-results/bug-escape-ledger.md' },
  MK:   { dynamicDir: '15-marketing-site/mockups', asset: true }, // docs/ 内の HTML 実体へリンク
  ADR:  { dynamicDir: '11-tech-stack/adr' },
};

// ID 検出パターン（単語境界。コード・リンク内は除外して適用する）
const ID_PATTERN =
  /\b(?:NFR-[A-Z]{2,8}-\d{1,3}|UC-[A-Z0-9]{2,12}-\d{1,3}|S-[A-Z0-9]{2,6}-\d{2,4}|ROLE-\d{1,3}|(?:F|BZ|US|PS|JOB|NTF|EXT|API|ENT|ERR|RSK|OQ|MK|CR|BUG)-\d{2,4}|ADR[ -]\d{4})\b/g;

const GEN_DATE = new Date().toISOString().slice(0, 16).replace('T', ' ');

// ---------- ユーティリティ ----------

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const rel = (from, to) => path.posix.relative(from.split(path.sep).join('/'), to.split(path.sep).join('/'));

function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/<[^>]*>/g, '')
      .replace(/[^\p{L}\p{N}\- ]/gu, '')
      .trim()
      .replace(/\s+/g, '-') || 'section'
  );
}

function idKey(raw) {
  return raw.replace(/^ADR[ -]/, 'ADR-'); // "ADR 0003" → アンカー用 "ADR-0003"
}
function idPrefix(raw) {
  if (/^ADR/.test(raw)) return 'ADR';
  if (/^NFR-/.test(raw)) return 'NFR';
  if (/^UC-/.test(raw)) return 'UC';
  if (/^ROLE-/.test(raw)) return 'ROLE';
  if (/^S-[A-Z0-9]{2,6}-\d/.test(raw)) return 'S';
  return raw.split('-')[0];
}

// ---------- ファイル収集 ----------

const allDocsFiles = walk(DOCS).map((p) => rel(DOCS, p)); // docs/ 相対（posix）
const mdFiles = allDocsFiles.filter((p) => p.endsWith('.md'));
const mdSet = new Set(mdFiles);

// dynamic ID → 実ファイル解決表（例: PS-001 → business-rules/PS-001-nendo-koshin.md）
const dynamicFiles = {};
for (const [prefix, cfg] of Object.entries(ID_REGISTRY)) {
  if (!cfg.dynamicDir) continue;
  dynamicFiles[prefix] = {};
  for (const f of allDocsFiles.filter((p) => p.startsWith(cfg.dynamicDir + '/'))) {
    const base = path.posix.basename(f);
    if (cfg.asset ? !base.endsWith('.html') : !base.endsWith('.md')) continue;
    let key = null;
    if (prefix === 'ADR') { const mm = base.match(/^(\d{4})/); if (mm) key = `ADR-${mm[1]}`; }
    else if (prefix === 'S') { const mm = base.toUpperCase().match(/^(S-[A-Z0-9]{2,6}-\d{2,4})/); if (mm) key = mm[1]; }
    else { const mm = base.toUpperCase().match(new RegExp(`^(${prefix}-\\d{2,4})`)); if (mm) key = mm[1]; }
    if (key && !dynamicFiles[prefix][key]) dynamicFiles[prefix][key] = f;
  }
}

// ID の正本解決: 戻り値 { docsPath, anchor, isAsset } | null
function resolveId(raw) {
  const prefix = idPrefix(raw);
  const cfg = ID_REGISTRY[prefix];
  if (!cfg) return null;
  const key = idKey(raw);
  if (cfg.dynamicDir && dynamicFiles[prefix]?.[key]) {
    return { docsPath: dynamicFiles[prefix][key], anchor: null, isAsset: !!cfg.asset && !dynamicFiles[prefix][key].endsWith('.md') };
  }
  const canonical = cfg.canonical && mdSet.has(cfg.canonical) ? cfg.canonical
    : cfg.fallback && mdSet.has(cfg.fallback) ? cfg.fallback : null;
  if (!canonical) return null;
  return { docsPath: canonical, anchor: key, isAsset: false };
}

// ---------- パス 1: ID 出現の収集（コードフェンス外のみ） ----------

const idOccurrences = new Map(); // key → { raw, refs: Map(mdFile → count) }
for (const f of mdFiles) {
  const src = fs.readFileSync(path.join(DOCS, f), 'utf8');
  let inFence = false;
  for (const line of src.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    for (const m of line.matchAll(ID_PATTERN)) {
      const key = idKey(m[0]);
      if (!idOccurrences.has(key)) idOccurrences.set(key, { raw: m[0], refs: new Map() });
      const rec = idOccurrences.get(key);
      rec.refs.set(f, (rec.refs.get(f) || 0) + 1);
    }
  }
}

// ---------- Markdown → HTML 変換 ----------

// インライン変換。ctx: { mdFile, relRootFromHtmlDir, definedIds }
function inline(text, ctx) {
  const stash = [];
  const put = (html) => `\x00${stash.push(html) - 1}\x01`;

  let s = esc(text);

  // コードスパン（ID リンク・強調の対象外）
  s = s.replace(/`([^`]+)`/g, (_, c) => put(`<code>${c}</code>`));
  // 画像
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => put(`<img src="${rewriteHref(src, ctx)}" alt="${alt}" loading="lazy">`));
  // リンク（リンクテキスト内は ID リンク化しない）
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, href) => put(`<a href="${rewriteHref(href, ctx)}">${t}</a>`));
  // 裸 URL
  s = s.replace(/(?<![">])(https?:\/\/[^\s<>"')]+)/g, (u) => put(`<a href="${u}">${u}</a>`));
  // 強調
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(?<![\w*])\*([^*\n]+)\*(?![\w*])/g, '<em>$1</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // ID 自動リンク
  s = s.replace(ID_PATTERN, (raw) => {
    const key = idKey(raw);
    const r = resolveId(raw);
    if (!r) return raw;
    const isCanonicalHere = r.docsPath === ctx.mdFile;
    if (isCanonicalHere && r.anchor) {
      if (!ctx.definedIds.has(key)) { ctx.definedIds.add(key); return put(`<span class="id-def" id="${key}">${raw}</span>`); }
      return put(`<a class="id-ref" href="#${key}">${raw}</a>`);
    }
    if (isCanonicalHere && !r.anchor) return raw; // 自ファイルが正本（PS 等）
    const target = r.isAsset
      ? ctx.relRootFromHtmlDir + '../docs/' + r.docsPath
      : relHtml(ctx.mdFile, r.docsPath) + (r.anchor ? `#${r.anchor}` : '');
    return put(`<a class="id-ref" href="${target}">${raw}</a>`);
  });

  // プレースホルダ復元（ネストがあるため収束するまで繰り返す）
  for (let n = 0; n < 5 && /\x00\d+\x01/.test(s); n++) {
    s = s.replace(/\x00(\d+)\x01/g, (_, i) => stash[Number(i)]);
  }
  return s;
}

// md 内リンクの書き換え（.md → 対応 .html、docs 内資産 → ../docs/ 経由、外部/絶対はそのまま）
function rewriteHref(href, ctx) {
  if (/^(https?:|mailto:|#|\/)/.test(href)) return href;
  const [p, hash = ''] = href.split('#');
  const resolvedFromDocs = path.posix.normalize(path.posix.join(path.posix.dirname(ctx.mdFile), p));
  const frag = hash ? `#${hash}` : '';
  if (resolvedFromDocs.startsWith('..')) {
    // docs/ の外（tests/ 等）→ プロジェクトルート経由
    return ctx.relRootFromHtmlDir + '../' + path.posix.normalize(path.posix.join('docs', path.posix.dirname(ctx.mdFile), p)) + frag;
  }
  if (p.endsWith('.md') && mdSet.has(resolvedFromDocs)) return relHtml(ctx.mdFile, resolvedFromDocs) + frag;
  return ctx.relRootFromHtmlDir + '../docs/' + resolvedFromDocs + frag; // HTML/PNG 等の実体はコピーせず参照
}

// あるページ（mdFile 基準）から別の md の生成 HTML への相対パス
function relHtml(fromMd, toMd) {
  const fromDir = path.posix.dirname(fromMd);
  const to = toMd.replace(/\.md$/, '.html');
  const r = path.posix.relative(fromDir === '.' ? '' : fromDir, to);
  return r === '' ? path.posix.basename(to) : r;
}

function renderMarkdown(src, ctx) {
  const lines = src.split('\n');
  const out = [];
  const headings = [];
  let i = 0;

  const flushPara = (buf) => {
    const t = buf.join(' ').trim();
    if (t) out.push(`<p>${inline(t, ctx)}</p>`);
    buf.length = 0;
  };

  let para = [];
  while (i < lines.length) {
    const line = lines[i];

    // フェンス
    const fence = line.match(/^\s*(```|~~~)\s*(\S*)/);
    if (fence) {
      flushPara(para);
      const lang = fence[2].toLowerCase();
      const body = [];
      i++;
      while (i < lines.length && !/^\s*(```|~~~)\s*$/.test(lines[i])) { body.push(lines[i]); i++; }
      i++;
      if (lang === 'mermaid') out.push(`<div class="mermaid-wrap"><pre class="mermaid">${esc(body.join('\n'))}</pre></div>`);
      else out.push(`<pre class="code"><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }

    // 見出し
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara(para);
      const level = h[1].length;
      const text = inline(h[2].trim(), ctx);
      const slug = slugify(h[2]);
      headings.push({ level, text, slug });
      out.push(`<h${level} id="${slug}">${text}</h${level}>`);
      i++;
      continue;
    }

    // 水平線
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flushPara(para); out.push('<hr>'); i++; continue; }

    // 表
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      flushPara(para);
      const parseRow = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const headCells = parseRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(parseRow(lines[i])); i++; }
      let t = '<div class="table-wrap"><table><thead><tr>';
      t += headCells.map((c) => `<th>${inline(c, ctx)}</th>`).join('');
      t += '</tr></thead><tbody>';
      for (const r of rows) t += '<tr>' + r.map((c) => `<td>${inline(c, ctx)}</td>`).join('') + '</tr>';
      t += '</tbody></table></div>';
      out.push(t);
      continue;
    }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      flushPara(para);
      const body = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { body.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push(`<blockquote>${renderMarkdown(body.join('\n'), ctx).html}</blockquote>`);
      continue;
    }

    // リスト（ネスト対応）
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      flushPara(para);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (!m) {
          // 継続行（インデントされた本文）
          if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1].text += ' ' + lines[i].trim(); i++; continue; }
          break;
        }
        items.push({ indent: m[1].length, ordered: /\d/.test(m[2]), text: m[3] });
        i++;
      }
      out.push(renderList(items, 0, ctx));
      continue;
    }

    // 空行
    if (!line.trim()) { flushPara(para); i++; continue; }

    para.push(line);
    i++;
  }
  flushPara(para);
  return { html: out.join('\n'), headings };
}

function renderList(items, from, ctx) {
  if (from >= items.length) return '';
  const base = items[from].indent;
  const ordered = items[from].ordered;
  let html = ordered ? '<ol>' : '<ul>';
  let k = from;
  while (k < items.length && items[k].indent >= base) {
    if (items[k].indent > base) { // 直前の li の子リスト
      let end = k;
      while (end < items.length && items[end].indent > base) end++;
      html = html.replace(/<\/li>$/, renderList(items.slice(k, end), 0, ctx) + '</li>');
      k = end;
      continue;
    }
    let text = items[k].text;
    let cls = '';
    const task = text.match(/^\[( |x|X)\]\s+(.*)$/);
    if (task) { cls = ' class="task"'; text = `${task[1].trim() ? '☑' : '☐'} ${task[2]}`; }
    html += `<li${cls}>${inline(text, ctx)}</li>`;
    k++;
  }
  html += ordered ? '</ol>' : '</ul>';
  return html + (k < items.length ? renderList(items, k, ctx) : '');
}

// ---------- ページテンプレート ----------

function pageShell({ title, breadcrumbHtml, bodyHtml, relRoot, meta }) {
  const mermaidTag = fs.existsSync(path.join(OUT, 'assets', 'mermaid.min.js'))
    ? `<script src="${relRoot}assets/mermaid.min.js"></script><script>mermaid.initialize({startOnLoad:true,securityLevel:'loose'});</script>`
    : '';
  const glossary = mdSet.has('00-requirements/glossary.md')
    ? `<a href="${relRoot}00-requirements/glossary.html">用語集</a> · ` : '';
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${relRoot}assets/style.css">
</head>
<body>
<header class="site-header">
  <nav class="breadcrumb">${breadcrumbHtml}</nav>
  <nav class="global-links">${glossary}<a href="${relRoot}id-index.html">ID索引</a></nav>
</header>
<main>
${meta ? `<div class="doc-meta">生成: ${GEN_DATE} ／ 正本: <code>${esc(meta.src)}</code>（最終更新 ${meta.mtime}）</div>` : ''}
${bodyHtml}
</main>
<footer class="site-footer">
  <p>この HTML は <code>docs/</code> の Markdown（正本）から自動生成されています。修正は Markdown 側に行ってください。</p>
</footer>
${mermaidTag}
</body>
</html>
`;
}

function breadcrumb(parts, relRoot) {
  // parts: [{label, href|null}]
  const items = [`<a href="${relRoot}index.html">📚 ドキュメント</a>`];
  for (const p of parts) items.push(p.href ? `<a href="${p.href}">${esc(p.label)}</a>` : `<span>${esc(p.label)}</span>`);
  return items.join(' <span class="sep">›</span> ');
}

function tocHtml(headings) {
  const h2s = headings.filter((h) => h.level === 2);
  if (h2s.length < 3) return '';
  return `<details class="toc" open><summary>目次</summary><ul>${h2s
    .map((h) => `<li><a href="#${h.slug}">${h.text}</a></li>`)
    .join('')}</ul></details>`;
}

// ---------- 出力準備 ----------

// 既存 HTML を全消去（assets のキャッシュは残す）
if (fs.existsSync(OUT)) {
  for (const f of walk(OUT)) if (f.endsWith('.html')) fs.rmSync(f);
}
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'assets', 'style.css'), STYLE_CSS());

// Mermaid 同梱（初回のみダウンロード試行）
const mermaidPath = path.join(OUT, 'assets', 'mermaid.min.js');
if (!fs.existsSync(mermaidPath)) {
  try {
    const res = await fetch('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js', { signal: AbortSignal.timeout(20000) });
    if (res.ok) fs.writeFileSync(mermaidPath, Buffer.from(await res.arrayBuffer()));
    else console.warn('⚠️ mermaid.min.js のダウンロードに失敗（HTTP ' + res.status + '）。図はコード表示になります');
  } catch {
    console.warn('⚠️ mermaid.min.js のダウンロードに失敗（オフライン？）。図はコード表示になります。後で再実行すれば取得を再試行します');
  }
}

// ---------- パス 2: 各 md を変換 ----------

const pageInfo = new Map(); // mdFile → { title, summary, htmlPath }
const definedIdsByFile = new Map();

for (const mdFile of mdFiles) {
  const src = fs.readFileSync(path.join(DOCS, mdFile), 'utf8');
  const htmlRel = mdFile.replace(/\.md$/, '.html');
  const depth = htmlRel.split('/').length - 1;
  const relRoot = '../'.repeat(depth);
  const ctx = { mdFile, relRootFromHtmlDir: relRoot, definedIds: new Set() };

  const { html, headings } = renderMarkdown(src, ctx);
  definedIdsByFile.set(mdFile, ctx.definedIds);

  const h1 = headings.find((h) => h.level === 1);
  const title = h1 ? h1.text.replace(/<[^>]*>/g, '') : path.posix.basename(mdFile, '.md');
  const firstPara = (src.match(/^(?!#|\||```|-|\*|>|\s*$)(.{10,})$/m) || [])[1] || '';
  pageInfo.set(mdFile, { title, summary: firstPara.slice(0, 140), htmlPath: htmlRel });

  const dir = path.posix.dirname(mdFile);
  const crumbs = [];
  if (dir !== '.') {
    const top = dir.split('/')[0];
    crumbs.push({ label: PHASE_TITLES[top] || top, href: rel(path.posix.dirname(htmlRel), `${top}/index.html`) || 'index.html' });
    if (dir !== top) crumbs.push({ label: dir.slice(top.length + 1), href: null });
  }
  crumbs.push({ label: title, href: null });

  const mtime = fs.statSync(path.join(DOCS, mdFile)).mtime.toISOString().slice(0, 10);
  const body = tocHtml(headings) + html;
  const outPath = path.join(OUT, htmlRel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, pageShell({
    title, breadcrumbHtml: breadcrumb(crumbs, relRoot), bodyHtml: body, relRoot,
    meta: { src: `docs/${mdFile}`, mtime },
  }));
}

// ---------- フェーズ表紙（各トップディレクトリの index.html） ----------

const topDirs = [...new Set(mdFiles.filter((f) => f.includes('/')).map((f) => f.split('/')[0]))].sort();

for (const dir of topDirs) {
  const files = mdFiles.filter((f) => f.startsWith(dir + '/'));
  const docsList = files.filter((f) => !f.includes('/reviews/'));
  const reviews = files.filter((f) => f.includes('/reviews/'));
  const groups = new Map(); // サブディレクトリ単位
  for (const f of docsList) {
    const sub = path.posix.dirname(f) === dir ? '' : path.posix.dirname(f).slice(dir.length + 1);
    if (!groups.has(sub)) groups.set(sub, []);
    groups.get(sub).push(f);
  }
  let body = `<h1>${esc(PHASE_TITLES[dir] || dir)} <span class="dim">(${dir})</span></h1>`;
  for (const [sub, fl] of [...groups.entries()].sort()) {
    if (sub) body += `<h2>${esc(sub)}/</h2>`;
    body += '<ul class="doc-list">';
    for (const f of fl) {
      const info = pageInfo.get(f);
      const href = rel(dir, info.htmlPath);
      body += `<li><a href="${href}"><strong>${info.title}</strong></a> <span class="dim">${esc(path.posix.basename(f))}</span>${info.summary ? `<br><span class="summary">${esc(info.summary)}</span>` : ''}</li>`;
    }
    body += '</ul>';
  }
  if (reviews.length) {
    body += `<h2>レビュー記録</h2><ul class="doc-list reviews">`;
    for (const f of reviews.sort().reverse()) {
      body += `<li><a href="${rel(dir, pageInfo.get(f).htmlPath)}">${esc(path.posix.basename(f, '.md'))}</a></li>`;
    }
    body += '</ul>';
  }
  fs.writeFileSync(path.join(OUT, dir, 'index.html'), pageShell({
    title: `${PHASE_TITLES[dir] || dir}（${dir}）`,
    breadcrumbHtml: breadcrumb([{ label: PHASE_TITLES[dir] || dir, href: null }], '../'),
    bodyHtml: body, relRoot: '../', meta: null,
  }));
}

// ---------- id-index.html ----------

{
  const rows = [...idOccurrences.entries()].sort(([a], [b]) => a.localeCompare(b));
  let body = '<h1>ID 索引</h1><p>全文書に出現する ID の逆引き。「正本」はその ID を定義する文書。</p>';
  body += '<div class="table-wrap"><table><thead><tr><th>ID</th><th>正本</th><th>出現文書</th></tr></thead><tbody>';
  for (const [key, rec] of rows) {
    const r = resolveId(rec.raw);
    const def = r
      ? (r.isAsset
        ? `<a href="../docs/${r.docsPath}">${esc(r.docsPath)}</a>`
        : `<a href="${r.docsPath.replace(/\.md$/, '.html')}${r.anchor ? '#' + r.anchor : ''}">${esc(r.docsPath)}</a>`)
      : '<span class="dim">（正本なし）</span>';
    const refs = [...rec.refs.entries()]
      .map(([f, n]) => `<a href="${f.replace(/\.md$/, '.html')}">${esc(path.posix.basename(f, '.md'))}</a>${n > 1 ? ` <span class="dim">×${n}</span>` : ''}`)
      .join('、 ');
    body += `<tr><td><code>${esc(key)}</code></td><td>${def}</td><td>${refs}</td></tr>`;
  }
  body += '</tbody></table></div>';
  fs.writeFileSync(path.join(OUT, 'id-index.html'), pageShell({
    title: 'ID 索引', breadcrumbHtml: breadcrumb([{ label: 'ID索引', href: null }], ''), bodyHtml: body, relRoot: '', meta: null,
  }));
}

// ---------- ルート index.html ----------

{
  let projectName = path.basename(ROOT);
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    if (pkg.name) projectName = pkg.name;
  } catch { /* package.json なし */ }

  let body = `<h1>📚 ${esc(projectName)} プロジェクトドキュメント</h1>`;
  body += `<p class="dim">生成: ${GEN_DATE} ／ 正本: <code>docs/</code>（Markdown）</p>`;

  const quick = [];
  if (mdSet.has('99-pm/status.md')) quick.push(`<a class="card" href="99-pm/status.html">📊 進捗ステータス</a>`);
  if (mdSet.has('99-pm/document-set.md')) quick.push(`<a class="card" href="99-pm/document-set.html">📋 文書セット定義</a>`);
  if (mdSet.has('00-requirements/glossary.md')) quick.push(`<a class="card" href="00-requirements/glossary.html">📖 用語集</a>`);
  quick.push(`<a class="card" href="id-index.html">🔎 ID 索引</a>`);
  body += `<div class="cards">${quick.join('')}</div>`;

  body += '<h2>フェーズ別文書</h2><ul class="phase-list">';
  for (const dir of topDirs) {
    const n = mdFiles.filter((f) => f.startsWith(dir + '/') && !f.includes('/reviews/')).length;
    const nr = mdFiles.filter((f) => f.startsWith(dir + '/') && f.includes('/reviews/')).length;
    body += `<li><a href="${dir}/index.html"><strong>${esc(PHASE_TITLES[dir] || dir)}</strong></a> <span class="dim">${dir} ・ 文書 ${n}${nr ? ` ・ レビュー ${nr}` : ''}</span></li>`;
  }
  body += '</ul>';

  fs.writeFileSync(path.join(OUT, 'index.html'), pageShell({
    title: `${projectName} ドキュメント`, breadcrumbHtml: '<span>📚 ドキュメント</span>', bodyHtml: body, relRoot: '', meta: null,
  }));
}

console.log(`✅ htmldocs/ を生成しました（${mdFiles.length} 文書 + フェーズ表紙 ${topDirs.length} + index / id-index）`);
console.log(`   閲覧: ${path.join(OUT, 'index.html')}`);

// ---------- スタイル ----------

function STYLE_CSS() {
  return `/* htmldocs 共通スタイル（build-htmldocs.mjs が生成） */
:root {
  --bg: #ffffff; --fg: #1f2430; --dim: #6b7280; --line: #e5e7eb;
  --accent: #2563eb; --accent-bg: #eff6ff; --code-bg: #f6f8fa; --def-bg: #fef9c3;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #111318; --fg: #e5e7eb; --dim: #9ca3af; --line: #2d3340; --accent: #7aa2f7; --accent-bg: #1a2233; --code-bg: #1b1f27; --def-bg: #3a3416; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg);
  font-family: "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif;
  line-height: 1.8; font-size: 16px; }
main { max-width: 62em; margin: 0 auto; padding: 1.5em 1.2em 4em; }
.site-header { display: flex; justify-content: space-between; gap: 1em; flex-wrap: wrap;
  padding: .7em 1.2em; border-bottom: 1px solid var(--line); position: sticky; top: 0;
  background: var(--bg); z-index: 10; font-size: .92em; }
.site-header a { color: var(--accent); text-decoration: none; }
.site-header a:hover { text-decoration: underline; }
.breadcrumb .sep { color: var(--dim); margin: 0 .3em; }
.site-footer { border-top: 1px solid var(--line); color: var(--dim); font-size: .85em;
  max-width: 62em; margin: 0 auto; padding: 1em 1.2em 2em; }
h1 { font-size: 1.7em; border-bottom: 2px solid var(--line); padding-bottom: .3em; }
h2 { font-size: 1.35em; border-bottom: 1px solid var(--line); padding-bottom: .2em; margin-top: 2em; }
h3 { font-size: 1.15em; margin-top: 1.6em; }
a { color: var(--accent); }
code { background: var(--code-bg); padding: .12em .35em; border-radius: 4px; font-size: .9em;
  font-family: "SFMono-Regular", Consolas, "Noto Sans Mono CJK JP", monospace; }
pre.code { background: var(--code-bg); padding: 1em; border-radius: 8px; overflow-x: auto; line-height: 1.5; }
pre.code code { background: none; padding: 0; }
.table-wrap { overflow-x: auto; margin: 1em 0; }
table { border-collapse: collapse; width: 100%; font-size: .93em; }
th, td { border: 1px solid var(--line); padding: .45em .7em; text-align: left; vertical-align: top; }
th { background: var(--accent-bg); }
blockquote { border-left: 4px solid var(--line); margin: 1em 0; padding: .2em 1em; color: var(--dim); }
hr { border: none; border-top: 1px solid var(--line); margin: 2em 0; }
img { max-width: 100%; }
.doc-meta { font-size: .82em; color: var(--dim); background: var(--accent-bg);
  border-radius: 6px; padding: .4em .8em; margin-bottom: 1.5em; }
.id-def { background: var(--def-bg); border-radius: 4px; padding: 0 .25em; font-weight: 600; }
a.id-ref { text-decoration: none; border-bottom: 1px dashed var(--accent); }
.toc { background: var(--accent-bg); border-radius: 8px; padding: .6em 1em; margin: 1em 0 2em; }
.toc summary { cursor: pointer; font-weight: 600; }
.toc ul { margin: .5em 0 0; }
.dim { color: var(--dim); font-weight: 400; font-size: .88em; }
.summary { color: var(--dim); font-size: .88em; }
ul.doc-list { list-style: none; padding-left: 0; }
ul.doc-list > li { padding: .5em 0; border-bottom: 1px dashed var(--line); }
ul.doc-list.reviews > li { padding: .2em 0; border-bottom: none; }
ul.phase-list { list-style: none; padding-left: 0; }
ul.phase-list > li { padding: .55em 0; border-bottom: 1px dashed var(--line); }
.cards { display: flex; flex-wrap: wrap; gap: .8em; margin: 1.2em 0; }
.card { display: block; padding: .7em 1.1em; border: 1px solid var(--line); border-radius: 8px;
  text-decoration: none; font-weight: 600; background: var(--accent-bg); }
li.task { list-style: none; margin-left: -1.2em; }
.mermaid-wrap { margin: 1em 0; overflow-x: auto; }
pre.mermaid { background: none; }
`;
}
