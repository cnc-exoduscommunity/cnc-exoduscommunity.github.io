# Exodus Community

The community site for the Command & Conquer: Renegade **Exodus Co-Op** mod,
built with [Jekyll](https://jekyllrb.com/) and hosted on GitHub Pages at
<https://cnc-exoduscommunity.github.io>.

Every push to `main` builds and deploys the site automatically (see
`.github/workflows/deploy.yml`).

## Running it locally

### Requirements

- [Ruby](https://jekyllrb.com/docs/installation/) 3.3 (what the deploy workflow uses, so the safest to match).
  - Windows: install **Ruby+Devkit 3.3** from <https://rubyinstaller.org/> and let it run `ridk install` at the end.
  - Linux / macOS: use your package manager or a version manager such as `rbenv`.
- Bundler: `gem install bundler`

### With the test script

- **Windows**: double-click `serve.bat` in the `tools` folder, or open a command prompt in `tools` and run `serve`.
- **Linux / macOS**: from the `tools` folder run `./serve.sh`.

The script installs the gems if needed, stops any old server still on port 4000, then builds and serves the site.
Open <http://localhost:4000>. Pages rebuild on save and the browser reloads by itself.

| Option  | What it does |
| :------ | :----------- |
| *(none)* / `build` | Builds and serves, reusing the previous build. |
| `clean` | Deletes the previous build first. Use it if a page looks stale, or after changing `_config.yml`. |

Set `JEKYLL_HOST=0.0.0.0` before running to open the site from other devices on your network,
or `JEKYLL_PORT` to use a port other than 4000.

### Manually

From the root of the repository:

```bash
bundle install
bundle exec jekyll serve --livereload
```

Then open <http://localhost:4000>.

> Changes to `_config.yml` are not picked up while the server runs - stop it (Ctrl+C) and start it again.

## Project structure

| Path | What it is |
| :--- | :--------- |
| `_config.yml` | Site settings (title, URL, plugins). |
| `_layouts/` | Page templates. `default.html` wraps every page. |
| `assets/css/` | Stylesheets. |
| `index.md` | The home page. |
| `404.html` | Page shown for missing URLs. |
| `tools/` | Local preview scripts (not part of the built site). |
| `.github/workflows/deploy.yml` | Builds and publishes the site on every push to `main`. |

To add a page, create a `.md` file with a front matter block at the top:

```markdown
---
title: My page
---

# My page

Content here.
```

`my-page.md` is served at `/my-page.html`; add `permalink: /my-page/` to the front matter for a cleaner URL.

## Deployment

One-time setup on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

After that, push to `main` and the **Deploy to GitHub Pages** workflow builds the site and publishes it.
It can also be run by hand from the **Actions** tab.
