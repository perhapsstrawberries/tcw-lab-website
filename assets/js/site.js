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

initIntroExperience();

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

function startBioCanvas(canvas) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const context = canvas.getContext("2d");
  const cells = [];
  const palette = [
    { stroke: "0, 166, 184", fill: "50, 239, 231", core: "0, 88, 101", halo: "124, 255, 246" },
    { stroke: "229, 54, 111", fill: "255, 99, 147", core: "122, 18, 58", halo: "255, 181, 205" },
    { stroke: "80, 196, 55", fill: "133, 241, 94", core: "34, 97, 29", halo: "193, 255, 163" },
    { stroke: "91, 98, 238", fill: "142, 149, 255", core: "47, 51, 139", halo: "198, 205, 255" },
    { stroke: "235, 171, 34", fill: "255, 214, 61", core: "126, 77, 5", halo: "255, 236, 139" },
    { stroke: "174, 70, 220", fill: "222, 124, 255", core: "88, 31, 127", halo: "235, 190, 255" }
  ];
  const isMemberPage = document.body.classList.contains("page-member");
  const isHomePage = document.body.classList.contains("is-home");
  const speed = isMemberPage ? 0.22 : isHomePage ? 0.28 : 0.34;
  const count = isMemberPage ? 16 : isHomePage ? 30 : 26;
  const glow = isMemberPage ? 0.88 : isHomePage ? 0.96 : 0.94;
  const field = canvas.closest(".hero, .login-hero, .gate-hero") || canvas.parentElement;
  const scatterSlots = [
    [0.04, 0.18], [0.16, 0.16], [0.28, 0.18], [0.42, 0.16], [0.58, 0.18], [0.74, 0.16], [0.9, 0.18],
    [0.08, 0.32], [0.22, 0.34], [0.36, 0.32], [0.52, 0.34], [0.68, 0.32], [0.84, 0.34], [0.96, 0.36],
    [0.05, 0.5], [0.18, 0.52], [0.34, 0.5], [0.5, 0.52], [0.66, 0.5], [0.82, 0.52], [0.95, 0.5],
    [0.1, 0.68], [0.26, 0.66], [0.42, 0.68], [0.58, 0.66], [0.74, 0.68], [0.9, 0.66],
    [0.06, 0.84], [0.22, 0.82], [0.38, 0.84], [0.54, 0.82], [0.7, 0.84], [0.86, 0.82], [0.98, 0.86]
  ];
  let seed = Array.from(`${window.location.pathname}:${canvas.className}`).reduce((hash, char) => {
    return ((hash << 5) - hash + char.charCodeAt(0)) >>> 0;
  }, 2166136261);
  const avoidSelectors = [
    ".hero-eyebrow",
    ".hero h1",
    ".hero-subtitle",
    ".hero-metrics",
    ".page-content",
    ".notice-panel",
    ".research-spotlight",
    ".research-project-card",
    ".login-intro",
    ".login-card",
    ".gate-copy",
    ".gate-card"
  ];
  let avoidZones = [];
  let width = 0;
  let height = 0;
  let frame = 0;

  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(width * scale);
    canvas.height = Math.floor(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    updateAvoidZones();
  }

  function updateAvoidZones() {
    const canvasRect = canvas.getBoundingClientRect();
    avoidZones = avoidSelectors.flatMap((selector) => {
      return Array.from(document.querySelectorAll(selector)).map((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        const padX = Math.min(132, Math.max(46, rect.width * 0.08));
        const padY = Math.min(74, Math.max(32, rect.height * 0.18));
        return {
          left: rect.left - canvasRect.left - padX,
          right: rect.right - canvasRect.left + padX,
          top: rect.top - canvasRect.top - padY,
          bottom: rect.bottom - canvasRect.top + padY
        };
      }).filter(Boolean);
    });
  }

  function isInsideAvoidZone(x, y, buffer) {
    return avoidZones.some((zone) => (
      x > zone.left - buffer &&
      x < zone.right + buffer &&
      y > zone.top - buffer &&
      y < zone.bottom + buffer
    ));
  }

  function placeCell(cell, index) {
    const buffer = Math.max(42, cell.r * 3.6);
    const minDistance = Math.max(72, cell.r * 6.2);
    const startSlot = (index * 7) % scatterSlots.length;
    const spreadX = width * (isMemberPage ? 0.12 : 0.08);
    const spreadY = height * (isMemberPage ? 0.11 : 0.085);
    for (let attempt = 0; attempt < 132; attempt += 1) {
      const slot = scatterSlots[(startSlot + Math.floor(attempt / 6)) % scatterSlots.length];
      const baseX = slot[0] * width;
      const baseY = slot[1] * height;
      const candidateX = baseX + (random() - 0.5) * spreadX * (1 + Math.min(attempt, 54) / 90);
      const candidateY = baseY + (random() - 0.5) * spreadY * (1 + Math.min(attempt, 54) / 90);
      const hasBreathingRoom = cells.every((other) => (
        Math.hypot(candidateX - other.x, candidateY - other.y) > minDistance
      ));
      if (!isInsideAvoidZone(candidateX, candidateY, buffer) && (hasBreathingRoom || attempt > 82)) {
        cell.x = Math.min(width + 28, Math.max(-28, candidateX));
        cell.y = Math.min(height + 28, Math.max(-28, candidateY));
        return;
      }
    }

    const side = index % 4;
    if (side === 0) {
      cell.x = random() * width * 0.18;
      cell.y = random() * height;
    } else if (side === 1) {
      cell.x = width * (0.74 + random() * 0.24);
      cell.y = random() * height;
    } else if (side === 2) {
      cell.x = random() * width;
      cell.y = random() * height * 0.2;
    } else {
      cell.x = random() * width;
      cell.y = height * (0.72 + random() * 0.25);
    }
  }

  function resetCell(cell, index) {
    cell.r = 6.4 + random() * 6.2;
    placeCell(cell, index);
    cell.vx = (random() - 0.5) * 0.085 * speed;
    cell.vy = (random() - 0.5) * 0.085 * speed;
    cell.phase = index * 0.77 + random() * 2;
    cell.float = 0.6 + random() * 0.7;
    cell.color = palette[index % palette.length];
    cell.arms = 7 + Math.floor(random() * 4);
    cell.soma = Array.from({ length: 24 }, (_, point) => ({
      angle: (Math.PI * 2 * point) / 24,
      radius: point % 2 === 0 ? 1.42 + random() * 0.34 : 1.0 + random() * 0.2
    }));
    cell.branches = Array.from({ length: cell.arms }, (_, arm) => ({
      angle: (Math.PI * 2 * arm) / cell.arms + (random() - 0.5) * 0.16,
      length: 1.15 + random() * 0.52,
      web: 2.42 + random() * 0.64,
      forkAt: 0.24 + random() * 0.18,
      fork: 0.38 + random() * 0.2,
      lean: (random() - 0.5) * 0.44,
      endBulb: 0.46 + random() * 0.24,
      twigs: 2 + Math.floor(random() * 3)
    }));
  }

  resize();
  for (let index = 0; index < count; index += 1) {
    const cell = {};
    resetCell(cell, index);
    cells.push(cell);
  }

  function distanceFadeFromZone(cell, zone) {
    const nearestX = Math.max(zone.left, Math.min(cell.x, zone.right));
    const nearestY = Math.max(zone.top, Math.min(cell.y, zone.bottom));
    const distance = Math.hypot(cell.x - nearestX, cell.y - nearestY);
    const margin = 170;
    return Math.min(1, Math.max(0, distance / margin));
  }

  function textFade(cell) {
    if (!avoidZones.length) return 1;
    return avoidZones.reduce((alpha, zone) => Math.min(alpha, distanceFadeFromZone(cell, zone)), 1);
  }

  function nudgeAwayFromText(cell) {
    avoidZones.forEach((zone) => {
      if (cell.x < zone.left || cell.x > zone.right || cell.y < zone.top || cell.y > zone.bottom) return;
      const centerX = (zone.left + zone.right) / 2;
      const centerY = (zone.top + zone.bottom) / 2;
      const dx = cell.x - centerX || 1;
      const dy = cell.y - centerY || 1;
      const length = Math.hypot(dx, dy) || 1;
      cell.x += (dx / length) * 0.82;
      cell.y += (dy / length) * 0.82;
      cell.vx += (dx / length) * 0.0032;
      cell.vy += (dy / length) * 0.0032;
    });
    cell.vx *= 0.998;
    cell.vy *= 0.998;
  }

  function draw() {
    frame += 0.014 * speed;
    context.clearRect(0, 0, width, height);
    const darkMode = document.documentElement.dataset.theme === "dark";

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, `rgba(117, 244, 240, ${0.07 * glow})`);
    gradient.addColorStop(0.45, `rgba(216, 144, 255, ${0.035 * glow})`);
    gradient.addColorStop(1, `rgba(255, 112, 145, ${0.032 * glow})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    cells.forEach((cell, index) => {
      cell.x += cell.vx + Math.sin(frame * cell.float + cell.phase) * 0.052 * speed;
      cell.y += cell.vy + Math.cos(frame * 0.86 * cell.float + cell.phase) * 0.062 * speed;
      nudgeAwayFromText(cell);
      if (cell.x < -70 || cell.x > width + 70 || cell.y < -70 || cell.y > height + 70) {
        resetCell(cell, index);
      }
    });

    for (let i = 0; i < cells.length; i += 1) {
      for (let j = i + 1; j < cells.length; j += 1) {
        const a = cells[i];
        const b = cells[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 76) {
          const bridge = i % 2 === 0 ? a.color.stroke : b.color.stroke;
          context.strokeStyle = `rgba(${bridge}, ${0.022 * glow * (1 - distance / 76)})`;
          context.lineWidth = 0.55;
          context.lineCap = "round";
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }
    }

    cells.forEach((cell) => {
      const heartbeat = 0.52 + Math.pow((Math.sin(frame * 12 + cell.phase) + 1) / 2, 5) * 0.18;
      const pulse = 0.38 + Math.sin(frame * 2 + cell.phase) * 0.04 + heartbeat * 0.08;
      const stroke = darkMode ? cell.color.fill : cell.color.stroke;
      const fill = cell.color.fill;
      const core = darkMode ? "235, 255, 253" : cell.color.core;
      const contentFade = textFade(cell);
      const edgeFade = Math.min(
        1,
        Math.max(0, cell.x / 92),
        Math.max(0, (width - cell.x) / 92),
        Math.max(0, cell.y / 92),
        Math.max(0, (height - cell.y) / 190)
      ) * contentFade;

      context.save();
      context.shadowColor = `rgba(${cell.color.halo}, ${0.3 * glow * edgeFade})`;
      context.shadowBlur = 10 + heartbeat * 6;

      context.beginPath();
      cell.branches.forEach((branch, arm) => {
        const next = cell.branches[(arm + 1) % cell.branches.length];
        const wobble = Math.sin(frame + cell.phase + arm) * 0.1;
        const angle = branch.angle + wobble + branch.lean * 0.12;
        const nextAngle = next.angle + Math.sin(frame + cell.phase + arm + 1) * 0.1 + next.lean * 0.12;
        const outer = cell.r * branch.web;
        const nextOuter = cell.r * next.web;
        const valleyAngle = (angle + nextAngle) / 2;
        const valley = cell.r * (0.92 + Math.sin(frame + cell.phase + arm) * 0.035);
        const outerX = cell.x + Math.cos(angle) * outer;
        const outerY = cell.y + Math.sin(angle) * outer;
        const valleyX = cell.x + Math.cos(valleyAngle) * valley;
        const valleyY = cell.y + Math.sin(valleyAngle) * valley;
        const nextX = cell.x + Math.cos(nextAngle) * nextOuter;
        const nextY = cell.y + Math.sin(nextAngle) * nextOuter;
        if (arm === 0) context.moveTo(outerX, outerY);
        context.quadraticCurveTo(valleyX, valleyY, nextX, nextY);
      });
      context.closePath();
      context.fillStyle = `rgba(${fill}, ${Math.min(0.32, 0.24 * glow) * edgeFade})`;
      context.fill();
      context.strokeStyle = `rgba(${stroke}, ${Math.min(0.34, 0.24 * glow) * edgeFade})`;
      context.lineWidth = Math.max(0.9, cell.r * 0.1);
      context.stroke();

      cell.branches.forEach((branch, arm) => {
        const wobble = Math.sin(frame + cell.phase + arm) * 0.13;
        const angle = branch.angle + wobble + branch.lean * 0.22;
        const length = cell.r * (branch.length + Math.sin(frame * 2 + arm + cell.phase) * 0.08);
        const startX = cell.x + Math.cos(angle) * cell.r * 1.74;
        const startY = cell.y + Math.sin(angle) * cell.r * 1.74;
        const midX = startX + Math.cos(angle + branch.lean + wobble * 0.8) * length * 0.48;
        const midY = startY + Math.sin(angle + branch.lean + wobble * 0.8) * length * 0.48;
        const tipX = startX + Math.cos(angle) * length;
        const tipY = startY + Math.sin(angle) * length;
        context.strokeStyle = `rgba(${stroke}, ${Math.min(0.48, (0.34 + pulse * 0.1) * glow) * edgeFade})`;
        context.lineWidth = Math.max(1.05, cell.r * 0.14);
        context.lineCap = "round";
        context.lineJoin = "round";
        context.beginPath();
        context.moveTo(startX, startY);
        context.quadraticCurveTo(midX, midY, tipX, tipY);
        context.stroke();

        context.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.22, 0.1 * glow) * edgeFade})`;
        context.lineWidth = Math.max(0.5, cell.r * 0.055);
        context.beginPath();
        context.moveTo(startX, startY);
        context.quadraticCurveTo(midX, midY, tipX, tipY);
        context.stroke();

        Array.from({ length: branch.twigs }, (_, twig) => twig).forEach((twig) => {
          const side = twig % 2 === 0 ? -1 : 1;
          const branchAngle = angle + side * (branch.fork + Math.sin(frame + cell.phase + twig) * 0.08);
          const branchLength = length * (0.17 + twig * 0.04);
          const forkAt = Math.min(0.8, branch.forkAt + twig * 0.1);
          const branchStartX = startX + Math.cos(angle) * length * forkAt;
          const branchStartY = startY + Math.sin(angle) * length * forkAt;
          const branchTipX = branchStartX + Math.cos(branchAngle) * branchLength;
          const branchTipY = branchStartY + Math.sin(branchAngle) * branchLength;
          context.strokeStyle = `rgba(${stroke}, ${Math.min(0.34, 0.24 * glow) * edgeFade})`;
          context.lineWidth = Math.max(0.55, cell.r * 0.07);
          context.beginPath();
          context.moveTo(branchStartX, branchStartY);
          context.quadraticCurveTo(
            branchStartX + Math.cos(branchAngle + side * 0.18) * branchLength * 0.56,
            branchStartY + Math.sin(branchAngle + side * 0.18) * branchLength * 0.56,
            branchTipX,
            branchTipY
          );
          context.stroke();
          context.beginPath();
          context.fillStyle = `rgba(${fill}, ${Math.min(0.36, 0.24 * glow) * edgeFade})`;
          context.arc(branchTipX, branchTipY, Math.max(0.65, cell.r * 0.055), 0, Math.PI * 2);
          context.fill();
        });

        context.beginPath();
        context.fillStyle = `rgba(${fill}, ${Math.min(0.38, 0.26 * glow) * edgeFade})`;
        context.arc(tipX, tipY, Math.max(0.8, cell.r * branch.endBulb * 0.14), 0, Math.PI * 2);
        context.fill();
      });
      context.restore();
      context.save();
      context.translate(cell.x, cell.y);
      context.beginPath();
      cell.soma.forEach((point, index) => {
        const wobble = 1 + Math.sin(frame * 2.2 + cell.phase + index) * 0.045;
        const x = Math.cos(point.angle) * cell.r * point.radius * wobble;
        const y = Math.sin(point.angle) * cell.r * point.radius * wobble;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
      context.shadowColor = `rgba(${cell.color.halo}, ${0.42 * glow * edgeFade})`;
      context.shadowBlur = 12 + heartbeat * 7;
      context.fillStyle = `rgba(${fill}, ${Math.min(0.62, (0.48 + pulse * 0.16) * glow) * edgeFade})`;
      context.fill();
      context.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.52, 0.28 * glow) * edgeFade})`;
      context.lineWidth = Math.max(0.8, cell.r * 0.085);
      context.stroke();
      context.beginPath();
      context.shadowBlur = 8;
      context.fillStyle = `rgba(${core}, ${Math.min(0.42, 0.3 * glow) * edgeFade})`;
      context.arc(-cell.r * 0.16, -cell.r * 0.12, Math.max(1.7, cell.r * 0.28), 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.fillStyle = `rgba(255, 255, 255, ${Math.min(0.5, 0.28 * glow) * edgeFade})`;
      context.arc(cell.r * 0.2, -cell.r * 0.26, Math.max(0.75, cell.r * 0.095), 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.fillStyle = `rgba(255, 255, 255, ${Math.min(0.24, heartbeat * 0.18) * edgeFade})`;
      context.arc(cell.r * 0.34, cell.r * 0.18, Math.max(0.6, cell.r * 0.07), 0, Math.PI * 2);
      context.fill();
      context.restore();
    });

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  draw();
}

document.querySelectorAll(".bio-canvas").forEach(startBioCanvas);

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
