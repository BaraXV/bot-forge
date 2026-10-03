import { renderForge } from './views/forge.js';
import { renderLibrary } from './views/library.js';
import { renderImport } from './views/import.js';
import { renderSettings } from './views/settings.js';
import { budgetLabel } from './gemini.js';

const views = { forge: renderForge, library: renderLibrary, import: renderImport, settings: renderSettings };
let current = 'forge';

function render() {
  document.getElementById('app').innerHTML = '';
  document.querySelectorAll('#nav button').forEach(b =>
    b.classList.toggle('active', b.dataset.view === current));
  views[current](document.getElementById('app'));
  document.getElementById('budget').textContent = budgetLabel();
}

document.querySelectorAll('#nav button').forEach(b =>
  b.onclick = () => { current = b.dataset.view; render(); });

const style = document.createElement('style');
style.textContent = `
  * { box-sizing: border-box; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; }
  body { margin: 0; background: #16161c; color: #e6e6ea; }
  #nav { display: flex; gap: 4px; padding: 10px 16px; background: #1b1b22; border-bottom: 1px solid #2a2a33; align-items: center; }
  #nav button { background: none; border: none; color: #999; padding: 8px 14px; cursor: pointer; font-size: 14px; border-bottom: 2px solid transparent; }
  #nav button.active { color: #ff6b9d; border-bottom-color: #ff6b9d; }
  #budget { margin-left: auto; font-size: 12px; color: #888; }
  #app { padding: 20px; max-width: 1100px; margin: 0 auto; }
  .card { background: #1e1e26; border: 1px solid #2a2a33; border-radius: 10px; padding: 16px; margin-bottom: 14px; }
  .btn { padding: 9px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 600;
    background: linear-gradient(135deg, #ff6b9d, #c084fc); color: #fff; }
  .btn:disabled { opacity: .5; cursor: default; }
  .btn.secondary { background: #2a2a33; color: #ccc; }
  .status { font-size: 13px; color: #aaa; padding: 8px 0; }
  .status.error { color: #ff8b8b; } .status.ok { color: #8bd694; }
  input, select, textarea { padding: 8px 10px; border-radius: 8px; border: 1px solid #2a2a33;
    background: #111116; color: #e6e6ea; font-size: 13px; width: 100%; }
  .ideaCard { background: #1a1a21; border: 1px solid #2a2a33; border-radius: 10px; padding: 12px; margin-bottom: 10px; }
`;
document.head.appendChild(style);
render();