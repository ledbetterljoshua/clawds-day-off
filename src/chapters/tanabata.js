// Day 4 — Tanabata (七夕). Placeholder until the chapter is built; see DESIGN.md.
export default {
  id: 'tanabata', day: 4, title: 'Tanabata', jp: '七夕', short: '七夕', weather: 'はれ · ほしぞら',
  blurb: 'Paper decorations, wishes on the bamboo, and two stars that meet once a year.',
  jpPreview: 'きょうは たなばた。ねがいごとを かく。',
  prompt: 'hang wishes on the bamboo', goal: 'hang wishes on the bamboo',
  sky: 'starry', mood: 'day', dayLen: 40, phase: [.3, 1],
  setup(root, game) {},
  stations: {},
  todo: () => [{ label: 'this evening is still being built', done: false }],
  hint: () => 'this chapter is under construction — the sun will set on its own',
  async ending(result, game) { await game.gather([]); },
  diary: () => ({ jp: 'きょうは たなばた。ねがいごとを かく。', lines: ['(this page is still being written)'] }),
};
