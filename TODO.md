# TODO: player list from IRC (ExaBot)

Branch for getting the real player list on Nod maps. Merge into `main` only
when it works.

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

## Plan: listen in #Mission-Coop (no commands, no spam)

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

- [ ] Permission from Deth to have a listening bot nick in `#Mission-Coop`
      (asked 31-10-2026; it never types anything)
- [ ] Register the bot nick (e.g. `ryanMapListGithub`, max 30 characters;
      MAXNICKLEN=30): connect, wait 30 minutes,
      `/msg NickServ REGISTER <password> <email>`
- [ ] Add the password on GitHub: Settings > Secrets and variables > Actions >
      New repository secret, name `IRC_PASSWORD` (never in a file or a chat)
- [ ] Note the exact line BRenBot posts when a map ends / the next map loads

## Build

- [ ] Workflow every 5 minutes (GitHub's minimum) that stays connected for
      ~5 minutes, so there is (almost) always one listening; keep the list
      between runs in `players.json` on the `server-status` branch
- [ ] Connect to `85.215.107.108:6667`, identify with `IRC_PASSWORD`, join
      `#Mission-Coop`, read only - never send a message to the channel
- [ ] Save `players.json`: map, list of names, `checked_at`
- [ ] Site: when CnCNet / the direct check say 0 players and `players.json`
      is recent, show its count and names, with an "IRC" badge (no scores:
      kill lines don't give them)

## Other option: ExaBot `!pl`

ExaBot's `!pl` gives names and scores, but it only answers in a channel (not
by private message), sometimes skips a request, and every 5 minutes would spam
`#Mission-Coop`. Only worth it with a quiet channel that ExaBot's owner
(PruServ) adds ExaBot to.

## Better alternative

Ask whoever runs the server / ExaBot whether the player list could be
published as a small web page or file, or whether the server's count on Nod
maps can be fixed. Then nothing here is needed.
