# Sketch: 花火師 Hanabi-shi, the firework maker

Sunday Aug 9 (`day: 7`), the balcony at night, no jobs. Clawd designs firework shells at a
workbench, test fires them over the city, puts them on a rack beside the helpers' shells, and
runs the show one press at a time. Any shell can be sent as a link. Opening that link plays
"a firework from a friend" first, then offers "make one back".

The question it tests: is making something of your own, and sending it to someone, the most
delightful thing we can add, and the thing that spreads the game?

## Play it

- `?day=7&nosave&mute` (add `&skip` to skip the laptop intro, `&q=low` for the light tier)
- A gift, a picture: `?fw=AQMAAAAAAAAAYAYAAGYAYGYGAGZmAGZmBmZmBmZmZmZmZmZmZmZmZmZgZmZmZmYAYGZmZmYAAGBmZmYAAABgZmYAAAAAYGYAAAAAAGAAAAAAAAAAAAAADmEgcHVycGxlIGhlYXJ0` ("a purple heart" with a gold frame)
- A gift, a shell: `?fw=AQANBzExMTExMTExMTEGBgYGBgYGBlVVVVVVVQAAAAAQc3VtbWVyLCBpbiByaW5ncw` ("summer, in rings")

## What's in it

- **The bench** (click the bench on the counter). A 花火玉 cross-section on a canvas. There
  are two ways to pack it:
  - **割物 shell**: stars on four rings (20/16/12/8 slots) plus a core. Each ring has an
    effect you cycle by tapping it: 牡丹 peony, 菊 chrysanthemum (tails), 柳 willow (drooping
    gold), 輪 ring (flat, facing you).
  - **型物 picture**: a 13×13 grid clipped to the round shell, bursting flat like the Clawd
    firework. An optional gold frame.
  - Seven colors, each named for what burns it: Sr red, Ca orange, Na gold, Ba green, Cu
    blue, Sr+Cu purple, Mg silver. Silver glitters, then crackles.
  - Drag paints. Starting a stroke on a star of the current color erases.
  - Each star plays a yo-scale chime, so packing a ring plays a phrase.
  - Also: undo (and ⌘Z), clear, 🎲, + new, an optional name, ✉ send.
  - The half-shell on the bench is a live 3D copy of the design.
- **Test fire**: the panel slides away, the camera looks up, and the shell bursts over the
  city in the layout you drew. The left/right halves map correctly (checked with a red/blue
  split shell). Tap, Space, or the pill returns you to the bench. One loop is about 5 s.
- **Helpers' shells**: click a helper to watch theirs. h1 🍓 made a strawberry (picture), h2
  🌿 a green-and-gold willow, h3 🧊 a snowflake (picture), and two classics: 八重芯 and 錦冠.
- **The rack card** (click the crate) lists tonight's running order. It has ▶ to test any
  shell and ✎ to edit yours. You get up to 3 shells, and yours go up last.
- **The show** runs in the ending. The crew stands at the railing.
  - Each press of 点火 (or a tap anywhere, or Space) launches the next shell. Its rise time
    is two beats, so an on-beat press bursts on a beat.
  - Presses within ±0.12 beat get "✦ on the beat" and a 12% bigger burst.
  - The beat comes from the music's own bar clock. With no running AudioContext it falls back
    to a timer at 84 bpm.
  - Helpers say "that's mine ✦" when their shell goes up. If nobody presses for 6.5 s, the
    next shell launches itself on a beat.
  - After the last shell, one more press fires a スターマイン star mine. The photo is taken at
    your last shell's full bloom.
  - The end card offers ✉ send for your shell.
- **Send / gift**:
  - The link format is `?fw=<base64url>`. Each one is a version byte, a mode,
    4-bit cells and a UTF-8 name: 44–66 chars for a shell, up to about 175 for a named picture.
  - Copying uses `navigator.clipboard` with a select-the-text fallback. Where it exists,
    `navigator.share` is offered too.
  - Opening a link plays the friend's firework twice at full night, then a card with "watch
    it again" and "make one back". The bench then opens labelled for the reply.
- **Diary**: what you made, whether you made one back for a friend, the helpers' shells, how
  many presses landed on the beat, and the star mine.

## Honest fun read

- **The best moment** is the first test fire: the shell you just packed bursts over the city
  in the layout you drew. The half-shell on the bench showing the same pattern makes it feel
  like a real object.
- **Pictures read clearly** in the sky. The strawberry, snowflake and a hand-drawn heart are
  all recognizable in the screenshots. Chrysanthemum tails and the willow look like the real
  thing.
- **The gift link is the strongest idea for spreading the game.** It's short, robust, and needs
  no backend:
  - 400 of 400 random designs round-tripped exactly, including unicode names and truncation.
  - 13 kinds of garbage input all returned null without throwing.
- **The show is the weakest part.**
  - One button and 6–8 presses give little skill and little choice.
  - The beat judgement is verified only on the fallback clock: beat-aligned presses scored "✦
    on the beat". The music-clock path is untested because headless Chrome kept the
    AudioContext suspended.
  - I didn't build arranging the running order. The auto-launch covers the "let it run" case.
- **Effects are abstract until fired.** On the canvas, 牡丹, 菊 and 輪 are subtle (short tail
  strokes, a drip, a flat pellet). The fast test-fire loop is what teaches them.
- **Picture mode on a phone is fiddly**: cells are about 22 px on a 390-wide screen. Drag
  painting makes it workable.
- **Sound is untested.** Every run was headless with audio muted.

## Next, if this direction wins

- Received fireworks collect on a shelf (localStorage) and can be replayed. A shared wall
  of everyone's fireworks would need a backend.
- A better show:
  - a composed finale built from your own shells, or a short score where the presses are
    the notes
  - or let the player arrange the order and then just watch
- `?fw=` is a top-level route: it opens day 7 whatever the player has unlocked.
- The design → test-fire → tweak loop is the part worth keeping; it would also work as a
  terminal command (`hanabi --design`) on other evenings.

## Core edits (additive, `src/core/fx.js` only)

- `firework()` gained options:
  - `stars`, `pattern`, `colors`, `trails`
  - `rise`: seconds to burst, default `1.1` as before
  - `onBurst(o)`
- Two new types: `'stars'` (an explicit star list) and `'pattern'` (rows of characters plus a
  color map, bursting flat).
- New exports: `patternStars(rows, colors)` and `starBurstCount()`.
- Star-list bursts live in their own `starBursts` list. Each burst has its own trail buffer,
  is updated by `updateStarBursts()` from `updateFx`, and disposes itself when it dies.
- Existing types run the same `burst()` code as before. The only change in their path is
  that the tween callback builds the burst origin first, then calls `burst(type, o, c1, c2,
  size)` with the same arguments.
- Verified (headless Chrome, :4392):
  - `firework({})`, `willow`, `ring`, `clawd` and the new `pattern` all fired.
  - Day 1 then played its full ending (fireworks plus the Clawd firework) into the diary.
  - Zero console errors.

## Measured

All of this was headless Chrome on this M5 Pro. It is not phone hardware.

- Peak star+trail points alive over the full show plus star mine: 3,472 on the low tier and
  5,485 on the high tier.
- Frame time over that window: p50 16.7 ms, p95 17.4 ms (low) and 17.2 ms (high), max
  20–21 ms.
- Layout checked at 1280×720 and 390×844. On phones the bench is a bottom sheet with a
  canvas of about 340 px.
