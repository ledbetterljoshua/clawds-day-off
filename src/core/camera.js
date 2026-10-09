// Camera director: a "play" framing that keeps the whole counter in view (following Clawd
// on narrow screens), plus scripted shots for intros and endings.
import { V3, camera, THREE } from './gfx.js';
import { G } from './state.js';
import { clamp, damp, lerp, reducedMotion } from './util.js';
import { clawd } from './crab.js';
import { until } from './tween.js';

export const cam = {
  mode: 'play',
  pos: new V3(0, 4, 16), look: new V3(0, 1.2, -.3),
  tpos: new V3(), tlook: new V3(), fov: 40, tfov: 40, k: 3,
  drift: 0, shake: 0, followX: null,

  play(k = 3) { cam.mode = 'play'; cam.k = k; cam.tfov = 40; cam.drift = 0; cam._dolly = null; },
  // aim at a shot; cut = jump there instantly
  shot(pos, look, { fov = 40, k = 1.4, cut = false, drift = 0 } = {}) {
    cam.mode = 'shot'; cam._dolly = null; cam.tpos.copy(pos); cam.tlook.copy(look); cam.tfov = fov; cam.k = k; cam.drift = reducedMotion() ? 0 : drift;
    if (cut) { cam.pos.copy(pos); cam.look.copy(look); cam.fov = fov; }
  },
  // play a list of { pos:[x,y,z], look:[x,y,z], fov, dur, cut, k, drift, to:{pos,look} } shots
  async shots(list, skipRef) {
    try { await playShots(list, skipRef); } finally { cam._dolly = null; }
  },
  frame(out = cam) {
    const asp = innerWidth / innerHeight, t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const d = clamp(9.9 / (t * asp), 12, 19), halfW = d * t * asp;
    const fx = cam.followX ?? clawd.x;
    const x = halfW < 9.9 ? clamp(fx, -9.9 + halfW, 9.9 - halfW) : 0;
    out.tpos.set(x, 1.2 + d * .175, d); out.tlook.set(x, 1.2, -.3);
    return out;
  },
  update(dt) {
    if (cam.mode === 'play') cam.frame();
    if (cam._dolly) {
      const D = cam._dolly, e = clamp((G.time - D.t0) / D.dur, 0, 1), s = e * e * (3 - 2 * e);
      cam.tpos.lerpVectors(D.p0, D.p1, s); cam.tlook.lerpVectors(D.l0, D.l1, s);
      cam.pos.copy(cam.tpos); cam.look.copy(cam.tlook);
    }
    const k = damp(cam.k, dt);
    cam.pos.lerp(cam.tpos, k); cam.look.lerp(cam.tlook, k);
    cam.fov = lerp(cam.fov, cam.tfov, k);
    camera.position.copy(cam.pos);
    const on = cam.mode === 'play' && !reducedMotion(), kp = damp(PAR.k, dt);
    par.x = lerp(par.x, on ? par.tx : 0, kp); par.y = lerp(par.y, on ? par.ty : 0, kp);
    camera.position.x += par.x * PAR.x; camera.position.y -= par.y * PAR.y;
    if (cam.drift) { camera.position.x += Math.sin(G.time * .5) * .04 * cam.drift; camera.position.y += Math.sin(G.time * .37) * .03 * cam.drift; }
    if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt * 2); const s = reducedMotion() ? 0 : cam.shake * .08; camera.position.x += (Math.random() - .5) * s; camera.position.y += (Math.random() - .5) * s; }
    camera.lookAt(cam.look);
    if (Math.abs(camera.fov - cam.fov) > .01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  },
};
cam.frame(); cam.pos.copy(cam.tpos); cam.look.copy(cam.tlook);

// mouse parallax: in the play framing the camera leans a little toward the pointer but keeps
// its aim, so the counter (and anything you'd click) stays put while the town behind it slides
// and the railing in front shifts the other way
const PAR = { x: .32, y: .16, k: 2.2 };
const par = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  par.tx = clamp(e.clientX / innerWidth * 2 - 1, -1, 1); par.ty = clamp(e.clientY / innerHeight * 2 - 1, -1, 1);
});
const recenter = () => { par.tx = par.ty = 0; };
document.documentElement.addEventListener('mouseleave', recenter);
addEventListener('blur', recenter);

async function playShots(list, skipRef) {
  for (const s of list) {
    if (skipRef && skipRef.skip) return;
    cam.shot(new V3(...s.pos), new V3(...s.look), { fov: s.fov ?? 40, k: s.k ?? 1.2, cut: s.cut ?? true, drift: s.drift ?? .25 });
    if (s.to) { // dolly toward a second framing during the shot
      const p0 = new V3(...s.pos), p1 = new V3(...s.to.pos), l0 = new V3(...s.look), l1 = new V3(...(s.to.look || s.look));
      cam._dolly = { p0, p1, l0, l1, t0: G.time, dur: s.dur ?? 2.5 };
    }
    s.onStart && s.onStart();
    await until(() => skipRef && skipRef.skip, s.dur ?? 2.5);
  }
}
