import { store } from './storage.js';

export const THEMES = {
  midnight: {
    name: 'Midnight',
    vars: {
      '--bg': '#16161c', '--panel': '#1b1b22', '--card': '#1e1e26', '--card2': '#1a1a21',
      '--border': '#2a2a33', '--text': '#e6e6ea', '--muted': '#888',
      '--accent': '#ff6b9d', '--accent2': '#c084fc', '--input-bg': '#111116',
      '--pos': '#8bd694', '--neg': '#ff8b8b', '--warn': '#e8c46b',
    },
  },
  ember: {
    name: 'Ember',
    animated: true,
    vars: {
      '--bg': '#0d0303', '--panel': 'rgba(24,8,6,.85)', '--card': 'rgba(42,14,10,.75)',
      '--card2': 'rgba(34,11,9,.8)', '--border': '#4a1f16', '--text': '#f5e8e3',
      '--muted': '#b3908a', '--accent': '#ff5c39', '--accent2': '#ffb057',
      '--input-bg': 'rgba(16,5,4,.8)', '--pos': '#9dd66b', '--neg': '#ff7b6b', '--warn': '#ffc46b',
    },
    bg: 'linear-gradient(130deg,#0d0303,#2b0a06,#55140a,#7a2412,#55140a,#2b0a06,#0d0303)',
    glow: 'radial-gradient(ellipse at 70% 110%, rgba(255,100,40,.20), transparent 55%),radial-gradient(ellipse at 20% -10%, rgba(180,40,10,.16), transparent 50%)',
    drift: '26s',
  },
  ocean: {
    name: 'Ocean',
    animated: true,
    vars: {
      '--bg': '#04080f', '--panel': 'rgba(8,18,30,.85)', '--card': 'rgba(10,26,42,.75)',
      '--card2': 'rgba(9,22,36,.8)', '--border': '#1c3a54', '--text': '#e2eef5',
      '--muted': '#7e97a8', '--accent': '#38d9c8', '--accent2': '#4f9dff',
      '--input-bg': 'rgba(5,12,20,.8)', '--pos': '#6bd9a0', '--neg': '#ff8b8b', '--warn': '#e8c46b',
    },
    bg: 'linear-gradient(130deg,#04080f,#07182b,#0b2b45,#123a5c,#0b2b45,#07182b,#04080f)',
    glow: 'radial-gradient(ellipse at 70% 110%, rgba(56,217,200,.14), transparent 55%),radial-gradient(ellipse at 20% -10%, rgba(79,157,255,.12), transparent 50%)',
    drift: '34s',
  },
};

export function getThemeId() { return store.get('theme', 'midnight'); }

export function applyTheme(id) {
  const t = THEMES[id] || THEMES.midnight;
  Object.entries(t.vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  document.querySelectorAll('.bia-bg,.bia-glow').forEach(el => el.remove());
  if (t.animated) {
    const bg = document.createElement('div');
    bg.className = 'bia-bg';
    bg.style.background = t.bg;
    bg.style.backgroundSize = '400% 400%';
    bg.style.animation = `biaDrift ${t.drift} ease-in-out infinite`;
    const glow = document.createElement('div');
    glow.className = 'bia-glow';
    glow.style.background = t.glow;
    glow.style.animation = 'biaPulse 6s ease-in-out infinite alternate';
    document.body.append(bg, glow);
  }
  store.set('theme', id);
}