import { callGemini, settings } from '../gemini.js';
import { IDEA_SCHEMA, buildEvolvePrompt, buildVariationsPrompt } from '../prompts.js';
import { getAllIdeas, saveIdeaBatch } from '../storage.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export function renderForge(root) {
  const kept = getAllIdeas().flatMap(b => b.ideas.filter(i => i.status === 'keep' || i.status === 'shipped'));
  const allIdeas = getAllIdeas().flatMap(b => b.ideas);

  root.innerHTML = `
    <div class="card">
      <h2>🔥 Expanded Forge</h2>
      <p class="status">Two modes beyond the userscript's solo/pattern forges. Both run on your generation model — 1 request each.</p>
    </div>

    <div class="card">
      <h3>🧬 Idea Evolution</h3>
      <p class="status">Combine 2+ ideas you marked "keep" into hybrid concepts. ${kept.length} kept ideas available.</p>
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

  const evolveBtn = root.querySelector('#evolveBtn');
  evolveBtn.onclick = async () => {
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
      const ideas = (Array.isArray(raw?.ideas) ? raw.ideas : []).filter(i => i.title || i.logline);
      const batch = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        createdAt: Date.now(), model: settings.genModel, mode: 'evolve',
        sourceSet: picked.map(p => p.title), count: ideas.length, ideas,
        flags: { perIdea: ideas.map(() => []), setFlags: [] },
      };
      saveIdeaBatch(batch);
      root.querySelector('#evolveResult').innerHTML = ideas.map(i => `
        <div class="ideaCard"><strong>${esc(i.title)}</strong> · ${esc(i.emotional_register || '')}
        <div style="color:#b9a7e3;font-style:italic;font-size:12px;margin:4px 0">${esc(i.logline)}</div>
        <div style="font-size:12px;color:#d4d4dc">${esc((i.differentiation || '').slice(0, 200))}…</div></div>`).join('');
      status.className = 'status ok';
      status.textContent = `Done ✓ — ${ideas.length} hybrids saved to library.`;
    } catch (e) {
      status.className = 'status error';
      status.textContent = `${e.type || 'Error'}: ${e.apiMessage || e.detail || ''}`;
    }
  };

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
      const ideas = (Array.isArray(raw?.ideas) ? raw.ideas : []).filter(i => i.title || i.logline);
      const batch = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        createdAt: Date.now(), model: settings.genModel, mode: 'variations',
        sourceBot: idea.title, count: ideas.length, ideas,
        flags: { perIdea: ideas.map(() => []), setFlags: [] },
      };
      saveIdeaBatch(batch);
      root.querySelector('#varResult').innerHTML = ideas.map(i => `
        <div class="ideaCard"><strong>${esc(i.title)}</strong>
        <div style="color:#b9a7e3;font-style:italic;font-size:12px;margin:4px 0">${esc(i.logline)}</div>
        <div style="font-size:12px;color:#d4d4dc">${esc((i.first_message_concept || '').slice(0, 200))}…</div></div>`).join('');
      status.className = 'status ok';
      status.textContent = `Done ✓ — ${ideas.length} variations saved.`;
    } catch (e) {
      status.className = 'status error';
      status.textContent = `${e.type || 'Error'}: ${e.apiMessage || e.detail || ''}`;
    }
  };
}