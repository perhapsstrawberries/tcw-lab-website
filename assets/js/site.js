const navToggle = document.querySelector(".nav-toggle");
const navMenu = document.querySelector(".nav-menu");
const searchToggle = document.querySelector(".search-toggle");
const searchPanel = document.querySelector(".site-search");
const searchInput = document.querySelector("#site-search-input");
const searchResults = document.querySelector("#site-search-results");
const themeToggle = document.querySelector(".theme-toggle");

let searchIndex = [];

const storedTheme = localStorage.getItem("tcw-theme");
document.documentElement.dataset.theme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : "light";

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("tcw-theme", next);
  });
}

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
  const count = 34;
  let width = 0;
  let height = 0;
  let frame = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(width * scale);
    canvas.height = Math.floor(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function resetCell(cell, index) {
    cell.x = Math.random() * width;
    cell.y = Math.random() * height;
    cell.r = 2.6 + Math.random() * 4.2;
    cell.vx = (Math.random() - 0.5) * 0.24;
    cell.vy = (Math.random() - 0.5) * 0.24;
    cell.phase = index * 0.77 + Math.random() * 2;
    cell.arms = 5 + Math.floor(Math.random() * 3);
  }

  resize();
  for (let index = 0; index < count; index += 1) {
    const cell = {};
    resetCell(cell, index);
    cells.push(cell);
  }

  function draw() {
    frame += 0.008;
    context.clearRect(0, 0, width, height);

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "rgba(162, 248, 246, 0.24)");
    gradient.addColorStop(1, "rgba(162, 248, 246, 0.14)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    cells.forEach((cell, index) => {
      cell.x += cell.vx + Math.sin(frame + cell.phase) * 0.035;
      cell.y += cell.vy + Math.cos(frame + cell.phase) * 0.035;
      if (cell.x < -40 || cell.x > width + 40 || cell.y < -40 || cell.y > height + 40) {
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
        if (distance < 118) {
          context.strokeStyle = `rgba(0, 142, 145, ${0.11 * (1 - distance / 118)})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }
    }

    cells.forEach((cell) => {
      const pulse = 0.58 + Math.sin(frame * 3 + cell.phase) * 0.16;
      for (let arm = 0; arm < cell.arms; arm += 1) {
        const angle = (Math.PI * 2 * arm) / cell.arms + Math.sin(frame + cell.phase) * 0.18;
        const length = cell.r * (4.2 + Math.sin(frame * 2 + arm + cell.phase) * 0.65);
        context.strokeStyle = `rgba(0, 142, 145, ${0.17 + pulse * 0.1})`;
        context.lineWidth = 1.15;
        context.beginPath();
        context.moveTo(cell.x, cell.y);
        context.lineTo(cell.x + Math.cos(angle) * length, cell.y + Math.sin(angle) * length);
        context.stroke();
      }
      context.beginPath();
      context.fillStyle = `rgba(162, 248, 246, ${pulse})`;
      context.arc(cell.x, cell.y, cell.r, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.strokeStyle = "rgba(255, 255, 255, 0.48)";
      context.arc(cell.x, cell.y, cell.r + 4, 0, Math.PI * 2);
      context.stroke();
    });

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  draw();
}

document.querySelectorAll(".bio-canvas").forEach(startBioCanvas);
