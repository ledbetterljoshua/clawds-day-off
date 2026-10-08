# Clawd's Day Off

A playable fan game of **[“Claude's day off 🏝️”](https://x.com/ishuagra02/status/2107488996490166538)**,
the short film by **Ishu Agrawal ([@ishuagra02](https://x.com/ishuagra02))**, animated by Opus 5.5
(end card: *Clawd's Kakigōri — a summer evening, made in code*). All the charm is theirs; this is fan work.

Clawd finishes work, types a prompt, spawns three helpers, and spends five summer evenings on a
balcony: kakigōri, takoyaki, nagashi-sōmen, tanabata, and a last senkō hanabi. Every evening you can
do each job yourself (a small hands-on minigame) or delegate it: click a helper, then a station, and
it works that job until it's done. The week is kept as a なつやすみ えにっき, a summer picture diary.

## Run it

```
python3 tools/serve.py 4388     # no-cache static server
open http://localhost:4388/
```

No build step: ES modules + three.js r160 from jsDelivr. Everything else is made in code.

**The week:**

| | evening | the twist |
|---|---|---|
| Mon | かき氷 kakigōri | the film's evening; one shaver is the bottleneck; a firework shaped like Clawd |
| Tue | たこ焼き takoyaki | sixteen balls cooking at once, a sudden 夕立 shower, a basket to the neighbors on 3F |
| Wed | 流しそうめん nagashi-sōmen | build a bamboo noodle slide, then catch dinner; the one pink noodle; fireflies |
| Thu | 七夕 tanabata | fold paper decorations, write your own wish, the Milky Way and the magpie bridge |
| Fri | 線香花火 senkō hanabi | no jobs; three sparklers; hold still; credits |

Also: a picture diary with a photo and a stamp per evening, your own polaroids (P), 19 stickers (シール),
an interactive terminal on the laptop, helpers who remember the week, generative music and cicadas,
painted skies with rain, rainbows, fireflies and the Milky Way.

**Controls:** click a station to go work it · click a helper (or its card, or 1–3), then a station,
to delegate · A/D walk · E interact · Space minigames · `/` opens the terminal (try `/help`,
`h3 shave ice`, `/effort max`, `sl`, `hanabi`, `crabsay`) · M mute · Esc cancel.

**Dev params:** `?day=N` jump to a day · `&skip` skip the intro · `&speed=4` · `&phase=0.7` pin the
sky clock · `&all` unlock every day · `&nosave` don't write progress.

See [DESIGN.md](DESIGN.md) for the vision, the week, and the chapter contract. `tools/audio-lab.html`
auditions every sound and music mood; `tools/build-artifact.py` prepares a claude.ai Artifact build.
`legacy/v1.html` is the original single-file prototype.

## Credits

- Original film and every idea worth having here: **Ishu Agrawal**,
  [@ishuagra02](https://x.com/ishuagra02), [“Claude's day off”](https://x.com/ishuagra02/status/2107488996490166538)
- Game: Joshua Ledbetter, built with Claude
- Unofficial fan project. Clawd is Anthropic's Claude Code mascot; not affiliated with or endorsed by Anthropic.
