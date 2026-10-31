# TODO: player list from IRC (ExaBot)

Branch for getting the real player list on Nod maps. Merge into `main` only
when it works.

## Why

On Nod maps the server reports **0 players** to everyone who asks (the in-game
list, W3D Hub, CnCNet, and our direct check on query port 23506), unless at
least one player is on GDI. Mission-Coop (BRenBot 1.53) also says "There are
no players ingame at this time."

**ExaBot's `!pl` is always right**, for example:

```
<ExaBot> C&C_Islands.mix 6 players
<ExaBot> Jesus Score: 0 Kills: 0 Deaths: 0 Credits: 2480
<ExaBot> Melody Score: 362 Kills: 0 Deaths: 0 Credits: 2842
```

ExaBot does **not** answer private messages, and it sometimes skips a request
(ask again after ~10-15 s).

## Before building

- [ ] Permission from Deth / the channel owners for a bot nick asking every
      ~5 minutes
- [ ] A quiet channel with **ExaBot in it** (ExaBot's owner, PruServ, has to add
      it), so `!pl` replies don't spam `#Mission-Coop`
- [ ] Register the bot nick (e.g. `ryanMapListGithub`, max 30 characters):
      connect, wait 30 minutes, `/msg NickServ REGISTER <password> <email>`
- [ ] Add the password on GitHub: Settings > Secrets and variables > Actions >
      New repository secret, name `IRC_PASSWORD` (never in a file or a chat)

## Build

- [ ] Workflow (every 5 minutes, GitHub's minimum): only ask ExaBot when the
      current map is a Nod map in `_data/maps.yml` **and** the server reports
      0 players
- [ ] Connect to `85.215.107.108:6667`, identify with `IRC_PASSWORD`, join the
      quiet channel, send `!pl`, read ExaBot's lines for ~15 s, retry once
- [ ] Parse `<map>.mix <n> players` and `<name> Score: Kills: Deaths: Credits:`
      (no team or time left: faction comes from the map list, time left from
      CnCNet / the direct check)
- [ ] Save as `players.json` on the `server-status` branch next to
      `status.json`
- [ ] Site: when the current source says 0 players on a Nod map and
      `players.json` is recent, show its count and list, with an "IRC" badge

## Better alternative

Ask whoever runs ExaBot whether it could publish the list itself (a small web
page or file). Then no IRC login or secret is needed and it could update every
minute.
