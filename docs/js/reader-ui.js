// Shared UI: settings (theme / language / layout / size), sheets, app bar, toast.
// Exposes window.BR for read-aloud.js and reading-progress.js.
(function () {
  const root = document.documentElement;
  const SETTINGS_KEY = "bilingual-reader:settings";
  const SIZES = [0.88, 0.94, 1, 1.08, 1.18];

  const BR = (window.BR = window.BR || {});
  const listeners = [];

  function load() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }
  const settings = Object.assign({ theme: "auto", show: "both", layout: "stack", size: 2, readLang: "both", rate: 1 }, load());

  function save() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (_) {}
  }

  function apply() {
    root.dataset.theme = settings.theme;
    root.dataset.show = settings.show;
    root.dataset.layout = settings.layout;
    root.style.setProperty("--scale", SIZES[settings.size] ?? 1);
    syncControls();
  }

  BR.settings = settings;
  BR.set = function (key, value) {
    if (settings[key] === value) return;
    settings[key] = value;
    save();
    apply();
    listeners.forEach((fn) => fn(key, value));
  };
  BR.onSettings = (fn) => listeners.push(fn);

  // ---------- controls ----------
  function setRangePct(input) {
    const min = +input.min || 0;
    const max = +input.max || 100;
    input.style.setProperty("--pct", ((+input.value - min) / (max - min)) * 100 + "%");
  }
  BR.setRangePct = setRangePct;

  function syncControls() {
    document.querySelectorAll("[data-setting]").forEach((group) => {
      const value = String(settings[group.dataset.setting]);
      group.querySelectorAll("[data-value]").forEach((b) => {
        b.setAttribute("aria-checked", String(b.dataset.value === value));
      });
    });
    const size = document.getElementById("set-size");
    if (size) {
      size.value = settings.size;
      setRangePct(size);
    }
  }

  document.addEventListener("click", (e) => {
    const opt = e.target.closest("[data-setting] [data-value]");
    if (!opt) return;
    const key = opt.closest("[data-setting]").dataset.setting;
    BR.set(key, opt.dataset.value);
  });

  const sizeInput = document.getElementById("set-size");
  if (sizeInput) {
    sizeInput.addEventListener("input", () => {
      setRangePct(sizeInput);
      BR.set("size", +sizeInput.value);
    });
  }

  // arrow keys inside a segmented control / theme group (radiogroup pattern)
  document.addEventListener("keydown", (e) => {
    const opt = e.target.closest && e.target.closest("[data-setting] [data-value]");
    if (!opt || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const opts = [...opt.parentElement.querySelectorAll("[data-value]")];
    const next = opts[(opts.indexOf(opt) + (e.key === "ArrowRight" ? 1 : -1) + opts.length) % opts.length];
    next.focus();
    next.click();
    e.preventDefault();
    e.stopPropagation();
  });

  // ---------- sheets ----------
  BR.openSheet = function (id) {
    const d = document.getElementById(id);
    if (!d || d.open) return;
    document.querySelectorAll("dialog[open]").forEach((o) => o.close());
    d.showModal();
    d.dispatchEvent(new CustomEvent("sheet-open"));
  };
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-open]");
    if (opener) {
      BR.openSheet(opener.dataset.open);
      return;
    }
    if (e.target.closest("[data-close]")) {
      e.target.closest("dialog").close();
      return;
    }
    // click on the backdrop = the dialog element itself
    if (e.target.tagName === "DIALOG") e.target.close();
  });

  // ---------- app bar ----------
  const appbar = document.getElementById("appbar");
  const heading = document.getElementById("chapter-head") || document.querySelector(".book-hero");
  if (appbar) {
    const onScroll = () => {
      const y = window.scrollY;
      appbar.classList.toggle("is-scrolled", y > 4);
      if (heading) {
        const bottom = heading.getBoundingClientRect().bottom;
        appbar.classList.toggle("show-title", bottom < appbar.offsetHeight);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ---------- toast ----------
  let toastTimer = 0;
  BR.toast = function (text) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = text;
    t.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-on"), 1800);
  };

  apply();
})();
