const navToggle = document.querySelector(".nav-toggle");
const navMenu = document.querySelector(".nav-menu");
const searchToggle = document.querySelector(".search-toggle");
const searchPanel = document.querySelector(".site-search");
const searchInput = document.querySelector("#site-search-input");
const searchResults = document.querySelector("#site-search-results");
const musicToggle = document.querySelector(".music-toggle");

let searchIndex = [];
let ambientAudio = null;

function setMusicButtonState(active) {
  document.querySelectorAll("[data-music-toggle], [data-music-start]").forEach((button) => {
    button.setAttribute("aria-pressed", String(active));
    if (button.matches("[data-music-toggle]")) {
      button.setAttribute("aria-label", active ? "Stop soft background music" : "Allow soft background music");
      button.setAttribute("title", active ? "Music on" : "Allow music");
    }
  });
}

function stopAmbientSound() {
  if (!ambientAudio) return;
  const { context, master, stopTimer } = ambientAudio;
  window.clearTimeout(stopTimer);
  const now = context.currentTime;
  try {
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    window.setTimeout(() => context.close().catch(() => {}), 620);
  } catch {
    context.close().catch(() => {});
  }
  ambientAudio = null;
  setMusicButtonState(false);
}

function playIntroSound(duration = 32) {
  stopAmbientSound();
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return false;

  let context;
  try {
    context = new AudioContext();
  } catch {
    return false;
  }

  const now = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.04, now + 0.7);
  master.gain.setValueAtTime(0.04, now + Math.max(1, duration - 2.2));
  master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  master.connect(context.destination);

  const noiseBuffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
  const noise = noiseBuffer.getChannelData(0);
  for (let index = 0; index < noise.length; index += 1) {
    noise[index] = (Math.random() * 2 - 1) * 0.55;
  }
  const noiseSource = context.createBufferSource();
  const noiseFilter = context.createBiquadFilter();
  const noiseGain = context.createGain();
  noiseSource.buffer = noiseBuffer;
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(1250, now);
  noiseFilter.Q.setValueAtTime(0.45, now);
  noiseGain.gain.setValueAtTime(0.012, now);
  noiseGain.gain.setValueAtTime(0.012, now + Math.max(1, duration - 1.4));
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);
  noiseSource.start(now);
  noiseSource.stop(now + duration);

  const chords = [
    [261.63, 329.63, 392.0, 523.25],
    [293.66, 349.23, 440.0, 587.33],
    [246.94, 329.63, 392.0, 493.88],
    [261.63, 349.23, 415.3, 523.25]
  ];
  for (let start = 0; start < duration - 2.8; start += 4.8) {
    chords[Math.floor(start / 4.8) % chords.length].forEach((freq, index) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = index % 2 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.12 / (index + 2), now + start + 0.5 + index * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 4.25);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + start + index * 0.04);
      osc.stop(now + start + 4.35);
    });

    [659.25, 783.99, 587.33].forEach((freq, index) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      const offset = start + 1.05 + index * 0.68;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.07, now + offset + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.9);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + offset);
      osc.stop(now + offset + 1);
    });
  }

  if (context.state === "suspended") {
    const resume = () => context.resume().catch(() => {});
    document.addEventListener("pointerdown", resume, { once: true });
    document.addEventListener("keydown", resume, { once: true });
  }

  ambientAudio = {
    context,
    master,
    stopTimer: window.setTimeout(() => {
      ambientAudio = null;
      setMusicButtonState(false);
      context.close().catch(() => {});
    }, (duration + 0.4) * 1000)
  };
  setMusicButtonState(true);
  return true;
}

function initIntroExperience() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const key = "tcw-intro-seen-v1";
  let seen = false;
  try {
    seen = sessionStorage.getItem(key) === "1";
  } catch {
    seen = false;
  }
  if (reduceMotion || seen) return;

  const intro = document.createElement("div");
  intro.className = "site-intro";
  intro.setAttribute("role", "status");
  intro.setAttribute("aria-live", "polite");
  intro.innerHTML = `
    <div class="intro-mark" aria-hidden="true">TCW</div>
    <h2>TCW Lab</h2>
    <p class="intro-kicker">Science is a team sport</p>
    <button class="intro-music" type="button" data-music-start aria-pressed="false">Allow music</button>
    <div class="intro-pulse" aria-hidden="true"><span></span><span></span><span></span></div>
  `;
  document.body.prepend(intro);
  document.body.classList.add("intro-lock");
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // Storage can be disabled in strict browser modes; the intro still works.
  }
  window.setTimeout(() => {
    intro.classList.add("leaving");
    document.body.classList.remove("intro-lock");
  }, 3900);

  window.setTimeout(() => intro.remove(), 4750);
}

document.documentElement.dataset.theme = "light";

// Dr. TCW asked for the homepage immediately, so the intro gate stays disabled.
// The function remains above for easy rollback, but it is intentionally not called.

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-music-toggle], [data-music-start]");
  if (!button) return;
  if (ambientAudio) {
    if (ambientAudio.context.state === "suspended") {
      ambientAudio.context.resume().catch(() => {});
      setMusicButtonState(true);
    } else {
      stopAmbientSound();
    }
  } else {
    playIntroSound(52);
  }
});

if (musicToggle) {
  musicToggle.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && ambientAudio) stopAmbientSound();
  });
}

function initExternalLinks() {
  document.querySelectorAll("a[href]").forEach((link) => {
    let url;
    try {
      url = new URL(link.getAttribute("href"), window.location.href);
    } catch {
      return;
    }

    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== window.location.origin) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  });
}

initExternalLinks();

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    const open = navMenu.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
}

if (searchToggle && searchPanel && searchInput) {
  searchToggle.addEventListener("click", () => {
    const open = searchPanel.classList.toggle("open");
    searchToggle.setAttribute("aria-expanded", String(open));
    if (open) searchInput.focus();
  });
}

async function loadSearchIndex() {
  if (!document.currentScript) return;
  const url = new URL("../search-index.json", document.currentScript.src);
  try {
    const response = await fetch(url);
    searchIndex = await response.json();
  } catch {
    searchIndex = [];
  }
}

function renderSearch(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    searchResults.innerHTML = "";
    return;
  }

  const terms = normalized.split(/\s+/).filter(Boolean);
  const matches = searchIndex
    .map((item) => {
      const haystack = `${item.title} ${item.text}`.toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 8);

  searchResults.innerHTML = matches.length
    ? matches.map((item) => `<a href="${item.url}"><strong>${item.title}</strong><br><small>${item.text.slice(0, 130)}...</small></a>`).join("")
    : "<p>No matches found.</p>";
}

if (searchInput && searchResults) {
  loadSearchIndex();
  searchInput.addEventListener("input", (event) => renderSearch(event.target.value));
}

function initGlialMotion() {
  const fields = Array.from(document.querySelectorAll(".glial-field"));
  if (!fields.length) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const palettes = [
    { cell: "rgba(43, 248, 242,", core: "#efffff", nucleus: "#00aeb2" },
    { cell: "rgba(203, 133, 255,", core: "#fff7b1", nucleus: "#9e59e8" },
    { cell: "rgba(198, 242, 90,", core: "#fff3a1", nucleus: "#7fb934" },
    { cell: "rgba(127, 220, 255,", core: "#f6ffff", nucleus: "#1499d1" },
    { cell: "rgba(255, 224, 90,", core: "#fff8c8", nucleus: "#d8a900" },
    { cell: "rgba(255, 154, 217,", core: "#fff0ad", nucleus: "#df58b2" }
  ];
  const TAU = Math.PI * 2;
  const rand = (min, max) => Math.random() * (max - min) + min;
  let pointerBias = 0;

  window.addEventListener("pointermove", (event) => {
    pointerBias = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 24;
  }, { passive: true });

  fields.forEach((field) => {
    const canvas = document.createElement("canvas");
    canvas.className = "glial-canvas";
    canvas.setAttribute("aria-hidden", "true");
    field.prepend(canvas);

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      canvas.remove();
      return;
    }
    field.classList.add("canvas-active");

    let width = 0;
    let height = 0;
    let dpr = 1;
    let cells = [];
    let lastTime = performance.now();
    let raf = 0;

    function resetCell(cell, fromTop = false) {
      const palette = palettes[Math.floor(rand(0, palettes.length))];
      cell.palette = palette;
      cell.size = rand(32, 92);
      cell.x = rand(-cell.size, width + cell.size);
      cell.y = fromTop ? rand(-height * 0.35, -cell.size) : rand(-cell.size, height + cell.size);
      cell.vx = rand(-16, 16);
      cell.vy = rand(28, 74) * (cell.size / 62);
      cell.wave = rand(10, 32);
      cell.phase = rand(0, TAU);
      cell.phaseSpeed = rand(0.65, 1.7);
      cell.rotation = rand(0, TAU);
      cell.spin = rand(-0.42, 0.42);
      cell.fadeDistance = rand(120, 230);
      cell.opacity = 0;
      cell.targetOpacity = rand(0.48, 0.86);
    }

    function buildCells() {
      const count = Math.round(Math.min(30, Math.max(18, width * height / 52000)));
      cells = Array.from({ length: count }, () => {
        const cell = {};
        resetCell(cell, false);
        return cell;
      });
    }

    function resize() {
      const rect = field.getBoundingClientRect();
      width = Math.max(320, Math.round(rect.width));
      height = Math.max(360, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildCells();
    }

    function drawGlial(cell, alpha) {
      const { size, palette } = cell;
      const outer = size * 0.5;
      const inner = size * 0.19;
      const core = size * 0.15;
      context.save();
      context.translate(cell.x, cell.y);
      context.rotate(cell.rotation);
      context.globalAlpha = alpha;

      context.beginPath();
      for (let i = 0; i < 24; i += 1) {
        const angle = (i / 24) * TAU;
        const radius = i % 2 === 0 ? outer : inner + Math.sin(cell.phase + i) * size * 0.018;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.fillStyle = `${palette.cell}${0.54 * alpha})`;
      context.fill();

      context.beginPath();
      context.arc(0, 0, core * 1.9, 0, TAU);
      context.fillStyle = `${palette.cell}${0.24 * alpha})`;
      context.fill();
      context.lineWidth = Math.max(1.5, size * 0.025);
      context.strokeStyle = `${palette.cell}${0.62 * alpha})`;
      context.stroke();

      context.beginPath();
      context.arc(0, 0, core, 0, TAU);
      context.fillStyle = palette.core;
      context.fill();
      context.lineWidth = Math.max(1, size * 0.018);
      context.strokeStyle = palette.nucleus;
      context.stroke();

      context.beginPath();
      context.arc(core * 0.2, -core * 0.22, core * 0.22, 0, TAU);
      context.fillStyle = `rgba(255, 255, 255, ${0.82 * alpha})`;
      context.fill();
      context.restore();
    }

    function step(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.04);
      lastTime = now;
      context.clearRect(0, 0, width, height);

      cells.forEach((cell) => {
        cell.phase += cell.phaseSpeed * dt;
        cell.rotation += cell.spin * dt;
        cell.x += (cell.vx + Math.sin(cell.phase) * cell.wave + pointerBias * 0.18) * dt;
        cell.y += (cell.vy + Math.cos(cell.phase * 0.7) * 10) * dt;

        if (cell.x < -cell.size) cell.x = width + cell.size;
        if (cell.x > width + cell.size) cell.x = -cell.size;

        const fadeIn = Math.min(1, (cell.y + cell.size) / cell.fadeDistance);
        const fadeOut = Math.min(1, (height + cell.size - cell.y) / cell.fadeDistance);
        const alpha = Math.max(0, Math.min(fadeIn, fadeOut, 1)) * cell.targetOpacity;
        cell.opacity += (alpha - cell.opacity) * Math.min(1, dt * 8);

        if (cell.y > height + cell.size || (cell.opacity < 0.01 && cell.y > height * 0.72)) {
          resetCell(cell, true);
          return;
        }

        drawGlial(cell, cell.opacity);
      });

      raf = window.requestAnimationFrame(step);
    }

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(resize);
      observer.observe(field);
    } else {
      window.addEventListener("resize", resize, { passive: true });
    }
    resize();
    raf = window.requestAnimationFrame(step);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        window.cancelAnimationFrame(raf);
      } else {
        lastTime = performance.now();
        raf = window.requestAnimationFrame(step);
      }
    });
  });
}

initGlialMotion();

function initImageLightbox() {
  const explicitTriggers = Array.from(document.querySelectorAll("[data-lightbox-src]"));
  const zoomableImages = Array.from(document.querySelectorAll(
    ".research-project-card img, .image-grid img, .activity-spotlight img, .is-home .page-content img"
  )).filter((image) => !image.closest("[data-lightbox-src]"));

  if (!explicitTriggers.length && !zoomableImages.length) return;

  let lightbox = document.querySelector("#photo-lightbox");
  if (!lightbox) {
    lightbox = document.createElement("div");
    lightbox.className = "photo-lightbox";
    lightbox.id = "photo-lightbox";
    lightbox.hidden = true;
    lightbox.innerHTML = '<button class="lightbox-close" type="button" aria-label="Close photo viewer">Close</button><figure><img alt=""><figcaption></figcaption></figure>';
    document.body.appendChild(lightbox);
  }

  const lightboxImage = lightbox.querySelector("img");
  const lightboxCaption = lightbox.querySelector("figcaption");
  const closeButton = lightbox.querySelector(".lightbox-close");

  function captionForImage(image) {
    const figure = image.closest("figure");
    const figureCaption = figure ? figure.querySelector("figcaption") : null;
    const projectTitle = image.closest(".research-project-card")?.querySelector("h2");
    return figureCaption?.textContent?.trim() || projectTitle?.textContent?.trim() || image.alt || "TCW Lab image";
  }

  function openLightbox(src, caption) {
    lightboxImage.src = src;
    lightboxImage.alt = caption;
    lightboxCaption.textContent = caption;
    lightbox.hidden = false;
    closeButton.focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImage.removeAttribute("src");
  }

  explicitTriggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      openLightbox(trigger.dataset.lightboxSrc, trigger.dataset.lightboxCaption || "TCW Lab image");
    });
  });

  zoomableImages.forEach((image) => {
    image.classList.add("zoomable-image");
    image.tabIndex = 0;
    image.setAttribute("role", "button");
    image.setAttribute("aria-label", "Open larger image");
    function open() {
      openLightbox(image.currentSrc || image.src, captionForImage(image));
    }
    image.addEventListener("click", open);
    image.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });

  closeButton.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !lightbox.hidden) closeLightbox();
  });
}

initImageLightbox();
