#!/usr/bin/env node
// Reads data/chunks/*.json + chapters.json manifest + book.config.json, emits a static site.
// No framework, no bundler — plain string templates.
//
// This file, src/js/* and src/styles/* are shared verbatim by every bilingual reader
// (book-of-tea / representative-men-of-japan / bushido / nature-of-japanese).
// Everything book-specific lives in book.config.json.

import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// GitHub Pages project sites are served under /<repo-name>/, not at the domain root,
// so every root-relative link needs this prefix. Local dev (npm run serve) leaves it empty.
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
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BOOK = readJSON(path.join(ROOT, "book.config.json"));
const chapters = readJSON(path.join(DATA_DIR, "chapters.json"));
const SEP = BOOK.title_separator ?? " — ";

// --- reset dist ---
rmSync(DIST, { recursive: true, force: true });
mkdirSync(path.join(DIST, "chapters"), { recursive: true });
mkdirSync(path.join(DIST, "styles"), { recursive: true });
mkdirSync(path.join(DIST, "js"), { recursive: true });

// --- copy static assets ---
for (const f of readdirSync(STYLES_DIR)) cpSync(path.join(STYLES_DIR, f), path.join(DIST, "styles", f));
for (const f of readdirSync(JS_DIR)) cpSync(path.join(JS_DIR, f), path.join(DIST, "js", f));
cpSync(path.join(PUBLIC_DIR, "images"), path.join(DIST, "images"), { recursive: true });
if (readdirSync(PUBLIC_DIR).includes("favicon.svg")) {
  cpSync(path.join(PUBLIC_DIR, "favicon.svg"), path.join(DIST, "favicon.svg"));
}

// --- chapter metadata shared with the browser (TOC sheet, progress, remaining time) ---
const chapterMeta = chapters.map((c) => {
  const chunks = readJSON(path.join(DATA_DIR, `${c.slug}.chunks.json`));
  return {
    slug: c.slug,
    num: c.num,
    label: chapterLabel(c),
    jp: c.jp_title,
    en: c.en_title,
    minutes: c.reading_minutes,
    total: chunks.length - 1, // chunk 0 is the title
    href: `${BASE}/chapters/${c.slug}.html`,
  };
});

function chapterLabel(c) {
  const nn = String(c.num).padStart(2, "0");
  if (BOOK.chapter_label === "essay") return c.num === 0 ? "Preface" : `Essay ${nn}`;
  return `Chapter ${nn}`;
}

function chapterLabelJp(c) {
  if (BOOK.chapter_label === "essay") return c.num === 0 ? "序文" : `第${c.num}篇`;
  return `第${c.num}章`;
}

// --- icons (SF Symbols–like strokes, inlined so they follow currentColor) ---
const I = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" class="fill"/><circle cx="4.5" cy="12" r="1.2" class="fill"/><circle cx="4.5" cy="18" r="1.2" class="fill"/></svg>',
  textformat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 19l5-13 5 13M4.4 14.5h6.2"/><path d="M14 19l3.5-8.5L21 19M15.2 16h4.6"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="fill" x="6.5" y="5" width="4" height="14" rx="1"/><rect class="fill" x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M18 6.2v11.6a.7.7 0 0 1-1.1.6L9 13.1v4.4a1 1 0 0 1-2 0v-11a1 1 0 0 1 2 0v4.4l7.9-5.3a.7.7 0 0 1 1.1.6z"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M6 6.2v11.6a.7.7 0 0 0 1.1.6l7.9-5.3v4.4a1 1 0 0 0 2 0v-11a1 1 0 0 0-2 0v4.4L7.1 5.6A.7.7 0 0 0 6 6.2z"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  arrowDown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  // book.fill–like: two pages, filled
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M3 5.4c0-.6.4-1 1-1.1 2.6-.4 5 .1 7.2 1.5v13.6c-2.2-1.3-4.6-1.8-7.2-1.5-.6.1-1-.4-1-1V5.4zm18 0c0-.6-.4-1-1-1.1-2.6-.4-5 .1-7.2 1.5v13.6c2.2-1.3 4.6-1.8 7.2-1.5.6.1 1-.4 1-1V5.4z"/></svg>',
};

const rawIconCache = new Map();
function bookIcon(icon, cls) {
  if (!icon) return "";
  if (!rawIconCache.has(icon)) {
    rawIconCache.set(icon, readFileSync(path.join(PUBLIC_DIR, "images", "icons", icon), "utf-8"));
  }
  return rawIconCache.get(icon).replace("<svg ", `<svg class="${cls}" aria-hidden="true" `);
}

// Applied before first paint so theme / text size / language mode never flash.
const SETTINGS_BOOT = `<script>(function(){try{var s=JSON.parse(localStorage.getItem("bilingual-reader:settings")||"{}"),d=document.documentElement,z=[.88,.94,1,1.08,1.18];d.dataset.theme=s.theme||"auto";d.dataset.show=s.show||"both";d.dataset.layout=s.layout||"stack";d.style.setProperty("--scale",z[s.size==null?2:s.size]||1);}catch(e){}})();</script>`;

function pageShell({ title, description, bodyClass, body, scripts }) {
  return `<!doctype html>
<html lang="ja" data-theme="auto" data-show="both" data-layout="stack">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#FBFAF7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121314" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${BASE}/favicon.svg">
${SETTINGS_BOOT}
<link rel="stylesheet" href="${BASE}/styles/tokens.css">
<link rel="stylesheet" href="${BASE}/styles/base.css">
<link rel="stylesheet" href="${BASE}/styles/reader.css">
</head>
<body class="${bodyClass ?? ""}">
${body}
${settingsSheet()}
${tocSheet()}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>window.__BOOK__ = ${JSON.stringify({ id: BOOK.id, base: BASE, title: BOOK.title_en, chapters: chapterMeta })};</script>
<script src="${BASE}/js/reader-ui.js" defer></script>
<script src="${BASE}/js/reading-progress.js" defer></script>
${scripts ?? ""}
</body>
</html>
`;
}

function segmented(name, label, options) {
  return `<div class="field">
    <div class="field-label" id="lbl-${name}">${label}</div>
    <div class="segmented" role="radiogroup" aria-labelledby="lbl-${name}" data-setting="${name}">
      ${options
        .map(([value, text]) => `<button type="button" role="radio" aria-checked="false" data-value="${value}">${text}</button>`)
        .join("")}
    </div>
  </div>`;
}

function settingsSheet() {
  const themes = [
    ["auto", "自動"],
    ["light", "ライト"],
    ["sepia", "セピア"],
    ["dark", "ダーク"],
  ];
  return `<dialog class="sheet" id="sheet-settings" aria-labelledby="sheet-settings-title">
  <div class="sheet-grabber" aria-hidden="true"></div>
  <header class="sheet-head">
    <h2 id="sheet-settings-title">表示</h2>
    <button type="button" class="icon-btn" data-close aria-label="閉じる">${I.close}</button>
  </header>
  <div class="sheet-body">
    ${segmented("show", "言語", [["both", "日英"], ["jp", "日本語"], ["en", "English"]])}
    <div class="field only-wide">
      ${segmented("layout", "並べ方", [["stack", "上下"], ["side", "左右"]])}
    </div>
    <div class="field">
      <div class="field-label" id="lbl-size">文字の大きさ</div>
      <div class="size-row">
        <span class="size-a small" aria-hidden="true">A</span>
        <input type="range" id="set-size" min="0" max="4" step="1" value="2" aria-labelledby="lbl-size">
        <span class="size-a large" aria-hidden="true">A</span>
      </div>
    </div>
    <div class="field">
      <div class="field-label" id="lbl-theme">テーマ</div>
      <div class="themes" role="radiogroup" aria-labelledby="lbl-theme" data-setting="theme">
        ${themes
          .map(
            ([v, t]) => `<button type="button" role="radio" aria-checked="false" data-value="${v}" class="theme-swatch theme-${v}">
          <span class="swatch" aria-hidden="true"><span class="swatch-jp">あ</span><span class="swatch-en">Aa</span></span>
          <span class="swatch-label">${t}</span>
        </button>`
          )
          .join("")}
      </div>
    </div>
  </div>
</dialog>`;
}

function tocSheet() {
  return `<dialog class="sheet sheet-tall" id="sheet-toc" aria-labelledby="sheet-toc-title">
  <div class="sheet-grabber" aria-hidden="true"></div>
  <header class="sheet-head">
    <h2 id="sheet-toc-title">目次</h2>
    <button type="button" class="icon-btn" data-close aria-label="閉じる">${I.close}</button>
  </header>
  <div class="sheet-body sheet-scroll">
    <ol class="toc-list" id="toc-list">
      ${chapterMeta.map((c) => tocRow(c)).join("")}
    </ol>
  </div>
</dialog>`;
}

function tocRow(c) {
  return `<li><a class="toc-row" href="${c.href}" data-slug="${c.slug}">
    <span class="toc-num">${String(c.num).padStart(2, "0")}</span>
    <span class="toc-titles"><span class="toc-jp">${esc(c.jp)}</span><span class="toc-en">${esc(c.en)}</span>
      <span class="progress-track" hidden><span class="progress-fill"></span></span>
    </span>
    <span class="toc-meta"><span class="toc-min">${c.minutes}分</span><span class="toc-state"></span></span>
  </a></li>`;
}

function appBar({ back, title, toc }) {
  return `<header class="appbar" id="appbar">
  <div class="appbar-inner">
    ${back ? `<a class="icon-btn appbar-back" href="${back.href}" aria-label="${esc(back.label)}">${I.back}<span class="appbar-back-text">${esc(back.text)}</span></a>` : `<span class="appbar-spacer"></span>`}
    <div class="appbar-title" aria-hidden="true">${esc(title ?? "")}</div>
    <div class="appbar-actions">
      ${toc ? `<button type="button" class="icon-btn" data-open="sheet-toc" aria-label="目次を開く">${I.list}</button>` : ""}
      <button type="button" class="icon-btn" data-open="sheet-settings" aria-label="表示の設定">${I.textformat}</button>
    </div>
  </div>
</header>`;
}

// --- index page ---
function buildIndex() {
  const totalMin = chapters.reduce((n, c) => n + (c.reading_minutes || 0), 0);
  const heroIcon = BOOK.hero_icon || chapters[0]?.icon;
  const first = chapterMeta[0];

  const rows = chapterMeta
    .map(
      (c) => `<li><a class="chapter-row" href="${c.href}" data-slug="${c.slug}">
      <span class="chapter-num">${String(c.num).padStart(2, "0")}</span>
      <span class="chapter-titles">
        <span class="chapter-jp">${esc(c.jp)}</span>
        <span class="chapter-en">${esc(c.en)}</span>
        <span class="progress-track" hidden><span class="progress-fill"></span></span>
      </span>
      <span class="chapter-meta"><span class="chapter-min">${c.minutes}分</span><span class="chapter-state"></span></span>
      <span class="chevron" aria-hidden="true">${I.chevron}</span>
    </a></li>`
    )
    .join("\n");

  const cover = BOOK.cover_image
    ? `<img class="book-cover-img" src="${BASE}/images/${esc(BOOK.cover_image)}" alt="${esc(BOOK.title_jp)} の表紙" width="800" height="800">`
    : `<div class="book-cover" aria-hidden="true">${bookIcon(heroIcon, "book-cover-icon")}</div>`;

  const body = `
${appBar({ title: BOOK.title_jp })}
<main class="home">
  <section class="book-hero">
    ${cover}
    <div class="book-info">
      <p class="eyebrow">バイリンガル読書 · 日本語 → English</p>
      <h1 class="book-title-jp">${esc(BOOK.title_jp)}</h1>
      <p class="book-title-en">${esc(BOOK.title_en)}</p>
      <p class="book-byline">${esc(BOOK.byline)}</p>
      <p class="book-meta">${chapters.length}章 · 約${totalMin}分 · 読み上げ付き</p>
      <div class="cta">
        <a class="btn-capsule" id="continue-btn" href="${first.href}">${I.book}<span class="btn-capsule-label">読みはじめる</span></a>
        <div class="cta-meta" id="continue-meta">
          <span class="cta-chapter">${esc(first.jp)}</span>
          <span class="cta-progress" hidden><span class="mini-track"><span class="mini-fill"></span></span><span class="cta-pct"></span></span>
        </div>
      </div>
    </div>
  </section>

  <section class="contents" aria-labelledby="contents-title">
    <h2 class="section-title" id="contents-title">目次</h2>
    <ol class="chapter-list">
      ${rows}
    </ol>
  </section>

  <footer class="site-footer">
    <p>${esc(BOOK.credit)}</p>
    <p>読み上げは、お使いの端末の音声で再生します。声の種類と質は端末によって変わります。</p>
  </footer>
</main>`;

  writeFileSync(
    path.join(DIST, "index.html"),
    pageShell({
      title: `${BOOK.title_en} ${BOOK.title_jp}${SEP}バイリンガル読書`,
      description: BOOK.description,
      bodyClass: "page-home",
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

function pairHtml(c) {
  return `<p class="pair" data-i="${c.index}"><span class="jp" lang="ja">${esc(c.jp)}</span><span class="en" lang="en">${esc(c.en)}</span></p>`;
}

function endCard(ch, kind) {
  if (!ch) {
    return kind === "next"
      ? `<a class="end-card next" href="${BASE}/index.html"><span class="end-label">読了</span><span class="end-title">目次に戻る</span></a>`
      : `<span class="end-card is-empty" aria-hidden="true"></span>`;
  }
  return `<a class="end-card ${kind}" href="${ch.href}">
    <span class="end-label">${kind === "next" ? "次の章" : "前の章"}</span>
    <span class="end-title">${esc(ch.jp)}</span>
    <span class="end-sub">${esc(ch.en)}</span>
  </a>`;
}

function buildChapter(c, i) {
  const meta = chapterMeta[i];
  const chunks = readJSON(path.join(DATA_DIR, `${c.slug}.chunks.json`));
  const paras = groupParagraphs(chunks);
  const bodyHtml = paras.map((p) => `<div class="para">${p.map(pairHtml).join("")}</div>`).join("\n");

  const body = `
${appBar({
  back: { href: `${BASE}/index.html`, label: "表紙と目次に戻る", text: BOOK.title_jp },
  title: c.jp_title,
  toc: true,
})}
<main class="reader" id="reader" data-slug="${c.slug}" data-total="${meta.total}" data-minutes="${c.reading_minutes}">
  <header class="chapter-head" id="chapter-head">
    <p class="eyebrow">${esc(chapterLabelJp(c))} · ${esc(meta.label)} · 約${c.reading_minutes}分</p>
    <h1 class="chapter-title-jp">${esc(c.jp_title)}</h1>
    <p class="chapter-title-en" lang="en">${esc(c.en_title)}</p>
  </header>

  <div class="resume" id="resume" hidden>
    <span class="resume-text" id="resume-text">続きから表示しています</span>
    <button type="button" class="link-btn" id="resume-restart">最初から</button>
    <button type="button" class="icon-btn small" id="resume-close" aria-label="閉じる">${I.close}</button>
  </div>

  <article class="text" id="text">
${bodyHtml}
  </article>

  <nav class="chapter-end" aria-label="章の移動">
    ${endCard(chapterMeta[i - 1], "prev")}
    ${endCard(chapterMeta[i + 1], "next")}
  </nav>
</main>

<button type="button" class="back-pill" id="back-pill" hidden>${I.arrowDown}<span>読んでいる位置に戻る</span></button>

<section class="player" id="player" aria-label="読み上げ" hidden>
  <div class="player-inner">
    <div class="player-seek">
      <input type="range" id="pl-seek" min="1" max="${meta.total}" step="1" value="1" aria-label="読む位置">
      <div class="player-times"><span id="pl-pos">1 / ${meta.total}</span><span id="pl-remaining">残り約${c.reading_minutes}分</span></div>
    </div>
    <div class="player-controls">
      <button type="button" class="chip" data-open="sheet-playback" id="pl-lang" aria-label="読み上げる言語">日→英</button>
      <button type="button" class="icon-btn large" id="pl-prev" aria-label="前の文">${I.prev}</button>
      <button type="button" class="play-btn" id="pl-play" aria-label="読み上げる">
        <span class="i-play">${I.play}</span><span class="i-pause">${I.pause}</span>
      </button>
      <button type="button" class="icon-btn large" id="pl-next" aria-label="次の文">${I.next}</button>
      <button type="button" class="chip" data-open="sheet-playback" id="pl-rate" aria-label="読み上げの速さ">1.0×</button>
    </div>
  </div>
</section>

<dialog class="sheet" id="sheet-playback" aria-labelledby="sheet-playback-title">
  <div class="sheet-grabber" aria-hidden="true"></div>
  <header class="sheet-head">
    <h2 id="sheet-playback-title">読み上げ</h2>
    <button type="button" class="icon-btn" data-close aria-label="閉じる">${I.close}</button>
  </header>
  <div class="sheet-body">
    ${segmented("readLang", "読み上げる言語", [["both", "日→英"], ["jp", "日本語"], ["en", "English"]])}
    <div class="field">
      <div class="field-label"><span id="lbl-rate">速さ</span><output id="rate-out" class="field-value">1.0×</output></div>
      <input type="range" id="set-rate" min="0.5" max="2" step="0.05" value="1" aria-labelledby="lbl-rate">
      <div class="presets" role="group" aria-label="よく使う速さ">
        ${[0.75, 1, 1.25, 1.5, 2].map((r) => `<button type="button" class="preset" data-rate="${r}">${r.toFixed(2).replace(/0$/, "")}×</button>`).join("")}
      </div>
    </div>
    <p class="field-note" id="voice-note">端末の音声で読み上げます。</p>
  </div>
</dialog>

<script>window.__CHAPTER__ = ${JSON.stringify({ slug: c.slug, index: i })};</script>
<script>window.__CHAPTER_CHUNKS__ = ${JSON.stringify(chunks)};</script>`;

  writeFileSync(
    path.join(DIST, "chapters", `${c.slug}.html`),
    pageShell({
      title: `${c.en_title}${SEP}${BOOK.title_en}`,
      description: `${c.jp_title} / ${c.en_title}`,
      bodyClass: "page-chapter",
      body,
      scripts: `<script src="${BASE}/js/read-aloud.js" defer></script>`,
    })
  );
}

buildIndex();
chapters.forEach((c, i) => buildChapter(c, i));

console.log(`Built ${chapters.length} chapter pages + index into ${DIST}`);
