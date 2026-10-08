# Core requests from day 4 (Tanabata)

0. **Helper cards don't select anything (all chapters).** `hud.js` calls `hud.onCard(h)` on a
   card click, but `game.js` never assigns `hud.onCard`, so tapping a helper card does
   nothing. On phones that's the main way to pick a helper. One line in `game.js` fixes it:
   `hud.onCard = h => select(G.selected === h ? null : h);`

1. **Frame loop dies on any throw.** `main.js` runs tweens/updates without a guard, so one
   exception inside a tween stops `requestAnimationFrame` and freezes the game. (I hit this
   while a chapter bug was live.) Wrap the frame body, or each tween `fn`, in try/catch and
   log once.
2. **Vega/Altair handshake.** Tanabata sets `sky.milkyWay` and `sky.starPair` (0..1) and draws
   its own Vega/Altair glow sprites *unless* `sky.rendersStarPair` is true. When `sky.js`
   draws the star pair itself, set `sky.rendersStarPair = true` so the two don't double up.
   The magpie bridge and the meeting glow stay in the chapter.
3. **Phone HUD overlap.** At 390px wide, `#todo` (max-width 60vw) and `#clock` overlap in
   every chapter. Tanabata's todo labels are kept short, but the panels still touch.
4. **Sounds tanabata calls that aren't in the shared list yet:** `creak` (lifting the
   bamboo), `wind` (a gust as the bridge forms). Also uses `paper fold snip brush tape chime
   done whoosh select pop` from the shared list.
5. **Rings for jobs a helper can't take.** The wish desk has a job with `canAssign: () => false`
   (only the player writes their wish), but its ring still lights up when a helper is
   selected. The ring check in `game.update` could skip jobs whose `canAssign` returns false.
6. **Klee One and "ō".** In the hand font, "kakigōri" renders as "kakigo¯ri" (seen in an
   input and in the day-1 diary text). Worth checking the fallback for macron vowels in
   `--hand` text.
7. Chapter CSS/DOM persists into the diary view until the next chapter's teardown. Harmless
   for tanabata (all selectors are `#tb-*`), noting it in case another chapter relies on
   teardown running at the end of an evening.
8. **Number keys have no repeat guard.** In `game.js` `key()`, `1`–`3` call
   `select(G.selected === h ? null : h)` on every keydown, so a held key (auto-repeat) flips the
   selection on and off. Ignore `e.repeat` there. (agent-browser's `press` also emits a burst of
   keydowns, which is how this showed up; select helpers by clicking them in tests.)
