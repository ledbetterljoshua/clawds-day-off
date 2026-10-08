// Day 2 — Takoyaki (たこ焼き). Placeholder until the chapter is built; see DESIGN.md.
export default {
  id: 'takoyaki', day: 2, title: 'Takoyaki', jp: 'たこ焼き', short: 'たこ焼き', weather: 'くもり のち ゆうだち',
  blurb: 'Sixteen octopus balls, one hot pan, and a sudden summer shower.',
  jpPreview: 'きょうは たこやきを やく。',
  prompt: 'make takoyaki for the neighbors', goal: 'make takoyaki for the neighbors',
  sky: 'shower', mood: 'day', dayLen: 40, phase: [.3, 1],
  setup(root, game) {},
  stations: {},
  todo: () => [{ label: 'this evening is still being built', done: false }],
  hint: () => 'this chapter is under construction — the sun will set on its own',
  async ending(result, game) { await game.gather([]); },
  diary: () => ({ jp: 'きょうは たこやきを やく。', lines: ['(this page is still being written)'] }),
};
