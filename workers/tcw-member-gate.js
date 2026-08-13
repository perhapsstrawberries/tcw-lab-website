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
  <link rel="icon" type="image/png" sizes="512x512" href="/assets/icons/tcw-logo-20260731p.png?v=20260731p">
  <link rel="stylesheet" href="/assets/css/styles.css?v=20260813b">
  <script src="/assets/js/site.js?v=20260813b" defer></script>
  <title>Member Access | TCW Lab</title>
  <style>
    body.page-member-gate {
      min-height: 100vh;
      overflow-x: hidden;
      background: var(--bg);
    }
    .page-member-gate .site-header {
      position: fixed;
      top: 14px;
      left: 50%;
      z-index: 80;
      width: min(calc(100% - 28px), 1320px);
      margin: 0;
      transform: translateX(-50%);
    }
    .login-hero {
      position: relative;
      min-height: 100vh;
      display: grid;
      place-items: center;
      overflow: hidden;
      padding: 132px 24px 80px;
    }
    .login-hero::before {
      content: "";
      position: absolute;
      inset: -20% 30% auto -10%;
      height: 70%;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(162, 248, 246, 0.26), transparent 66%);
      filter: blur(22px);
      pointer-events: none;
    }
    .login-grid {
      position: relative;
      z-index: 1;
      width: min(100%, 980px);
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: clamp(28px, 5vw, 64px);
      align-items: center;
    }
    .login-intro .hero-eyebrow { margin-bottom: 14px; }
    .login-intro h1 {
      margin: 0;
      font-family: "DM Serif Display", Georgia, serif;
      font-size: clamp(40px, 6vw, 76px);
      font-weight: 700;
      line-height: 0.96;
    }
    .login-intro p.lede {
      max-width: 440px;
      margin: 22px 0 0;
      color: var(--muted);
      font-size: clamp(16px, 1.7vw, 19px);
      line-height: 1.6;
    }
    .login-intro .intro-list {
      margin: 28px 0 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 12px;
    }
    .login-intro .intro-list li {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.45;
      margin: 0;
    }
    .login-intro .intro-list .dot {
      flex: none;
      width: 22px;
      height: 22px;
      margin-top: 1px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--teal), var(--blue));
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.5);
      display: grid;
      place-items: center;
      color: #061112;
      font-weight: 900;
      font-size: 12px;
    }
    .login-card {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface-strong);
      box-shadow: var(--shadow);
      padding: clamp(22px, 3vw, 34px);
      backdrop-filter: blur(16px);
    }
    .login-card h2 {
      margin: 0 0 4px;
      font-size: clamp(24px, 2.6vw, 30px);
    }
    .login-card .card-sub {
      margin: 0 0 20px;
      color: var(--muted);
      font-size: 14.5px;
    }
    .auth-panel {
      display: grid;
      gap: 14px;
    }
    .field { display: grid; gap: 7px; }
    .field label {
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.02em;
    }
    .field input {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface-strong);
      color: var(--ink);
      font: inherit;
      padding: 12px 14px;
    }
    .field input:focus-visible {
      outline: 2px solid var(--teal-deep);
      outline-offset: 1px;
    }
    .password-field {
      position: relative;
      display: flex;
      align-items: center;
    }
    .password-field input {
      padding-right: 74px;
    }
    .password-toggle {
      appearance: none;
      position: absolute;
      right: 9px;
      min-width: 52px;
      min-height: 32px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--teal-soft);
      color: var(--teal-deep);
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      font-weight: 800;
    }
    .password-toggle:focus-visible {
      outline: 2px solid var(--teal-deep);
      outline-offset: 2px;
    }
    .submit-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 50px;
      border: 0;
      border-radius: 999px;
      background: linear-gradient(135deg, var(--teal), var(--blue));
      color: #061112;
      font-weight: 800;
      font-size: 15px;
      cursor: pointer;
      transition: filter 160ms ease, transform 160ms ease;
    }
    .submit-btn:hover { filter: saturate(1.15) brightness(1.03); }
    .submit-btn:active { transform: translateY(1px); }
    .auth-error {
      margin: 0;
      min-height: 18px;
      color: #c2453f;
      font-size: 13px;
      font-weight: 700;
    }
    html[data-theme="dark"] .auth-error { color: #ff9a94; }
    .auth-note {
      margin: 2px 0 0;
      color: var(--muted);
      font-size: 12.5px;
      line-height: 1.5;
    }
    .login-foot {
      margin: 20px 0 0;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 12.5px;
      line-height: 1.55;
    }
    .login-foot a { font-weight: 700; }
    @media (max-width: 840px) {
      .login-grid {
        grid-template-columns: 1fr;
      }
      .login-intro h1 {
        max-width: 420px;
      }
    }
    @media (max-width: 620px) {
      .page-member-gate .site-header {
        top: 9px;
        width: min(calc(100% - 18px), 1240px);
      }
      .login-hero {
        padding: 116px 18px 64px;
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
  <main>
  <section class="login-hero">
    <div class="glial-field" aria-hidden="true"><span class="glial-cell glial-cell-1"></span><span class="glial-cell glial-cell-2"></span><span class="glial-cell glial-cell-3"></span><span class="glial-cell glial-cell-4"></span><span class="glial-cell glial-cell-5"></span><span class="glial-cell glial-cell-6"></span><span class="glial-cell glial-cell-7"></span><span class="glial-cell glial-cell-8"></span><span class="glial-cell glial-cell-9"></span><span class="glial-cell glial-cell-10"></span><span class="glial-cell glial-cell-11"></span><span class="glial-cell glial-cell-12"></span><span class="glial-cell glial-cell-13"></span><span class="glial-cell glial-cell-14"></span><span class="glial-cell glial-cell-15"></span><span class="glial-cell glial-cell-16"></span><span class="glial-cell glial-cell-17"></span><span class="glial-cell glial-cell-18"></span><span class="glial-cell glial-cell-19"></span><span class="glial-cell glial-cell-20"></span></div>
    <div class="login-grid">
      <section class="login-intro" aria-labelledby="member-gate-title">
        <p class="hero-eyebrow">Members Only</p>
        <h1 id="member-gate-title">Lab Member Portal</h1>
        <p class="lede">One door to the member-only resources the TCW Lab runs on: database access, protocols, code, and shared onboarding materials.</p>
        <ul class="intro-list">
          <li><span class="dot">+</span> Use the current passcode shared with lab members.</li>
          <li><span class="dot">+</span> Access shared lab resources after unlocking.</li>
          <li><span class="dot">+</span> Keep member materials private and current.</li>
        </ul>
      </section>
      <div class="login-card">
        <h2>Member access</h2>
        <p class="card-sub">Enter the current lab member passcode.</p>
        <form class="auth-panel active" method="post" action="${escapeAttribute(action)}" autocomplete="off">
          <div class="field">
            <label for="passcode">Shared lab passcode</label>
            <div class="password-field">
              <input id="passcode" name="passcode" type="password" placeholder="Enter member passcode" autocomplete="current-password" autofocus required>
              <button type="button" class="password-toggle" data-password-toggle aria-controls="passcode" aria-pressed="false" aria-label="Show passcode">Show</button>
            </div>
          </div>
          <p class="auth-error" role="alert" aria-live="polite">${safeError}</p>
          <button class="submit-btn" type="submit">Unlock member area</button>
          <p class="auth-note">Rotate the passcode regularly and share only with current members.</p>
        </form>
        <p class="login-foot">Need access or lost the passcode? Email the lab at <a href="/contact/">our contact page</a>.</p>
      </div>
    </div>
  </section>
  </main>
  <script>
    document.querySelector("[data-password-toggle]").addEventListener("click", function () {
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
