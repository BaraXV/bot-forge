import { callGemini, settings } from './gemini.js';
import { DEVELOPED_SCHEMA, buildDevelopPrompt } from './prompts.js';
import { store, saveIdeaBatch } from './storage.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const DEV_FIELDS = [
  ['title', 'Title'], ['tagline', 'Tagline'], ['description', 'Description', true],
  ['personality', 'Personality'], ['scenario', 'Scenario'],
  ['first_message', 'First message', true], ['example_dialogue', 'Example dialogue', true],
  ['hook_delivery', 'Hook delivery (self-check)'], ['anchor_mechanics', 'Anchor mechanics (self-check)'],
  ['creator_notes', 'Creator notes'],
];

function coerce(v, depth = 0) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(x => coerce(x, depth + 1)).filter(Boolean).join(depth ? '; ' : '\n');
  if (typeof v === 'object')
    return Object.entries(v).map(([k, x]) => { const t = coerce(x, depth + 1); return t ? `${k}: ${t}` : ''; }).filter(Boolean).join('\n');
  return '';
}

export function coerceDevelopment(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const [f] of DEV_FIELDS) out[f] = coerce(src[f]);
  out.tags = (Array.isArray(src.tags) ? src.tags : src.tags != null ? [src.tags] : []).map(t => coerce(t)).filter(Boolean);
  out.alt_greetings = (Array.isArray(src.alt_greetings) ? src.alt_greetings : []).map(g => coerce(g)).filter(Boolean);
  return out;
}

export function devToMd(d) {
  const L = [`# ${d.title || ''}`, ''];
  if (d.tagline) L.push(`*${d.tagline}*`, '');
  const f = (label, v) => { if (v) L.push(`## ${label}`, '', v, ''); };
  f('Description', d.description); f('Personality', d.personality); f('Scenario', d.scenario);
  f('First message', d.first_message);
  if (d.alt_greetings?.length) f('Alt greetings', d.alt_greetings.map((g, i) => `**Alternate ${i + 1}**\n\n${g}`).join('\n\n'));
  f('Example dialogue', d.example_dialogue);
  if (d.tags?.length) L.push(`**Tags:** ${d.tags.join(', ')}`, '');
  f('Creator notes', d.creator_notes);
  return L.join('\n');
}

export function errText(e) {
  switch (e.type) {
    case 'NO_KEY': return 'No API key — set it in Settings first.';
    case 'BUDGET': return `Daily budget for "${e.model}" reached — raise it in Settings if your real quota allows.`;
    case 'RATE_LIMIT': return e.daily
      ? `Daily free-tier cap on "${e.model}" — resets at midnight Pacific. ${e.apiMessage || ''}`
      : `Rate limit on "${e.model}" — wait ${e.retryAfter ? Math.round(e.retryAfter) + 's' : 'a moment'}.`;
    case 'SAFETY_BLOCK': return `Gemini safety-blocked this (${e.stage} stage). The request was spent.`;
    case 'JSON_PARSE': return `Model returned malformed JSON: ${(e.rawPreview || '').slice(0, 150)}…`;
    default: return `${e.type || 'Error'}: ${e.apiMessage || e.detail || 'failed'}`;
  }
}

function validateDevelopment(d) {
  const flags = [];
  if (!d.first_message || d.first_message.length < 600) flags.push(`first message thin (${d.first_message?.length || 0} chars — target 1500+)`);
  if (!d.description || d.description.length < 500) flags.push(`description thin (${d.description?.length || 0} chars — target 1300+)`);
  if (!d.hook_delivery) flags.push('hook_delivery missing — the model could not justify its own first message');
  if (!d.anchor_mechanics) flags.push('anchor_mechanics missing');
  return flags;
}

function exportCardV2(d) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({
    spec: 'chara_card_v2', spec_version: '2.0',
    data: {
      name: d.title, description: d.description, personality: d.personality,
      scenario: d.scenario, first_mes: d.first_message, mes_example: d.example_dialogue || '',
      creator_notes: d.creator_notes || '', alternate_greetings: d.alt_greetings || [],
      tags: d.tags || [], creator: 'Bot Forge', character_version: '1.0',
    },
  }, null, 2)], { type: 'application/json' }));
  a.download = `${(d.title || 'bot').replace(/[^\w-]+/g, '_')}-card.json`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

export function renderDevArea(area, batchId, i) {
  const batch = store.get('idea:' + batchId);
  const idea = batch?.ideas?.[i];
  if (!idea?.dev?.draft) { area.innerHTML = ''; return; }
  const d = idea.dev.draft;
  const fl = idea.dev.flags || [];
  const ta = ([f, label, tall]) => `<label style="font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:.04em;display:block;margin:10px 0 3px;font-weight:700">${label}</label>
    <textarea data-f="${f}" style="min-height:${tall ? 150 : 64}px">${esc(d[f] || '')}</textarea>`;
  area.innerHTML = `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-top:10px">
    <h5 style="margin:0;font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:.05em">Full bot draft ${fl.length ? `— ⚠ ${fl.length} flag${fl.length > 1 ? 's' : ''}` : '— ✓ clean'}</h5>
    ${fl.length ? `<div style="font-size:11px;color:var(--muted);margin:4px 0">${fl.map(esc).join(' · ')}</div>` : ''}
    ${d.tags?.length ? `<div style="margin:6px 0">${d.tags.map(t => `<span style="font-size:11px;border:1px solid var(--border);color:var(--accent2);border-radius:99px;padding:2px 9px;margin-right:4px">${esc(t)}</span>`).join('')}</div>` : ''}
    ${DEV_FIELDS.map(ta).join('')}
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center">
      <input type="text" data-refine-input placeholder="refine: e.g. 'first message shorter, more dialogue'" style="flex:1;min-width:180px">
      <button class="btn" data-refine style="padding:7px 12px;font-size:12px">↻ Refine (1 req)</button>
      <button class="btn secondary" data-card style="padding:7px 12px;font-size:12px">⬇ V2 card</button>
      <button class="btn secondary" data-copy style="padding:7px 12px;font-size:12px">⧉ Copy</button>
    </div>
    <div class="status devStatus"></div>
  </div>`;

  area.querySelectorAll('textarea[data-f]').forEach(t => {
    t.onblur = () => {
      const b = store.get('idea:' + batchId);
      if (!b?.ideas?.[i]?.dev?.draft) return;
      b.ideas[i].dev.draft[t.dataset.f] = t.value;   // edits auto-save
      saveIdeaBatch(b);
    };
  });
  const status = area.querySelector('.devStatus');
  area.querySelector('[data-refine]').onclick = () => {
    const fb = area.querySelector('[data-refine-input]').value.trim();
    if (!fb) { status.className = 'status error'; status.textContent = 'Type refine feedback first — nothing was sent.'; return; }
    developIdea(batchId, i, { refine: true, feedback: fb });
  };
  area.querySelector('[data-card]').onclick = () => {
    const b = store.get('idea:' + batchId);
    if (b?.ideas?.[i]?.dev?.draft) exportCardV2(b.ideas[i].dev.draft);
  };
  area.querySelector('[data-copy]').onclick = async (ev) => {
    const b = store.get('idea:' + batchId);
    try { await navigator.clipboard.writeText(devToMd(b.ideas[i].dev.draft)); ev.target.textContent = '✓ copied'; }
    catch { ev.target.textContent = '✗ failed'; }
    setTimeout(() => (ev.target.textContent = '⧉ Copy'), 1500);
  };
}

export async function developIdea(batchId, i, { refine = false, feedback = '' } = {}) {
  const area = document.querySelector(`[data-devarea="${batchId}:${i}"]`);
  if (!area) return;
  const batch = store.get('idea:' + batchId);
  const idea = batch?.ideas?.[i];
  if (!idea) return;
  let status = area.querySelector('.devStatus');
  if (!status) { area.innerHTML = '<div class="status devStatus"></div>'; status = area.querySelector('.devStatus'); }

  status.className = 'status';
  status.textContent = `${refine ? 'Refining' : 'Developing'} "${idea.title}" on ${settings.genModel} — 1 request…`;
  try {
    const raw = await callGemini(
      buildDevelopPrompt(idea, { feedback: refine ? feedback : '', currentDraft: refine ? idea.dev?.draft : null }),
      DEVELOPED_SCHEMA, settings.genModel);
    const draft = coerceDevelopment(raw);
    const flags = validateDevelopment(draft);
    const fresh = store.get('idea:' + batchId);   // reload — user may have edited meanwhile
    const log = refine ? [...(fresh.ideas[i].dev?.log || []), { feedback, at: Date.now() }] : (fresh.ideas[i].dev?.log || []);
    fresh.ideas[i].dev = { draft, flags, log, updatedAt: Date.now() };
    saveIdeaBatch(fresh);
    renderDevArea(area, batchId, i);
    const st = area.querySelector('.devStatus');
    st.className = 'status ok';
    st.textContent = flags.length
      ? `Done ✓ (1 request) — ${flags.length} flag${flags.length > 1 ? 's' : ''} to review above.`
      : 'Done ✓ (1 request) — draft passed all checks.';
  } catch (e) {
    status.className = 'status error';
    status.textContent = errText(e);
  }
}