import { store } from '../storage.js';
import { settings, budgetLabel } from '../gemini.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite', 'gemini-3.8-flash'];

export function renderSettings(root) {
  const modelList = store.get('modelList', null);
  const models = (modelList?.models?.length) ? modelList.models : FALLBACK_MODELS;
  const budgets = settings.budgets;

  root.innerHTML = `
    <div class="card">
      <h2>⚙ Settings</h2>
      <p class="status">Everything saves in your browser (localStorage). Your key never leaves this machine.</p>

      <div style="margin-bottom:14px">
        <label style="display:block;font-size:12px;color:#aaa;margin-bottom:5px">Gemini API key (free at aistudio.google.com)</label>
        <input type="password" id="key" placeholder="AIza..." value="${esc(settings.apiKey)}" />
      </div>

      <div style="margin-bottom:14px">
        <label style="display:block;font-size:12px;color:#aaa;margin-bottom:5px">Analysis model (high-quota model — analyzing bots)</label>
        <select id="modelA">
          ${models.map(m => `<option ${m === settings.analysisModel ? 'selected' : ''}>${esc(m)}</option>`).join('')}
          <option value="__custom" ${!models.includes(settings.analysisModel) ? 'selected' : ''}>Custom…</option>
        </select>
        <input type="text" id="modelACustom" placeholder="custom model id" style="margin-top:6px;${models.includes(settings.analysisModel) ? 'display:none' : ''}" value="${esc(settings.analysisModel)}" />
      </div>

      <div style="margin-bottom:14px">
        <label style="display:block;font-size:12px;color:#aaa;margin-bottom:5px">Analysis model daily budget</label>
        <input type="number" id="budgetA" min="1" max="5000" value="${budgets[settings.analysisModel] ?? 50}" />
      </div>

      <div style="margin-bottom:14px">
        <label style="display:block;font-size:12px;color:#aaa;margin-bottom:5px">Generation model (your best model — forges)</label>
        <select id="modelG">
          ${models.map(m => `<option ${m === settings.genModel ? 'selected' : ''}>${esc(m)}</option>`).join('')}
          <option value="__custom" ${!models.includes(settings.genModel) ? 'selected' : ''}>Custom…</option>
        </select>
        <input type="text" id="modelGCustom" placeholder="custom model id" style="margin-top:6px;${models.includes(settings.genModel) ? 'display:none' : ''}" value="${esc(settings.genModel)}" />
      </div>

      <div style="margin-bottom:14px">
        <label style="display:block;font-size:12px;color:#aaa;margin-bottom:5px">Generation model daily budget</label>
        <input type="number" id="budgetG" min="1" max="5000" value="${budgets[settings.genModel] ?? 50}" />
      </div>

      <div style="margin-bottom:14px">
        <label style="display:block;font-size:12px;color:#aaa;margin-bottom:5px">Max output tokens per request</label>
        <input type="number" id="maxOut" min="1024" max="65536" value="${settings.maxOut}" />
      </div>

      <button class="btn" id="save">Save</button>
      <button class="btn secondary" id="refreshModels" style="margin-left:8px">↻ Refresh model list</button>
      <div class="status" id="status"></div>
    </div>`;

  const selA = root.querySelector('#modelA'), custA = root.querySelector('#modelACustom');
  const selG = root.querySelector('#modelG'), custG = root.querySelector('#modelGCustom');
  selA.onchange = () => custA.style.display = selA.value === '__custom' ? 'block' : 'none';
  selG.onchange = () => custG.style.display = selG.value === '__custom' ? 'block' : 'none';

  root.querySelector('#save').onclick = () => {
    const key = root.querySelector('#key').value.trim();
    const aModel = selA.value === '__custom' ? custA.value.trim() : selA.value;
    const gModel = selG.value === '__custom' ? custG.value.trim() : selG.value;

    store.set('apiKey', key);
    if (aModel) store.set('analysisModel', aModel);
    if (gModel) store.set('genModel', gModel);

    const b = settings.budgets;
    b[store.get('analysisModel')] = Math.max(1, parseInt(root.querySelector('#budgetA').value) || 50);
    b[store.get('genModel')] = Math.max(1, parseInt(root.querySelector('#budgetG').value) || 50);
    store.set('budgets', b);
    store.set('maxOut', Math.max(1024, Math.min(65536, parseInt(root.querySelector('#maxOut').value) || 8192)));

    document.getElementById('budget').textContent = budgetLabel();
    const st = root.querySelector('#status');
    st.className = 'status ok';
    st.textContent = `Saved ✓ — analysis: ${store.get('analysisModel')} · generation: ${store.get('genModel')}`;
  };

  root.querySelector('#refreshModels').onclick = async () => {
    const st = root.querySelector('#status');
    const key = store.get('apiKey', '');
    if (!key) { st.className = 'status error'; st.textContent = 'Save an API key first.'; return; }
    st.className = 'status';
    st.textContent = 'Fetching model list…';
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
        { headers: { 'x-goog-api-key': key } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      const models = (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => String(m.name || '').replace(/^models\//, ''))
        .filter(Boolean).sort();
      if (!models.length) throw new Error('no models returned');
      store.set('modelList', { fetchedAt: Date.now(), models });
      st.className = 'status ok';
      st.textContent = `${models.length} models loaded — re-open Settings to see them.`;
    } catch (e) {
      st.className = 'status error';
      st.textContent = `Failed: ${e.message}`;
    }
  };
}