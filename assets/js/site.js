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
    { stroke: "0, 176, 184", fill: "117, 244, 240", core: "0, 92, 96" },
    { stroke: "220, 58, 95", fill: "255, 112, 145", core: "108, 22, 48" },
    { stroke: "97, 198, 72", fill: "155, 235, 126", core: "38, 92, 36" },
    { stroke: "105, 111, 240", fill: "156, 161, 255", core: "50, 54, 130" },
    { stroke: "238, 174, 56", fill: "255, 217, 102", core: "125, 78, 12" },
    { stroke: "170, 78, 214", fill: "216, 144, 255", core: "82, 35, 120" }
  ];
  const isMemberPage = document.body.classList.contains("page-member");
  const isHomePage = document.body.classList.contains("is-home");
  const speed = isMemberPage ? 0.22 : isHomePage ? 0.42 : 0.65;
  const count = isMemberPage ? 10 : isHomePage ? 18 : 24;
  const glow = isMemberPage ? 0.58 : isHomePage ? 0.82 : 0.92;
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
    cell.r = 3.5 + Math.random() * 4.7;
    cell.vx = (Math.random() - 0.5) * 0.18 * speed;
    cell.vy = (Math.random() - 0.5) * 0.18 * speed;
    cell.phase = index * 0.77 + Math.random() * 2;
    cell.color = palette[index % palette.length];
    cell.arms = 8 + Math.floor(Math.random() * 4);
    cell.branches = Array.from({ length: cell.arms }, (_, arm) => ({
      angle: (Math.PI * 2 * arm) / cell.arms + (Math.random() - 0.5) * 0.46,
      length: 4.6 + Math.random() * 2.2,
      forkAt: 0.46 + Math.random() * 0.24,
      fork: 0.36 + Math.random() * 0.42,
      lean: (Math.random() - 0.5) * 0.35,
      twigs: 1 + Math.floor(Math.random() * 3)
    }));
  }

  resize();
  for (let index = 0; index < count; index += 1) {
    const cell = {};
    resetCell(cell, index);
    cells.push(cell);
  }

  function draw() {
    frame += 0.004 * speed;
    context.clearRect(0, 0, width, height);
    const darkMode = document.documentElement.dataset.theme === "dark";

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, `rgba(117, 244, 240, ${0.12 * glow})`);
    gradient.addColorStop(0.45, `rgba(216, 144, 255, ${0.055 * glow})`);
    gradient.addColorStop(1, `rgba(255, 112, 145, ${0.045 * glow})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    cells.forEach((cell, index) => {
      cell.x += cell.vx + Math.sin(frame + cell.phase) * 0.018 * speed;
      cell.y += cell.vy + Math.cos(frame + cell.phase) * 0.018 * speed;
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
          const bridge = i % 2 === 0 ? a.color.stroke : b.color.stroke;
          context.strokeStyle = `rgba(${bridge}, ${0.07 * glow * (1 - distance / 118)})`;
          context.lineWidth = 1;
          context.lineCap = "round";
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }
    }

    cells.forEach((cell) => {
      const pulse = 0.42 + Math.sin(frame * 2 + cell.phase) * 0.06;
      const stroke = darkMode ? cell.color.fill : cell.color.stroke;
      const fill = cell.color.fill;
      const core = darkMode ? "235, 255, 253" : cell.color.core;
      cell.branches.forEach((branch, arm) => {
        const wobble = Math.sin(frame + cell.phase + arm) * 0.16;
        const angle = branch.angle + wobble + branch.lean * 0.22;
        const length = cell.r * (branch.length + Math.sin(frame * 2 + arm + cell.phase) * 0.5);
        const midX = cell.x + Math.cos(angle + branch.lean + wobble * 0.55) * length * 0.5;
        const midY = cell.y + Math.sin(angle + branch.lean + wobble * 0.55) * length * 0.5;
        const tipX = cell.x + Math.cos(angle) * length;
        const tipY = cell.y + Math.sin(angle) * length;
        context.strokeStyle = `rgba(${stroke}, ${(0.24 + pulse * 0.09) * glow})`;
        context.lineWidth = 1.55;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.beginPath();
        context.moveTo(cell.x, cell.y);
        context.quadraticCurveTo(midX, midY, tipX, tipY);
        context.stroke();

        if (arm % 2 === 0 || branch.length > 5.2) {
          Array.from({ length: branch.twigs }, (_, twig) => twig).forEach((twig) => {
            const side = twig % 2 === 0 ? -1 : 1;
            const branchAngle = angle + side * (branch.fork + Math.sin(frame + cell.phase) * 0.08);
            const branchLength = length * (0.18 + (arm % 3) * 0.05);
            const forkAt = Math.min(0.82, branch.forkAt + twig * 0.12);
            const branchStartX = cell.x + Math.cos(angle) * length * forkAt;
            const branchStartY = cell.y + Math.sin(angle) * length * forkAt;
            const branchTipX = branchStartX + Math.cos(branchAngle) * branchLength;
            const branchTipY = branchStartY + Math.sin(branchAngle) * branchLength;
            context.strokeStyle = `rgba(${stroke}, ${0.16 * glow})`;
            context.lineWidth = 1.05;
            context.beginPath();
            context.moveTo(branchStartX, branchStartY);
            context.quadraticCurveTo(
              branchStartX + Math.cos(branchAngle + side * 0.16) * branchLength * 0.55,
              branchStartY + Math.sin(branchAngle + side * 0.16) * branchLength * 0.55,
              branchTipX,
              branchTipY
            );
            context.stroke();
          });
        }
      });
      context.beginPath();
      context.fillStyle = `rgba(${fill}, ${(0.5 + pulse * 0.5) * glow})`;
      context.arc(cell.x, cell.y, cell.r * 1.08, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.fillStyle = `rgba(${core}, ${0.28 * glow})`;
      context.arc(cell.x - cell.r * 0.23, cell.y - cell.r * 0.16, Math.max(1.4, cell.r * 0.38), 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.strokeStyle = `rgba(255, 255, 255, ${0.34 * glow})`;
      context.arc(cell.x, cell.y, cell.r + 4, 0, Math.PI * 2);
      context.stroke();
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
