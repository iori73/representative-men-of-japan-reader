#!/usr/bin/env node
// Reads data/chunks/*.json + chapters.json manifest, emits a static dist/ site.
// No framework, no bundler — plain string templates.

import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// GitHub Pages project sites are served under /<repo-name>/, not at the domain root,
// so every root-relative link needs this prefix. Local dev (npm run serve) leaves it
// empty since http.server serves dist/ directly at the root.
const BASE = process.env.SITE_BASE_PATH ?? "";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = path.join(ROOT, "data", "chunks");
const DIST = path.join(ROOT, process.env.SITE_OUT_DIR || "dist");
const STYLES_DIR = path.join(ROOT, "src", "styles");
const PUBLIC_DIR = path.join(ROOT, "public");
const JS_DIR = path.join(ROOT, "src", "js");

function readJSON(p) {
  return JSON.parse(readFileSync(p, "utf-8"));
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const chapters = readJSON(path.join(DATA_DIR, "chapters.json"));

// --- reset dist ---
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
mkdirSync(path.join(DIST, "chapters"), { recursive: true });
mkdirSync(path.join(DIST, "styles"), { recursive: true });
mkdirSync(path.join(DIST, "js"), { recursive: true });

// --- copy static assets ---
for (const f of readdirSync(STYLES_DIR)) {
  cpSync(path.join(STYLES_DIR, f), path.join(DIST, "styles", f));
}
for (const f of readdirSync(JS_DIR)) {
  cpSync(path.join(JS_DIR, f), path.join(DIST, "js", f));
}
cpSync(path.join(PUBLIC_DIR, "images"), path.join(DIST, "images"), { recursive: true });
if (readdirSync(PUBLIC_DIR).includes("favicon.svg")) {
  cpSync(path.join(PUBLIC_DIR, "favicon.svg"), path.join(DIST, "favicon.svg"));
}

function pageShell({ title, description, bodyClass, headExtra, body }) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="${BASE}/favicon.svg">
<link rel="stylesheet" href="${BASE}/styles/tokens.css">
<link rel="stylesheet" href="${BASE}/styles/base.css">
<link rel="stylesheet" href="${BASE}/styles/reader.css">
${headExtra ?? ""}
</head>
<body class="${bodyClass ?? ""}">
${body}
</body>
</html>
`;
}

const rawIconCache = new Map();
function iconImg(icon, cls) {
  // Inlined (not <img src>) so the SVG's currentColor fill picks up the
  // wrapping element's CSS color — an <img>-referenced SVG is opaque to page CSS.
  if (!rawIconCache.has(icon)) {
    rawIconCache.set(icon, readFileSync(path.join(PUBLIC_DIR, "images", "icons", icon), "utf-8"));
  }
  return rawIconCache.get(icon).replace("<svg ", `<svg class="${cls}" aria-hidden="true" `);
}

// --- index page ---
function buildIndex() {
  const rows = chapters
    .map((c) => {
      return `
      <a class="chapter-row" href="${BASE}/chapters/${c.slug}.html">
        <span class="num">${String(c.num).padStart(2, "0")}</span>
        ${iconImg(c.icon, "icon")}
        <span class="titles">
          <span class="en-title">${esc(c.en_title)}</span>
          <span class="jp-title">${esc(c.jp_title)}</span>
        </span>
        <span class="meta">${c.reading_minutes} min</span>
      </a>`;
    })
    .join("\n");

  const body = `
<div class="hero grain">
  <div class="hero-inner">
    ${iconImg("01-mountain.svg", "hero-icon")}
    <h1>Representative Men of Japan</h1>
    <p class="jp-title">代表的日本人</p>
    <p class="byline">内村鑑三 (Kanzo Uchimura) / English original, 1908</p>
  </div>
</div>
<div class="wrap">
  <ul class="chapter-list">
    ${rows}
  </ul>
  <footer class="site-footer">
    <p>英語原文: 内村鑑三著 (1908年刊、パブリックドメイン、Internet Archive所蔵版に基づく)。
    日本語訳は既存訳を用いず原文から新たに翻訳したもの(Claude/河野いおり)。
    日本語→英語の対訳チャンクで交互に読めるよう構成しています。</p>
  </footer>
</div>`;

  writeFileSync(
    path.join(DIST, "index.html"),
    pageShell({
      title: "Representative Men of Japan 代表的日本人 — バイリンガル読書",
      description: "内村鑑三「代表的日本人」を日本語→英語の対訳で読む",
      body,
    })
  );
}

// --- chapter page ---
function groupParagraphs(chunks) {
  const paras = [];
  let current = null;
  chunks.forEach((c, i) => {
    if (i === 0) return; // title handled separately
    if (c.para_break || !current) {
      current = [];
      paras.push(current);
    }
    current.push({ ...c, index: i });
  });
  return paras;
}

function chunkHtml(c) {
  return `<p class="chunk" data-chunk-index="${c.index}">
    <span class="jp" data-lang="jp">${esc(c.jp)}</span>
    <span class="en" data-lang="en">${esc(c.en)}</span>
  </p>`;
}

function buildChapter(c, prev, next) {
  const chunks = readJSON(path.join(DATA_DIR, `${c.slug}.chunks.json`));
  const paras = groupParagraphs(chunks);
  const bodyHtml = paras
    .map((p) => `<div class="para">\n${p.map(chunkHtml).join("\n")}\n</div>`)
    .join("\n");

  const prevLink = prev
    ? `<a href="${BASE}/chapters/${prev.slug}.html"><span class="label">前の章</span>${esc(prev.en_title)}</a>`
    : `<a href="${BASE}/index.html"><span class="label">戻る</span>目次</a>`;
  const nextLink = next
    ? `<a class="next" href="${BASE}/chapters/${next.slug}.html"><span class="label">次の章</span>${esc(next.en_title)}</a>`
    : `<a class="next" href="${BASE}/index.html"><span class="label">読了</span>目次に戻る</a>`;

  const body = `
<nav class="topnav"><a href="${BASE}/index.html">← Representative Men of Japan 目次</a></nav>
<div class="wrap">
  <div class="chapter-head">
    <div class="num">${c.num === 0 ? "PREFACE" : `ESSAY ${String(c.num).padStart(2, "0")}`}</div>
    <h1>${esc(c.en_title)}</h1>
    <p class="jp-title">${esc(c.jp_title)}</p>
  </div>

  <div class="read-aloud-bar" id="read-aloud-bar" data-slug="${c.slug}">
    <button type="button" id="ra-play">▶ 読み上げ</button>
    <button type="button" id="ra-pause" hidden>❚❚ 一時停止</button>
    <label>速度
      <input type="range" id="ra-rate" min="0.8" max="1.3" step="0.1" value="1">
    </label>
  </div>

  ${bodyHtml}

  <div class="chapter-nav">
    ${prevLink}
    ${nextLink}
  </div>
</div>
<script>
  window.__CHAPTER_CHUNKS__ = ${JSON.stringify(chunks)};
  window.__CHAPTER_SLUG__ = ${JSON.stringify(c.slug)};
</script>
<script src="${BASE}/js/reading-progress.js" defer></script>
<script src="${BASE}/js/read-aloud.js" defer></script>`;

  writeFileSync(
    path.join(DIST, "chapters", `${c.slug}.html`),
    pageShell({
      title: `${c.en_title} — Representative Men of Japan`,
      description: `${c.jp_title} / ${c.en_title}`,
      body,
    })
  );
}

buildIndex();
chapters.forEach((c, i) => {
  buildChapter(c, chapters[i - 1] ?? null, chapters[i + 1] ?? null);
});

console.log(`Built ${chapters.length} chapter pages + index into ${DIST}`);
