# TODO

## Map marking tool

A tool to mark things on the map images, based on how the Gears DB website does
it (`F:\Gears Website\New`):

- [ ] Mark **starting positions** (GDI / Nod spawns) on a map image
- [ ] Mark **objectives** (numbered, matching the objectives list) on the map
- [ ] Save the marks as data (e.g. `_data/map_marks.yml`: map, kind, x/y as a
      percentage of the image, label) so they scale with the image
- [ ] Show the marks as an overlay in the map preview, with a way to hide them
- [ ] A simple editor page (local only) to click on the map and place / move
      marks, then copy the resulting data into the repo

## Gallery tagging tool

A tool to go through the gallery photos and say which map each one is from:

- [ ] Show a gallery photo and pick its map from the rotation list (or "none")
- [ ] Save the links as data (e.g. `_data/gallery.yml`: photo file name -> map
      name, optional caption) so nothing has to be renamed
- [ ] Gallery: show the map name on each photo and filter the gallery by map
- [ ] Map preview: a "Photos" link or strip with that map's gallery photos

## Player list from IRC (dropped)

> **Decision (01-11-2026): not doing this.** Deth: asking the bots on a
> schedule would be too spammy, even every 10 minutes. The Nod player count
> is wrong because the server runs an old version of BRenBot; updating BRenBot
> will fix it. Until then the site relies on CnCNet (direct check as backup)
> and its Nod map note. The built version is kept on the `irc-player-list`
> branch, unused.

Getting the real player list on Nod maps, where the server reports 0 players.
Nothing here is built yet.

## Why

On Nod maps the server reports **0 players** to everyone who asks (the in-game
list, W3D Hub, CnCNet, and our direct check on query port 23506), unless at
least one player is on GDI. Even the server's own bot, Mission-Coop
(BRenBot 1.53), can't see them, while 6 people were playing:

```
<Mission-Coop> There are no players ingame at this time.
<Mission-Coop> Gameinfo: (WOL) Map: C&C_Islands.mix GDI: 0/36 players  0 points Nod: 0/36 players  0 points 1.34.20 mins left SFPS: 59
```

So the problem is in the server or its scripts, not in the server lists -
worth reporting to the server admin; fixing it there fixes everything.

**ExaBot's `!pl` is always right**, for example:

```
<ExaBot> C&C_Islands.mix 6 players
<ExaBot> Jesus Score: 0 Kills: 0 Deaths: 0 Credits: 2480
<ExaBot> Melody Score: 362 Kills: 0 Deaths: 0 Credits: 2842
```

ExaBot does **not** answer private messages, and it sometimes skips a request
(ask again after ~10-15 s).

## Chosen plan: ExaBot `!pl` once an hour + listen in between

- `!pl` (ExaBot) gives the full, correct list with scores. Ask it at most once
  an hour, and only on a **Nod map where the servers say 0 players**; also
  once when a new Nod map starts. Maps run ~2 hours, so ~2-3 `!pl` per Nod map
  and none on GDI maps (8 lines per `!pl` in `#Mission-Coop`).
- In between, keep the list from BRenBot's join / leave / kill lines below.
- If ExaBot skips the request, wait ~15 s and ask once more; otherwise keep
  the listened list until the next hour.
- Scores are only as fresh as the last `!pl`: show "scores as of hh:mm".

Timing: a job starts every 30 minutes and stays connected ~35 minutes
(`concurrency: cancel-in-progress` hands over to the newer one), so one is
almost always listening. Store the time of the last `!pl` in `players.json`.
If GitHub starts a job late, joins/leaves in the gap are missed until the
next kill line or `!pl` (at most an hour).

## Listening in #Mission-Coop (no commands)

Mission-Coop (BRenBot) posts joins, leaves and kills in `#Mission-Coop` by
itself, even on Nod maps (seen 31-10-2026):

```
<Mission-Coop> Player RyanTurner1331 joined the game
<Mission-Coop> Player RyanTurner1331 left the game
<Mission-Coop> Host: [BR] RyanTurner1331 is no longer among us to fight in the war
<Mission-Coop> Host: [BR] Melody destroyed an enemy Guard Tower
<Mission-Coop> Host: [BR] ChaosLegionnaire destroyed an enemy Humm-Vee (Chemical Warrior/ APC)
```

A job that only listens can keep the player list from these lines, without
typing anything in the channel.

- `Player <name> joined the game` -> add `<name>`
- `Player <name> left the game` (or `... is no longer among us ...`) -> remove
- `Host: [BR] <name> destroyed ...` -> make sure `<name>` is in the list
  (catches players who joined while nobody was listening)
- New map / game over line (check what BRenBot posts) -> keep the list, but
  check it against the next joins/leaves
- If the server ever reports players again (someone on GDI), trust that and
  reset the list from it

ExaBot's `!pl` (posts in the channel) stays as a manual check only.

## Before building

- [ ] Permission from Deth for a bot nick in `#Mission-Coop` that listens,
      and types `!pl` at most once an hour, only on Nod maps (asked 31-10-2026)
- [ ] Register the bot nick (e.g. `ryanMapListGithub`, max 30 characters;
      MAXNICKLEN=30): connect, wait 30 minutes,
      `/msg NickServ REGISTER <password> <email>`
- [ ] Add the password on GitHub: Settings > Secrets and variables > Actions >
      New repository secret, name `IRC_PASSWORD` (never in a file or a chat)
- [ ] Note the exact line BRenBot posts when a map ends / the next map loads

## Build

- [ ] Workflow every 30 minutes that stays connected ~35 minutes (see Timing);
      keep the list between runs in `players.json` on the `server-status` branch
- [ ] Connect to `85.215.107.108:6667`, identify with `IRC_PASSWORD`, join
      `#Mission-Coop`; the only thing it ever sends is the hourly `!pl`
- [ ] Save `players.json` every minute: map, names (+ scores from the last
      `!pl`), `checked_at`, `last_pl_at`
- [ ] Site: when CnCNet / the direct check say 0 players and `players.json`
      is recent, show its count and names, with an "IRC" badge and a note
      like "From IRC · full list 23 min ago · on Nod maps this can be wrong"
      (Nod as a badge), so visitors know it's an estimate between `!pl`s

## Notes on ExaBot

ExaBot only answers in a channel (not by private message) and sometimes skips
a request. Asking every 5 minutes would spam `#Mission-Coop`, hence once an
hour. With a quiet channel that ExaBot's owner (PruServ) adds ExaBot to, it
could ask more often.

## Better alternative

Ask whoever runs the server / ExaBot whether the player list could be
published as a small web page or file, or whether the server's count on Nod
maps can be fixed. Then nothing here is needed.
