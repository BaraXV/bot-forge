const STOPWORDS = new Set(('the a an and or but with your you their his her its who that this from into for are was were is be been ' +
  'has have had will would could can not no when while they them then there here what which how why because during between ' +
  'against through both each such only own same too very more most some all one two other another make makes made just also ' +
  'than about after before story tale character bot user roleplay rp chat find finds').split(' '));

function stem(w) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s')) return w.slice(0, -1);
  return w;
}

export const contentTokens = (s) =>
  (String(s || '').toLowerCase().match(/[a-z]{3,}/g) || []).filter(w => !STOPWORDS.has(w)).map(stem);
const contentWords = (s) => new Set(contentTokens(s));

export function similarity(a, b) {
  const ta = contentTokens(a), tb = contentTokens(b);
  const A = new Set(ta), B = new Set(tb);
  if (!A.size || !B.size) return { j: 0, shared: 0, sharedBigrams: 0 };
  let shared = 0; A.forEach(w => { if (B.has(w)) shared++; });
  const j = shared / (A.size + B.size - shared);
  const bg = (arr) => { const o = new Set(); for (let i = 0; i < arr.length - 1; i++) o.add(arr[i] + ' ' + arr[i + 1]); return o; };
  const ba = bg(ta), bb = bg(tb);
  let sb = 0; ba.forEach(g => { if (bb.has(g)) sb++; });
  return { j, shared, sharedBigrams: sb };
}

export const isEcho = (s, t) => (s.j >= t && s.shared >= 3) || s.sharedBigrams >= 2;

export function bestMatchScore(cited, candidates) {
  const C = contentWords(cited);
  if (!C.size || !candidates.length) return 0;
  let best = 0;
  for (const c of candidates) {
    const P = contentWords(c);
    if (!P.size) continue;
    let hits = 0; C.forEach(w => { if (P.has(w)) hits++; });
    best = Math.max(best, hits / C.size);
  }
  return best;
}

export function wordFreq(strings) {
  const f = {};
  strings.forEach(s => contentTokens(s).forEach(w => { f[w] = (f[w] || 0) + 1; }));
  return f;
}
export const topWords = (f, n) => Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);