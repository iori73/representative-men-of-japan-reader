// Bilingual chunk-by-chunk read-aloud using the browser's built-in Web Speech API.
// Free, no server, no pre-rendered audio. Voice quality/availability depends on
// the visitor's OS/browser (see README "known limitations").
(function () {
  if (!("speechSynthesis" in window)) return;

  const bar = document.getElementById("read-aloud-bar");
  if (!bar || !Array.isArray(window.__CHAPTER_CHUNKS__)) return;

  const chunks = window.__CHAPTER_CHUNKS__;
  const playBtn = document.getElementById("ra-play");
  const pauseBtn = document.getElementById("ra-pause");
  const rateInput = document.getElementById("ra-rate");

  // Resume from the reading-progress bookmark (reading-progress.js) if one exists,
  // so pressing play continues near where the reader left off instead of restarting.
  let currentIndex = 1; // index 0 is the chapter title, skip it
  try {
    const raw = window.__CHAPTER_SLUG__ && localStorage.getItem("book-of-tea:progress:" + window.__CHAPTER_SLUG__);
    const saved = raw && JSON.parse(raw);
    if (saved && saved.chunkIndex > 1) currentIndex = saved.chunkIndex;
  } catch (_) {
    // ignore — just starts from the top
  }
  let shouldContinue = false;
  let jaVoice = null;
  let enVoice = null;

  function pickVoices() {
    const voices = speechSynthesis.getVoices();
    const jaVoices = voices.filter((v) => v.lang && v.lang.startsWith("ja"));
    // Prefer "Kyoko" (the macOS voice used for the offline .m4a pipeline) for consistency;
    // fall back to any other available Japanese voice on browsers/OSes without her.
    jaVoice = jaVoices.find((v) => v.name.includes("Kyoko")) || jaVoices[0] || null;
    enVoice = voices.find((v) => v.lang && v.lang.startsWith("en")) || null;
  }
  pickVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.addEventListener("voiceschanged", pickVoices);
  }

  function clearHighlight() {
    document.querySelectorAll(".chunk.speaking").forEach((el) => el.classList.remove("speaking"));
  }

  function highlight(index) {
    clearHighlight();
    const el = document.querySelector(`.chunk[data-chunk-index="${index}"]`);
    if (!el) return;
    el.classList.add("speaking");
    const rect = el.getBoundingClientRect();
    const inView = rect.top > 80 && rect.bottom < window.innerHeight - 80;
    if (!inView) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function speak(text, lang, voice, onEnd) {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    if (voice) utter.voice = voice;
    utter.rate = parseFloat(rateInput.value || "1");
    utter.onend = onEnd;
    utter.onerror = onEnd;
    speechSynthesis.speak(utter);
  }

  function playChunk(index) {
    if (!shouldContinue || index >= chunks.length) {
      stop();
      return;
    }
    const chunk = chunks[index];
    currentIndex = index;
    highlight(index);
    speak(chunk.jp, "ja-JP", jaVoice, () => {
      if (!shouldContinue) return;
      speak(chunk.en, "en-US", enVoice, () => {
        if (!shouldContinue) return;
        playChunk(index + 1);
      });
    });
  }

  function play(fromIndex) {
    shouldContinue = true;
    speechSynthesis.cancel();
    playBtn.hidden = true;
    pauseBtn.hidden = false;
    playChunk(fromIndex ?? currentIndex);
  }

  function stop() {
    shouldContinue = false;
    speechSynthesis.cancel();
    clearHighlight();
    playBtn.hidden = false;
    pauseBtn.hidden = true;
  }

  playBtn.addEventListener("click", () => play());
  pauseBtn.addEventListener("click", stop);

  document.querySelectorAll(".chunk").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.chunkIndex, 10);
      if (Number.isNaN(idx)) return;
      play(idx);
    });
    el.style.cursor = "pointer";
  });

  bar.classList.add("ready");
})();
