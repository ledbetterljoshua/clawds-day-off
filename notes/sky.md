# Sky, weather & post: API for chapters

## Weather levels (0..1)
`sky.rain`, `sky.overcast`, `sky.fireflies`, `sky.rainbow`, `sky.milkyWay`, `sky.starPair`, `sky.shimmer`

Each follows its preset's curve until a chapter assigns it (`sky.rain = .8`); from then on the
chapter owns that level until the next `setPreset`. Preset curves:
- `shower`: overcast 1 → 0 by phase .78, rain ≈ .3–.63, rainbow ≈ .66–.9
- `hot`: shimmer until ≈ .7, fireflies from ≈ .8
- `starry`: milkyWay from ≈ .8; clouds thin out after .5
- `moon`: moon and stars from phase 0 (late night all evening)

## Other hooks
- `sky.lightning(strength = 1)`: flash in the clouds, `audio.sfx('thunder', {delay, strength})` a moment later
- `sky.flash(color, amt)`: firework light on the scene (unchanged)
- `sky.stars.vega`, `sky.stars.altair`: unit directions (≈30° and ≈25° up). The Milky Way runs between
  them and rises from the horizon straight out from the balcony (azimuth ≈ 0). The play camera only sees
  0–10° of sky, so tanabata shots that want the pair should look up (camera pitch ≈ +20°).
- `sky.moonDir` (moon preset: left of center, ≈3° rising to ≈6°), `sky.sunDir`
- `sky.toScene(displayColor, out)`: the scene-linear color that renders as `displayColor` after tone mapping
  (use it for anything that must match the sky exactly)
- `post.dof({ focus, aperture, maxblur })` / `post.dof(null)`: cutscene depth of field (high tier only).
  `focus` is distance from the camera in world units; e.g. `{ focus: 1, aperture: .012, maxblur: .012 }` for a prop close-up.
- `post.quality = 'high' | 'low'`: auto low on touch/mobile/≤4 cores; a watchdog drops to low once if the
  median frame exceeds 26 ms.

Dev params: `&rain= &overcast= &fireflies= &rainbow= &milky= &pair= &shimmer= &q=low|high`

## How the look works
Sky colors are authored as the colors you see on screen. The sky shader runs them through an inverse of the
final ACES pass, so they land exactly there while scene geometry keeps the tone curve it was tuned under.
Tone mapping now happens in post's final pass (the same ACES curve as the renderer, plus split-tone grading,
vignette and grain). `renderer.toneMapping` only matters if the composer fails to build.

## Requests for other owners
1. **world.js:** consider lowering the city by ~6 units (base y −28 instead of −22). The play camera sees
   only 0–10° above the horizon, and the near towers poke into that band. Haze hides most of it by day,
   but the cumulus would rise more cleanly from the skyline.
2. **fx.js:** the Clawd-shaped firework reads near-white because ~450 overlapping additive points saturate.
   Scaling its per-point color by ≈ .45 keeps it orange.
3. **audio.js:** `thunder` (sfx with `delay`, `strength`) and a `rain` loop. Sky already calls
   `audio.loop('rain', level)` and `audio.setAmbience({ rain })`.
