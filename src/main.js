import { renderForge } from './views/forge.js';
import { renderLibrary } from './views/library.js';
import { renderImport } from './views/import.js';
import { renderSettings } from './views/settings.js';
import { budgetLabel } from './gemini.js';
import { THEMES, applyTheme, getThemeId } from './themes.js';

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

/* theme picker */
const themePick = document.getElementById('themePick');
Object.entries(THEMES).forEach(([id, t]) => {
  const o = document.createElement('option');
  o.value = id; o.textContent = t.name;
  themePick.appendChild(o);
});
themePick.value = getThemeId();
themePick.onchange = () => applyTheme(themePick.value);
applyTheme(getThemeId());

const style = document.createElement('style');
style.textContent = `
  :root {
    --bg:#16161c; --panel:#1b1b22; --card:#1e1e26; --card2:#1a1a21; --border:#2a2a33;
    --text:#e6e6ea; --muted:#888; --accent:#ff6b9d; --accent2:#c084fc; --input-bg:#111116;
    --pos:#8bd694; --neg:#ff8b8b; --warn:#e8c46b;
  }
  * { box-sizing:border-box; font-family:-apple-system,'Segoe UI',Roboto,sans-serif; }
  body { margin:0; background:var(--bg); color:var(--text); min-height:100vh; }
  .bia-bg,.bia-glow { position:fixed; inset:0; pointer-events:none; }
  .bia-bg { z-index:-2; } .bia-glow { z-index:-1; }
  @keyframes biaDrift { 0%,100% { background-position:0% 30%; } 50% { background-position:100% 70%; } }
  @keyframes biaPulse { from { opacity:.55; } to { opacity:1; } }
  @media (prefers-reduced-motion:reduce) { .bia-bg,.bia-glow { animation:none !important; } }
  #nav { display:flex; gap:4px; padding:10px 16px; background:var(--panel); border-bottom:1px solid var(--border); align-items:center; }
  #nav button { background:none; border:none; color:var(--muted); padding:8px 14px; cursor:pointer; font-size:14px; border-bottom:2px solid transparent; }
  #nav button.active { color:var(--accent); border-bottom-color:var(--accent); }
  #themePick { margin-left:auto; background:var(--input-bg); color:var(--text); border:1px solid var(--border); border-radius:8px; padding:5px 8px; font-size:12px; }
  #budget { margin-left:10px; font-size:12px; color:var(--muted); }
  #app { padding:20px; max-width:1100px; margin:0 auto; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:16px; margin-bottom:14px; }
  h2 { color:var(--text); margin:0 0 6px; font-size:18px; }
  h3 { color:var(--text); margin:0 0 4px; font-size:15px; }
  .btn { padding:9px 16px; border-radius:8px; border:none; cursor:pointer; font-size:13px; font-weight:600;
    background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#fff; }
  .btn:disabled { opacity:.5; cursor:default; }
  .btn.secondary { background:var(--card2); color:var(--text); border:1px solid var(--border); }
  .status { font-size:13px; color:var(--muted); padding:8px 0; }
  .status.error { color:var(--neg); } .status.ok { color:var(--pos); }
  input,select,textarea { padding:8px 10px; border-radius:8px; border:1px solid var(--border);
    background:var(--input-bg); color:var(--text); font-size:13px; width:100%; }
  .ideaCard { background:var(--card2); border:1px solid var(--border); border-radius:10px; padding:12px; margin-bottom:10px; }
`;
document.head.appendChild(style);
render();