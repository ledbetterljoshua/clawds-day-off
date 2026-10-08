// Shared, mutable game state. Chapter-specific state lives in each chapter module.
export const G = {
  mode: 'title',      // title | diary | intro | play | ending
  time: 0,            // seconds since boot, scaled by speed
  t: 0,               // seconds of play in the current chapter
  phase: 0,           // sky clock: 0 = afternoon, 1 = full night
  speed: 1,           // time scale (debug, /effort)
  chapter: null,      // active chapter definition
  stations: {},       // active chapter's stations
  selected: null,     // helper awaiting a delegation click
  locks: {},          // station key -> crab currently working it
  mini: null,         // open minigame controller
  effort: 0,          // seconds left on the /effort max buff
  flash: 0, flashCol: null,
  stats: null,
  dev: new URLSearchParams(location.search),
};

export function resetStats() {
  G.stats = { you: 0, helpers: 0, deleg: 0, tasksYou: 0, tasksHelpers: 0, quality: [], byHelper: [0, 0, 0, 0, 0] };
}
resetStats();

// tiny event bus so core modules can talk without importing each other
const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export const on = (type, fn) => bus.addEventListener(type, e => fn(e.detail));
