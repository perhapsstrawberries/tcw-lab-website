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
    { cell: "rgba(22, 248, 242,", core: "#efffff", nucleus: "#00aeb2" },
    { cell: "rgba(194, 104, 255,", core: "#fff4a8", nucleus: "#9e48ec" },
    { cell: "rgba(190, 255, 70,", core: "#fff29a", nucleus: "#78b92b" },
    { cell: "rgba(96, 214, 255,", core: "#f4ffff", nucleus: "#1197d3" },
    { cell: "rgba(255, 218, 56,", core: "#fff6bc", nucleus: "#d8a000" },
    { cell: "rgba(255, 126, 210,", core: "#ffefa6", nucleus: "#df46ad" }
  ];
  const TAU = Math.PI * 2;
  const rand = (min, max) => Math.random() * (max - min) + min;
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const fill = (base, alpha) => `${base}${clamp(alpha)})`;
  let pointerBias = 0;

  function motifForPage() {
    const page = document.body.classList;
    const hasPage = (name) => page.contains(name) || Array.from(page).some((className) => className.startsWith(`${name}-`));
    if (hasPage("page-research-programs") || hasPage("page-publications")) return "dna";
    if (hasPage("page-ourteam") || hasPage("page-careers")) return "neuron";
    if (hasPage("page-resources") || hasPage("page-contact")) return "molecule";
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
      if (motif === "molecule") cell.size *= rand(0.88, 1.12);
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
      cell.targetOpacity = layer < 0.28 ? rand(0.28, 0.54) : layer < 0.78 ? rand(0.58, 0.82) : rand(0.82, 0.98);
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
    }

    function buildCells() {
      const density = motif === "dna" ? 43000 : motif === "molecule" ? 39000 : motif === "neuron" ? 36000 : 32000;
      const maxCount = motif === "dna" ? 34 : motif === "molecule" ? 42 : motif === "neuron" ? 44 : 52;
      const minCount = motif === "dna" ? 18 : motif === "molecule" ? 24 : motif === "neuron" ? 24 : 32;
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
      const outer = size * 0.5;
      const inner = size * cell.innerRatio;
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
      for (let i = 0; i < 24; i += 1) {
        const angle = (i / 24) * TAU;
        const radius = i % 2 === 0 ? outer : inner + Math.sin(cell.phase + i) * size * cell.pointWobble;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.fillStyle = fill(palette.cell, Math.min(0.58, 0.48 * alpha * cell.starAlpha));
      context.fill();

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

    function drawMotif(cell, alpha) {
      if (cell.motif === "dna") drawDna(cell, alpha);
      else if (cell.motif === "neuron") drawNeuron(cell, alpha);
      else if (cell.motif === "molecule") drawMolecule(cell, alpha);
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
