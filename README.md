# Clawd's Day Off — ch. 1: kakigōri

A playable version of the short film *Clawd's Kakigōri — a summer evening, made in code*.

Clawd pushes, tests pass, done for today. `make kakigōri for four` spawns three helpers,
and the evening becomes a tiny cooking game about delegation:

- **Do it yourself** — click a station and play its minigame (crank the shaver in circles,
  time three strawberry cuts, release a syrup pour inside the band, hold to pick mint).
- **Delegate** — click a helper (or its card / press 1–3), then a station. Helpers stay on a
  job until it's done; specialists (🍓 strawberry, 🌿 mint+syrups, 🧊 ice) work twice as fast.
- The sun is the clock. At 7:45 the fireworks start whether you're done or not. Nobody loses.

Open `index.html` (single file, three.js from jsDelivr). Keys: A/D walk, E interact,
Space minigame, 1–3 select helper, Esc cancel, M mute.

Debug: `__G.speed = 4` fast-forwards; `__dbg.assign(__dbg.helpers[2], 'shaver')`.
