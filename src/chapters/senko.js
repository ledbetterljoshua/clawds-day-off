// Day 5 — Senkō hanabi (線香花火). Placeholder until the chapter is built; see DESIGN.md.
export default {
  id: 'senko', day: 5, title: 'Senkō hanabi', jp: '線香花火', short: '花火', weather: 'はれ · つき',
  blurb: 'The last sparklers of summer. Keep your claw very still.',
  jpPreview: 'きょうは せんこうはなび。',
  prompt: 'one last sparkler each', goal: 'one last sparkler each',
  sky: 'moon', mood: 'day', dayLen: 40, phase: [.3, 1],
  setup(root, game) {},
  stations: {},
  todo: () => [{ label: 'this evening is still being built', done: false }],
  hint: () => 'this chapter is under construction — the sun will set on its own',
  async ending(result, game) { await game.gather([]); },
  diary: () => ({ jp: 'きょうは せんこうはなび。', lines: ['(this page is still being written)'] }),
};
