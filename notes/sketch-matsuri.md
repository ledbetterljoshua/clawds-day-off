# Sketch · 夏祭り Natsu-matsuri

`?proto=matsuri` (add `&skip` to skip the intro, `&nosave&mute` for test runs).

**The question:** can delegating well be the reason Clawd gets a day off?

## What's in it

Saturday Aug 8, 6:30–8:30 pm (phase .78 → 1, about 6½ minutes of play), on a festival street in
the town below the balcony. The balcony, backdrop and komorebi canopy are hidden
(`game.setScene`); `bounds: [-30, 30]`.

- **The street** (`matsuri/street.js`): eight yatai under two strings of chōchin, a row of
  machiya shopfronts with lit shoji, a torii and shrine steps at the left end, the river
  embankment at the right, painted hills with town lights behind. One canvas atlas for every
  sign, awning and shopfront, so the static set merges into three meshes. Lanterns are instanced
  and glow up with the phase. The sky module's lantern lights travel with the camera.
- **The stall** (`matsuri/stall.js`): ice box, a half-size version of the balcony's shaver,
  shaved cups, three syrups, cups ready to go, coin tray. One cup per customer: shave → syrup
  (their flavor) → hand it over (¥300).
- **Standing jobs:** shave / syrup / serve never finish; a helper keeps its role until
  reassigned. Specialists: h1 serving, h2 syrups, h3 ice (shaving and fetching).
- **Ice:** a block makes six cups. When the box runs low, send someone to the 氷屋 at the left
  end (¥200 for two blocks). A helper sent for ice goes back to its old post afterwards.
- **The line** (`matsuri/folk.js`): townsfolk in yukata (cat, tanuki, rabbit, dog, a kid with a
  fox mask, gramps with an uchiwa), 6 species × 8 yukata patterns, one merged mesh + a face
  shell each. Strollers browse other stalls, join the line, and show an order chip with a
  patience bar. They give up after ~50 s, and a full line (6) turns people away. Both count as
  "gave up".
- **金魚すくい** (`matsuri/goldfish.js`): in-world, looking down into the tub. Press to dip the
  poi, slide under a fish, let go to lift. The paper soaks while it's wet, wears faster when you
  sweep it, and a heavy demekin can break it. 12 fish (wakin, akame, a calico sarasa, two black
  demekin) wander and dart away from a fast poi. The tanuki keeper gives the real tips. Catches
  go into a bag Clawd carries all night; catch none and he gives you one anyway (おまけ).
- **お面** (`matsuri/masks.js`): fox, hyottoko, okame, oni, cat, and a Clawd mask. Bought with
  stall money (¥600), worn pushed to the side.
- **Things that happen:** a kid trips and drops their cup, and whoever is serving makes them a
  new one for free. At ~7:20 helper 2 asks for a break to go look at the goldfish (you cover its
  role, or reassign it and it says "ok ok, back to work ✦"). At ~7:40 the bon-odori ends and
  there's a rush.
- **The end:** 8:30, the stall closes, cut to the embankment, fireworks over the river with the
  Clawd one bursting alone. The diary keeps the sale count and up to three of the evening's
  stories.

## How it plays (honest read)

What works:
- The thesis lands. Staff the three roles and the stall runs. Walk off to the tub and the todo
  keeps you honest ("nobody", "line 6", "3 gave up"). Measured, fully delegated with matching
  specialists: 64 cups, 0 lost. Mismatched specialists plus the break and three ice runs: 53–65
  cups, 2–13 lost.
- The interrupts are where the orchestration is: the ice running out (every ~2½ minutes), the
  break request, the rush. Each one pulls you back to re-plan.
- Goldfish scooping is the best-feeling thing in the sketch: tense paper, ripples, a fish
  arcing into the bowl. A scripted player sliding in slowly from behind a fish catches 2 in 4
  tries before the paper tears, which seems right.
- The look carries off the balcony. Dusk-to-night with every lantern lit is the prettiest the
  game has looked. Performance: 242 draw calls per frame (high tier) and 235 (low), vs 761 on
  day 1's balcony measured the same way.

What doesn't yet:
- Between interrupts, a well-staffed stall runs itself and there are only two things to do on
  the street. Six minutes needs 2–3 more playable stalls.
- Money stops mattering once the stall is staffed (¥19k by the end, nothing to spend it on).
- The bon-odori is only a toast; there's no dance.
- Stall status lives only in the todo and the hint line. Away from the stall you can't see the
  line growing.
- Clawd's own stall work uses the old panel widgets (dial, pour), and serving is one click.
- On a portrait phone the tub view shows ~75% of the tub's width (the awning forces a front-on
  angle). It's still playable.

## Next, to make it a real evening

1. Two more stalls: 射的 shooting gallery (tap prizes off a shelf) and ヨーヨー釣り yo-yo fishing
   (a paper-string hook: the poi's tear mechanic again).
2. Bon-odori at 7:30 around a yagura in a small plaza: a short circle dance to the taiko. The
   rush after it is already in.
3. Something to spend on: yakisoba or ringo-ame for the helpers (a short speed boost), prizes
   for the diary.
4. A stall-status pip by the clock while Clawd is away.
5. Let the player answer the break request (yes / "after the rush").

## Core edits

None. The sketch uses only the explore/base hooks (`?proto`, `bounds`, `game.setScene`,
`diary.showSketch`) and existing APIs. Requests are in `requests-sketch-matsuri.md`.
