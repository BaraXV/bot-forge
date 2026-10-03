import { store } from './storage.js';

export const settings = {
  get apiKey() { return store.get('apiKey', ''); },
  get analysisModel() { return store.get('analysisModel', 'gemini-2.5-flash-lite'); },
  get genModel() { return store.get('genModel', 'gemini-3.8-flash'); },
  get budgets() { return store.get('budgets', {}); },
  get maxOut() { return store.get('maxOut', 8192); },
};
export const budgetFor = (m) => settings.budgets[m] ?? 50;

const counter = {
  data: store.get('counter', { date: '', counts: {} }),
  save() { store.set('counter', this.data); },
  counts() {
    const t = new Date().toISOString().slice(0, 10);
    if (this.data.date !== t) { this.data = { date: t, counts: {} }; this.save(); }
    return this.data.counts;
  },
  today(m) { return this.counts()[m] || 0; },
  bump(m) { const c = this.counts(); c[m] = (c[m] || 0) + 1; this.save(); },
  refund(m) { const c = this.counts(); if (c[m] > 0) { c[m]--; this.save(); } },
};

const MIN_INTERVAL = 6500;
let lastCall = 0;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let chain = Promise.resolve();
const limiter = {
  add(fn) {
    const run = chain.then(async () => {
      const wait = lastCall + MIN_INTERVAL - Date.now();
      if (wait > 0) await sleep(wait);
      lastCall = Date.now();
      return fn();
    });
    chain = run.catch(() => {});
    return run;
  },
};

export function budgetLabel() {
  const A = settings.analysisModel, G = settings.genModel;
  return `A ${counter.today(A)}/${budgetFor(A)} · G ${counter.today(G)}/${budgetFor(G)}`;
}

export async function callGemini(prompt, schema, modelOverride) {
  const model = modelOverride || settings.analysisModel;
  if (!settings.apiKey) throw { type: 'NO_KEY' };
  if (counter.today(model) >= budgetFor(model)) throw { type: 'BUDGET', model };

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: settings.maxOut,
      ...(schema && { response_mime_type: 'application/json', response_schema: schema }),
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  counter.bump(model);
  let res;
  try {
    res = await limiter.add(() => fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.apiKey },
        body: JSON.stringify(body),
      }
    ));
  } catch (netErr) { counter.refund(model); throw { type: 'NETWORK', detail: String(netErr) }; }

  const data = await res.json().catch(() => null);

  if (res.status === 429) {
    counter.refund(model);
    const details = data?.error?.details || [];
    const rd = details.find(d => /RetryInfo/i.test(d['@type'] || ''))?.retryDelay;
    const daily = !/minute/i.test(String(details.find(d => /QuotaFailure/i.test(d['@type'] || ''))?.violations?.[0]?.quotaMetric || ''));
    throw { type: 'RATE_LIMIT', status: 429, model, daily, retryAfter: rd ? parseFloat(rd) : null, apiMessage: data?.error?.message || '' };
  }
  if ([400, 401, 403, 404].includes(res.status)) {
    counter.refund(model);
    throw { type: res.status === 400 ? 'BAD_REQUEST' : res.status === 404 ? 'MODEL_NOT_FOUND' : 'AUTH', status: res.status, model, apiMessage: data?.error?.message || '' };
  }
  if (!res.ok) { counter.refund(model); throw { type: 'SERVER', status: res.status, model }; }

  if (data?.promptFeedback?.blockReason)
    throw { type: 'SAFETY_BLOCK', stage: 'prompt', model, blockReason: data.promptFeedback.blockReason };
  const cand = data?.candidates?.[0];
  if (!cand) throw { type: 'EMPTY_RESPONSE', model };
  if (cand.finishReason === 'SAFETY') throw { type: 'SAFETY_BLOCK', stage: 'response', model };
  if (cand.finishReason === 'MAX_TOKENS') throw { type: 'TRUNCATED', model };

  const text = (cand.content?.parts || []).map(p => p.text || '').join('');
  if (schema) {
    try { return JSON.parse(text); }
    catch {
      const s = text.indexOf('{'), e = text.lastIndexOf('}');
      if (s >= 0 && e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch {} }
      throw { type: 'JSON_PARSE', model, rawPreview: text.slice(0, 400) };
    }
  }
  return text;
}