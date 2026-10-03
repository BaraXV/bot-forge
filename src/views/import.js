import { store, getAllAnalyses } from '../storage.js';

export function renderImport(root) {
  root.innerHTML = `
    <div class="card">
      <h2>⬇ Import from userscript</h2>
      <p class="status">In the userscript: open the Lab → ⬇ Export analyses / ideas → save the JSON. Then upload it here. Imports merge — existing entries are never overwritten.</p>
      <input type="file" id="file" accept=".json" />
      <textarea id="paste" rows="8" placeholder="…or paste JSON here" style="margin-top:10px"></textarea>
      <div class="status" id="status"></div>
    </div>`;

  const status = root.querySelector('#status');
  const handle = async (text, label) => {
    try {
      const data = JSON.parse(text);
      let analyses = 0, ideas = 0;
      const arr = Array.isArray(data) ? data : (data.analyses || data.ideas || []);
      for (const entry of arr) {
        if (entry.analysis && (entry.botName || entry.botId)) {
          const key = 'analysis:' + (entry.botId || entry.botName);
          if (!store.get(key)) { store.set(key, entry); analyses++; }
        } else if (entry.ideas && entry.createdAt && entry.id) {
          if (!store.get('idea:' + entry.id)) { store.set('idea:' + entry.id, entry); ideas++; }
        }
      }
      status.className = 'status ok';
      status.textContent = `Imported ${analyses} analyses, ${ideas} idea batches from ${label}. Library now: ${getAllAnalyses().length} analyses.`;
    } catch (e) {
      status.className = 'status error';
      status.textContent = `Parse failed: ${e.message}`;
    }
  };
  root.querySelector('#file').onchange = (ev) => {
    const f = ev.target.files[0];
    if (f) f.text().then(t => handle(t, f.name));
  };
  root.querySelector('#paste').onblur = (ev) => {
    if (ev.target.value.trim()) handle(ev.target.value, 'paste');
  };
}