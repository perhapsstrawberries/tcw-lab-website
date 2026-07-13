import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const outDir = projectRoot;

const WP_BASE = "https://sites.bu.edu/tcwlab";
const PAGE_EXPORT = "/private/tmp/tcw-pages.json";
const POST_EXPORT = "/private/tmp/tcw-posts.json";

const NAV = [
  ["Research", "/research-programs/"],
  ["Publications", "/publications/"],
  ["Our Team", "/ourteam/"],
  ["Lab Activity", "/ourteam/activity/"],
  ["Careers", "/careers/"],
  ["Resources", "/resources/"],
  ["Contact", "/contact/"],
  ["Members", "/member/"],
];

const PAGE_ROUTES = [
  { wpSlug: "tcw-lab", route: "/", nav: "TCW Lab", title: "Science is a Team Sport" },
  { wpSlug: "research-programs", route: "/research-programs/", nav: "Research Projects" },
  { wpSlug: "publications", route: "/publications/", nav: "Publications" },
  { wpSlug: "ourteam", route: "/ourteam/", nav: "Our Team", title: "Lab Members" },
  { wpSlug: "activity", route: "/ourteam/activity/", nav: "Lab Activity" },
  { wpSlug: "talent-aquisition", route: "/careers/", nav: "Careers", custom: "talent" },
  { wpSlug: "resources", route: "/resources/", nav: "Resources", custom: "resources" },
  { wpSlug: "news", route: "/resources/news/", nav: "Research News" },
  { wpSlug: "research-comments", route: "/resources/research-comments/", nav: "Research Comments" },
  { wpSlug: "contact", route: "/contact/", nav: "Contact", title: "Contact Us", custom: "contact" },
];

const RESEARCH_IMAGES = [
  ["combined-photo.jpg", "Research image collection"],
  ["12453-3e-1f1-1-nestin-sox2snapshot1.jpg", "NPC marker staining"],
  ["12453-3e-2c2-3-nestin-sox2snapshot1.jpg", "NPC marker staining"],
  ["12481-3-1-gaba-map2-1snapshot1.jpg", "GABA and MAP2 staining"],
  ["12481-3-1-th1-map2-3snapshot1.jpg", "TH1 and MAP2 staining"],
  ["astrocyte-stacked-2m.jpg", "Astrocyte culture image"],
  ["3651-4-func-aldh1l1.jpg", "Functional astrocyte marker image"],
  ["9429-4-m.jpg", "Cell culture microscopy"],
  ["3363tcw14-n-t.jpg", "Neuronal culture image"],
  ["3363tcw6-n-t.jpg", "Neuronal culture image"],
  ["f12461-5-1-npc-nestin-foxp2-dapi.jpg", "NPC Nestin, FOXP2, and DAPI staining"],
  ["tcw2e33-2e3-d56-org-e33-2e3-img-d10-20x-c1-c2-c3.jpg", "Organoid and iMG co-culture image"],
];

const INTERNAL_ROUTES = new Map(PAGE_ROUTES.map((page) => [page.wpSlug, page.route]));
INTERNAL_ROUTES.set("tcwlab", "/");

function decodeEntities(value = "") {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html = "") {
  return decodeEntities(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function compactText(htmlOrText = "", limit = 520) {
  const text = stripTags(htmlOrText);
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
}

function slugify(value) {
  return decodeEntities(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90) || "asset";
}

function basePrefix(route) {
  if (route === "/") return "";
  const depth = route.split("/").filter(Boolean).length;
  return "../".repeat(depth);
}

function relHref(currentRoute, targetRoute) {
  const base = basePrefix(currentRoute);
  if (targetRoute === "/") return base || "./";
  return `${base}${targetRoute.replace(/^\//, "")}`;
}

function outputPathForRoute(route) {
  if (route === "/") return path.join(outDir, "index.html");
  return path.join(outDir, route.replace(/^\//, ""), "index.html");
}

function canonicalWpUrl(route) {
  if (route === "/") return `${WP_BASE}/`;
  return `${WP_BASE}${route}`;
}

function normalizeUrl(raw) {
  if (!raw || raw.startsWith("data:") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/tcwlab/")) return `https://sites.bu.edu${raw}`;
  if (raw.startsWith("/")) return `https://sites.bu.edu${raw}`;
  try {
    return new URL(raw, `${WP_BASE}/`).href;
  } catch {
    return raw;
  }
}

function isImageUrl(url) {
  return /\.(apng|avif|gif|jpe?g|png|svg|webp)(\?|#|$)/i.test(url || "");
}

function collectImageUrls(html, urls) {
  for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
    const url = normalizeUrl(match[1]);
    if (isImageUrl(url)) urls.add(url);
  }
}

function assetNameForUrl(url, taken) {
  const parsed = new URL(url);
  const ext = path.extname(parsed.pathname).toLowerCase() || ".img";
  const stem = slugify(path.basename(parsed.pathname, ext));
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 8);
  let filename = `${stem}-${hash}${ext}`;
  while (taken.has(filename)) filename = `${stem}-${hash}-${taken.size}${ext}`;
  taken.add(filename);
  return `assets/images/${filename}`;
}

async function readJsonExport(tmpPath, repoName, url) {
  let raw;
  if (existsSync(tmpPath)) {
    raw = await readFile(tmpPath, "utf8");
  } else {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    raw = await response.text();
    await writeFile(tmpPath, raw);
  }
  return JSON.parse(raw);
}

async function downloadAssets(urls) {
  const assetDir = path.join(outDir, "assets", "images");
  await mkdir(assetDir, { recursive: true });
  const taken = new Set();
  const assetMap = new Map();

  for (const url of [...urls].sort()) {
    const relPath = assetNameForUrl(url, taken);
    assetMap.set(url, relPath);
    const dest = path.join(outDir, relPath);
    if (existsSync(dest)) continue;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Skipping ${url}: HTTP ${response.status}`);
        continue;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(dest, buffer);
    } catch (error) {
      console.warn(`Skipping ${url}: ${error.message}`);
    }
  }

  return assetMap;
}

function internalTarget(raw) {
  const absolute = normalizeUrl(raw);
  if (!absolute || absolute.startsWith("mailto:") || absolute.startsWith("tel:")) return null;

  try {
    const parsed = new URL(absolute);
    if (parsed.hostname !== "sites.bu.edu") return null;
    let pathname = parsed.pathname.replace(/^\/tcwlab/, "") || "/";
    if (!pathname.endsWith("/")) pathname += "/";
    return [...INTERNAL_ROUTES.values()].includes(pathname) ? pathname : null;
  } catch {
    return null;
  }
}

function cleanWpContent(html, route, assetMap) {
  const base = basePrefix(route);
  let content = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\s(?:srcset|sizes)=["'][^"']*["']/gi, "")
    .replace(/\sloading=["'][^"']*["']/gi, "")
    .replace(/<p>(?:&nbsp;|\s)*<\/p>/gi, "")
    .replace(/\sstyle=["'][^"']*["']/gi, "");

  content = content.replace(/\b(src|href)=["']([^"']+)["']/gi, (full, attr, raw) => {
    const normalized = normalizeUrl(raw);
    if (attr.toLowerCase() === "href") {
      const target = internalTarget(raw);
      if (target) return `${attr}="${relHref(route, target)}"`;
    }
    if (assetMap.has(normalized)) return `${attr}="${base}${assetMap.get(normalized)}"`;
    return `${attr}="${raw}"`;
  });

  content = content
    .replace(/<div class=['"]slideshow-loader active['"][\s\S]*?<\/div><\/div>/gi, "")
    .replace(/<div class=["']bu-slideshow-navigation-container["'][\s\S]*?<\/div><\/div>/gi, "")
    .replace(/<a href="&quot;(https?:\/\/[^"<]+)&lt;\/a"><\/a>/gi, '<a href="$1">Alzforum</a>')
    .replace(/<img /gi, '<img loading="lazy" ');

  return content;
}

function customTalent() {
  return `
    <section class="notice-panel">
      <h2>Talent Acquisition</h2>
      <p>We welcome scientists, trainees, and collaborators who want to work at the interface of Alzheimer's disease genetics, human iPSC models, CRISPRi screens, and multi-omics computational biology.</p>
      <p>Because GitHub Pages is static, this version routes applications by email instead of the old WordPress upload form.</p>
      <p><a class="button-link" href="mailto:doctortcw@gmail.com?subject=TCW%20Lab%20Application">Email application materials</a></p>
    </section>
    <section class="form-shell" aria-labelledby="apply-fields">
      <h2 id="apply-fields">Application Information</h2>
      <div class="field-grid">
        <label>Name<input type="text" autocomplete="name"></label>
        <label>Email<input type="email" autocomplete="email"></label>
        <label>Current Affiliation<input type="text"></label>
        <label>Position Looking For<select><option>Postdoctoral Fellow</option><option>Research Associate</option><option>Internship</option><option>Research Professor</option><option>None-of-Above</option></select></label>
      </div>
      <fieldset>
        <legend>Wet lab and/or dry lab</legend>
        <label><input type="checkbox"> Wet lab</label>
        <label><input type="checkbox"> Dry lab</label>
        <label><input type="checkbox"> Both</label>
      </fieldset>
      <fieldset>
        <legend>Wet lab skill sets</legend>
        <div class="checkbox-grid">
          ${["Human iPSC maintenance", "CRISPRi screen", "Any CNS cell type differentiation from iPSC", "Human iPSC reprogramming", "Western blotting", "Confocal microscopy", "Molecular cloning", "DNA/RNA purification", "Flow cytometry / FACS", "Human brain cell type preparation", "PCR / qRT-PCR", "Single cell/single nucleus library preparation", "Animal handling", "Electrophysiology"].map((item) => `<label><input type="checkbox"> ${item}</label>`).join("")}
        </div>
      </fieldset>
      <label>Other skills<textarea rows="4"></textarea></label>
      <label>Any comments<textarea rows="6"></textarea></label>
      <p class="form-note">Attach cover letter, CV, references, and major publications in the email message.</p>
    </section>`;
}

function customContact() {
  return `
    <section class="contact-grid">
      <div class="notice-panel">
        <h2>Contact Details</h2>
        <p><strong>Lab science:</strong> <a href="mailto:doctortcw@gmail.com">doctortcw@gmail.com</a></p>
        <p><strong>Lab business:</strong> <a href="mailto:tcwlaboratory@gmail.com">tcwlaboratory@gmail.com</a></p>
        <p><strong>Location:</strong> 700 Albany St. W533, Boston, MA 02118</p>
      </div>
      <form class="form-shell" action="mailto:tcwlaboratory@gmail.com" method="post" enctype="text/plain">
        <h2>Email Us Here for Any Inquiry</h2>
        <label>Name<input name="name" type="text" autocomplete="name"></label>
        <label>Email<input name="email" type="email" autocomplete="email"></label>
        <label>Message<textarea name="message" rows="8"></textarea></label>
        <button type="submit">Open Email Draft</button>
      </form>
    </section>`;
}

function customResources() {
  return `
<h3>Videos</h3>
<ul class="resource-list">
  <li><a href="https://vjdementia.com/video/i9n1p55i4_w-overcoming-the-limitations-of-ipsc-models/">Overcoming the limitations of iPSC models</a></li>
  <li><a href="https://vjdementia.com/video/tmvdgtxzbjc-impact-of-apoe4-on-cellular-function-in-astrocytes-and-microglia/">Alzheimer's disease functional genomics with iPSCs</a></li>
  <li><a href="https://vjdementia.com/video/iqqluwmmock-alzheimers-disease-functional-genomics-with-ipscs/">Impact of APOE4 on cellular function in astrocytes and microglia</a></li>
  <li><a href="https://vjdementia.com/video/jr36vzg-ja8-unveiling-the-role-of-astrocytes-in-alzheimers-disease-for-novel-therapeutic-strategies/">Unveiling the role of astrocytes in Alzheimer's disease for novel therapeutic strategies</a></li>
</ul>
<h3>Mutation Resources</h3>
<ul class="resource-list">
  <li><a href="https://www.alzforum.org/mutations">Alzforum Mutations Database</a></li>
</ul>
<h3><strong>Protocol for morphogen-guided differentiation of brain cell types using human induced pluripotent stem cells</strong></h3>
<p><a href="https://www.cell.com/star-protocols/fulltext/S2666-1667(25)00745-2">STAR Protocols publication</a></p>
<p><a href="https://drive.google.com/file/d/1dNUte8q5X5toklKFnMare8KD11taTGbK/view?usp=sharing">Differentiation of iPSCs to Microglia</a></p>
<p><a href="https://drive.google.com/file/d/1aO_vIdrQXCbdo2ZdJ3SMGzJyOS_KMTUt/view?usp=sharing">Differentiation of iPSCs to Astrocytes</a></p>`;
}

function dataPortalContent() {
  return `
    <section class="notice-panel">
      <h2>Research Data Portal</h2>
      <p>This tab is reserved for the lab data website and member-only research tools. GitHub Pages can host the public shell, but real authentication needs a separate service such as GitHub organization access, Netlify/Vercel auth, Cloudflare Access, or a small backend.</p>
      <p>The current static build keeps this page ready for the private database once the hosting/authentication decision is made.</p>
    </section>
    <div class="portal-grid">
      <article>
        <h3>Lab Database</h3>
        <p>Keep member-only datasets, project notes, and internal tools behind the Members portal.</p>
      </article>
      <article>
        <h3>Member Access</h3>
        <p>Use GitHub organization membership or an external identity layer for restricted lab-only tools.</p>
      </article>
      <article>
        <h3>Future Integration</h3>
        <p>Connect the existing APOE-AD research database as a tab after its deployment target is chosen.</p>
      </article>
    </div>`;
}

function researchImageGallery(route) {
  const base = basePrefix(route);
  return `
    <section class="research-image-gallery">
      <h2>Research Images</h2>
      <p>Representative research images provided by Dr. TCW for the independent lab website.</p>
      <div class="image-grid">
        ${RESEARCH_IMAGES.map(([file, caption]) => `
          <figure>
            <img loading="lazy" src="${base}assets/images/research/${file}" alt="${caption}">
            <figcaption>${caption}</figcaption>
          </figure>`).join("")}
      </div>
    </section>`;
}

function sidebarFor(route) {
  if (route.startsWith("/resources/")) {
    const base = basePrefix(route);
    return `
    <aside class="sidebar-stack" aria-label="Resources navigation">
      <section class="sidebar-card">
        <h2>Resources</h2>
        <ul>
          <li><a href="${base}resources/">Resources Home</a></li>
          <li><a href="${base}resources/news/">Research News</a></li>
          <li><a href="${base}resources/research-comments/">Research Comments</a></li>
        </ul>
      </section>
      <section class="sidebar-card">
        <h2>News</h2>
        <p>Research coverage and lab highlights are collected under the Research News tab.</p>
        <p><a class="text-link" href="${base}resources/news/">Open Research News</a></p>
      </section>
    </aside>`;
  }
  if (route !== "/") return "";
  return `
    <aside class="sidebar-stack" aria-label="Explore more">
      <section class="sidebar-card" aria-labelledby="related-links-title">
        <h2 id="related-links-title">Explore AD Research</h2>
        <ul>
          <li><a href="https://www.cell.com/cell/fulltext/S0092-8674(22)00648-1">Cell Publication</a></li>
          <li><a href="https://www.alzforum.org/">Alzforum</a></li>
          <li><a href="https://www.alzforum.org/news/research-news/cholesterol-dysregulation-early-step-tau-pathology">Cholesterol Dysregulation</a></li>
        </ul>
      </section>
      <section class="sidebar-card" aria-labelledby="home-news-title">
        <div class="section-kicker">News</div>
        <h2 id="home-news-title">News</h2>
        <ul class="sidebar-news-list">
          <li>
            <time>2022</time>
            <a href="https://www.nature.com/articles/s43587-022-00256-2.epdf?sharing_token=GrUQ68XperuvW8iguf1MMdRgN0jAjWel9jnR3ZoTv0Pnvp0rwzcstVsDzMecyAHcFbe-FD23JvAay-bQAYgo06TgH6niiUEuX54lyopUMKMM7nhMa8x1OG311rOZaKUXClm1imnT-lPUwXIr7tibKD42dQ9bdgnknlqXozRS3X0%3D">Nature Aging interview highlights APOE4 work</a>
            <p>Nature Aging featured the lab's APOE4 cholesterol homeostasis work.</p>
          </li>
          <li>
            <time>June 8, 2026</time>
            <a href="${relHref(route, "/posts/selina-received-newbury-center-fellowship/")}">Selina received Newbury Center fellowship!</a>
            <p>Congratulations to Selina Chen on receiving the fellowship.</p>
          </li>
          <li>
            <time>June 23, 2022</time>
            <a href="${relHref(route, "/posts/analysis-of-cholesterol-and-matrisome-pathways-in-glia-is-published-in-molecular-cell/")}">Our newest publication is in Cell!</a>
            <p>Read about cholesterol and matrisome pathways in human APOE4 glia.</p>
          </li>
        </ul>
        <a class="text-link" href="${relHref(route, "/ourteam/activity/")}">View all updates</a>
      </section>
    </aside>`;
}

function postCard(post, route, assetMap) {
  const title = decodeEntities(post.title.rendered);
  const date = new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const excerpt = stripTags(post.excerpt.rendered || post.content.rendered).slice(0, 240);
  const href = relHref(route, `/posts/${post.slug}/`);
  return `<article class="post-card"><time>${date}</time><h2><a href="${href}">${title}</a></h2><p>${excerpt}${excerpt.length >= 240 ? "..." : ""}</p></article>`;
}

function navMarkup(route) {
  return NAV.map(([label, target]) => {
    const active = target === "/" ? route === "/" : route.startsWith(target);
    return `<a class="${active ? "active" : ""}" href="${relHref(route, target)}">${label}</a>`;
  }).join("");
}

function pageClass(route) {
  if (route === "/") return "page-home";
  return `page-${route.split("/").filter(Boolean).join("-")}`;
}

function heroCopy(route, title) {
  const copy = {
    "/": [
      "Alzheimer's disease functional genomics",
      "Advancing Alzheimer's disease therapeutics through human genomics, iPSC models, CRISPRi screens, and multi-omics integrations.",
    ],
    "/research-programs/": [
      "Research Programs",
      "Human stem-cell systems, glial biology, computational genomics, and translational platforms for Alzheimer's disease discovery.",
    ],
    "/publications/": [
      "Publications",
      "Selected papers, preprints, protocols, and scientific commentaries from the TCW Lab.",
    ],
    "/ourteam/": [
      "People",
      "Wet lab, dry lab, trainees, and collaborators working across stem cell biology, neurogenetics, and computation.",
    ],
    "/ourteam/activity/": [
      "Lab Activity",
      "A separate home for TCW Lab celebrations, milestones, events, and team updates.",
    ],
    "/careers/": [
      "Join the Lab",
      "Opportunities for scientists, trainees, and collaborators interested in AD genetics, iPSC systems, and computation.",
    ],
    "/resources/": [
      "Resources",
      "Protocols, mutation resources, videos, and research context collected for the lab community.",
    ],
    "/resources/news/": [
      "Research News",
      "Coverage and background reading related to APOE, glia, lipids, and Alzheimer's disease mechanisms.",
    ],
    "/resources/research-comments/": [
      "Research Comments",
      "External commentary and discussion around work relevant to the TCW Lab.",
    ],
    "/contact/": [
      "Contact",
      "Reach the lab for science questions, collaborations, applications, and lab operations.",
    ],
    "/data/": [
      "Data Portal",
      "A future member-focused tab for datasets, research tools, and private lab resources.",
    ],
  };
  return copy[route] || ["TCW Lab", title];
}

function template({ route, title, body, sidebar = "", description = "" }) {
  const base = basePrefix(route);
  const layoutClass = sidebar ? "content-layout has-sidebar" : "content-layout";
  const [eyebrow, subtitle] = heroCopy(route, title);
  const home = route === "/";
  const heroTitle = home ? "TCW Laboratory" : title;
  const classes = `${pageClass(route)}${home ? " is-home" : ""}`;
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/png" href="${base}assets/icons/tcw-circle-favicon-20260713.png">
  <link rel="shortcut icon" type="image/png" href="${base}assets/icons/tcw-circle-favicon-20260713.png">
  <link rel="apple-touch-icon" href="${base}assets/icons/tcw-circle-touch-20260713.png">
  <title>${title} | TCW Lab</title>
  <meta name="description" content="${description || "TCW Laboratory static website"}">
  <link rel="stylesheet" href="${base}assets/css/styles.css">
  <script src="${base}assets/js/site.js" defer></script>
</head>
<body class="${classes}">
  <header class="site-header">
    <a class="brand" href="${relHref(route, "/")}" aria-label="TCW Lab home">
      <span class="brand-mark">TCW</span>
      <span class="brand-copy">
        <strong>Science is a team sport</strong>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu"><span></span><span></span><span></span><b>Menu</b></button>
    <nav class="nav-menu" id="nav-menu" aria-label="Primary navigation">${navMarkup(route)}</nav>
    <div class="nav-actions">
      <button class="music-toggle" type="button" data-music-toggle aria-pressed="false" aria-label="Allow soft background music" title="Allow music"><span></span></button>
      <button class="search-toggle" type="button" aria-expanded="false" aria-controls="site-search" aria-label="Search site"></button>
    </div>
  </header>
  <form class="site-search" id="site-search" role="search">
    <label>
      <span>Search site</span>
      <input type="search" id="site-search-input" autocomplete="off">
    </label>
    <div class="search-results" id="site-search-results"></div>
  </form>
  <main>
    <section class="hero">
      <canvas class="bio-canvas" aria-hidden="true"></canvas>
      <div class="hero-inner">
        <p class="hero-eyebrow">${eyebrow}</p>
        <h1>${heroTitle}</h1>
        <p class="hero-subtitle">${subtitle}</p>
        ${home ? `<div class="hero-metrics" aria-label="Research pillars">
          <span><strong>iPSC</strong> models</span>
          <span><strong>APOE</strong> genetics</span>
          <span><strong>Multi-omics</strong> discovery</span>
        </div>` : ""}
      </div>
    </section>
    <section class="wrapper">
      <div class="${layoutClass}">
        <article class="page-content">
          ${body}
        </article>
        ${sidebar}
      </div>
    </section>
  </main>
  <footer class="site-footer">
    <p>TCW Laboratory</p>
    <nav aria-label="Footer navigation">
      <a href="${relHref(route, "/contact/")}">Contact</a>
      <a href="${relHref(route, "/resources/")}">Resources</a>
      <a href="${relHref(route, "/member/")}">Member Portal</a>
    </nav>
  </footer>
</body>
</html>
`;
}

let SEARCH_INDEX = [];

async function writePage(route, html) {
  const file = outputPathForRoute(route);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
}

async function main() {
  const pages = await readJsonExport(PAGE_EXPORT, "pages.json", `${WP_BASE}/wp-json/wp/v2/pages?per_page=100&_embed=1`);
  const posts = await readJsonExport(POST_EXPORT, "posts.json", `${WP_BASE}/wp-json/wp/v2/posts?per_page=100&_embed=1`);

  const imageUrls = new Set();
  for (const page of pages) collectImageUrls(page.content?.rendered || "", imageUrls);
  for (const post of posts) {
    collectImageUrls(post.content?.rendered || "", imageUrls);
    collectImageUrls(post.excerpt?.rendered || "", imageUrls);
    const media = post._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
    if (media && isImageUrl(media)) imageUrls.add(normalizeUrl(media));
  }

  const assetMap = await downloadAssets(imageUrls);
  const pageBySlug = new Map(pages.map((page) => [page.slug, page]));

  SEARCH_INDEX = [
    ...PAGE_ROUTES.map((config) => {
      const page = pageBySlug.get(config.wpSlug);
      const title = config.title || decodeEntities(page?.title?.rendered || config.nav);
      const customSearchText = config.custom === "talent"
        ? "Careers join the TCW Lab postdoctoral fellow research associate internship wet lab dry lab application"
        : config.custom === "contact"
          ? "Contact TCW Lab email lab science lab business location inquiry"
          : "";
      return {
        title,
        route: config.route,
        text: customSearchText || compactText(page?.content?.rendered || ""),
      };
    }),
    { title: "Members", route: "/member/", text: "Member portal lab passcode research database wet lab dry lab GitHub code protocols" },
    ...posts.map((post) => ({
      title: decodeEntities(post.title.rendered),
      route: `/posts/${post.slug}/`,
      text: compactText(post.content?.rendered || ""),
    })),
  ];

  for (const config of PAGE_ROUTES) {
    const page = pageBySlug.get(config.wpSlug);
    if (!page) throw new Error(`Missing page ${config.wpSlug}`);

    let body;
    if (config.custom === "talent") body = customTalent();
    else if (config.custom === "contact") body = customContact();
    else if (config.custom === "resources") body = customResources();
    else body = cleanWpContent(page.content.rendered, config.route, assetMap);

    if (config.wpSlug === "activity") {
      body += `<section class="activity-feed"><h2>Lab Updates</h2>${posts.map((post) => postCard(post, config.route, assetMap)).join("")}</section>`;
    }
    if (config.wpSlug === "research-programs") {
      body += researchImageGallery(config.route);
    }

    const title = config.title || decodeEntities(page.title.rendered);
    const html = template({
      route: config.route,
      title,
      body,
      modified: page.modified?.split("T")[0],
      sidebar: sidebarFor(config.route),
      description: compactText(page.excerpt?.rendered || page.content.rendered, 155),
    });
    await writePage(config.route, html);
  }

  await writePage("/data/", template({
    route: "/data/",
    title: "Data Portal",
    body: dataPortalContent(),
    modified: "",
    description: "TCW Lab research data portal placeholder.",
  }));

  for (const post of posts) {
    const route = `/posts/${post.slug}/`;
    const title = decodeEntities(post.title.rendered);
    const body = `<p class="post-meta">${new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>${cleanWpContent(post.content.rendered, route, assetMap)}`;
    await writePage(route, template({
      route,
      title,
      body,
      modified: post.modified?.split("T")[0],
      description: compactText(post.excerpt?.rendered || post.content.rendered, 155),
    }));
  }

  await writeFile(path.join(projectRoot, "assets", "manifest.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: WP_BASE,
    pages: PAGE_ROUTES.length + 1,
    posts: posts.length,
    assets: assetMap.size,
  }, null, 2));
  await writeFile(path.join(projectRoot, "assets", "search-index.json"), JSON.stringify(SEARCH_INDEX, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
