# TCW Lab Static Website

Static GitHub Pages version of the TCW Lab website, generated from the current BU WordPress content.

## Preview

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Update From BU WordPress

```bash
node scripts/build-from-wp.mjs
```

The generator reads the current WordPress REST exports, localizes image assets into `assets/images`, and rewrites internal links for static hosting.

## Deploy To GitHub Pages

1. Create a new GitHub repository.
2. Push this folder to the repository.
3. In GitHub, go to `Settings -> Pages`.
4. Set source to `Deploy from a branch`, branch `main`, folder `/root`.
5. After buying a domain, add the custom domain in Pages settings. GitHub will create or use a `CNAME` file.

## Notes

- The old BU WordPress Gravity Forms cannot run on GitHub Pages. Talent and Contact pages now use email-based static forms.
- The Data Portal page is a placeholder for a future authenticated database tab.
- Member-only access requires a real auth layer; plain public GitHub Pages cannot restrict pages by lab membership.
