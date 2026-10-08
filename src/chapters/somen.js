// Day 3 — Nagashi-sōmen (流しそうめん). Placeholder until the chapter is built; see DESIGN.md.
export default {
  id: 'somen', day: 3, title: 'Nagashi-sōmen', jp: '流しそうめん', short: 'そうめん', weather: 'はれ · とても あつい',
  blurb: 'Build a bamboo noodle slide, then catch dinner as it flows past.',
  jpPreview: 'きょうは ながしそうめんを する。',
  prompt: 'build a noodle slide', goal: 'build a noodle slide',
  sky: 'hot', mood: 'day', dayLen: 40, phase: [.3, 1],
  setup(root, game) {},
  stations: {},
  todo: () => [{ label: 'this evening is still being built', done: false }],
  hint: () => 'this chapter is under construction — the sun will set on its own',
  async ending(result, game) { await game.gather([]); },
  diary: () => ({ jp: 'きょうは ながしそうめんを する。', lines: ['(this page is still being written)'] }),
};
