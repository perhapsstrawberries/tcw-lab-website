const COOKIE_NAME = "tcw_member_auth";
const SESSION_SECONDS = 60 * 60 * 24 * 14;
const RAW_MEMBER_PAGE = "https://raw.githubusercontent.com/perhapsstrawberries/tcw-lab-website/main/member/index.html";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.searchParams.get("tcw_logout") === "1") {
      return clearSession(url);
    }

    if (request.method === "POST") {
      return handleLogin(request, env);
    }

    const session = await readSession(request, env);
    if (!session) {
      return html(loginPage(url));
    }

    const upstream = await fetch(RAW_MEMBER_PAGE, {
      headers: { "User-Agent": "tcw-member-gate" }
    });

    if (!upstream.ok) {
      return html(errorPage(), 502);
    }

    const page = await upstream.text();
    return html(injectMemberSession(page, session));
  }
};

async function handleLogin(request, env) {
  const form = await request.formData();
  const submitted = String(form.get("passcode") || "").trim();
  const url = new URL(request.url);
  const role = roleForPasscode(submitted, env);

  if (!role) {
    return html(loginPage(url, "That passcode is not right. Try again or contact the lab."), 401);
  }

  const token = await createToken(role, env);
  const headers = new Headers({
    "Location": "/member/",
    "Set-Cookie": `${COOKIE_NAME}=${token}; Path=/member; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`
  });

  return new Response(null, { status: 303, headers });
}

function roleForPasscode(passcode, env) {
  if (passcode && env.TCW_PASSCODE && passcode === env.TCW_PASSCODE) return "shared";
  if (passcode && env.WET_PASSCODE && passcode === env.WET_PASSCODE) return "wet";
  if (passcode && env.DRY_PASSCODE && passcode === env.DRY_PASSCODE) return "dry";
  return "";
}

function injectMemberSession(page, session) {
  const safeTrack = JSON.stringify(session.role);
  const script = `
<script>
  localStorage.setItem("tcw-member-session", JSON.stringify({
    method: "passcode",
    name: "",
    track: ${safeTrack},
    ts: Date.now()
  }));
  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-signout]");
    if (!button) return;
    event.preventDefault();
    localStorage.removeItem("tcw-member-session");
    window.location.href = "/member/?tcw_logout=1";
  }, true);
</script>`;

  return page.replace("</head>", `${script}</head>`);
}

async function createToken(role, env) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${role}.${expires}`;
  const signature = await hmac(payload, env.COOKIE_SECRET);
  return `${payload}.${signature}`;
}

async function readSession(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;

  const parts = match[1].split(".");
  if (parts.length !== 3) return null;

  const [role, expires, signature] = parts;
  if (!["wet", "dry", "shared"].includes(role)) return null;
  if (Number(expires) < Math.floor(Date.now() / 1000)) return null;

  const expected = await hmac(`${role}.${expires}`, env.COOKIE_SECRET);
  if (signature !== expected) return null;

  return { role };
}

async function hmac(value, secret) {
  if (!secret) throw new Error("COOKIE_SECRET is required");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clearSession(url) {
  const headers = new Headers({
    "Location": `${url.origin}/member/`,
    "Set-Cookie": `${COOKIE_NAME}=; Path=/member; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
  });

  return new Response(null, { status: 303, headers });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function loginPage(url, error = "") {
  const safeError = escapeHtml(error);
  const action = `${url.pathname}${url.search}`;

  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/png" href="/assets/icons/tcw-circle-favicon-20260714.png">
  <link rel="shortcut icon" type="image/png" href="/assets/icons/tcw-circle-favicon-20260714.png">
  <link rel="apple-touch-icon" href="/assets/icons/tcw-circle-touch-20260714.png">
  <link rel="stylesheet" href="/assets/css/styles.css">
  <script src="/assets/js/site.js" defer></script>
  <title>Member Access | TCW Lab</title>
  <style>
    body.page-member-gate {
      min-height: 100vh;
      overflow-x: hidden;
    }
    .gate-hero {
      position: relative;
      min-height: calc(100vh - 96px);
      display: grid;
      place-items: center;
      overflow: hidden;
      isolation: isolate;
      padding: clamp(30px, 6vw, 72px) 24px;
    }
    .gate-hero::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 0;
      background:
        radial-gradient(circle at 26% 20%, rgba(162, 248, 246, 0.38), transparent 28%),
        radial-gradient(circle at 76% 24%, rgba(216, 144, 255, 0.15), transparent 24%),
        radial-gradient(circle at 64% 78%, rgba(255, 214, 61, 0.12), transparent 26%);
      pointer-events: none;
    }
    .gate-hero .bio-canvas {
      inset: -8% -6%;
      width: 112%;
      height: 116%;
      opacity: 0.9;
      -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 12%, #000 82%, transparent 100%);
      mask-image: linear-gradient(to bottom, transparent 0%, #000 12%, #000 82%, transparent 100%);
    }
    .gate-grid {
      position: relative;
      z-index: 2;
      width: min(100%, 1080px);
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 480px);
      gap: clamp(30px, 6vw, 78px);
      align-items: center;
    }
    .gate-copy .hero-eyebrow {
      margin-bottom: 14px;
    }
    .gate-copy h1 {
      max-width: 560px;
      margin: 0;
      font-family: "DM Serif Display", Georgia, serif;
      font-size: clamp(48px, 7vw, 96px);
      line-height: 0.94;
      letter-spacing: 0;
      color: var(--ink);
    }
    .gate-copy p {
      max-width: 520px;
      margin: 24px 0 0;
      color: var(--muted);
      font-size: clamp(17px, 2vw, 21px);
      line-height: 1.55;
    }
    .gate-card {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 255, 255, 0.9);
      box-shadow: var(--shadow);
      padding: clamp(24px, 3.2vw, 38px);
      backdrop-filter: blur(16px);
    }
    .gate-card h2 {
      margin: 0 0 6px;
      font-family: "DM Serif Display", Georgia, serif;
      font-size: clamp(28px, 3.2vw, 36px);
      line-height: 1.08;
      color: var(--ink);
    }
    .gate-card p {
      margin: 0 0 24px;
      color: var(--muted);
      font-size: 15.5px;
      line-height: 1.5;
    }
    .gate-card label {
      display: grid;
      gap: 8px;
      color: var(--ink);
      font-weight: 800;
    }
    .gate-field {
      position: relative;
    }
    .gate-field input {
      width: 100%;
      min-height: 64px;
      border: 2px solid var(--line);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.86);
      color: var(--ink);
      font: inherit;
      font-size: 19px;
      padding: 16px 58px 16px 18px;
      outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease;
    }
    .gate-field input:focus {
      border-color: var(--teal-deep);
      box-shadow: 0 0 0 4px rgba(162, 248, 246, 0.42);
    }
    .gate-field button {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      min-width: 42px;
      min-height: 42px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface-strong);
      color: var(--ink);
      font-weight: 800;
      cursor: pointer;
    }
    .gate-error {
      min-height: 28px;
      margin: 14px 0 0;
      color: #c83f36;
      font-weight: 800;
      line-height: 1.35;
    }
    .gate-submit {
      width: 100%;
      min-height: 62px;
      margin-top: 18px;
      border: 0;
      border-radius: 999px;
      background: linear-gradient(135deg, var(--teal), var(--blue));
      color: #061112;
      font: inherit;
      font-size: 18px;
      font-weight: 900;
      cursor: pointer;
      box-shadow: 0 14px 32px rgba(0, 142, 145, 0.16);
    }
    .gate-note {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
    }
    .gate-note a {
      color: var(--teal-deep);
      font-weight: 800;
    }
    @media (max-width: 840px) {
      .gate-grid {
        grid-template-columns: 1fr;
      }
      .gate-copy h1 {
        max-width: 420px;
      }
    }
  </style>
</head>
<body class="page-member page-member-gate">
  <header class="site-header">
    <a class="brand" href="/" aria-label="TCW Lab home">
      <span class="brand-mark">TCW</span>
      <span class="brand-copy">
        <strong>Science is a team sport</strong>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu"><span></span><span></span><span></span><b>Menu</b></button>
    <nav class="nav-menu" id="nav-menu" aria-label="Primary navigation">
      <a href="/research-programs/">Research</a>
      <a href="/publications/">Publications</a>
      <a href="/ourteam/">Our Team</a>
      <a href="/ourteam/activity/">Lab Activity</a>
      <a href="/careers/">Careers</a>
      <a href="/resources/">Resources</a>
      <a href="/contact/">Contact</a>
      <a class="active" href="/member/">Members</a>
    </nav>
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
  <main class="gate-hero">
    <canvas class="bio-canvas" aria-hidden="true"></canvas>
    <div class="gate-grid">
      <section class="gate-copy" aria-labelledby="member-gate-title">
        <p class="hero-eyebrow">Members only</p>
        <h1 id="member-gate-title">Lab Member Portal</h1>
        <p>One door to member-only resources for current TCW Lab members.</p>
      </section>
      <form class="gate-card" method="post" action="${escapeAttribute(action)}">
        <h2>Member access</h2>
        <p>Enter the current lab member passcode.</p>
        <label for="passcode">
          Shared lab passcode
          <span class="gate-field">
            <input id="passcode" name="passcode" type="password" autocomplete="current-password" autofocus required>
            <button type="button" data-show-passcode aria-label="Show passcode" aria-pressed="false">Show</button>
          </span>
        </label>
        <div class="gate-error" role="alert">${safeError}</div>
        <button class="gate-submit" type="submit">Unlock member area</button>
        <div class="gate-note">Need access or lost the passcode? Email the lab through the <a href="/contact/">contact page</a>.</div>
      </form>
    </div>
  </main>
  <script>
    document.querySelector("[data-show-passcode]").addEventListener("click", function () {
      var input = document.querySelector("#passcode");
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      this.textContent = show ? "Hide" : "Show";
      this.setAttribute("aria-pressed", String(show));
      this.setAttribute("aria-label", show ? "Hide passcode" : "Show passcode");
      input.focus();
    });
  </script>
</body>
</html>`;
}

function errorPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Member Access | TCW Lab</title>
</head>
<body>
  <h1>Member page unavailable</h1>
  <p>Please try again in a few minutes.</p>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
