// Reading position: save per chapter, show progress on the home page and in the
// contents sheet, and offer "continue" on a chapter page.
//
// Keys: "<book.id>:progress:<slug>" = { i, total, ts } and "<book.id>:last" = { slug, ts }.
// Earlier versions of every reader wrote "book-of-tea:progress:<slug>" = { chunkIndex, ts };
// that is read once and migrated so nobody loses their place.
(function () {
  const BOOK = window.__BOOK__;
  const BR = (window.BR = window.BR || {});
  if (!BOOK) return;

  const key = (slug) => `${BOOK.id}:progress:${slug}`;
  const LAST = `${BOOK.id}:last`;
  const LEGACY = (slug) => `book-of-tea:progress:${slug}`;
  const bySlug = Object.fromEntries(BOOK.chapters.map((c) => [c.slug, c]));

  function read(k) {
    try {
      return JSON.parse(localStorage.getItem(k) || "null");
    } catch (_) {
      return null;
    }
  }
  function write(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (_) {}
  }

  function get(slug) {
    const total = bySlug[slug]?.total || 1;
    let p = read(key(slug));
    if (!p) {
      const old = read(LEGACY(slug));
      if (old && typeof old.chunkIndex === "number") {
        p = { i: old.chunkIndex, total, ts: old.ts || Date.now() };
        write(key(slug), p);
      }
    }
    if (!p) return null;
    p.total = total;
    p.pct = Math.min(1, Math.max(0, p.i / total));
    p.done = p.i >= total;
    return p;
  }

  function save(slug, i) {
    const total = bySlug[slug]?.total || 1;
    const prev = read(key(slug));
    if (prev && prev.i === i) return;
    write(key(slug), { i, total, ts: Date.now() });
    write(LAST, { slug, ts: Date.now() });
  }

  function clear(slug) {
    try {
      localStorage.removeItem(key(slug));
      localStorage.removeItem(LEGACY(slug));
    } catch (_) {}
  }

  BR.progress = { get, save, clear };

  // ---------- progress in lists (home + contents sheet) ----------
  function paintRow(row, currentSlug) {
    const slug = row.dataset.slug;
    const p = get(slug);
    const track = row.querySelector(".progress-track");
    const state = row.querySelector(".chapter-state, .toc-state");
    if (slug === currentSlug) row.setAttribute("aria-current", "page");
    if (!p || p.i < 2) {
      if (track) track.hidden = true;
      if (state) state.textContent = "";
      return;
    }
    if (p.done || p.pct > 0.97) {
      if (track) track.hidden = true;
      if (state) state.textContent = "読了";
      return;
    }
    if (track) {
      track.hidden = false;
      track.querySelector(".progress-fill").style.width = Math.round(p.pct * 100) + "%";
    }
    if (state) state.textContent = Math.round(p.pct * 100) + "%";
  }

  const currentSlug = window.__CHAPTER__ && window.__CHAPTER__.slug;
  const paintLists = () =>
    document.querySelectorAll(".chapter-row[data-slug], .toc-row[data-slug]").forEach((r) => paintRow(r, currentSlug));
  paintLists();
  const toc = document.getElementById("sheet-toc");
  if (toc) {
    toc.addEventListener("sheet-open", () => {
      paintLists();
      const cur = toc.querySelector('[aria-current="page"]');
      if (cur) cur.scrollIntoView({ block: "center" });
    });
  }

  // ---------- home: continue button ----------
  const btn = document.getElementById("continue-btn");
  if (btn) {
    const last = read(LAST);
    let target = null;
    if (last && bySlug[last.slug]) {
      const p = get(last.slug);
      const idx = BOOK.chapters.findIndex((c) => c.slug === last.slug);
      if (p && (p.done || p.pct > 0.97) && BOOK.chapters[idx + 1]) {
        target = { ch: BOOK.chapters[idx + 1], pct: 0 };
      } else if (p && p.i >= 2) {
        target = { ch: bySlug[last.slug], pct: p.pct };
      }
    } else {
      // migrate: any chapter with legacy progress counts as "last"
      const found = BOOK.chapters.map((c) => ({ c, p: get(c.slug) })).filter((x) => x.p && x.p.i >= 2);
      found.sort((a, b) => (b.p.ts || 0) - (a.p.ts || 0));
      if (found[0]) target = { ch: found[0].c, pct: found[0].p.pct };
    }
    if (target) {
      btn.href = target.ch.href;
      btn.querySelector(".btn-capsule-label").textContent = target.pct ? "続きから読む" : "次の章を読む";
      const meta = document.getElementById("continue-meta");
      meta.querySelector(".cta-chapter").textContent = target.ch.jp;
      if (target.pct) {
        const pct = Math.round(target.pct * 100);
        const prog = meta.querySelector(".cta-progress");
        prog.hidden = false;
        prog.querySelector(".mini-fill").style.width = pct + "%";
        prog.querySelector(".cta-pct").textContent = pct + "%";
      }
    }
  }

  // ---------- chapter: track position while reading, offer resume ----------
  const reader = document.getElementById("reader");
  if (!reader || !currentSlug) return;
  const pairs = [...document.querySelectorAll(".pair")];
  if (!pairs.length) return;

  // the pair whose box crosses 40% of the viewport height
  BR.pairAtViewport = function () {
    const line = window.innerHeight * 0.4;
    let lo = 0;
    let hi = pairs.length - 1;
    let ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (pairs[mid].getBoundingClientRect().top <= line) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return +pairs[ans].dataset.i;
  };

  let t = 0;
  window.addEventListener(
    "scroll",
    () => {
      if (BR.isPlaying && BR.isPlaying()) return; // the player saves its own position
      clearTimeout(t);
      t = setTimeout(() => {
        if (window.scrollY < 80) return; // still on the chapter title
        save(currentSlug, BR.pairAtViewport());
      }, 400);
    },
    { passive: true }
  );

  const saved = get(currentSlug);
  const resume = document.getElementById("resume");
  if (saved && saved.i >= 2 && !saved.done && !location.hash) {
    const el = document.querySelector(`.pair[data-i="${saved.i}"]`);
    if (el) {
      BR.initialIndex = saved.i;
      requestAnimationFrame(() => el.scrollIntoView({ block: "center" }));
      if (resume) {
        document.getElementById("resume-text").textContent = `続きから表示しています（${Math.round(saved.pct * 100)}%）`;
        resume.hidden = false;
        // keep the notice visible: move it just above the resumed pair
        el.closest(".para").before(resume);
      }
    }
  }
  if (resume) {
    document.getElementById("resume-restart").addEventListener("click", () => {
      resume.hidden = true;
      clear(currentSlug);
      BR.initialIndex = 1;
      if (BR.seek) BR.seek(1, { scroll: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    document.getElementById("resume-close").addEventListener("click", () => {
      resume.hidden = true;
    });
  }
})();
