// hands-on player bot for testing day 2 (paste via agent-browser eval). No delegation.
(async () => {
  const gfx = await import('/src/core/gfx.js');
  const crab = await import('/src/core/crab.js');
  const c = __G.chapter, S = () => c.debug(), g = __game, cv = document.querySelector('#c');
  const L = window.__L = []; const log = s => L.push(__G.phase.toFixed(2) + ' ' + s);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const until = async (f, ms = 20000) => { const t0 = performance.now(); while (!f()) { if (performance.now() - t0 > ms) return false; await wait(60); } return true; };
  const click = (x, y) => { const o = { clientX: x, clientY: y, bubbles: true, pointerId: 1, pointerType: 'mouse' }; cv.dispatchEvent(new PointerEvent('pointermove', o)); cv.dispatchEvent(new PointerEvent('pointerdown', o)); cv.dispatchEvent(new PointerEvent('pointerup', o)); };
  const clickBall = b => { const p = gfx.toScreen(b.cx, .42, b.cz); click(p.x, p.y); };
  const go = async k => { g.playerGo(k); await until(() => crab.clawd.arrived() && !crab.clawd.pending, 8000); await wait(150); };
  const holdMini = async (ms) => { await until(() => __G.mini, 3000); __G.mini.act(); await wait(ms); __G.mini && __G.mini.actUp(); };
  // 1 whisk
  await go('batter'); await until(() => __G.mini, 2000);
  while (!S().mixed) { __G.mini?.act(); await wait(25); }
  log('mixed');
  // 2 pour
  await go('pan'); await until(() => __G.mini?.kind === 'pour', 3000);
  __G.mini.act(); await until(() => S().pourProg >= 1, 4000); await wait(220); __G.mini?.actUp();
  await until(() => S().poured, 3000); log('poured q=' + S().pourQ);
  // 3 octopus in every cup
  for (const b of S().balls) { if (!b.tako) { clickBall(b); await wait(90); } }
  log('tako ' + S().balls.filter(b => b.tako).length);
  // 4 toppings
  await go('tako'); await holdMini(1700); await until(() => S().toppings >= 1, 3000); log('toppings');
  await go('pan');
  // 5 turn, cover the pan when it rains, plate as they finish
  let t0 = performance.now();
  while (!(S().plated >= 16)) {
    if (__G.mode !== 'play') { log('mode ' + __G.mode); return; }
    const s = S();
    if (s.wet && s.umbrella !== 'open') { await go('parasol'); await holdMini(1500); log('umbrella'); await go('pan'); continue; }
    const due = s.balls.filter(b => b.batter && b.turns < 2 && !b.plated && c.debugDownB(b) >= .72).sort((a, b) => c.debugDownB(b) - c.debugDownB(a));
    if (due.length) { if (Math.abs(crab.clawd.x - 2.45) > .3) await go('pan'); clickBall(due[0]); await wait(110); continue; }
    if (s.balls.some(b => b.done && !b.plated) && s.balls.filter(b => b.turns < 2).length === 0) { await go('plate'); await wait(2400); continue; }
    await wait(120);
    if (performance.now() - t0 > 240000) { log('timeout'); return; }
  }
  log('plated; perfect=' + S().perfect + ' crispy=' + S().crispy + ' noTako=' + S().noTako);
  // 6 dress: sauce, mayo, aonori, katsuobushi
  await go('plate'); await until(() => __G.mini?.kind === 'pour', 3000); __G.mini.act(); await until(() => S().sauceAmt >= .98, 4000); await wait(150); __G.mini?.actUp(); await until(() => S().dressStep >= 1, 3000); log('sauce');
  await go('plate'); await until(() => __G.mini?.kind === 'mayo', 3000); __G.mini.act(); await until(() => S().dressStep >= 2, 3000); log('mayo');
  await go('plate'); await holdMini(1400); await until(() => S().dressStep >= 3, 3000); log('aonori');
  await go('plate'); await holdMini(1500); await until(() => S().dressStep >= 4, 3000); log('katsuo');
  // 7 basket, then eat
  await go('basket'); await until(() => S().basket === 'returned', 30000); log('basket back');
  await go('plate'); log('served'); 
})();
