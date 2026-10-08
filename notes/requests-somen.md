# Core requests from day 3 (nagashi-sōmen)

Worked around locally in `src/chapters/somen.js`; nothing here blocks the chapter.

1. **Sounds the chapter calls that core doesn't have yet.** One-shots: `knock` (bamboo on bamboo),
   `slurp` (zuzu), `clack` (chopsticks), `splash`, `trickle`. Loops via `audio.loop(name, level)`:
   `water` (running flume, ~0.55 while flowing), `bubble` (boiling pot, 0.45 while boiling).
2. **Fireflies.** The chapter drives `sky.fireflies` (dusk ramp, 1.0 in the ending) and expects the sky
   module to render the swarm over the trees. It also spawns ~18 of its own points near the balcony
   and one firefly that lands on helper 3's head; those are chapter content, not a duplicate swarm.
3. **Particles leak across replays.** `fx.Particles` registers in a module-level set and keeps updating
   after its parent is removed. Chapters have to call `dispose()` in teardown (somen does).
   `kakigori.js` never disposes `P.snow` / `P.mist`, so every replay of day 1 leaves two live systems.
   Either auto-dispose systems parented under the chapter root on teardown, or fix kakigori.
4. **HUD overlap on phones.** At 390px wide, `#clock` overlaps the right side of `#todo` (any chapter
   with a long goal line). Maybe stack the clock under the todo panel below ~480px.
5. **Wait bubbles repeat.** A job whose `plan()` returns `{ x, wait }` re-says the wait text after any
   other bubble expires (helperTick compares against `lastSay`). Somen restores `lastSay` after its
   own "ずずっ" bubbles. A `quiet: true` flag on the wait step would be cleaner.
6. **Proactive station rings.** Rings only show on hover or while a helper is selected. Somen draws
   its own pulsing floor marks at the catch spots when the slide opens. A `highlight()` hook per
   station (or `ring.always`) would let chapters use the core rings instead.
