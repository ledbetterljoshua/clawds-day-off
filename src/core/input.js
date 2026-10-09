// Pointer + keyboard. Raycasts against the crew and the active chapter's hit boxes, then hands
// the result to the game. Chapters can take over with def.pointer(type, e, ray) / def.key(e).
import { THREE, camera } from './gfx.js';
import { G } from './state.js';
import { $ } from './util.js';
import { crew, clawd } from './crab.js';
import { term } from './terminal.js';

export const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
export const held = {};
export const pointer = { x: -1, y: -1, over: null };
const lane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -.5), hitPt = new THREE.Vector3();
const walkPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), walkPt = new THREE.Vector3();
let H = null, downAt = null, hits = [];
// A press on empty ground walks Clawd there. Held past HOLD_MS or dragged, it becomes a hold:
// Clawd follows the finger until it lifts.
const HOLD_MS = 180, HOLD_PX = 10;
let hold = null;

export function setHits(list) { hits = list; }
export function initInput(handlers) { H = handlers; }

function setRay(e) { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); }
function crewMeshes() { const a = []; crew.forEach(c => { if (!c.g.visible) return; c.g.traverse(o => { if (o.isMesh && o !== c.sel && o.visible) a.push(o); }); }); return a; }
// the x on Clawd's lane under a screen point
function groundX(p) { setRay(p); walkPlane.constant = -clawd.z; return ray.ray.intersectPlane(walkPlane, walkPt) ? walkPt.x : null; }
function startHold() { if (hold && !hold.on) hold.on = H.walk(groundX(hold.last), 'go'); }
// every frame: a hold keeps aiming at the finger, so holding at the edge of a view that follows
// Clawd keeps him walking
export function holdTick() { if (hold?.on && H) H.walk(groundX(hold.last), 'go'); }

export function pick(e) {
  setRay(e);
  const c = ray.intersectObjects(crewMeshes(), false)[0];
  const s = ray.intersectObjects(hits.filter(h => h.visible !== false), false)[0];
  // a station in front of a crab wins only if it's clearly closer; clawd never hides one (tapping
  // him is only a hop, and on a touch screen there's no hover to show what's behind him)
  const crab = c?.object.userData.crab;
  if (c && (!s || (crab !== clawd && c.distance < s.distance + .3))) return { crab };
  if (s) return { station: s.object.userData.station };
  return null;
}

const canvas = $('#c');
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  if (hold && e.pointerId === hold.id) {
    hold.last = { clientX: e.clientX, clientY: e.clientY };
    const far = downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > HOLD_PX;
    if (far) hold.dragged = true;
    if (hold.on) H.walk(groundX(e), 'go');
    else if (far) startHold();
  }
  setRay(e); G.cursor = ray.ray.intersectPlane(lane, hitPt) ? hitPt : null;
  if (!H) return;
  if (G.chapter?.pointer) { setRay(e); if (G.chapter.pointer('move', e, ray) === true) return; }
  H.hover(G.mode === 'play' ? pick(e) : null, e);
});
canvas.addEventListener('pointerdown', e => {
  downAt = [e.clientX, e.clientY, performance.now()]; hold = null;
  if (G.chapter?.pointer && (G.mode === 'play' || G.mode === 'ending')) { setRay(e); if (G.chapter.pointer('down', e, ray) === true) { downAt = null; return; } }
  if (H && G.mode === 'play' && e.isPrimary && !pick(e)) {
    const h = hold = { id: e.pointerId, on: false, last: { clientX: e.clientX, clientY: e.clientY } };
    setTimeout(() => { if (hold === h && downAt) startHold(); }, HOLD_MS);
  }
});
canvas.addEventListener('pointerup', e => {
  const h = hold; hold = null;
  if (G.chapter?.pointer && (G.mode === 'play' || G.mode === 'ending')) { setRay(e); if (G.chapter.pointer('up', e, ray) === true) { downAt = null; return; } }
  // lifting a drag or a long hold stops Clawd; a slow tap that never moved still walks all the way
  if (h?.on) { if (h.dragged || performance.now() - (downAt?.[2] ?? 0) > 500) H.walk(null, 'stop'); downAt = null; return; }
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 10) { downAt = null; return; }
  downAt = null;
  if (!H) return;
  if (G.mode === 'intro') { H.introTap(); return; }
  if (G.mode !== 'play') return;
  const hit = pick(e);
  H.click(hit, e, hit ? null : groundX(e));
});
canvas.addEventListener('pointercancel', () => { if (hold?.on) H.walk(null, 'stop'); hold = null; downAt = null; });
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
