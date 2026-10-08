import { G } from './core/state.js';
import { resize, renderer } from './core/gfx.js';
import { world } from './core/world.js';
import { sky } from './core/sky.js';
import { updateTweens } from './core/tween.js';
import { crew } from './core/crab.js';
import { updateFx } from './core/fx.js';
import { cam } from './core/camera.js';
import { hud } from './core/hud.js';
import { term } from './core/terminal.js';
import { audio } from './core/audio.js';
import { post } from './core/post.js';
import { game } from './game.js';
import { $ } from './core/util.js';

resize();
post.init();

let last = performance.now();
function frame(now) {
  const real = Math.min(.05, (now - last) / 1000); last = now;
  const dt = G.paused ? 0 : real * G.speed;
  G.time += dt;
  updateTweens(dt);
  game.update(dt);
  world.update(dt);
  crew.forEach(c => c.update(dt));
  sky.update(dt, G.phase);
  updateFx(dt);
  cam.update(real);
  hud.update(dt);
  term.update(real);
  audio.update(dt);
  post.render();
  game.afterRender();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
game.boot();
$('#boot')?.remove();

// handy in the console
window.__game = game; window.__G = G;
