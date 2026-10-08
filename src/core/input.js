// Pointer + keyboard. Raycasts against the crew and the active chapter's hit boxes, then hands
// the result to the game. Chapters can take over with def.pointer(type, e, ray) / def.key(e).
import { THREE, camera } from './gfx.js';
import { G } from './state.js';
import { $ } from './util.js';
import { crew } from './crab.js';
import { term } from './terminal.js';

export const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
export const held = {};
export const pointer = { x: -1, y: -1, over: null };
const lane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -.5), hitPt = new THREE.Vector3();
let H = null, downAt = null, hits = [];

export function setHits(list) { hits = list; }
export function initInput(handlers) { H = handlers; }

function setRay(e) { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); }
function crewMeshes() { const a = []; crew.forEach(c => { if (!c.g.visible) return; c.g.traverse(o => { if (o.isMesh && o !== c.sel && o.visible) a.push(o); }); }); return a; }
export function pick(e) {
  setRay(e);
  const c = ray.intersectObjects(crewMeshes(), false)[0];
  const s = ray.intersectObjects(hits.filter(h => h.visible !== false), false)[0];
  // a station in front of a crab wins only if it's clearly closer
  if (c && (!s || c.distance < s.distance + .3)) return { crab: c.object.userData.crab };
  if (s) return { station: s.object.userData.station };
  return null;
}

const canvas = $('#c');
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  setRay(e); G.cursor = ray.ray.intersectPlane(lane, hitPt) ? hitPt : null;
  if (!H) return;
  if (G.chapter?.pointer) { setRay(e); if (G.chapter.pointer('move', e, ray) === true) return; }
  H.hover(G.mode === 'play' ? pick(e) : null, e);
});
canvas.addEventListener('pointerdown', e => {
  downAt = [e.clientX, e.clientY, performance.now()];
  if (G.chapter?.pointer && (G.mode === 'play' || G.mode === 'ending')) { setRay(e); if (G.chapter.pointer('down', e, ray) === true) { downAt = null; return; } }
});
canvas.addEventListener('pointerup', e => {
  if (G.chapter?.pointer && (G.mode === 'play' || G.mode === 'ending')) { setRay(e); if (G.chapter.pointer('up', e, ray) === true) { downAt = null; return; } }
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 10) { downAt = null; return; }
  downAt = null;
  if (!H) return;
  if (G.mode === 'intro') { H.introTap(); return; }
  if (G.mode !== 'play') return;
  H.click(pick(e), e);
});
canvas.addEventListener('pointerleave', () => { G.cursor = null; H && H.hover(null); });

addEventListener('keydown', e => {
  if (term.isOpen) return;
  const k = e.key.toLowerCase();
  held[k] = true;
  if (G.chapter?.key && G.chapter.key(e, 'down') === true) return;
  H && H.key(e);
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  held[k] = false;
  if (term.isOpen) return;
  if (G.chapter?.key && G.chapter.key(e, 'up') === true) return;
  if (e.code === 'Space') { if (G.mini?.actUp) G.mini.actUp(); H && H.keyup && H.keyup(e); }
});
addEventListener('blur', () => { for (const k in held) held[k] = false; });
