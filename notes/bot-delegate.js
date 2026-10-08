// delegated bot for day 2: assign helpers, react to the shower, serve. Clawd never works a station.
(async () => {
  const crab = await import('/src/core/crab.js');
  const H = crab.helpers, g = __game, c = __G.chapter, S = () => c.debug();
  const L = window.__L = []; const log = s => L.push(__G.phase.toFixed(2) + ' ' + s);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  g.assign(H[1], 'batter'); g.assign(H[0], 'tako'); g.assign(H[2], 'pan'); log('assigned batter/tako/pan');
  const flags = {};
  while (__G.mode === 'play') {
    const s = S();
    if (!flags.plate && s.toppings >= 1 && s.balls.every(b => b.tako || b.turns)) { g.assign(H[0], 'plate'); flags.plate = 1; log('h1 → plate'); }
    if (!flags.rain && s.rainSeen && s.umbrella !== 'open') { g.assign(H[1], 'parasol'); flags.rain = 1; log('h2 → umbrella (flameOut=' + s.flameOut + ')'); }
    if (!flags.basket && s.dressStep >= 4 && s.basket === 'waiting') { g.assign(H[1], 'basket'); flags.basket = 1; log('h2 → basket'); }
    if (s.basket === 'returned' && s.plated >= 16 && s.dressStep >= 4) { log('serve'); g.playerGo('plate'); break; }
    await wait(200);
  }
  log('flameOuts=' + S().flameOuts + ' perfect=' + S().perfect + ' crispy=' + S().crispy + ' soggy=' + S().soggy.toFixed(1));
})();
