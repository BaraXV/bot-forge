const PREFIX = 'bia_';

export const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(PREFIX + key); return v != null ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(PREFIX + key, JSON.stringify(value)); },
  remove(key) { localStorage.removeItem(PREFIX + key); },
  keys() { return Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).map(k => k.slice(PREFIX.length)); },
};

export const getAllAnalyses = () => store.keys()
  .filter(k => k.startsWith('analysis:'))
  .map(k => store.get(k)).filter(Boolean);

export const getAllIdeas = () => store.keys()
  .filter(k => k.startsWith('idea:'))
  .map(k => store.get(k)).filter(Boolean)
  .sort((a, b) => b.createdAt - a.createdAt);

export const saveIdeaBatch = (b) => store.set('idea:' + b.id, b);