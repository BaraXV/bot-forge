import { callGemini, settings, budgetLabel } from '../gemini.js';
import { IDEA_SCHEMA, buildPremiseForgePrompt, buildEvolvePrompt, buildVariationsPrompt,
  coerceIdeas, recentIdeaContexts } from '../prompts.js';
import { store, getAllIdeas, saveIdeaBatch } from '../storage.js';
import { similarity, isEcho, bestMatchScore } from '../text.js';
import { developIdea, renderDevArea, errText } from '../develop.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/* ---------- shared card rendering ---------- */

function ideaCardHtml(idea, idx, batchId, flags) {
  const fl = flags?.perIdea?.[idx] || [];
  const bad = fl.filter(x => x.sev === 'bad').length, warn = fl.filter(x => x.sev === 'warn').length;
  const badge = bad ? `✗ ${bad}` : warn ? `⚠ ${warn}` : '✓ clean';
  const badgeClr = bad ? 'var(--neg)' : warn ? 'var(--warn)' : 'var(--pos)';
  const field = (l, v) => v ? `<div style="font-size:12.5px;color:var(--text);margin:6px 0;line-height:1.5"><span style="display:inline-block;color:var(--accent);font-size:10px;text-transform:uppercase;letter-spacing:.04em;width:130px;font-weight:700;vertical-align:top">${l}</span>${esc(v)}</div>` : '';
  const hasDev = !!idea.dev?.draft;
  return `<div class="ideaCard">
    <h4 style="margin:0 0 6px;font-size:14px;color:var(--text)">
      ${esc(idea.title)} <span style="font-weight:400;color:var(--muted)">· ${esc(idea.emotional_register || '')}</span>
      <button data-devbtn data-b="${esc(batchId)}" data-i="${idx}" style="float:right;background:none;border:1px solid var(--accent2);color:var(--accent2);border-radius:6px;padding:2px 10px;font-size:10px;cursor:pointer;font-weight:600">${hasDev ? '✎ Draft ready' : '🔨 Develop'}</button>
    </h4>
    <div style="color:var(--accent2);font-style:italic;font-size:12px;margin:4px 0">${esc(idea.logline || '')}</div>
    <div style="font-size:11px;color:${badgeClr};font-weight:600">${badge}${fl.length ? ` <span style="color:var(--muted);font-weight:400">— ${fl.map(x => esc(x.msg)).join(' · ')}</span>` : ''}</div>
    ${field('Hook', idea.hook)}
    ${field('Anchor', idea.anchor)}
    ${field('Core', idea.character_core)}
    ${field('Keeps', (idea.exploits_patterns || []).join(' · '))}
    ${field('Adds', idea.addresses_gap)}
    ${field('Risk', idea.risk)}
    <div data-devarea="${esc(batchId)}:${idx}"></div>
  </div>`;
}

function setFlagHtml(flags) {
  return flags?.setFlags?.length
    ? `<div style="background:var(--card);border-left:3px solid var(--warn);padding:8px 10px;border-radius:6px;font-size:12px;color:var(--warn);margin-bottom:10px;line-height:1.5">⚠ ${flags.setFlags.map(f => esc(f.msg)).join('<br>')}</div>` : '';
}

function wireCards(container, batchId) {
  const batch = store.get('idea:' + batchId);
  if (!batch) return;
  container.querySelectorAll('[data-devbtn]').forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.dataset.i);
      if (batch.ideas[i]?.dev?.draft) {
        const area = container.querySelector(`[data-devarea="${batchId}:${i}"]`);
        if (area) renderDevArea(area, batchId, i);
      } else developIdea(batchId, i);
    };
  });
  batch.ideas.forEach((idea, i) => {
    if (idea.dev?.draft) {
      const area = container.querySelector(`[data-devarea="${batchId}:${i}"]`);
      if (area && !area.innerHTML) renderDevArea(area, batchId, i);
    }
  });
}

function mutualDistinctness(ideas) {
  const setFlags = [];
  for (let i = 0; i < ideas.length; i++) for (let j = i + 1; j < ideas.length; j++) {
    const s = similarity(
      [ideas[i].title, ideas[i].logline, ideas[i].premise_archetype].join(' '),
      [ideas[j].title, ideas[j].logline, ideas[j].premise_archetype].join(' '));
    if ((s.j >= 0.5 && s.shared >= 4) || s.sharedBigrams >= 3)
      setFlags.push({ sev: 'warn', msg: `ideas ${i + 1} & ${j + 1} too similar (${Math.round(s.j * 100)}% overlap) — differentiate archetype and register` });
  }
  return setFlags;
}

function validatePremiseIdeas(ideas, premise) {
  const recent = recentIdeaContexts();
  const perIdea = ideas.map(idea => {
    const flags = [];
    for (const f of ['title', 'logline', 'hook', 'anchor', 'character_core'])
      if (!idea[f] || idea[f].length < 15) flags.push({ sev: 'bad', msg: `${f} missing or too thin` });
    const cited = idea.exploits_patterns || [];
    if (!cited.length) flags.push({ sev: 'bad', msg: 'cites no premise elements' });
    else {
      const stray = cited.filter(c => bestMatchScore(c, [premise]) < 0.25);
      if (stray.length) flags.push({ sev: 'warn', msg: `cited element not found in premise: "${stray[0]}"` });
    }
    for (const r of recent) {
      const s = similarity([idea.title, idea.logline].join(' '), [r.title, r.ll || ''].join(' '));
      if (isEcho(s, 0.45)) { flags.push({ sev: 'warn', msg: `rehashes a previously generated idea "${r.title}"` }); break; }
    }
    return flags;
  });
  return { perIdea, setFlags: mutualDistinctness(ideas) };
}

/* ---------- view ---------- */

export function renderForge(root) {
  const kept = getAllIdeas().flatMap(b => b.ideas.filter(i => i.status === 'keep' || i.status === 'shipped'));
  const allIdeas = getAllIdeas().flatMap(b => b.ideas);

  root.innerHTML = `
    <div class="card">
      <h2>🌱 Premise Forge</h2>
      <p class="status">Type a raw idea — a sentence, a fragment, anything. The forge expands it into fully-structured concepts. Your taste profile and anti-rehash memory stay active even here. Like one? Hit 🔨 Develop.</p>
      <textarea id="premise" rows="3" placeholder="e.g. a knight sworn to kill the monster she's slowly falling for"></textarea>
      <div style="display:flex;gap:8px;margin:10px 0;flex-wrap:wrap;align-items:center">
        <input type="text" id="premiseSteer" placeholder="steering (optional): tone, setting, constraints…" style="flex:1;min-width:200px">
        <select id="premiseCount" style="width:auto">
          <option>2</option><option selected>3</option><option>4</option><option>5</option>
        </select>
        <button class="btn" id="premiseBtn">🌱 Forge from premise (1 request)</button>
      </div>
      <div class="status" id="premiseStatus"></div>
      <div id="premiseResult"></div>
    </div>

    <div class="card">
      <h3>🧬 Idea Evolution</h3>
      <p class="status">Combine 2+ ideas you marked "keep" into hybrids. ${kept.length} kept ideas available.</p>
      <div id="evolvePick" style="max-height:200px;overflow-y:auto;margin:10px 0">
        ${kept.length ? kept.map((i, n) => `
          <label style="display:flex;gap:8px;padding:5px 0">
            <input type="checkbox" data-n="${n}" />
            <span><strong>${esc(i.title)}</strong> — ${esc((i.logline || '').slice(0, 80))}…</span>
          </label>`).join('') : '<span class="status">Mark ideas "keep" in the Library first.</span>'}
      </div>
      <input type="text" id="evolveSteer" placeholder="steering (optional)" style="margin-bottom:10px" />
      <button class="btn" id="evolveBtn" ${kept.length < 2 ? 'disabled' : ''}>🧬 Evolve hybrids (1 request)</button>
      <div class="status" id="evolveStatus"></div>
      <div id="evolveResult"></div>
    </div>

    <div class="card">
      <h3>⚖ A/B Variations</h3>
      <p class="status">Take one idea and explore 3–5 different executions of the same core — different voices, POVs, tones.</p>
      <select id="varPick" style="margin-bottom:10px">
        <option value="">— pick an idea —</option>
        ${allIdeas.map((i, n) => `<option value="${n}">${esc(i.title)}${i.status ? ` (${i.status})` : ''}</option>`).join('')}
      </select>
      <select id="varCount" style="margin-bottom:10px;width:auto">
        <option>3</option><option>4</option><option>5</option>
      </select>
      <button class="btn" id="varBtn" disabled>⚖ Generate variations (1 request)</button>
      <div class="status" id="varStatus"></div>
      <div id="varResult"></div>
    </div>`;

  const refreshBudget = () => document.getElementById('budget').textContent = budgetLabel();

  /* --- Premise Forge --- */
  root.querySelector('#premiseBtn').onclick = async () => {
    const premise = root.querySelector('#premise').value.trim();
    const status = root.querySelector('#premiseStatus');
    if (premise.length < 10) {
      status.className = 'status error';
      status.textContent = 'Give the premise a little more to work with (10+ characters). Nothing was sent.';
      return;
    }
    const count = parseInt(root.querySelector('#premiseCount').value);
    status.className = 'status';
    status.textContent = `Expanding your premise into ${count} concepts on ${settings.genModel}…`;
    try {
      const raw = await callGemini(
        buildPremiseForgePrompt(premise, { count, steering: root.querySelector('#premiseSteer').value.trim() }),
        IDEA_SCHEMA, settings.genModel);
      const ideas = coerceIdeas(raw);
      if (!ideas.length) throw { type: 'JSON_PARSE', rawPreview: 'empty ideas array' };
      const flags = validatePremiseIdeas(ideas, premise);
      const batch = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        createdAt: Date.now(), model: settings.genModel, mode: 'premise',
        premise, count: ideas.length, ideas, flags,
      };
      saveIdeaBatch(batch);
      root.querySelector('#premiseResult').innerHTML =
        setFlagHtml(flags) + ideas.map((i, n) => ideaCardHtml(i, n, batch.id, flags)).join('');
      wireCards(root.querySelector('#premiseResult'), batch.id);
      status.className = 'status ok';
      status.textContent = `Done ✓ (1 request) — ${ideas.length} concepts saved to library. Mark favorites "keep" in the Library to feed Evolution.`;
      refreshBudget();
    } catch (e) {
      status.className = 'status error';
      status.textContent = errText(e);
    }
  };

  /* --- Evolve --- */
  root.querySelector('#evolveBtn').onclick = async () => {
    const picked = [...root.querySelectorAll('#evolvePick input:checked')]
      .map(cb => kept[parseInt(cb.dataset.n)]).filter(Boolean);
    if (picked.length < 2) return;
    const status = root.querySelector('#evolveStatus');
    status.className = 'status';
    status.textContent = `Evolving ${picked.length} parents → 3 hybrids on ${settings.genModel}…`;
    try {
      const raw = await callGemini(
        buildEvolvePrompt(picked, { steering: root.querySelector('#evolveSteer').value.trim() }),
        IDEA_SCHEMA, settings.genModel);
      const ideas = coerceIdeas(raw);
      const batch = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        createdAt: Date.now(), model: settings.genModel, mode: 'evolve',
        sourceSet: picked.map(p => p.title), count: ideas.length, ideas,
        flags: { perIdea: ideas.map(() => []), setFlags: mutualDistinctness(ideas) },
      };
      saveIdeaBatch(batch);
      root.querySelector('#evolveResult').innerHTML =
        setFlagHtml(batch.flags) + ideas.map((i, n) => ideaCardHtml(i, n, batch.id, batch.flags)).join('');
      wireCards(root.querySelector('#evolveResult'), batch.id);
      status.className = 'status ok';
      status.textContent = `Done ✓ — ${ideas.length} hybrids saved to library.`;
      refreshBudget();
    } catch (e) {
      status.className = 'status error';
      status.textContent = errText(e);
    }
  };

  /* --- Variations --- */
  const varPick = root.querySelector('#varPick'), varBtn = root.querySelector('#varBtn');
  varPick.onchange = () => varBtn.disabled = !varPick.value;
  varBtn.onclick = async () => {
    const idea = allIdeas[parseInt(varPick.value)];
    if (!idea) return;
    const count = parseInt(root.querySelector('#varCount').value);
    const status = root.querySelector('#varStatus');
    status.className = 'status';
    status.textContent = `Generating ${count} executions of "${idea.title}"…`;
    try {
      const raw = await callGemini(buildVariationsPrompt(idea, count), IDEA_SCHEMA, settings.genModel);
      const ideas = coerceIdeas(raw);
      const batch = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        createdAt: Date.now(), model: settings.genModel, mode: 'variations',
        sourceBot: idea.title, count: ideas.length, ideas,
        flags: { perIdea: ideas.map(() => []), setFlags: mutualDistinctness(ideas) },
      };
      saveIdeaBatch(batch);
      root.querySelector('#varResult').innerHTML =
        setFlagHtml(batch.flags) + ideas.map((i, n) => ideaCardHtml(i, n, batch.id, batch.flags)).join('');
      wireCards(root.querySelector('#varResult'), batch.id);
      status.className = 'status ok';
      status.textContent = `Done ✓ — ${ideas.length} variations saved.`;
      refreshBudget();
    } catch (e) {
      status.className = 'status error';
      status.textContent = errText(e);
    }
  };
}