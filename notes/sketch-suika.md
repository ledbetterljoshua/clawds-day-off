# Sketch: スイカ割り Suikawari (prompt a blindfolded agent)

`?proto=suika` (add `&skip` to skip the intro, `&nosave&mute` for tests). Files:
`src/chapters/proto/suika.js` (rounds, prompting, motion), `suika/beach.js` (the set),
`suika/ui.js` (command pad, question, blindfold, title card). No core edits.

## What it is

A day trip to the sea, Mon Aug 10, afternoon into golden hour. The verb is *prompting*.

- **Rounds 1–3:** a helper is blindfolded, handed a stick and spun three times. It moves only
  on your instructions: ⬆ forward, ⟲ ⟳ turn, ⬇ back, ↻ turn around, ちょっと (a little), ✋ stop,
  SWING. Each instruction is one message from a 12-message context meter. Run out and it
  compacts and swings on its own. Keyboard: arrows/WASD, Shift = a little, Q = turn around,
  Esc/X = stop, Space = swing. Press `/` and type a whole prompt
  (`turn left 60 then forward 3 then swing`): one line is one message.
- **Each helper hears you its own way, learnably:**
  - **h1 🍓 precise:** exact steps and degrees ("left 45.0° ✦"). The first time "left" is
    ambiguous (it's facing you), it asks *left as you see it, or left as I face?* Answering
    costs a message, and it remembers for the round.
  - **h2 🌿 dreamy:** every step bends toward the sound of the sea. Aim a little inland, or it
    wanders into the water ("the sea… was calling…").
  - **h3 🧊 eager:** double steps, and near the watermelon (or after bumping into it) it winds
    up on its own: "SWING? ✦". STOP pulses; stop it or let it swing.
- **Noisy context:** the two watching helpers shout advice every few seconds. h1 gives exact
  numbers, h2 says warmer and colder, and h3 often calls it from its own side, which is
  backwards when the blindfolded one faces you. Only Clawd's instructions count.
- **Round 4, the reversal:** Clawd wears the blindfold. The screen goes dark, with a little
  light through the cloth when you face the sun. You hold the arrows to walk and turn. The
  helpers' voices come from where they stand: stereo-panned, with bubbles at the matching edge
  of the screen. h1 is exact but slow, h2 says warmer or colder (or where the sea is), and h3
  is loud and always calls SWING too early. Miss twice and h3 chops it open for you.
- **The watermelon** cracks a little more with each good hit and falls open on the last one.
  Then everyone sits on the sand with slices, seeds fly, and the photo is taken.
- **Sketch diary page:** a line per helper, the funniest misunderstanding (sea > early swing
  > walked into someone > context full > asked which left), and your round.
- **Footprints:** crab tracks stay in the sand (fading slowly), so you can read the agent's
  path. A faint chevron and ring under the blindfolded helper show its facing and where the
  stick will land.

## Verified

- I played every path with test bots in agent-browser at 1280×720, with zero page errors
  (the bots are at `scratchpad/sketches/suika-bots/`):
  - all four hits leads to the perfect stamp
  - context full makes it swing on its own
  - helper 3's early wind-up, caught with STOP
  - two misses in round 4 leads to helper 3's chop
  - "end evening" ends on the sketch page; "play again" leaves one pad and one style tag
- Phone portrait (390×844): the camera frames the agent and the watermelon, and the question
  panel covers the pad. Not tried on a real touch device.
- `&q=low`: about 85 visible meshes, 61 fps headless.
- One full run had sound enabled (browser muted): the surf loop and every `sk-*` sound ran
  without errors.

## Honest read on the fun

- **Works:**
  - The jokes land without explanation: h1's question, h3's "SWING? ✦" with STOP pulsing,
    and h2 "the sea is calling…".
  - The real puzzle is *its* left versus *yours* when it faces you. That is the
    prompting problem, made physical.
  - The typed one-line prompt is the most Claude Code moment: a good prompt does the whole
    round in 2–4 messages. With the buttons it's about 6–10.
  - The reversal is the strongest idea in the sketch. The same mechanic from the agent's
    side, deciding which voice to trust, is a genuine "oh".
  - The golden ending on the beach is one of the prettiest frames in the game.
- **Weak:**
  - With buttons, rounds 1–3 can feel like turtle graphics (turn, walk, turn, walk). The
    quirks carry it.
  - Twelve messages is generous, so the budget rarely bites.
  - A blindfolded box-crab's facing is hard to read without the chevron.
  - h2's drift is the weakest quirk: it reads as your own mistake until the hint says otherwise.
  - Round transitions take about 9 s, which is slow.
- **Best quirk:** h3 (eager), because the wind-up plus STOP is real tension. **Funniest:** h1's
  question.
- **Is prompting fun?** Yes as one five-minute evening. As a recurring verb, it's better used
  as a tool inside other evenings (talk a helper through something it can't see) than as a
  whole game.

## Next, if it goes forward

1. Tighten: an 8-message budget, a ≤5-message tier per round, and faster transitions.
2. A "+ then" chain button so touch players can compose a multi-step prompt (the best part
   is keyboard-only right now).
3. Make h2's drift legible: footprints that visibly curve, a gull and a wave sound from the
   side it's drifting toward.
4. Seed-spitting at the picnic (a distance contest h3 always claims to win).
5. Reuse the beach set for a full day-trip evening: train ride, sandcastle, crab cousins.

## Core requests (worked around locally)

- **2D walking:** sets off the balcony need crabs that walk in 2D. I wrap each crab's
  `update` while the sketch runs (position and facing from my own motion, plus the leg
  cycle). A supported mode in crab.js (for example `c.free = {x, z, th, moving}`) would be
  cleaner.
- **`game.gather`** walks along x only.
- **`#hint`** sits above the crew cards. A chapter with its own bottom pad moves it with a
  body class (`body.sk-suika`).
