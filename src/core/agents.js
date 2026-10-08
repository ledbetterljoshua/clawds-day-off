// Helper AI. A chapter defines jobs; a helper assigned to a job asks job.plan(h, sp)
// every frame for its next step until job.done() is true.
//
// plan() returns one of:
//   { x, start() }   walk to x, then call start(); start returns an action or null
//   { x, wait }      walk to x and wait (wait is the status/bubble text)
//   null             nothing to do right now
// An action is { kind, verb, anim?, face?, lock?, step(dt) -> true when finished, cancel?() }.
import { G, emit } from './state.js';
import { helpers, clawd } from './crab.js';
import { term } from './terminal.js';
import { audio } from './audio.js';
import { rand, clamp } from './util.js';

export const isSpec = (h, job) => !!h.spec && h.spec.includes(job);
// specialists work twice as fast; /effort max makes everyone faster for a while
export const speedOf = (h, job) => (isSpec(h, job) ? 2 : 1) * (G.effort > 0 ? 1.5 : 1);

export function jobOf(stationKey) { return G.stations[stationKey]?.job || null; }
export function jobDef(job) { return G.chapter?.jobs?.[job]; }
export function jobDone(job) { const j = jobDef(job); return !j || (j.done ? j.done() : false); }

export function lock(key, who) { if (G.locks[key] && G.locks[key] !== who) return false; G.locks[key] = who; return true; }
export function unlock(key, who) { if (!who || G.locks[key] === who) G.locks[key] = null; }
export const lockedBy = (key, who) => G.locks[key] && G.locks[key] !== who ? G.locks[key] : null;

export function actionDone(h) {
  const a = h.action; h.action = null; h.workAnim = null; h.faceOverride = null;
  if (a && a.lock) unlock(a.lock, h);
}
export function cancelAction(h) {
  const a = h.action; if (!a) return;
  try { a.cancel && a.cancel(); } catch (e) { console.warn(e); }
  actionDone(h);
}
// called when a helper leaves a job for any reason (reassigned, finished, evening over)
export function releaseJob(h) {
  const j = jobDef(h.job);
  try { j && j.release && j.release(h); } catch (e) { console.warn(e); }
}

export function credit(who, n = 1) {
  if (who === clawd) G.stats.tasksYou += n;
  else { G.stats.tasksHelpers += n; G.stats.byHelper[who.i] += n; }
}

export function assign(h, stationKey) {
  const job = jobOf(stationKey);
  if (!job) { h.say(stationKey === 'laptop' ? 'that\'s clawd\'s laptop 👀' : 'nothing to do there'); audio.sfx('deny'); return false; }
  if (jobDone(job)) { h.say('already done ✓'); return false; }
  const J = jobDef(job);
  if (J.canAssign && J.canAssign(h) === false) { h.say(J.refuse || 'can\'t do that one'); audio.sfx('deny'); return false; }
  h.wake();
  cancelAction(h);
  if (h.job && h.job !== job) releaseJob(h);
  h.job = job; G.stats.deleg++;
  const label = J.label || job;
  h.say(`on it ▸ ${label}${isSpec(h, job) ? ' ✦' : ''}`, 2); h.mood('happy', .8); h.hop(.3);
  term.log(`> ${h.name}: ${label}`, '#d97757');
  emit('sticker', 'delegate');
  audio.sfx('pop');
  return true;
}

export function unassign(h) {
  cancelAction(h); releaseJob(h); h.job = null; h.waitMsg = '';
}

export function helperTick(h, dt) {
  if (h.action) {
    G.stats.helpers += dt;
    let fin = false;
    try { fin = h.action.step(dt * (G.effort > 0 ? 1.5 : 1)); } catch (e) { console.error(e); fin = true; }
    if (fin) actionDone(h);
    return;
  }
  h.waitMsg = '';
  if (!h.job) { idleWander(h, dt); return; }
  const J = jobDef(h.job);
  if (!J || jobDone(h.job)) {
    if (J) term.log(`✓ ${h.name} finished: ${J.label || h.job}`, '#7bd88f');
    releaseJob(h);
    h.say('✓ done'); h.mood('happy', 1.6); h.hop(.6); h.job = null; audio.sfx('select');
    return;
  }
  let s = null;
  try { s = J.plan(h, speedOf(h, h.job)); } catch (e) { console.error(e); }
  if (!s) { h.waitMsg = '⋯'; return; }
  if (s.x != null) h.targetX = clamp(s.x, -9.8, 9.8);
  if (s.wait) {
    h.waitMsg = s.wait;
    if (h.arrived() && h.lastSay !== s.wait && h.bubT <= 0) h.say(s.wait, 2);
    return;
  }
  if (h.arrived() && s.start) {
    const a = s.start();
    if (a) {
      h.action = a; h.workAnim = a.anim || null; h.faceOverride = a.face ?? null;
      if (a.verb) h.say(`▸ ${a.verb}`, 1.6);
    }
  }
}

function idleWander(h, dt) {
  if (h.sit > .5 || h.asleep) return;
  h.wanderT = (h.wanderT ?? rand(2, 5)) - dt;
  if (h.wanderT < 0 && h.arrived()) {
    h.wanderT = rand(4, 9);
    h.targetX = clamp(h.x + rand(-1, 1), -9, 9);
    if (Math.random() < .25 && h.voice?.length) h.say(h.voice[Math.floor(Math.random() * h.voice.length)], 2.2);
    else if (Math.random() < .3) h.hop(.4);
  }
}
