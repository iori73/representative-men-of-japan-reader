// Read-aloud player (Web Speech API).
// Reads each pair Japanese → English (or one language only), highlights the pair,
// highlights the spoken word where the browser reports word boundaries, follows
// along while playing, and lets you jump with prev/next/seek or by tapping a pair.
(function () {
  const BR = (window.BR = window.BR || {});
  const chunks = window.__CHAPTER_CHUNKS__ || [];
  const ch = window.__CHAPTER__ || {};
  const reader = document.getElementById("reader");
  const player = document.getElementById("player");
  if (!reader || !player || chunks.length < 2) return;

  const total = chunks.length - 1;
  const minutes = +reader.dataset.minutes || 0;
  const synth = window.speechSynthesis;
  const pairs = new Map([...document.querySelectorAll(".pair")].map((el) => [+el.dataset.i, el]));

  const $ = (id) => document.getElementById(id);
  const ui = {
    play: $("pl-play"),
    prev: $("pl-prev"),
    next: $("pl-next"),
    seek: $("pl-seek"),
    pos: $("pl-pos"),
    remaining: $("pl-remaining"),
    lang: $("pl-lang"),
    rateChip: $("pl-rate"),
    rate: $("set-rate"),
    rateOut: $("rate-out"),
    pill: $("back-pill"),
    voiceNote: $("voice-note"),
  };

  let idx = Math.min(Math.max(BR.initialIndex || 1, 1), total);
  let playing = false;
  let gen = 0; // invalidates callbacks of cancelled utterances
  let follow = true;
  let engaged = !!BR.initialIndex; // show the position marker only once the reader has a position
  let userScrollAt = 0;
  let voices = { ja: null, en: null };

  BR.isPlaying = () => playing;

  // ---------- voices ----------
  function score(v, lang) {
    let s = 0;
    const n = v.name.toLowerCase();
    if (v.lang.replace("_", "-").toLowerCase().startsWith(lang === "ja" ? "ja" : "en-us")) s += 4;
    else if (v.lang.toLowerCase().startsWith(lang)) s += 2;
    if (/premium|enhanced|natural|neural|siri/.test(n)) s += 3;
    if (/google/.test(n)) s += 2;
    if (lang === "ja" && /kyoko|o-ren|otoya|hattori/.test(n)) s += 1;
    if (lang === "en" && /samantha|ava|allison|zoe|aria|jenny/.test(n)) s += 1;
    if (v.localService) s += 0.5;
    return s;
  }
  function pickVoices() {
    if (!synth) return;
    const all = synth.getVoices();
    const best = (lang) =>
      all.filter((v) => v.lang.toLowerCase().startsWith(lang)).sort((a, b) => score(b, lang) - score(a, lang))[0] || null;
    voices = { ja: best("ja"), en: best("en") };
    if (ui.voiceNote) {
      const names = [voices.ja && `日本語: ${voices.ja.name}`, voices.en && `English: ${voices.en.name}`].filter(Boolean);
      ui.voiceNote.textContent = names.length
        ? `端末の音声で読み上げます（${names.join(" / ")}）。`
        : "この端末では読み上げの音声が見つかりませんでした。";
    }
  }

  // ---------- word highlight (CSS Custom Highlight API, no DOM changes) ----------
  const canHighlight = typeof CSS !== "undefined" && CSS.highlights && typeof Highlight !== "undefined";
  function clearWord() {
    if (canHighlight) CSS.highlights.delete("reading-word");
  }
  function markWord(span, charIndex, charLength) {
    if (!canHighlight || !span.firstChild) return;
    const text = span.textContent;
    let end = charLength ? charIndex + charLength : charIndex;
    if (!charLength) {
      const m = /^[\p{L}\p{N}'’-]+/u.exec(text.slice(charIndex));
      end = charIndex + (m ? m[0].length : 1);
    }
    try {
      const r = new Range();
      r.setStart(span.firstChild, Math.min(charIndex, text.length));
      r.setEnd(span.firstChild, Math.min(end, text.length));
      CSS.highlights.set("reading-word", new Highlight(r));
    } catch (_) {}
  }

  // ---------- position ----------
  function fmtRate(r) {
    const s = (+r).toFixed(2).replace(/0$/, "");
    return (s.endsWith(".") ? s + "0" : s) + "×";
  }

  function render() {
    ui.seek.value = idx;
    BR.setRangePct && BR.setRangePct(ui.seek);
    ui.pos.textContent = `${idx} / ${total}`;
    const rate = BR.settings.rate || 1;
    const left = Math.max(1, Math.round((minutes * (total - idx + 1)) / total / rate));
    ui.remaining.textContent = `残り約${left}分`;
    ui.prev.disabled = idx <= 1;
    ui.next.disabled = idx >= total;
  }

  function markCurrent() {
    document.querySelectorAll(".pair.is-current").forEach((el) => {
      el.classList.remove("is-current");
      el.querySelectorAll(".is-speaking").forEach((s) => s.classList.remove("is-speaking"));
    });
    const el = pairs.get(idx);
    if (el && (engaged || playing)) el.classList.add("is-current");
    render();
  }

  function inView(el) {
    const r = el.getBoundingClientRect();
    const top = (document.getElementById("appbar")?.offsetHeight || 0) + 8;
    const bottom = window.innerHeight - player.offsetHeight - 8;
    return r.top >= top && r.bottom <= bottom;
  }

  function scrollToCurrent(smooth = true) {
    const el = pairs.get(idx);
    if (!el) return;
    const appbarH = document.getElementById("appbar")?.offsetHeight || 0;
    const visible = window.innerHeight - appbarH - player.offsetHeight;
    const r = el.getBoundingClientRect();
    const target = window.scrollY + r.top - appbarH - Math.max(16, (visible - r.height) * 0.35);
    window.scrollTo({ top: Math.max(0, target), behavior: smooth ? "smooth" : "auto" });
  }

  function seek(i, { scroll = true } = {}) {
    engaged = true;
    idx = Math.min(Math.max(i, 1), total);
    markCurrent();
    if (scroll) {
      follow = true;
      ui.pill.hidden = true;
      if (!inView(pairs.get(idx))) scrollToCurrent();
    }
    if (playing) speakFrom(0);
    else BR.progress && BR.progress.save(ch.slug, idx);
  }
  BR.seek = seek;

  // ---------- speech ----------
  function parts() {
    const mode = BR.settings.readLang || "both";
    return mode === "jp" ? ["jp"] : mode === "en" ? ["en"] : ["jp", "en"];
  }

  function speakFrom(partIndex) {
    if (!synth) return;
    const my = ++gen;
    synth.cancel();
    clearWord();
    const list = parts();
    const part = list[partIndex];
    const c = chunks[idx];
    const el = pairs.get(idx);
    if (!part || !c || !el) return;

    el.querySelectorAll(".is-speaking").forEach((s) => s.classList.remove("is-speaking"));
    const span = el.querySelector(part === "jp" ? ".jp" : ".en");
    span.classList.add("is-speaking");

    if (follow && !inView(el)) scrollToCurrent();

    const u = new SpeechSynthesisUtterance(part === "jp" ? c.jp : c.en);
    u.lang = part === "jp" ? "ja-JP" : "en-US";
    const v = part === "jp" ? voices.ja : voices.en;
    if (v) u.voice = v;
    u.rate = BR.settings.rate || 1;
    u.onboundary = (e) => {
      if (my !== gen || e.name === "sentence") return;
      markWord(span, e.charIndex, e.charLength);
    };
    u.onend = () => {
      if (my !== gen || !playing) return;
      clearWord();
      if (partIndex + 1 < list.length) return speakFrom(partIndex + 1);
      if (idx >= total) return finish();
      idx += 1;
      markCurrent();
      BR.progress && BR.progress.save(ch.slug, idx);
      speakFrom(0);
    };
    u.onerror = (e) => {
      if (my !== gen) return;
      if (e.error === "interrupted" || e.error === "canceled") return;
      setPlaying(false);
      BR.toast && BR.toast("読み上げを続けられませんでした");
    };
    // Some engines (Chrome) drop an utterance queued in the same tick as cancel().
    setTimeout(() => {
      if (my === gen) synth.speak(u);
    }, 30);
  }

  function setPlaying(on) {
    playing = on;
    document.body.classList.toggle("is-playing", on);
    ui.play.setAttribute("aria-label", on ? "一時停止" : "読み上げる");
    if (!on) {
      gen++;
      synth && synth.cancel();
      clearWord();
      document.querySelectorAll(".is-speaking").forEach((s) => s.classList.remove("is-speaking"));
      ui.pill.hidden = true;
    }
  }

  function play() {
    if (!synth) return;
    if (!voices.ja && !voices.en) pickVoices();
    setPlaying(true);
    follow = true;
    markCurrent();
    speakFrom(0);
  }
  function pause() {
    setPlaying(false);
    BR.progress && BR.progress.save(ch.slug, idx);
  }
  function finish() {
    setPlaying(false);
    BR.progress && BR.progress.save(ch.slug, total);
    BR.toast && BR.toast("この章を読み終えました");
  }

  // ---------- follow / back-to-current ----------
  ["wheel", "touchmove"].forEach((t) =>
    window.addEventListener(t, () => (userScrollAt = Date.now()), { passive: true })
  );
  window.addEventListener("keydown", (e) => {
    if (["PageDown", "PageUp", "Home", "End", "ArrowDown", "ArrowUp"].includes(e.key)) userScrollAt = Date.now();
  });
  window.addEventListener(
    "scroll",
    () => {
      if (!playing) return;
      const el = pairs.get(idx);
      if (!el) return;
      if (Date.now() - userScrollAt < 800 && !inView(el)) {
        follow = false;
        ui.pill.hidden = false;
      } else if (inView(el)) {
        ui.pill.hidden = true;
      }
    },
    { passive: true }
  );
  ui.pill.addEventListener("click", () => {
    follow = true;
    ui.pill.hidden = true;
    scrollToCurrent();
  });

  // ---------- controls ----------
  ui.play.addEventListener("click", () => (playing ? pause() : play()));
  ui.prev.addEventListener("click", () => seek(idx - 1));
  ui.next.addEventListener("click", () => seek(idx + 1));
  ui.seek.addEventListener("input", () => {
    BR.setRangePct && BR.setRangePct(ui.seek);
    ui.pos.textContent = `${ui.seek.value} / ${total}`;
  });
  ui.seek.addEventListener("change", () => seek(+ui.seek.value));

  reader.addEventListener("click", (e) => {
    const el = e.target.closest(".pair");
    if (!el) return;
    if (String(window.getSelection && window.getSelection()).length > 0) return; // selecting text
    seek(+el.dataset.i, { scroll: false });
  });

  // rate
  function syncRate() {
    const r = BR.settings.rate || 1;
    ui.rateChip.textContent = fmtRate(r);
    ui.rateOut.textContent = fmtRate(r);
    ui.rate.value = r;
    BR.setRangePct && BR.setRangePct(ui.rate);
    document.querySelectorAll(".preset").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.rate === +r)));
    render();
  }
  ui.rate.addEventListener("input", () => {
    BR.set("rate", Math.round(+ui.rate.value * 100) / 100);
  });
  ui.rate.addEventListener("change", () => playing && speakFrom(0));
  document.querySelectorAll(".preset").forEach((b) =>
    b.addEventListener("click", () => {
      BR.set("rate", +b.dataset.rate);
      if (playing) speakFrom(0);
    })
  );

  // reading language
  const LANG_LABEL = { both: "日→英", jp: "日本語", en: "English" };
  function syncLang() {
    ui.lang.textContent = LANG_LABEL[BR.settings.readLang || "both"];
  }

  BR.onSettings((key) => {
    if (key === "rate") syncRate();
    if (key === "readLang") {
      syncLang();
      if (playing) speakFrom(0);
    }
  });

  // keyboard
  document.addEventListener("keydown", (e) => {
    if (document.querySelector("dialog[open]")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (["input", "textarea", "select"].includes(tag)) return;
    if (e.key === " " && tag !== "button" && tag !== "a") {
      e.preventDefault();
      playing ? pause() : play();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      seek(idx + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      seek(idx - 1);
    }
  });

  // player height → CSS (keeps the last lines and the back pill clear of the bar)
  const setH = () => document.documentElement.style.setProperty("--player-h", player.offsetHeight + "px");

  // ---------- init ----------
  if (!synth) {
    // No speech in this browser: keep the reading position UI, drop the play controls.
    ui.play.disabled = true;
    ui.play.setAttribute("aria-label", "この端末は読み上げに対応していません");
  } else {
    synth.cancel();
    pickVoices();
    synth.addEventListener ? synth.addEventListener("voiceschanged", pickVoices) : (synth.onvoiceschanged = pickVoices);
  }
  player.hidden = false;
  setH();
  if ("ResizeObserver" in window) new ResizeObserver(setH).observe(player);
  syncRate();
  syncLang();
  markCurrent();
  window.addEventListener("pagehide", () => synth && synth.cancel());
})();
