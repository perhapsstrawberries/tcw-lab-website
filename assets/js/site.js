const navToggle = document.querySelector(".nav-toggle");
const navMenu = document.querySelector(".nav-menu");
const searchToggle = document.querySelector(".search-toggle");
const searchPanel = document.querySelector(".site-search");
const searchInput = document.querySelector("#site-search-input");
const searchResults = document.querySelector("#site-search-results");
const themeToggle = document.querySelector(".theme-toggle");

let searchIndex = [];

const storedTheme = localStorage.getItem("tcw-theme");
document.documentElement.dataset.theme = storedTheme || "light";

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
  const particles = [];
  const count = 44;
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

  function resetParticle(particle, index) {
    particle.x = Math.random() * width;
    particle.y = Math.random() * height;
    particle.r = 2 + Math.random() * 3.8;
    particle.vx = (Math.random() - 0.5) * 0.34;
    particle.vy = (Math.random() - 0.5) * 0.34;
    particle.phase = index * 0.7 + Math.random() * 2;
  }

  resize();
  for (let index = 0; index < count; index += 1) {
    const particle = {};
    resetParticle(particle, index);
    particles.push(particle);
  }

  function draw() {
    frame += 0.008;
    context.clearRect(0, 0, width, height);

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "rgba(69, 229, 223, 0.20)");
    gradient.addColorStop(1, "rgba(47, 115, 255, 0.12)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    particles.forEach((particle, index) => {
      particle.x += particle.vx + Math.sin(frame + particle.phase) * 0.05;
      particle.y += particle.vy + Math.cos(frame + particle.phase) * 0.05;
      if (particle.x < -30 || particle.x > width + 30 || particle.y < -30 || particle.y > height + 30) {
        resetParticle(particle, index);
      }
    });

    for (let i = 0; i < particles.length; i += 1) {
      for (let j = i + 1; j < particles.length; j += 1) {
        const a = particles[i];
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 150) {
          context.strokeStyle = `rgba(7, 143, 144, ${0.20 * (1 - distance / 150)})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }
    }

    particles.forEach((particle) => {
      const pulse = 0.65 + Math.sin(frame * 3 + particle.phase) * 0.18;
      context.beginPath();
      context.fillStyle = `rgba(69, 229, 223, ${pulse})`;
      context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.strokeStyle = "rgba(255, 255, 255, 0.42)";
      context.arc(particle.x, particle.y, particle.r + 5, 0, Math.PI * 2);
      context.stroke();
    });

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  draw();
}

document.querySelectorAll(".bio-canvas").forEach(startBioCanvas);
