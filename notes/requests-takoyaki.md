# Core requests from the takoyaki chapter (day 2)

Worked around locally where possible; none of these block the chapter.

1. **HUD overlap on phones.** At 390px wide, `#todo` and `#clock` overlap (todo `max-width: min(380px, 60vw)` plus the
   clock panel on the right). Long goals ("make takoyaki for the neighbors") make it worse. Suggest capping the todo at
   `calc(100vw - <clock width> - 36px)` on narrow screens, or stacking the clock under the todo.
2. **Off-screen speech bubbles.** `Crab.update` clamps a bubble to the screen edge even when its crab is far off-screen
   (e.g. helpers at x≈-6 while the camera is close on the pan), so stray bubbles float at the left edge. Suggest hiding
   bubbles whose projected point is outside the viewport (with a margin) or behind the camera.
3. **Intro camera move.** After `introShots`, `intro()` eases to the laptop framing with `cam.shot(..., {k:1.6})`; from a
   shot on the far side of the balcony that path can pass through Clawd's body. I added a final establishing shot to keep
   the path in front of Clawd. A `cut: true` (or a quick fade) for the laptop framing would make this robust for every chapter.
4. **Audio names this chapter calls** (silent until the audio module implements them):
   sfx: `scrape` (pick turning a ball), `pour`, `pop`, `squeeze` (mayo), `sprinkle`, `flake` (katsuobushi), `creak`,
   `ramune` (marble pop + fizz), `steam` (hiss), `splash`, `thunder` (distant), plus core `chime/done/clunk/select/deny/whoosh`.
   loops via `audio.loop(name, level)`: `sizzle` (level ∝ balls cooking), `steam` (rain hitting the hot pan),
   `creak` (the basket rope while it moves, 0/1).
5. **Sky hooks.** The chapter drives `sky.overcast` (.55 → .95 → .05), `sky.rain` (peaks phase ≈ .24–.38) and
   `sky.rainbow` (≈ .45–.62) every frame, and resets them to 0 in teardown. It expects the `shower` preset to render rain
   particles and the rainbow from those values.
6. **Quitting saves the day.** "end evening" calls `finish({quit:true})`, and the runner then stamps the day done
   (がんばりました) and unlocks the next one. Maybe a quit shouldn't count as finishing the evening.
