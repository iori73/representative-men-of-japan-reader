// Remembers how far the reader got in each chapter (per browser, via localStorage)
// so leaving mid-chapter and coming back resumes near the same spot.
(function () {
  const slug = window.__CHAPTER_SLUG__;
  if (!slug) return;

  const STORAGE_KEY = "book-of-tea:progress:" + slug;
  const chunks = document.querySelectorAll(".chunk[data-chunk-index]");
  if (!chunks.length) return;

  function readSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function save(chunkIndex) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ chunkIndex, ts: Date.now() }));
    } catch (_) {
      // localStorage unavailable (private mode, blocked, etc.) — resuming just won't work, no big deal
    }
  }

  // Track the furthest-read chunk: any chunk whose top has scrolled above the
  // middle of the viewport counts as "read". We keep the max index seen so
  // scrolling back up to re-read something earlier doesn't lose the bookmark.
  let furthest = 0;
  let saveTimer = null;
  function onScroll() {
    const mid = window.innerHeight * 0.45;
    for (let i = chunks.length - 1; i >= 0; i--) {
      const rect = chunks[i].getBoundingClientRect();
      if (rect.top <= mid) {
        const idx = parseInt(chunks[i].dataset.chunkIndex, 10);
        if (idx > furthest) furthest = idx;
        break;
      }
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(furthest), 400);
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  // Resume: if we have a saved position and the reader hasn't scrolled here
  // manually yet (i.e. this is a fresh page load), jump to it and show a small banner.
  const saved = readSaved();
  if (saved && saved.chunkIndex > 1) {
    const target = document.querySelector(`.chunk[data-chunk-index="${saved.chunkIndex}"]`);
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: "start" });
        showResumeBanner(saved.chunkIndex);
      });
    }
  }

  function showResumeBanner(chunkIndex) {
    const bar = document.createElement("div");
    bar.className = "resume-banner";
    bar.innerHTML =
      '<span>続きから表示しています。</span> <button type="button">最初から読む</button>';
    bar.querySelector("button").addEventListener("click", () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
      window.scrollTo({ top: 0 });
      bar.remove();
      furthest = 0;
    });
    document.body.appendChild(bar);
    setTimeout(() => bar.classList.add("show"), 10);
    setTimeout(() => bar.remove(), 6000);
  }
})();
