// Progress lives in this browser only (localStorage). Every access is guarded: private
// windows and blocked storage must still give a playable game.
const KEY = 'clawds-day-off/v1';
let data = null;

function blank() {
  return { days: {}, helpers: [{ tasks: 0, days: 0 }, { tasks: 0, days: 0 }, { tasks: 0, days: 0 }], wishes: [], settings: {}, seenIntro: false };
}

export const save = {
  load() {
    try { data = JSON.parse(localStorage.getItem(KEY)) || blank(); } catch { data = blank(); }
    data = { ...blank(), ...data };
    return data;
  },
  get data() { return data || save.load(); },
  write() {
    if (new URLSearchParams(location.search).has('nosave')) return true;
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch {
      // quota: drop the oldest photos first, keep the words
      try {
        for (const k of Object.keys(data.days)) { if (data.days[k].photo) { data.days[k].photo = null; localStorage.setItem(KEY, JSON.stringify(data)); return true; } }
      } catch {}
      return false;
    }
  },
  day(id) { return save.data.days[id] || null; },
  setDay(id, entry) { save.data.days[id] = { ...(save.data.days[id] || {}), ...entry }; save.write(); },
  setting(k, v) { if (v === undefined) return save.data.settings[k]; save.data.settings[k] = v; save.write(); },
  reset() { data = blank(); save.write(); },
};
