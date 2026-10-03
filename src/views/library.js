import { store, getAllIdeas } from '../storage.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const STATUS_CYCLE = { '': 'keep', 'keep': 'shipped', 'shipped': 'shelved', 'shelved': '' };

export function renderLibrary(root) {
  const all = getAllIdeas();
  const filter = store.get('libFilter', '');

  const matches = (i) => {
    if (filter === '__un') return !i.status;
    if (!filter) return true;
    return i.status === filter;
  };

  const visible = all.map(b => ({ ...b, ideas: b.ideas.filter(matches) })).filter(b => b.ideas.length);
  const totalIdeas = all.reduce((s, b) => s + b.ideas.length, 0);
  const shown = visible.reduce((s, b) => s + b.ideas.length, 0);

  root.innerHTML = `
    <div class="card">
      <h2>📚 Idea Library</h2>
      <p class="status">${totalIdeas} ideas in ${all.length} batches${filter ? ` · ${shown} shown` : ''}. Click an idea's tag to cycle: keep → shipped → shelved.</p>
      <select id="libFilter" style="width:auto;margin-bottom:12px">
        <option value="">All</option>
        <option value="__un" ${filter === '__un' ? 'selected' : ''}>Unmarked</option>
        <option value="keep" ${filter === 'keep' ? 'selected' : ''}>Keep</option>
        <option value="shipped" ${filter === 'shipped' ? 'selected' : ''}>Shipped</option>
        <option value="shelved" ${filter === 'shelved' ? 'selected' : ''}>Shelved</option>
      </select>
      <div id="batches"></div>
    </div>`;

  const box = root.querySelector('#batches');
  if (!all.length) {
    box.innerHTML = '<p class="status">No ideas yet — forge some, or import from the userscript.</p>';
  } else if (!visible.length) {
    box.innerHTML = '<p class="status">No ideas match this filter.</p>';
  } else {
    box.innerHTML = visible.map(b => `
      <details style="margin-bottom:10px">
        <summary style="cursor:pointer;color:#e6e6ea;padding:4px 0">
          <span style="font-size:11px;padding:1px 7px;border-radius:99px;background:#2a2a33;color:#c084fc">${esc(b.mode || 'forge')}</span>
          ${esc(b.mode === 'solo' ? 'from ' + (b.sourceBot || '?') : ((b.sourceSet || []).join(' + ') || b.count + ' ideas').slice(0, 90))}
          <span style="color:#777;font-size:11px">(${new Date(b.createdAt).toLocaleDateString()} · ${esc(b.model)})</span>
        </summary>
        <div style="margin:6px 0 8px">
          <button class="btn secondary" style="padding:4px 10px;font-size:11px" data-del="${esc(b.id)}">Delete batch</button>
        </div>
        ${b.ideas.map((i, idx) => `
          <div class="ideaCard">
            <h4 style="margin:0 0 4px;font-size:14px;color:#fff">
              <button data-st="${esc(b.id)}" data-i="${idx}" style="font-size:10px;padding:1px 8px;border-radius:99px;cursor:pointer;border:1px dashed #444;color:#999;background:none;margin-right:6px">${i.status || 'mark'}</button>
              ${esc(i.title)}
            </h4>
            <div style="color:#b9a7e3;font-style:italic;font-size:12px;margin:4px 0">${esc(i.logline || '')}</div>
            ${i.hook ? `<div style="font-size:12px;color:#d4d4dc;margin:4px 0"><span style="color:#ff9ec1;font-size:10px;text-transform:uppercase;font-weight:700">hook</span> ${esc(i.hook)}</div>` : ''}
          </div>`).join('')}
      </details>`).join('');

    box.querySelectorAll('[data-st]').forEach(btn => {
      btn.onclick = () => {
        const b = store.get('idea:' + btn.dataset.st);
        if (!b) return;
        const i = b.ideas[parseInt(btn.dataset.i)];
        i.status = STATUS_CYCLE[i.status || ''] ?? '';
        store.set('idea:' + b.id, b);
        renderLibrary(root);
      };
    });
    box.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => {
        if (!confirm('Delete this whole batch of ideas?')) return;
        store.remove('idea:' + btn.dataset.del);
        renderLibrary(root);
      };
    });
  }

  root.querySelector('#libFilter').onchange = (ev) => {
    store.set('libFilter', ev.target.value);
    renderLibrary(root);
  };
}