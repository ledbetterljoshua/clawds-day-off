# Core requests from day 5 (senkō hanabi)

1. **A sanctioned way to dim the lanterns for a chapter.** `sky.update` rewrites
   `sky.lights.lantern.intensity` every frame, after chapter updates. Senko dims it (×0.42 while
   lighting, ×0.3 while burning, ×0.22 in the ending) by wrapping `scene.onBeforeRender`, which
   runs after `sky.update` and before lights are set up. It restores the original on teardown.
   Proposal: `sky.lanternScale` (default 1) applied inside `sky.update`, and I'll switch to it.

2. **Diary stats override.** The runner's `statsLine()` prints "you 0 tasks · helpers 0 ·
   0 delegations" for a chapter with no jobs. Proposal: use `def.stats?.(result)` when a chapter
   defines one. (Senko would say "3 sparklers · reached chiri-giku twice".)

3. **Klee One renders ō/ū badly** in `.dp-text` ("senko¯"). Senko's diary lines avoid macrons
   for now; kakigori's "kakigōri" shows the same problem. A per-glyph fallback (`unicode-range`
   on a second face) or swapping macron letters for the M PLUS face would fix every chapter.

4. **Off-screen bubbles.** `Crab.update` clamps bubble x to the screen edge, so a crab out of
   frame shows its bubble pinned at the edge (noticeable in close cinematic shots). Proposal:
   hide the bubble when the projected point is off-screen or behind the camera.

5. **Gust hook.** Senko cues gusts by nudging `world.furin.v` (the furin rings, then the push
   arrives). A documented `world.gust(strength)` that swings the furin and lanterns would be
   cleaner and reusable for the takoyaki shower.

6. **Audio names this chapter calls** (no-ops until the audio branch lands):
   loops `sparkler` (0..1, combined crackle bed) and `candle` (0..0.5);
   sfx `match` (`{ soft }`), `crackle` (`{ gap }`), `bead-drop` (`{ soft }`), `hiss`, `whoosh`,
   `select`, `stamp`; moods `night` (play), `quiet` (after the last bead), `finale` (credits).

7. **Week complete.** Day 5 is the last page. A diary view after day 5 that collects all five
   photos (a contact sheet or a fold-out page) would close the week; senko's credits hand off to
   the normal diary page today.
