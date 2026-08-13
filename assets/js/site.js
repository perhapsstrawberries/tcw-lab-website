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
    { cell: "rgba(0, 236, 228,", core: "#efffff", nucleus: "#009fa4" },
    { cell: "rgba(190, 86, 255,", core: "#fff4a8", nucleus: "#9740e8" },
    { cell: "rgba(176, 248, 46,", core: "#fff29a", nucleus: "#74af24" },
    { cell: "rgba(72, 206, 255,", core: "#f4ffff", nucleus: "#0e94d0" },
    { cell: "rgba(255, 207, 32,", core: "#fff6bc", nucleus: "#d29a00" },
    { cell: "rgba(255, 104, 198,", core: "#ffefa6", nucleus: "#da3aa5" },
    { cell: "rgba(255, 128, 78,", core: "#fff0c2", nucleus: "#dc6430" }
  ];
  const TAU = Math.PI * 2;
  const rand = (min, max) => Math.random() * (max - min) + min;
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const fill = (base, alpha) => `${base}${clamp(alpha)})`;
  let pointerBias = 0;

  function motifForPage() {
    const page = document.body.classList;
    const hasPage = (name) => page.contains(name) || Array.from(page).some((className) => className.startsWith(`${name}-`));
    if (hasPage("page-research-programs")) return "dna";
    if (hasPage("page-publications")) return "chromatin";
    if (hasPage("page-ourteam-activity")) return "synapse";
    if (hasPage("page-ourteam")) return "neuron";
    if (hasPage("page-careers")) return "stem";
    if (hasPage("page-resources")) return "molecule";
    if (hasPage("page-contact")) return "signal";
    if (hasPage("page-member")) return "mixed";
    return "glial";
  }

  window.addEventListener("pointermove", (event) => {
    pointerBias = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 24;
  }, { passive: true });

  fields.forEach((field) => {
    const motif = field.dataset.motif || motifForPage();
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
      const layer = Math.random();
      cell.motif = motif;
      cell.palette = palette;
      cell.size = layer < 0.28 ? rand(28, 52) : layer < 0.78 ? rand(52, 88) : rand(88, 132);
      if (motif === "dna") cell.size *= rand(1.08, 1.38);
      if (motif === "chromatin") cell.size *= rand(1.15, 1.48);
      if (motif === "molecule") cell.size *= rand(0.86, 1.08);
      if (motif === "synapse") cell.size *= rand(0.92, 1.22);
      if (motif === "stem") cell.size *= rand(0.86, 1.18);
      if (motif === "signal") cell.size *= rand(1.05, 1.46);
      if (motif === "organoid" || motif === "mixed") cell.size *= rand(1.08, 1.52);
      cell.x = rand(-cell.size, width + cell.size);
      cell.y = fromTop ? rand(-height * 0.35, -cell.size) : rand(-cell.size, height + cell.size);
      cell.vx = rand(-17, 17);
      cell.vy = rand(30, 78) * (cell.size / 62);
      if (motif === "signal" || motif === "synapse") cell.vy *= 0.78;
      if (motif === "dna" || motif === "chromatin") cell.vy *= 0.9;
      cell.variant = Math.floor(rand(0, 5));
      cell.wave = rand(10, 32);
      cell.phase = rand(0, TAU);
      cell.phaseSpeed = rand(0.65, 1.7);
      cell.rotation = rand(0, TAU);
      cell.spin = rand(-0.42, 0.42);
      cell.fadeDistance = rand(120, 230);
      cell.opacity = 0;
      cell.targetOpacity = layer < 0.28 ? rand(0.34, 0.58) : layer < 0.78 ? rand(0.64, 0.86) : rand(0.84, 1);
      cell.innerRatio = rand(0.13, 0.2);
      cell.coreRatio = rand(0.12, 0.16);
      cell.starAlpha = rand(0.84, 1.12);
      cell.coreAlpha = rand(0.78, 1.08);
      cell.pointWobble = rand(0.012, 0.034);
      cell.branchCount = Math.floor(rand(5, 8));
      cell.branches = Array.from({ length: cell.branchCount }, (_, index) => ({
        angle: (index / cell.branchCount) * TAU + rand(-0.24, 0.24),
        reach: rand(0.48, 1),
        bend: rand(-0.55, 0.55),
        fork: Math.random() > 0.45
      }));
      cell.nodes = Array.from({ length: Math.floor(rand(4, 7)) }, () => ({
        angle: rand(0, TAU),
        distance: rand(0.2, 0.48),
        radius: rand(0.045, 0.085)
      }));
      cell.beads = Array.from({ length: Math.floor(rand(5, 9)) }, () => ({
        offset: rand(-0.48, 0.48),
        radius: rand(0.032, 0.06),
        phase: rand(0, TAU)
      }));
      cell.colony = Array.from({ length: Math.floor(rand(5, 10)) }, () => ({
        angle: rand(0, TAU),
        distance: rand(0.02, 0.34),
        radius: rand(0.12, 0.23),
        phase: rand(0, TAU)
      }));
    }

    function buildCells() {
      const settings = {
        dna: { density: 43000, min: 18, max: 34 },
        chromatin: { density: 46000, min: 16, max: 32 },
        neuron: { density: 36000, min: 24, max: 44 },
        synapse: { density: 33000, min: 26, max: 48 },
        stem: { density: 40000, min: 20, max: 38 },
        molecule: { density: 39000, min: 24, max: 42 },
        signal: { density: 47000, min: 16, max: 30 },
        organoid: { density: 52000, min: 14, max: 26 },
        mixed: { density: 38000, min: 22, max: 40 },
        glial: { density: 32000, min: 32, max: 52 }
      }[motif] || { density: 32000, min: 32, max: 52 };
      const density = settings.density;
      const maxCount = settings.max;
      const minCount = settings.min;
      const count = Math.round(Math.min(maxCount, Math.max(minCount, width * height / density)));
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
      const outer = size * (0.3 + (cell.variant % 4) * 0.014);
      const core = size * cell.coreRatio;
      context.save();
      context.translate(cell.x, cell.y);
      context.rotate(cell.rotation);
      context.globalAlpha = 1;
      context.lineCap = "round";
      context.lineJoin = "round";

      cell.branches.forEach((branch, index) => {
        const angle = branch.angle + Math.sin(cell.phase * 0.55 + index) * 0.1;
        const reach = size * (0.52 + branch.reach * 0.72);
        const bend = branch.bend * 0.52;
        const startX = Math.cos(angle) * core * 1.3;
        const startY = Math.sin(angle) * core * 1.3;
        const controlX = Math.cos(angle + bend) * reach * 0.55;
        const controlY = Math.sin(angle + bend) * reach * 0.55;
        const endX = Math.cos(angle + bend * 0.5) * reach;
        const endY = Math.sin(angle + bend * 0.5) * reach;
        context.beginPath();
        context.moveTo(startX, startY);
        context.quadraticCurveTo(controlX, controlY, endX, endY);
        context.lineWidth = Math.max(1.2, size * 0.018);
        context.strokeStyle = fill(palette.cell, 0.18 * alpha * cell.starAlpha);
        context.stroke();
      });

      context.beginPath();
      for (let i = 0; i < 30; i += 1) {
        const angle = (i / 30) * TAU;
        const membrane = outer * (1 + Math.sin(cell.phase * 0.8 + i * 1.7) * 0.08 + Math.cos(cell.phase * 0.5 + i * 0.9) * 0.045);
        const x = Math.cos(angle) * membrane;
        const y = Math.sin(angle) * membrane;
        if (i === 0) context.moveTo(x, y);
        else context.quadraticCurveTo(Math.cos(angle - 0.1) * membrane, Math.sin(angle - 0.1) * membrane, x, y);
      }
      context.closePath();
      context.fillStyle = fill(palette.cell, Math.min(0.42, 0.34 * alpha * cell.starAlpha));
      context.fill();
      context.lineWidth = Math.max(1, size * 0.014);
      context.strokeStyle = fill(palette.cell, Math.min(0.5, 0.42 * alpha * cell.starAlpha));
      context.stroke();

      for (let i = 0; i < 3; i += 1) {
        const angle = cell.phase * 0.18 + i * (TAU / 3);
        const radius = outer * 0.58;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        context.beginPath();
        context.arc(x, y, Math.max(1.2, size * 0.026), 0, TAU);
        context.fillStyle = fill(palette.cell, 0.18 * alpha);
        context.fill();
      }

      context.beginPath();
      context.arc(0, 0, core * 2.25, 0, TAU);
      context.fillStyle = fill(palette.cell, Math.min(0.32, 0.25 * alpha * cell.coreAlpha));
      context.fill();
      context.lineWidth = Math.max(1.2, size * 0.018);
      context.strokeStyle = fill(palette.cell, Math.min(0.46, 0.4 * alpha * cell.starAlpha));
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
      context.fillStyle = `rgba(255, 255, 255, ${0.92 * alpha})`;
      context.fill();
      context.restore();
    }

    function drawChromatin(cell, alpha) {
      const { size, palette } = cell;
      const beads = cell.beads;
      context.save();
      context.translate(cell.x, cell.y);
      context.rotate(cell.rotation);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();
      for (let step = 0; step <= 26; step += 1) {
        const t = step / 26;
        const angle = t * TAU * 1.45 + cell.phase * 0.28;
        const radius = size * (0.18 + 0.22 * Math.sin(t * Math.PI));
        const x = (t - 0.5) * size * 1.15 + Math.cos(angle) * radius * 0.42;
        const y = Math.sin(angle) * radius;
        if (step === 0) context.moveTo(x, y);
        else context.bezierCurveTo(x - size * 0.05, y - size * 0.08, x + size * 0.04, y + size * 0.08, x, y);
      }
      context.lineWidth = Math.max(1.2, size * 0.018);
      context.strokeStyle = fill(palette.cell, 0.34 * alpha);
      context.stroke();
      beads.forEach((bead, index) => {
        const x = bead.offset * size;
        const y = Math.sin(cell.phase + bead.phase) * size * 0.18;
        context.beginPath();
        context.arc(x, y, Math.max(2, size * bead.radius), 0, TAU);
        context.fillStyle = index % 2 ? fill(palette.cell, 0.36 * alpha) : palette.core;
        context.fill();
        context.lineWidth = Math.max(0.8, size * 0.008);
        context.strokeStyle = fill(palette.cell, 0.34 * alpha);
        context.stroke();
      });
      context.restore();
    }

    function drawSynapse(cell, alpha) {
      const { size, palette } = cell;
      context.save();
      context.translate(cell.x, cell.y);
      context.rotate(cell.rotation);
      context.lineCap = "round";
      const gap = size * 0.2;
      context.beginPath();
      context.arc(-gap, 0, size * 0.26, -1.1, 1.1);
      context.arc(gap, 0, size * 0.26, Math.PI - 1.1, Math.PI + 1.1);
      context.lineWidth = Math.max(1.3, size * 0.02);
      context.strokeStyle = fill(palette.cell, 0.36 * alpha);
      context.stroke();
      for (let i = 0; i < 7; i += 1) {
        const x = -gap + Math.cos(i * 1.7 + cell.phase) * size * 0.16;
        const y = Math.sin(i * 1.35 + cell.phase) * size * 0.18;
        context.beginPath();
        context.arc(x, y, size * (0.028 + (i % 3) * 0.005), 0, TAU);
        context.fillStyle = fill(palette.cell, 0.42 * alpha);
        context.fill();
      }
      context.beginPath();
      context.moveTo(-size * 0.04, -size * 0.24);
      context.quadraticCurveTo(size * 0.08, 0, -size * 0.04, size * 0.24);
      context.lineWidth = Math.max(0.9, size * 0.01);
      context.strokeStyle = fill(palette.cell, 0.2 * alpha);
      context.stroke();
      context.restore();
    }

    function drawNeuron(cell, alpha) {
      const { size, palette } = cell;
      const soma = size * cell.coreRatio * 1.75;
      context.save();
      context.translate(cell.x, cell.y);
      context.rotate(cell.rotation);
      context.lineCap = "round";
      context.lineJoin = "round";

      cell.branches.forEach((branch, index) => {
        const angle = branch.angle + Math.sin(cell.phase * 0.7 + index) * 0.08;
        const reach = size * (0.42 + branch.reach * 0.48);
        const control = reach * 0.55;
        const startX = Math.cos(angle) * soma * 0.6;
        const startY = Math.sin(angle) * soma * 0.6;
        const controlX = Math.cos(angle + branch.bend) * control;
        const controlY = Math.sin(angle + branch.bend) * control;
        const endX = Math.cos(angle + branch.bend * 0.42) * reach;
        const endY = Math.sin(angle + branch.bend * 0.42) * reach;
        context.beginPath();
        context.moveTo(startX, startY);
        context.quadraticCurveTo(controlX, controlY, endX, endY);
        context.lineWidth = Math.max(1.4, size * 0.02 * cell.starAlpha);
        context.strokeStyle = fill(palette.cell, 0.26 * alpha);
        context.stroke();

        if (branch.fork) {
          context.beginPath();
          context.moveTo(endX * 0.76, endY * 0.76);
          context.lineTo(endX + Math.cos(angle + 0.58) * soma * 0.8, endY + Math.sin(angle + 0.58) * soma * 0.8);
          context.moveTo(endX * 0.76, endY * 0.76);
          context.lineTo(endX + Math.cos(angle - 0.58) * soma * 0.62, endY + Math.sin(angle - 0.58) * soma * 0.62);
          context.lineWidth = Math.max(0.9, size * 0.014);
          context.strokeStyle = fill(palette.cell, 0.2 * alpha);
          context.stroke();
        }
      });

      context.beginPath();
      context.arc(0, 0, soma, 0, TAU);
      context.fillStyle = fill(palette.cell, 0.24 * alpha * cell.coreAlpha);
      context.fill();
      context.lineWidth = Math.max(1.1, size * 0.016);
      context.strokeStyle = fill(palette.cell, 0.36 * alpha * cell.starAlpha);
      context.stroke();

      context.beginPath();
      context.arc(0, 0, soma * 0.54, 0, TAU);
      context.fillStyle = palette.core;
      context.fill();
      context.lineWidth = Math.max(0.8, size * 0.011);
      context.strokeStyle = palette.nucleus;
      context.stroke();
      context.restore();
    }

    function drawDna(cell, alpha) {
      const { size, palette } = cell;
      const length = size * 1.12;
      const amplitude = size * 0.16;
      const steps = 14;
      const rungEvery = 2;
      context.save();
      context.translate(cell.x, cell.y);
      context.rotate(cell.rotation);
      context.lineCap = "round";
      context.lineJoin = "round";

      for (let strand = 0; strand < 2; strand += 1) {
        context.beginPath();
        for (let step = 0; step <= steps; step += 1) {
          const progress = step / steps;
          const y = -length / 2 + progress * length;
          const wave = Math.sin(progress * TAU * 1.25 + cell.phase + strand * Math.PI);
          const x = wave * amplitude;
          if (step === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.lineWidth = Math.max(1.1, size * 0.016);
        context.strokeStyle = fill(palette.cell, strand ? 0.26 * alpha : 0.36 * alpha * cell.starAlpha);
        context.stroke();
      }

      for (let step = 1; step < steps; step += rungEvery) {
        const progress = step / steps;
        const y = -length / 2 + progress * length;
        const wave = Math.sin(progress * TAU * 1.25 + cell.phase);
        context.beginPath();
        context.moveTo(wave * amplitude, y);
        context.lineTo(-wave * amplitude, y);
        context.lineWidth = Math.max(0.7, size * 0.009);
        context.strokeStyle = fill(palette.cell, 0.18 * alpha);
        context.stroke();
      }
      context.restore();
    }

    function drawMolecule(cell, alpha) {
      const { size, palette } = cell;
      context.save();
      context.translate(cell.x, cell.y);
      context.rotate(cell.rotation);
      context.lineCap = "round";

      const points = cell.nodes.map((node) => ({
        x: Math.cos(node.angle + Math.sin(cell.phase) * 0.08) * size * node.distance,
        y: Math.sin(node.angle + Math.cos(cell.phase) * 0.08) * size * node.distance,
        radius: size * node.radius
      }));

      context.lineWidth = Math.max(1, size * 0.01);
      context.strokeStyle = fill(palette.cell, 0.2 * alpha);
      points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(next.x, next.y);
        context.stroke();
      });

      points.forEach((point, index) => {
        context.beginPath();
        context.arc(point.x, point.y, point.radius, 0, TAU);
        if (index % 2) {
          context.fillStyle = fill(palette.cell, 0.28 * alpha);
          context.fill();
        } else {
          context.fillStyle = palette.core;
          context.fill();
        }
        context.lineWidth = Math.max(0.7, size * 0.009);
        context.strokeStyle = fill(palette.cell, 0.34 * alpha);
        context.stroke();
      });
      context.restore();
    }

    function drawStemColony(cell, alpha) {
      const { size, palette } = cell;
      context.save();
      context.translate(cell.x, cell.y);
      context.rotate(cell.rotation);
      context.lineCap = "round";
      context.lineJoin = "round";
      cell.colony.forEach((spot, index) => {
        const wobble = Math.sin(cell.phase + spot.phase) * size * 0.025;
        const x = Math.cos(spot.angle) * size * spot.distance + wobble;
        const y = Math.sin(spot.angle) * size * spot.distance - wobble * 0.6;
        const radius = size * spot.radius;
        context.beginPath();
        context.arc(x, y, radius, 0, TAU);
        context.fillStyle = fill(palette.cell, (index % 2 ? 0.24 : 0.34) * alpha);
        context.fill();
        context.lineWidth = Math.max(0.9, size * 0.009);
        context.strokeStyle = fill(palette.cell, 0.36 * alpha);
        context.stroke();
        context.beginPath();
        context.arc(x + radius * 0.14, y - radius * 0.1, radius * 0.34, 0, TAU);
        context.fillStyle = index % 3 === 0 ? palette.core : fill(palette.cell, 0.2 * alpha);
        context.fill();
      });
      context.restore();
    }

    function drawSignal(cell, alpha) {
      const { size, palette } = cell;
      context.save();
      context.translate(cell.x, cell.y);
      context.rotate(cell.rotation * 0.45);
      context.lineCap = "round";
      for (let ring = 0; ring < 3; ring += 1) {
        const pulse = (Math.sin(cell.phase * 0.9 + ring * 1.35) + 1) * 0.5;
        const radius = size * (0.12 + ring * 0.13 + pulse * 0.055);
        context.beginPath();
        context.arc(0, 0, radius, 0, TAU);
        context.lineWidth = Math.max(0.8, size * (0.01 - ring * 0.001));
        context.strokeStyle = fill(palette.cell, (0.38 - ring * 0.08) * alpha);
        context.stroke();
      }
      context.beginPath();
      context.arc(0, 0, size * 0.08, 0, TAU);
      context.fillStyle = palette.core;
      context.fill();
      context.lineWidth = Math.max(0.8, size * 0.01);
      context.strokeStyle = palette.nucleus;
      context.stroke();
      context.restore();
    }

    function drawOrganoid(cell, alpha) {
      const { size, palette } = cell;
      context.save();
      context.translate(cell.x, cell.y);
      context.rotate(cell.rotation * 0.35);
      context.lineCap = "round";
      context.lineJoin = "round";
      const radius = size * 0.34;
      context.beginPath();
      for (let i = 0; i < 36; i += 1) {
        const angle = (i / 36) * TAU;
        const membrane = radius * (1 + Math.sin(cell.phase * 0.55 + i * 0.74) * 0.11);
        const x = Math.cos(angle) * membrane;
        const y = Math.sin(angle) * membrane;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.fillStyle = fill(palette.cell, 0.26 * alpha);
      context.fill();
      context.lineWidth = Math.max(1, size * 0.012);
      context.strokeStyle = fill(palette.cell, 0.4 * alpha);
      context.stroke();
      cell.colony.slice(0, 7).forEach((spot, index) => {
        const x = Math.cos(spot.angle + cell.phase * 0.06) * radius * spot.distance * 1.7;
        const y = Math.sin(spot.angle + cell.phase * 0.06) * radius * spot.distance * 1.7;
        context.beginPath();
        context.arc(x, y, Math.max(2, size * spot.radius * 0.28), 0, TAU);
        context.fillStyle = index % 2 ? fill(palette.cell, 0.32 * alpha) : palette.core;
        context.fill();
      });
      context.restore();
    }

    function drawMixed(cell, alpha) {
      const choice = cell.variant % 5;
      if (choice === 0) drawOrganoid(cell, alpha);
      else if (choice === 1) drawNeuron(cell, alpha * 0.92);
      else if (choice === 2) drawDna(cell, alpha * 0.92);
      else if (choice === 3) drawStemColony(cell, alpha);
      else drawMolecule(cell, alpha);
    }

    function drawMotif(cell, alpha) {
      if (cell.motif === "dna") drawDna(cell, alpha);
      else if (cell.motif === "chromatin") drawChromatin(cell, alpha);
      else if (cell.motif === "neuron") drawNeuron(cell, alpha);
      else if (cell.motif === "synapse") drawSynapse(cell, alpha);
      else if (cell.motif === "stem") drawStemColony(cell, alpha);
      else if (cell.motif === "molecule") drawMolecule(cell, alpha);
      else if (cell.motif === "signal") drawSignal(cell, alpha);
      else if (cell.motif === "mixed") drawMixed(cell, alpha);
      else drawGlial(cell, alpha);
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

        drawMotif(cell, cell.opacity);
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
