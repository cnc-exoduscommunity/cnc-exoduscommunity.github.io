# Exodus Community

The community site for the Command & Conquer: Renegade **Exodus Co-Op** server,
built with [Jekyll](https://jekyllrb.com/) and hosted on GitHub Pages at
<https://cnc-exoduscommunity.github.io>.

> **Renz0r.net has merged with Exodus:** more people on the same great server.

| Server | |
| :-- | :-- |
| Location | Hosted in Europe |
| Address | `85.215.107.108:4852` |
| Direct join | `renegade://85.215.107.108:4852` (opens the game on the server, if your Renegade install handles `renegade://` links) |

[![Discord](https://img.shields.io/badge/Discord-Join%20our%20server-5865F2?logo=discord&logoColor=white)](https://discord.gg/vt4hURUG5a)
[![Steam](https://img.shields.io/badge/Steam-Group-1b2838?logo=steam&logoColor=white)](https://steamcommunity.com/groups/Exoduscommunity)

Not sure how to connect? Have a look at [CnCNet](https://cncnet.org/renegade), [W3D Hub](https://w3dhub.com/) or [Tiberian Technologies](https://www.tiberiantechnologies.org/).

The [website](https://cnc-exoduscommunity.github.io) also shows whether the server is online, the current map, who's playing and the time left, live from [CnCNet](https://cncnet.org/renegade).

## Map rotation

The maps the server cycles through, in order. In game, type `!rotation` to see the list; the map currently being played is shown in [brackets].

| Map | Campaign name / Note |
| :-- | :------------------- |
| ttm1 | Custom map |
| City | Original multiplayer map, changed to allow co-op |
| Complex | Original multiplayer map, changed to allow co-op |
| Walls | Original multiplayer map, changed to allow co-op |
| Mesa | Original multiplayer map, changed to allow co-op |
| Canyon | Original multiplayer map, changed to allow co-op |
| Under | Original multiplayer map, changed to allow co-op |
| Coop_B01_B6 | Custom co-op map |
| Coop_B02_B10 | Custom co-op map |
| Coop_Tropics_B1 | Custom co-op map |
| Volcano | Original multiplayer map, changed to allow co-op |
| Islands | Original multiplayer map, changed to allow co-op |
| Hourglass | Original multiplayer map, changed to allow co-op |
| Skirmish00 | Original skirmish map |
| [M00_Tutorial](assets/images/maps/M00_Tutorial.webp) | Tutorial - campaign training level |
| [M13](assets/images/maps/M13.webp) | Mission 1: The Scorpion Hunters - the first mission's file is numbered 13 |
| [M01](assets/images/maps/M01.webp) | Mission 2: Rescue and Retribution |
| [M02](assets/images/maps/M02.webp) | Mission 3: Armored Assault |
| [M03](assets/images/maps/M03.webp) | Mission 4: The Plot Erupts |
| [M04](assets/images/maps/M04.webp) | Mission 5: Stowaway |
| [M05](assets/images/maps/M05.webp) | Mission 6: Deadly Reunion |
| [M06](assets/images/maps/M06.webp) | Mission 7: The Grip of the Black Hand |
| [M07](assets/images/maps/M07.webp) | Mission 8: Obelisk of Oppression |
| [M08](assets/images/maps/M08.webp) | Mission 9: Evolution of Evil |
| [M09](assets/images/maps/M09.webp) | Mission 10: All Brains, No Brawn |
| [M10](assets/images/maps/M10.webp) | Mission 11: Tomorrow's Technology Today |
| [M11](assets/images/maps/M11.webp) | Mission 12: Stomping on Holy Ground |

Linked map names open an overhead map. Map images: credit to [vgmaps.de](https://vgmaps.de/maps/pc/command-and-conquer-renegade)

## IRC

| Setting | Value |
| :-- | :-- |
| Server | `85.215.107.108` |
| Port | `6667` (no SSL) |
| Channel | `#exodus-home` |

All Exodus servers can be found at `85.215.107.108` on their usual ports, so IRC is `85.215.107.108:6667`.
Don't use `irc.exoduscommunity.com`: the exoduscommunity.com domain has lapsed, so that name no longer reaches the server.

`#exodus-home` only lets in **registered nicknames**, so you have to register yours once ([step 4](#irc-step-4)).

### Free clients

| System | Client |
| :----- | :----- |
| <img src="assets/images/os/windows.svg" width="20" height="20" alt="Windows" title="Windows"> | [HexChat](https://hexchat.github.io/), [AdiIRC](https://adiirc.com/) or [Halloy](https://github.com/squidowl/halloy) |
| <img src="assets/images/os/macos.svg" width="20" height="20" alt="macOS" title="macOS"> | [LimeChat](https://github.com/psychs/limechat) or [Halloy](https://github.com/squidowl/halloy) |
| <img src="assets/images/os/linux.svg" width="20" height="20" alt="Linux" title="Linux"> | [HexChat](https://hexchat.github.io/) or [Halloy](https://github.com/squidowl/halloy) (both usually in your package manager), or [WeeChat](https://weechat.org/) in a terminal |

While searching for IRC software, mIRC may appear: this is paid software with a free trial.

### How to connect

1. <span id="irc-step-1" class="step-anchor">**Add the server.**</span> In your client's server list, add a new network with server `85.215.107.108`, port `6667`, and SSL/TLS turned **off**. In HexChat, the server is written as `85.215.107.108/6667`; leave "Use SSL" unticked.
2. <span id="irc-step-2" class="step-anchor">**Pick a nickname.**</span> Using your in-game name makes you easy to recognise.
3. <span id="irc-step-3" class="step-anchor">**Connect.**</span> If you try to join the channel now you will get *"unable to join channel (not using registered nickname)"*, which is expected.
4. <span id="irc-step-4" class="step-anchor">**Register your nickname.**</span> Because of bot attacks, you must stay connected for **30 minutes** first. Then type:

   ```
   /msg NickServ REGISTER yourpassword youremail@example.com
   ```

   If you get a confirmation e-mail, follow it.
5. <span id="irc-step-5" class="step-anchor">**Join the channel:**</span>

   ```
   /join #exodus-home
   ```

From then on, log in each time you connect with `/msg NickServ IDENTIFY yourpassword`, or put the password in your client's *NickServ password* (or *SASL*) field so it happens automatically.

---

# Working on the site

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
Open <http://localhost:4000>.

- **Saving any file** (pages, layouts, `_data/`, CSS, images) rebuilds the whole site and the browser reloads by itself.
  The site is small, so a full rebuild takes about a second; Jekyll's cache (`.jekyll-cache`) keeps Markdown and styles that did not change.
- **Changing `_config.yml`** restarts the server by itself (`tools/serve.rb` watches it), because Jekyll only reads that file when it starts.

| Option  | What it does |
| :------ | :----------- |
| *(none)* / `build` | Builds and serves the site. |
| `clean` | Deletes the previous build and cache first. Only needed if something still looks wrong. |

Set `JEKYLL_HOST=0.0.0.0` before running to open the site from other devices on your network,
or `JEKYLL_PORT` to use a port other than 4000.

### Manually

From the root of the repository:

```bash
bundle install
bundle exec jekyll serve --livereload
```

Then open <http://localhost:4000>.

> Run this way, changes to `_config.yml` are not picked up while the server runs - stop it (Ctrl+C) and start it again. The test script does that for you.

## Project structure

| Path | What it is |
| :--- | :--------- |
| `_config.yml` | Site settings: title, URL, header logo, Discord and Steam links, server address, live status source and the "Not sure how to connect?" links. |
| `index.html` | The home page: Message Of The Day, Index, Map rotation and IRC. |
| `_data/maps.yml` | The map rotation table. |
| `_data/credits.yml` | Image credits, used by `image_credit:` in `_data/maps.yml`. |
| `_includes/irc.md` | The IRC section (Markdown). |
| `_layouts/default.html` | The page template: header (logo, Join Server, Discord, Steam, theme toggle), footer, theme picker. |
| `_plugins/last_commit.rb` | Reads the last git commit (hash, date, branch) for the footer's "Site Revision" line. |
| `assets/css/style.css` | All styling. The colours of both themes are variables at the top. |
| `assets/js/site.js` | Theme toggle, collapsible sections, the header that follows the page, the map preview (previous/next, arrow keys, zoom and drag) and the live server status. |
| `assets/images/maps/` | Map previews, named after the map (`M01.webp`). |
| `assets/images/rg-logo.png` | Header logo. If it is missing, or `logo:` is removed from `_config.yml`, the header shows the site title as text. |
| `assets/images/radar.svg`, `circuit.svg` | Background art (radar dial and circuit lines), drawn for this site. |
| `assets/images/os/` | Windows, macOS and Linux icons from [Bootstrap Icons](https://icons.getbootstrap.com/) (MIT). |
| `assets/fonts/` | The Oswald font used for titles and buttons ([SIL Open Font License](assets/fonts/OFL.txt)), hosted with the site. |
| `_includes/discord-icon.svg`, `steam-icon.svg` | The Discord and Steam logos used on the buttons ([Simple Icons](https://simpleicons.org/), CC0). |
| `_includes/image-icon.svg` | The small picture icon next to map names that have a preview. |
| `_includes/os-icon.html` | Shows an OS icon: `{% include os-icon.html os="windows" label="Windows" %}`. |
| `404.html` | Page shown for missing URLs. |
| `tools/` | Local preview scripts (not part of the built site). `serve.bat` / `serve.sh` start `serve.rb`, which restarts Jekyll when `_config.yml` changes. |
| `.github/workflows/deploy.yml` | Builds and publishes the site on every push to `main`. |

## Editing the site

### Server address, links and the Message Of The Day

Everything here lives in `_config.yml`:

| Setting | What it changes |
| :------ | :-------------- |
| `server.address` | The address shown on the page, and the one the live status looks for. |
| `server.join_url` | The **Join Server** buttons, in the header and the live status box (`renegade://<address>`). |
| `server.location` | "Hosted in ..." |
| `server.status_url` | Where the live status comes from (CnCNet's public server list). Remove the line to hide the live status box (the header keeps its Join Server button). |
| `discord_url`, `steam_url` | The Discord and Steam buttons in the header. Remove one to hide its button. |
| `connect_help` | The "Not sure how to connect?" links. Add or remove `- name:` / `url:` pairs. |

The Message Of The Day text itself (the Renz0r.net line) is in `index.html`, in the `motd-text` paragraph.

### Adding, removing or reordering a map

Edit `_data/maps.yml`. Each map is two or three lines, in the order the server plays them:

```yaml
- name: M05                              # the map's file name, exactly as !rotation shows it
  description: "Mission 6: Deadly Reunion" # campaign name and/or a note
  image_credit: vgmaps                   # optional: who made the preview image (see below)
```

Put the description in quotes if it contains a colon (`:`). The README's own map table is written by hand, so update it too.

### Adding a map preview image

1. Name the image exactly like the map's `name` in `_data/maps.yml`, keeping the same capitals: `M05.webp`, `Coop_Tropics_B1.png`.
   `.webp`, `.png`, `.jpg` and `.jpeg` all work; `.webp` keeps the files small.
2. Put it in `assets/images/maps/`.
3. That's it: the map's row in the table gets the picture icon, and clicking the row opens the preview. Any size or shape works; the preview box fits the largest image.
4. If someone else made the image, credit them: add `image_credit: <key>` to the map in `_data/maps.yml`, using a key from `_data/credits.yml`.
   To add a new source there:

   ```yaml
   vgmaps:                       # the key used by image_credit
     name: vgmaps.de             # shown as "Credit to vgmaps.de"
     url: https://vgmaps.de/maps/pc/command-and-conquer-renegade
   ```

5. In this README, turn the map's name into a link to the image, like the others: `[M05](assets/images/maps/M05.webp)`.

Images downloaded from vgmaps.de come with long names such as
`command-and-conquer-renegade-mission-06-deadly-reunion-in-game-map-pc-map.webp`; rename them to the map name first.
The campaign file numbers are one behind the mission numbers: Mission 1 is `M13`, Mission 2 is `M01`, ..., Mission 12 is `M11`,
and the tutorial is `M00_Tutorial`.

### The map preview

Opened by clicking a map's row. ❮ ❯ or the ← → keys step through every map that has an image;
the mouse wheel, pinching or + / − zoom, dragging moves the map, double-click zooms in or out, and `0` or Reset goes back to 100%.
The zoom carries over from map to map. When a map is the one being played, it shows the same **Now playing** badge as the table.

### Live server status

The **Message Of The Day** box shows whether the server is online, the current map (with its mission name and preview),
players, time left and who's playing, with **Join Server** next to the status. The visitor's browser reads it from CnCNet's
public server list (`server.status_url` in `_config.yml`) when the page opens and then every minute, and the map being played
gets a **Now playing** badge in the rotation table.

CnCNet's own list only updates every so often, so the page says when it last checked rather than offering a refresh button.
That address isn't documented by CnCNet, so it could change: if the live box ever shows "Couldn't reach the server list",
open <https://cncnet.org/renegade> and check where its server list comes from now.

### Adding a section to the home page

1. In `index.html`, copy one of the `<details class="panel" id="...">` blocks (Map rotation or IRC) and give it a new `id` and title.
   Add `open` to `<details ...>` to have it start expanded.
2. Add it to the Index box (the `toc-menu` list in `index.html`): copy an `<li>`, update the number, the `href="#your-id"`, the title and the one-line description.
3. Add it to `sections:` at the top of `index.html` to give it a quick link in the header that follows the page:

   ```yaml
   sections:
     - title: Map rotation
       id: map-rotation
     - title: Your section
       id: your-id
   ```

To write the section in Markdown, put it in `_includes/your-section.md` and render it the way the IRC section does
(`{% capture %}{% include ... %}{% endcapture %}` and `| markdownify`).
To link to a specific step or paragraph, give it an id with `<span id="...">...</span>` and link to `#...` - the IRC steps (`#irc-step-4`) work this way.

### Themes

The site is dark by default, styled after Renegade's menus and loading screens (red and black, yellow titles, orange-outlined buttons),
with a light theme behind the sun/moon button in the header. The choice is remembered in the browser.
Adding `?theme=light` or `?theme=dark` to a URL sets (and remembers) the theme too,
for example <https://cnc-exoduscommunity.github.io/?theme=light>.
To change colours, edit the variables at the top of `assets/css/style.css` (one block per theme).

### Footer revision line

"Site Revision" in the footer fills itself in from the last git commit when the site is built - nothing to update by hand.

### Adding a page

Create a `.md` file with a front matter block at the top:

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

It has to be **GitHub Actions**, not "Deploy from a branch": the site uses Jekyll 4 and its own plugin (`_plugins/last_commit.rb`,
for the footer's revision line), and GitHub's branch builds support neither. The workflow that does the build is
`.github/workflows/deploy.yml`.

After that, push to `main` and the **Deploy to GitHub Pages** workflow builds the site and publishes it.
It can also be run by hand from the **Actions** tab.
