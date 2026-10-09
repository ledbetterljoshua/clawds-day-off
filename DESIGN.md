# Clawd's Day Off: design + engine contract

Status: all five evenings are built and merged. Chapter notes from their builders live in `notes/`.

Read this whole file before writing code. It is the source of truth for the vision, the
week, the characters, and the chapter contract every evening is built on.

## The vision

A cozy game about an AI agent on vacation who can't quite stop orchestrating subagents.
It is a fan game of Ishu Agrawal's short film **"Claude's day off"**
(<https://x.com/ishuagra02/status/2107488996490166538>, animated by Opus 5.5; its end card
reads *Clawd's Kakigōri — a summer evening, made in code*). Clawd, the Claude Code mascot,
finishes work, types a prompt, spawns three helpers, and spends a summer evening on a
balcony making something together. The sun is the clock. Night always ends in something
beautiful. Nobody loses.

**The core verb, every evening:** do it yourself (a tactile minigame at a station) *or*
delegate (click a helper, then a station; the helper works that job until it is done).
Each helper is a specialist and twice as fast at its specialty. The fun is in noticing
the bottleneck and spreading the work, exactly like running agents in parallel.

**Tone:** warm, funny, quiet, specific. Real Japanese summer details used as content, not
decoration. The jokes are Claude Code jokes (terminal, `/commands`, "spawning helpers…"),
told gently. Everything is **made in code**: procedural geometry, canvas textures,
synthesized audio. No image or audio files. Fonts come from Google Fonts only.

## The week (なつやすみ えにっき, a summer picture diary)

Five evenings, Mon Aug 3 – Fri Aug 7, 2026, framed as a Japanese kid's summer picture diary.
Each evening ends with a photo (the game captures one at the best moment) and a diary entry
in a child's voice (one hiragana sentence + a few English lines), stamped by the teacher:
たいへんよくできました (perfect) / よくできました (complete) / がんばりました (partial).
Days unlock in order. The same three helpers come back every day ("resuming helpers from
yesterday… · 12 tasks remembered").

| day | chapter | file | sky preset | the evening |
|---|---|---|---|---|
| 1 Mon | かき氷 Kakigōri | `chapters/kakigori.js` | `clear` | The film's evening. Shaved ice for four before the fireworks. **Reference chapter: copy its patterns.** |
| 2 Tue | たこ焼き Takoyaki | `chapters/takoyaki.js` | `shower` | Sixteen octopus balls on a hot pan; a sudden evening shower (夕立) mid-cook; a rope basket to the neighbor upstairs. |
| 3 Wed | 流しそうめん Nagashi-sōmen | `chapters/somen.js` | `hot` | Build a bamboo noodle slide, then catch dinner as it flows past. Fireflies at dusk. |
| 4 Thu | 七夕 Tanabata | `chapters/tanabata.js` | `starry` | Fold paper decorations, write wishes on tanzaku strips, hang them on bamboo. The Milky Way; Orihime and Hikoboshi meet. |
| 5 Fri | 線香花火 Senkō hanabi | `chapters/senko.js` | `moon` | The finale. No jobs. Four sparklers, one candle. Keep your claw still. Credits. |

### Chapter briefs

**Day 2, Takoyaki: "make takoyaki for the neighbors."** The mechanic is *concurrency*.
A 4×4 cast-iron takoyaki pan on a portable gas burner (カセットコンロ). Each of the 16 cups
has its own state: empty → batter → octopus in → cooking (a timer) → turn window (glows
golden) → turned → done; burnt if neglected. Many balls come due at once, which is the
point: the player can't watch all sixteen alone, so delegating parts of the pan to helpers
feels necessary (watching many concurrent processes). Stations: batter pitcher (pour
across cups), octopus bowl (drop tako into cups), toppings (tenkasu, beni-shōga, green
onion), the pan (turning with picks; the player clicks individual balls at the right
moment), the plate (two boat plates, 舟皿), and finishing: sauce, a mayo zigzag (draw it),
aonori, and katsuobushi that *dances* on the hot balls (animate the flakes curling).
Mid-evening the sky preset `shower` brings a 夕立: set `sky.overcast` / `sky.rain` (0..1)
from the chapter and the sky module renders it; it clears into a washed pink sunset,
maybe with `sky.rainbow`. The neighbors: one boat goes up to the neighbor upstairs in a
basket on a rope (a real apartment-balcony move). It comes back down with a note
(ありがとう! — 3F) and a ramune bottle. Eating: they blow on the balls ("hafu hafu"),
steam everywhere. Helper specialties: h1 🍓 precise = toppings/plating/mayo,
h2 🌿 liquids = batter and sauce, h3 🧊 strong claws = turning ("I'm cold, so I don't mind
the heat ✦").

**Day 3, Nagashi-sōmen: "build a noodle slide."** Two phases. *Build:* a split-bamboo flume
zigzags from high on the pergola down across the balcony to a colander. Helpers fetch and
mount segments, run the water (h3 ice = water), boil the sōmen, make tsuyu (h2), slice
garnish (h1: cucumber, myōga). The todo list is a build checklist. *Play:* water runs;
noodle bundles flow down the flume. Clawd catches with chopsticks (timing/tap as a bundle
passes the catch zone). Helpers stand at points along the flume and catch too, upstream of
you. Goal: everyone eats enough. Reposition helpers along the flume (select a helper, then
a spot) to share the flow. Rare treats come down: cherry tomatoes, mikan segments, and
**the one pink noodle** (packs of sōmen really do contain a few colored strands; catching
one is lucky). Ending: dusk, fireflies (`sky.fireflies`) rise over the trees below.

**Day 4, Tanabata: "hang wishes on the bamboo."** A bamboo branch (笹) stands in a bucket
at the center. A craft table: helpers make paper decorations (paper chains 輪つなぎ, nets
網飾り, cranes 折り鶴, streamers 吹き流し, little lanterns), each type a job; the player can
fold one by hand (an origami minigame: a short sequence of fold gestures). Decorations get
hung on the bamboo and sway. **Wishes:** the player types a real wish onto a tanzaku strip
(vertical writing). Save it with `save.data.wishes`; it hangs there for the rest of the
week. The helpers write theirs too, revealed one by one. h1: "to cut a strawberry into a
perfect star", h2: "for a rain that smells like mint", h3: "to be spawned again tomorrow".
That last one is the quiet heart of the week (subagents end when their task ends); play it
softly. Ending: night with the Milky Way (`sky.milkyWay`), Vega (Orihime) and Altair
(Hikoboshi) brightening on either side; the wishes flutter.

**Day 5, Senkō hanabi: "one last sparkler each."** The finale. `delegation: false`; no
todo, no clock pressure (`dayLen: Infinity`). Late night, moon, crickets, the furin. The
four sit at the counter's edge with a candle. Each lights a senkō hanabi. The player holds
Clawd's: press and hold still (mouse/touch); movement and gusts make the glowing bead
wobble, and a bead that wobbles too much drops. The sparkler moves through the four
traditional stages, named softly on screen: 牡丹 botan (peony), 松葉 matsuba (pine
needles), 柳 yanagi (willow), 散り菊 chiri-giku (scattering chrysanthemum). People often
read these as the stages of a life; say so once, quietly, if at all. Three sparklers each.
The helpers' sparklers burn on their own; one drops early ("ah"). After the last bead
falls: silence, the moon, the helpers asleep leaning on Clawd, the laptop screen showing
`$ exit` and going dark. Then a credits roll: the original film by Ishu Agrawal
(@ishuagra02), animated by Opus 5.5; game by Joshua Ledbetter, built with Claude.

## Characters

- **Clawd**: the orchestrator, on a day off. Dry and warm. Talks like someone who just
  closed their laptop. Orange (`#d97757`), blocky, two claws, four legs, square eyes.
- **helper 1 🍓 "strawberry"**: precise, delicate, a perfectionist; slicing, arranging, decorating. Says "✦".
- **helper 2 🌿 "mint"**: liquids, pouring, sauces, plants; calm, a little poetic.
- **helper 3 🧊 "ice"**: cold things, water, strength, mechanical work; enthusiastic ("ice is my thing ✦").

Helpers are 0.62 scale. A chapter sets each helper's `spec` (job keys it's fast at) and
`specName` for the evening; the icon and voice lines stay.

## Architecture

No build step. `index.html` + ES modules; three.js r160 from jsDelivr via an import map
(`three`, `three/addons/`). Run `python3 tools/serve.py <port>` (a no-cache static server) and open
`http://localhost:<port>/`.

```
index.html            shell, all CSS, import map
src/main.js           boot + the frame loop
src/game.js           chapter runner, intro, input → delegation, terminal gameplay commands
src/core/
  state.js   G (shared mutable state), resetStats, tiny event bus
  util.js    $ lerp clamp ease easeOut easeOutBack rand randi pick smooth damp esc wrapAngle;
             isTouch, forTouch(s) (prompts say tap, keyboard alternatives drop out; HUD and minigames use it)
  gfx.js     THREE, renderer, scene, camera, toon(), mesh(), group(), box/rbox/cyl/sph, canvasTex, dotTex, MAT, COL, hitMat, toScreen
  tween.js   tween(dur, fn(e), done, tag), sleep(s), until(pred, timeout), killTweens(tag)
  world.js   the balcony, city, lanterns, furin, laptop; world.wind (0..1.25 breeze); CLAWD_PIXELS
  sky.js     sky dome, clouds, lights, palette by phase + preset; sky.rain/overcast hooks
  crab.js    Crab class; clawd, helpers[3], crew, PERSONA, iceMat
  agents.js  helper AI runtime: assign, helperTick, lock/unlock/lockedBy, credit, isSpec, speedOf
  minigames.js  mini.dial / timing / pour / hold / custom; returns a controller (G.mini)
  fx.js      Particles (pooled points), sparkle, puff, firework({type:'peony'|'chrysanthemum'|'willow'|'ring'|'clawd'})
  audio.js   procedural audio: audio.sfx(name, opts), audio.register(name, fn), tone(), noise(), setMood, setAmbience
  terminal.js  laptop screen texture + interactive terminal overlay; term.log, term.register
  camera.js  cam.play(), cam.shot(pos, look, {fov,k,cut,drift}), cam.shots(list); in the play framing
             the camera leans slightly toward the mouse but keeps its aim (parallax; PAR in camera.js)
  hud.js     todo / clock / crew cards / hint / tooltip / hud.toast(html)
  diary.js   title cover, the week, day pages, photo capture
  save.js    localStorage progress (guarded): save.data, save.day(id), save.setDay
  post.js    EffectComposer: scene → ink → (cutscene DOF) → bloom → tone map + grade
  ink.js     InkPass: normal/depth prepass + colored line art
  input.js   pointer + keys → game; chapters can intercept (def.pointer / def.key)
src/chapters/   one file per evening + index.js
```

### Coordinates and layout

- Counter top is **y = 0**. The counter runs **x ∈ [-10, 10]**, depth z ∈ [-1.2, 1.2].
- Props sit at the back, **z ≈ -0.3 … -1.0**. Characters walk the front lane, **z ≈ 0.45 … 0.7**.
  Stand characters *beside* a station (its `spot`), not in front of it, or they hide it.
- Reserved: the laptop at x = -8.4 (keep x < -7 clear for the intro and helper spawn landing
  at x = -6.95, -6.25, -5.55); permanent decor at the right edge (planter x 6.9, plant x 8.45).
  The pergola beam is at y 6.2, z -1.5; the lantern string sags from y 5.7 to 4.6 at z -1.3.
- The play camera frames x ∈ [-10, 10] on landscape screens and follows Clawd on portrait
  phones. Keep the important action between y = 0 and y = 3.5.
- Clawd is ~1.2 units tall; helpers ~0.75.
- Put everything a chapter builds in the `root` group passed to `setup`. The runner removes it, and disposes any `Particles` parented under it.

### The frame

`main.js` each frame: `updateTweens → game.update (chapter.update, helpers, minigame) →
world.update → crew.update → sky.update → fx → camera → hud → terminal → audio → post.render`.
`G.time` is game seconds (scaled by `G.speed`); `G.phase` is the sky clock 0..1.

### The look

The target is Ishu's film: anime background art with cel-shaded props. What carries it:

- **Two-tone cel shading.** Everything built with `toon()` (or `MeshToonMaterial` + `gradTex`)
  gets a two-step ramp with a soft terminator: faces turned from the key keep 75% of it, cast
  shadows lose all of it and fall to the cool sky fill. The shadow side sees a more saturated
  albedo, so shadows deepen in hue (orange → red-orange, mint → blue) instead of greying.
  Pick base colors as the *lit* color you want; don't pre-darken.
- **The key light comes from the sun** (or the moon), lifted so the counter never drops into
  shade. The scene is backlit in the afternoon, like the film. Light levels live in `CEL` in
  sky.js; the per-phase colors stay in the presets.
- **Ink.** `ink.js` draws colored line art on silhouettes and creases: a deeper shade of the
  surface it outlines, fading out past ~26–60 units. It skips transparent / no-depth-write /
  alpha-tested materials, ShaderMaterials, lines, points, sprites, and anything with
  `userData.noInk` on the object or its material. Set `noInk` on things that shouldn't get a
  line (soft fx, painted cards). `?noink` turns the pass off for comparison.
- **Paint, not flat color.** Big surfaces get a greyscale `canvasTex` that modulates the
  material color (plank grain, leaf veins, lantern ribs). Keep detail painterly and low-contrast;
  the ink and the cel shadows do the drawing.
- **Komorebi.** An unseen leaf canopy (sky.js) sits between the sun and the right end of the
  counter and sways with `world.wind`, so dappled shadows drift over it.

## Chapter contract

A chapter is a default-exported object. Only `id, day, title, jp, setup, ending` are required.

```js
export default {
  id: 'takoyaki', day: 2, title: 'Takoyaki', jp: 'たこ焼き', short: 'たこ焼き',
  weather: 'くもり のち ゆうだち',            // diary weather line (hiragana)
  blurb: 'one-line description for the diary',
  jpPreview: 'きょうは たこやきを やく。',      // diary placeholder line before it's played
  prompt: 'make takoyaki for the neighbors',   // typed into the terminal in the intro
  goal: 'make takoyaki for the neighbors',     // todo panel header
  sky: 'shower', mood: 'day',                  // sky preset, starting music mood
  dayLen: 180, phase: [0, 1],                  // seconds of play to go from phase[0] to phase[1]; Infinity = no clock
  autoNight: true,                             // finish({complete:false, night:true}) when phase reaches phase[1]
  clock: [17*60, 19*60+45], clockNote: '🌧 shower around 6',
  delegation: true,                            // false hides helper cards, disables selecting
  helpers: [ {spec:['toppings','plate'], specName:'toppings'}, {...}, {...} ],  // per-helper role tonight
  helperCount: 3,
  intro: [['$ git pull'], ['  Already up to date.', '#7bd88f'], ...],  // lines before the prompt
  introShots: [{ pos:[x,y,z], look:[x,y,z], fov, dur, to:{pos,look} }, ...], // optional cinematic opener
  introRun: async (game) => {},                // optional: replace the whole default intro

  setup(root, game) {},          // build props into root; reset your module state (it persists between plays!)
  stations: () => ({             // evaluated after setup
    pan: { name:'takoyaki pan', spot: 1.2, job:'pan',          // spot: number or () => number
           hit:[w,h,d, x,y,z] /* or hitObj: () => mesh */, ring:[x, z, scale] /* or () => [...] */,
           tip: () => 'takoyaki pan · 6/16 cooking', keywords:['pan','turn','flip'] },
  }),
  jobs: { pan: { label:'turn the balls', done: () => bool, plan(h, sp) {...}, release(h) {}, canAssign(h) {} } },
  interact(key, game) {},        // Clawd walked to a station and wants to work it (open a minigame here)
  redirect: key => key,          // optional: map a clicked station to another
  highlight: () => ['pan'],      // optional: station keys whose rings pulse right now (suggest the next step)
  ready: () => bool,             // optional: "can serve" (for /skip and hints)
  todo: () => [{ label, done, detail /* html */, workers:[str], blocked }],
  hint: () => 'contextual hint line',
  start(game) {},                // called when play begins
  update(dt, game) {},           // every frame in every mode (intro/play/ending): animate props here
  pointer(type, e, ray) {},      // optional: 'move'|'down'|'up' with a THREE.Raycaster; return true to consume
  key(e, upOrDown) {},           // optional: return true to consume
  async ending(result, game) {}, // the evening's finale cutscene; call game.snap() at the photo moment
  diary(result, stats) { return { jp: 'ひらがなの ぶん。', lines: ['English lines', ...] } },
  teardown(game) {},
  commands: { 'cat recipe.md': () => [...] },  // extra terminal commands while this chapter runs
  ls: () => [...], review: () => '...',
};
```

**Finishing:** call `game.finish({ complete: true, perfect?: bool, stamp?: 'perfect'|'good'|'tried' })`
when the player serves (usually from `interact` on the serve station). Night calls
`finish({ complete:false, night:true })` automatically. Then `ending(result, game)` runs
(HUD hidden, helpers unassigned); when it resolves the runner saves the photo + `diary()` and
shows the diary page. Always handle `result.quit` (the player ended the evening early) with
a short ending.

### Sketch evenings (`?proto=<id>`)

A sketch is a chapter at `src/chapters/proto/<id>.js` with `proto: true`, loaded only by
`?proto=<id>`. It isn't part of the week: its ending shows a diary page (`diary.showSketch`)
and nothing is saved. Extra fields: `sketch: ['lines for the left page']` and
`bounds: [x0, x1]`, how far anyone can walk (default the counter, `[-9.8, 9.8]`). On a set
wider than 20 the play camera follows Clawd and the key light's shadow map follows the camera.
An evening somewhere other than the balcony calls
`game.setScene({ balcony: false, backdrop: false, canopy: false })` in `setup` and uses
`introRun`, since there's no laptop; teardown puts the balcony back.

### Jobs (helper AI)

A helper assigned to a job calls `plan(h, sp)` every frame until `done()`. `sp` is its speed
multiplier (2 for a specialist, ×1.5 under `/effort max`). Return:

- `{ x, start() }`: walk to x, then `start()` returns an **action** or `null` (try again next frame).
- `{ x, wait: 'status text', quiet? }`: walk to x and wait (shown on its card, and once in a bubble unless `quiet`).
- `null`: nothing to do.

An action is `{ kind, verb, anim?, face?, lock?, step(dt) → true when finished, cancel?() }`.
Use `lock('pan', h)` in `start()` for single-worker stations and put `lock: 'pan'` on the
action so it's released automatically. `anim` is one of the crab work animations: `crank,
chop, pour, pick, eat, stir, wave, hold, write, cheer`. `release(h)` runs when a helper leaves
the job (reassigned, done, evening over): give back anything it was carrying. Call
`credit(who)` when a unit of work completes; it drives the diary and stats.

### The player at a station

`interact(key, game)` usually opens a minigame through `game.work(lockKey, () => mini.xxx({...}))`.
That takes the lock, sets Clawd's working state, and releases both when the panel closes.
Minigames: `mini.dial` (crank in circles), `mini.timing` (tap in the zone, N cuts),
`mini.pour` (hold and release in a band), `mini.hold` (hold to fill), `mini.custom({html, setup, update, act, actUp})`.
Space maps to `act()`/`actUp()`. Set `clawd.workAnim` while the player works. Push
`G.stats.quality` (0..1) for skill moments; they feed the diary.

For things you click *in the world* (individual takoyaki balls, noodle bundles), implement
`pointer(type, e, ray)`: raycast your own meshes, `return true` to consume the event.

### Useful game API (passed as `game`)

`game.finish(result)`, `game.snap()` (photo on next frame, returns a promise),
`game.gather([[crab, x, z], ...], {face, timeout})` (walk the crew somewhere; resolves on
arrival), `game.work(key, openFn)`, `game.playerGo(stationKey)`, `game.select(h)`,
`game.assign(h, stationKey)`, `game.firework(opts)`, `game.sparkle(x,y,z,n,color)`,
`game.puff(x,y,z,n)`, `game.trainPass()`, `game.clockText(phase)`, `game.root`.
Also import directly: `cam` (camera shots), `term` (`term.log(text, color)`), `audio`,
`hud.toast(html)`, `sky`, `world`, `clawd`, `helpers`, `crew`, `tween`, `sleep`, `until`.

### Crab API

`c.say(text, dur)`, `c.mood('happy'|'wow'|'focus'|'sad'|'wink'|'love'|'sleep', dur)`,
`c.hop(dur)`, `c.targetX = x` (walks), `c.faceOverride = radians` (0 faces camera, π faces the
city), `c.workAnim = 'crank'|...`, `c.lookAt(V3|null)`, `c.blush = 1`, `c.squash = 1`,
`c.setCarry(bool)` (ice block on head), `c.hand` (a group in the right claw: add props),
`c.headSlot` (a group on top of the head), `c.spoon.visible`, `c.sit`/`c.sitTarget` (0..1).

## Working rules (for every contributor, human or agent)

- **Own your files.** Edit only the files your brief assigns. If you need something from core,
  write it to `notes/requests-<your-area>.md` (what, why, the API you'd want) and work around it
  locally. The integrator merges.
- **Made in code.** No binary assets, no new CDNs. Canvas textures and procedural geometry.
- **Every chapter must stay playable on a phone** (portrait, touch). Big tap targets, no hover-only affordances.
- **Comments describe the code**, not its history. Default to none; one or two lines for a non-obvious constraint.
- **Verify by playing.** Run your own server port and your own `agent-browser --session <name>`.
  Dev params: `?day=N` jumps straight into a chapter, `&skip` skips the intro, `&speed=4` fast-forwards,
  `&phase=0.7` pins the sky clock, `&all` unlocks every day, `&nosave` keeps progress out of storage.
  `window.__game`, `window.__G` are exposed; `await import('/src/core/crab.js')` gives you the crew.
  Check `agent-browser errors` / `console` after every change; zero errors is the bar.
- **Performance:** keep draw calls modest (merge or instance repeated props), reuse geometries and
  materials, no per-frame allocations in hot loops. It should hold 60fps on a laptop and be smooth on a phone.
