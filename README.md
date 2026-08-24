# TCW Lab Website

Static website for TCW Lab: <https://tcwlab.org/>

Repository: <https://github.com/perhapsstrawberries/tcw-lab-website>

This site is hosted from the `main` branch with GitHub Pages. Most edits are plain HTML, CSS, JavaScript, and image files.

## Quick Start

Work from the repository root:

```bash
cd /Users/wendybui/Documents/Claude/Projects/Lab/tcw-lab-website
```

Preview locally:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Where To Edit

Each public tab is a folder with its own `index.html`.

```text
tcw-lab-website/
|-- index.html                         # Homepage
|-- research-programs/index.html       # Research tab
|-- publications/index.html            # Publications tab
|-- ourteam/index.html                 # Our Team tab, current members, alumni
|-- ourteam/activity/index.html        # Lab Activity tab
|-- careers/index.html                 # Careers tab
|-- resources/index.html               # Resources tab
|-- resources/news/index.html          # News archive
|-- resources/research-comments/       # Research comments pages
|-- contact/index.html                 # Contact tab
|-- member/index.html                  # Static member page source
|-- data/index.html                    # Redirects old Data Portal URL to member/
|-- talent-aquisition/index.html       # Legacy typo URL, redirects to careers/
|-- assets/
|   |-- css/styles.css                 # Site styling
|   |-- js/site.js                     # Menu, search, animation, UI behavior
|   |-- images/                        # Website images
|   |-- images/alumni/                 # Alumni photos
|   |-- images/glial-cells/            # Research/gallery images
|   |-- images/projects/               # Project images
|   `-- icons/                         # Logo/favicon assets
|-- posts/                             # Individual news/activity posts
|-- scripts/build-from-wp.mjs          # Optional WordPress import/build script
|-- workers/tcw-member-gate.js         # Cloudflare Worker for member gate
|-- CNAME                              # Custom domain: tcwlab.org
`-- package.json                       # npm scripts
```

## Common Updates

Page text:

- Edit the matching `index.html` file.
- Example: alumni and current member cards are in `ourteam/index.html`.

Images:

- Add or replace files inside `assets/images/...`.
- Keep filenames simple, lowercase if possible, and avoid spaces.
- Update the image path in the relevant HTML file.

Styling:

- Edit `assets/css/styles.css`.

Animation or interactive behavior:

- Edit `assets/js/site.js`.

News/activity posts:

- Edit files under `posts/.../index.html`.
- Add links from `resources/news/index.html` or the relevant page if needed.

Redirect folders:

- `data/index.html` only redirects old links to `member/`.
- `talent-aquisition/index.html` only redirects old links to `careers/`.
- Keep these unless the old URLs are no longer needed.

## Commit And Push Changes

Always commit from the repository root.

1. Make sure you are on `main`:

```bash
git branch --show-current
```

2. Pull the latest changes before editing:

```bash
git pull --rebase origin main
```

3. Check what changed:

```bash
git status
```

4. Preview locally and confirm the pages look correct:

```bash
python3 -m http.server 8080
```

5. Stage the files you changed:

```bash
git add path/to/file
```

For example:

```bash
git add ourteam/index.html assets/images/alumni/new-photo.jpg
```

6. Commit with a short message:

```bash
git commit -m "Update alumni section"
```

7. Push to GitHub:

```bash
git push origin main
```

GitHub Pages will rebuild automatically after the push. Check the live site after a few minutes.

## Cache Busting

If you edit `assets/css/styles.css` or `assets/js/site.js`, browsers may keep an old cached copy.

To force the live site to load the new file, update the version number in HTML references such as:

```html
<link rel="stylesheet" href="assets/css/styles.css?v=20260824a">
<script src="assets/js/site.js?v=20260824a" defer></script>
```

Use a new value each time, for example `20260824b`, then commit and push the HTML files along with the CSS/JS change.

## Member Portal And Cloudflare Worker

The public website is deployed by GitHub Pages, but the live member portal route is handled by Cloudflare:

```text
tcwlab.org/member*
```

The Worker source is tracked here:

```text
workers/tcw-member-gate.js
```

Important notes:

- Member passcodes should live only in Cloudflare Worker secrets.
- Editing `member/index.html` changes the static source, but the live gated member page may still need the Worker deployed.
- If `workers/tcw-member-gate.js` changes, deploy it to the existing `tcw-member-gate` Worker from a machine/account with Cloudflare access.

## Optional WordPress Rebuild

The site originally came from BU WordPress content. The build script can regenerate pages from WordPress exports:

```bash
npm run build
```

Use this carefully because it can rewrite many files. For small website edits, direct HTML/CSS/JS edits are usually easier.

## Before Asking Someone Else To Review

Run:

```bash
git status
```

Make sure the changes are committed and pushed, then send the reviewer:

- The live URL: <https://tcwlab.org/>
- The page/tab changed
- What feedback you need
