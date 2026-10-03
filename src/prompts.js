import { getAllIdeas, store } from './storage.js';
import { wordFreq, topWords } from './text.js';

const IDEA_STRING_FIELDS = ['title', 'logline', 'premise_archetype', 'addresses_gap', 'hook',
  'anchor', 'character_core', 'relationship_dynamic', 'emotional_register',
  'first_message_concept', 'differentiation', 'risk'];

export const IDEA_SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short, evocative bot title' },
          logline: { type: 'string', description: '1-2 sentence pitch of the concept' },
          premise_archetype: { type: 'string', description: 'One-line classification; MUST differ across ideas in this batch' },
          exploits_patterns: { type: 'array', items: { type: 'string' }, description: 'The load-bearing elements preserved — in the source\'s own words' },
          addresses_gap: { type: 'string', description: 'What this idea ADDS that the source didn\'t have' },
          hook: { type: 'string', description: 'The in-medias-res opening moment — specific dramatic situation happening NOW, stakes visible' },
          anchor: { type: 'string', description: 'The retention mechanic — why a user stays after message 3' },
          character_core: { type: 'string', description: 'Who the bot is: flaw, want, contradiction' },
          relationship_dynamic: { type: 'string', description: 'Power balance and emotional geometry between bot and user' },
          emotional_register: { type: 'string', description: 'The core feeling targeted; MUST differ across ideas in this batch' },
          first_message_concept: { type: 'string', description: 'How the opening message plays out — concept, not full text' },
          differentiation: { type: 'string', description: 'Versus the closest source: what this does differently AND why a user would pick it' },
          risk: { type: 'string', description: 'The likeliest failure mode — be honest' },
        },
        required: IDEA_STRING_FIELDS,
      },
    },
  },
  required: ['ideas'],
};

const BASE_CLICHES = [
  'a "mysterious past" as the core premise', 'forbidden love as the whole concept',
  'plain enemies-to-lovers with no subversion', 'the childhood friend who returns',
  'amnesia as the central mystery', 'the chosen one',
  'an ordinary person stumbles into a hidden world', 'the bad boy with a secret soft side',
  'love at first sight as the driving force',
];
export function bannedList() {
  const extra = String(store.get('extraBans', '')).split('\n').map(s => s.trim()).filter(Boolean);
  return [...BASE_CLICHES, ...extra].map(x => `- ${x}`).join('\n');
}

function coerceText(v, depth = 0) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(x => coerceText(x, depth + 1)).filter(Boolean).join(depth ? '; ' : '\n');
  if (typeof v === 'object')
    return Object.entries(v).map(([k, x]) => { const t = coerceText(x, depth + 1); return t ? `${k}: ${t}` : ''; }).filter(Boolean).join('\n');
  return '';
}

export function coerceIdeas(raw) {
  const arr = Array.isArray(raw?.ideas) ? raw.ideas : (raw?.ideas ? [raw.ideas] : Array.isArray(raw) ? raw : []);
  return arr.map(src => {
    src = src && typeof src === 'object' ? src : {};
    const out = {};
    for (const f of IDEA_STRING_FIELDS) out[f] = coerceText(src[f]);
    out.exploits_patterns = (Array.isArray(src.exploits_patterns) ? src.exploits_patterns : src.exploits_patterns != null ? [src.exploits_patterns] : [])
      .map(x => coerceText(x)).filter(Boolean);
    return out;
  }).filter(i => i.title || i.logline);
}

/* ---------- compounding: taste + anti-rehash (shared by all forges) ---------- */

export function buildTasteSection() {
  const kept = [], shelved = [];
  getAllIdeas().forEach(b => b.ideas.forEach(i => {
    if (i.status === 'keep' || i.status === 'shipped') kept.push(i);
    else if (i.status === 'shelved') shelved.push(i);
  }));
  if (kept.length < 3 && shelved.length < 3) return '';
  let p = `## User taste — learned from their own marks (${kept.length} kept, ${shelved.length} shelved)`;
  if (kept.length >= 3) {
    const kr = topWords(wordFreq(kept.map(i => (i.emotional_register || '') + ' ' + (i.premise_archetype || ''))), 8);
    p += `\nThey KEEP ideas featuring: ${kr.join(', ')}. Lean toward these.`;
  }
  if (shelved.length >= 3) {
    const sr = topWords(wordFreq(shelved.map(i => (i.emotional_register || '') + ' ' + (i.premise_archetype || ''))), 8);
    p += `\nThey SHELVE ideas featuring: ${sr.join(', ')}. Avoid unless strongly inverted.`;
  }
  return p;
}

export function recentIdeaContexts(limit = 12) {
  const out = [];
  for (const b of getAllIdeas()) for (const i of b.ideas) {
    out.push({ title: i.title, arch: i.premise_archetype, ll: i.logline });
    if (out.length >= limit) return out;
  }
  return out;
}

/* ---------- Premise Forge (NEW) ---------- */

export function buildPremiseForgePrompt(premise, { count = 3, steering = '' } = {}) {
  const recent = recentIdeaContexts();
  const taste = buildTasteSection();
  return `You are a veteran character-bot designer. A user arrives with a raw premise — the seed of an idea, possibly just a sentence. Expand it into ${count} fully-formed, structurally distinct bot concepts that honor the premise while taking it in genuinely different directions.

## The premise (user-provided — its load-bearing elements are FIXED)
 ${premise}

## How to expand
1. FIDELITY: identify the premise's load-bearing elements (the character, situation, relationship, or tone that makes it THIS premise) and preserve them in every idea.
2. DIVERGENCE: everything not load-bearing is yours to invent. Vary the archetype, power dynamic, and emotional register across the batch — no ${count} flavors of one fantasy.
3. ELEVATION: each idea must give the premise something it didn't have — a hook sharper than the premise implies, an anchor the premise didn't contain, a contradiction that makes the character feel alive. The user wants to be surprised by their own idea.

## HARD RULES — violating any makes an idea worthless
1. PREMISE FIDELITY: in exploits_patterns, cite the load-bearing elements you preserved — using the premise's own words.
2. VALUE ADDED: in addresses_gap, name what this idea gives the premise that it didn't already have.
3. NO GENERIC CORES — banned as the CORE premise (fine as seasoning if subverted specifically):
 ${bannedList()}
4. CONCRETE HOOK: the in-medias-res opening moment — a specific dramatic situation happening NOW, stakes visible. Not "you meet X" — the moment things break.
5. NAMED ANCHOR: the retention mechanic — why a user stays after message 3.
6. MUTUAL DISTINCTNESS: the ${count} ideas differ in premise_archetype AND emotional_register AND target audience.
7. SPECIFICITY FLOOR: every field names concrete specifics — situations, stakes, contradictions. Abstract vibes are rejected.
8. HONEST RISK: each idea names its likeliest failure mode.
 ${recent.length ? `\n## Previously generated ideas — do NOT rehash these\n${recent.map(r => `- "${r.title}" (${r.arch || '?'})`).join('\n')}\n` : ''}${taste ? `\n${taste}\n` : ''}${steering ? `\n## Creative steering (user-specified — respect it)\n${steering}\n` : ''}
Quality over quantity: if a field would be generic, rethink the whole idea. Respond ONLY with the JSON object.`;
}

/* ---------- Evolve ---------- */

export function buildEvolvePrompt(ideas, { steering = '' } = {}) {
  const list = ideas.map((i, n) => `### Parent ${n + 1}: ${i.title}
- Logline: ${i.logline}
- Archetype: ${i.premise_archetype}
- Hook: ${i.hook}
- Anchor: ${i.anchor}
- Character core: ${i.character_core}
- Register: ${i.emotional_register}`).join('\n\n');

  return `You are a veteran character-bot designer. Below are ${ideas.length} bot concepts the user explicitly LIKED (marked "keep"). Forge 3 HYBRID concepts — each combining the strongest elements of at least two parents into something neither parent was.

## Parent concepts (all user-approved)
 ${list}

## Mission: synthesis, not averaging
- Each hybrid takes a CONCRETE mechanic from one parent (its hook structure, anchor type, relationship geometry) and fuses it with a different parent's premise energy.
- No hybrid may be a simple blend ("Parent A's setting with Parent B's character") — the fusion must produce a premise neither parent could have been.
- The 3 hybrids must differ from each other as much as the parents differ from each other.

## HARD RULES
1. NAME THE INHERITANCE: in differentiation, state exactly which mechanic came from which parent and what the fusion adds that neither had.
2. Concrete in-medias-res hooks, named anchors, distinct archetypes across the batch, specificity floor, honest risk.
 ${steering ? `\n## Steering\n${steering}\n` : ''}
Respond ONLY with the JSON object.`;
}

/* ---------- A/B Variations ---------- */

export function buildVariationsPrompt(idea, count = 3) {
  return `You are a veteran character-bot designer. One concept has been approved for development, but the EXECUTION is undecided. Forge ${count} VARIATIONS of this exact concept — same premise, same character core, same hook moment — each taking a radically different executional approach.

## The concept (fixed — do not change the core)
- Title: ${idea.title}
- Logline: ${idea.logline}
- Archetype: ${idea.premise_archetype}
- Hook: ${idea.hook}
- Anchor: ${idea.anchor}
- Character core: ${idea.character_core}
- Relationship: ${idea.relationship_dynamic}
- Register: ${idea.emotional_register}

## What varies between the ${count} executions
- narrative_voice: one variation sparse and terse; another lush and sensory; another heavy on dialogue; another epistolary/found-document style
- first_message_concept: the same hook moment rendered through different lenses — different POV, pacing, information revealed
- power_dynamics: subtle shifts in who holds the leverage in the opening scene
- tone: same register but different flavors — brooding vs. clinical vs. feverish

## HARD RULES
1. SAME CORE: title, archetype, character_core, relationship_dynamic, emotional_register match the source. Only executional fields differ.
2. RADICAL DIFFERENCE: the ${count} variations should feel like ${count} different writers tackling the same brief.
3. Concrete hooks, named anchors, specificity, honest risk.
 ${idea.risk ? `\nNote the concept's known risk: ${idea.risk} — at least one variation should actively mitigate it.\n` : ''}
Respond ONLY with the JSON object.`;
}

/* ---------- Develop: idea → full bot definition ---------- */

const DEV_STRING_FIELDS = ['title', 'tagline', 'description', 'personality', 'scenario',
  'first_message', 'example_dialogue', 'hook_delivery', 'anchor_mechanics', 'creator_notes'];

export const DEVELOPED_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    tagline: { type: 'string', description: 'One-line hook for a browsing reader' },
    tags: { type: 'array', items: { type: 'string' }, description: '5-8 discoverability tags' },
    description: { type: 'string', description: '250-500 words: who the character is, their world, their contradiction. Concrete specifics, no stat sheets.' },
    personality: { type: 'string', description: '80-200 words: core traits, voice, flaws, how they treat the user' },
    scenario: { type: 'string', description: 'The starting situation, 2-5 sentences' },
    first_message: { type: 'string', description: '300-800 words, FULLY WRITTEN: in medias res, mid-scene, implements the hook exactly, ends on a beat demanding the user\'s reply. Mix action, dialogue, interiority. No greeting, no biography dump.' },
    alt_greetings: { type: 'array', items: { type: 'string' }, description: '1-2 alternative first messages taking the hook in a different direction' },
    example_dialogue: { type: 'string', description: '1-2 exchanges demonstrating the character\'s voice' },
    hook_delivery: { type: 'string', description: 'Concrete explanation of HOW first_message implements the hook' },
    anchor_mechanics: { type: 'string', description: 'How the bot sustains its anchor across a long chat: the recurring tension that gets revisited' },
    creator_notes: { type: 'string', description: 'Short notes for users: tone, content guidance, what the bot does best' },
  },
  required: DEV_STRING_FIELDS,
};

export function buildDevelopPrompt(idea, { feedback = '', currentDraft = null } = {}) {
  const f = (label, v) => v ? `- ${label}: ${v}` : '';
  return `You are a veteran character-bot writer. An approved concept needs its COMPLETE bot definition — publication-ready, built to compete with top performers. Write the full draft.

## The concept
 ${f('Title', idea.title)}
 ${f('Logline', idea.logline)}
 ${f('Premise archetype', idea.premise_archetype)}
 ${f('Hook (the first message MUST implement this)', idea.hook)}
 ${f('Anchor (retention mechanic)', idea.anchor)}
 ${f('Character core', idea.character_core)}
 ${f('Relationship dynamic', idea.relationship_dynamic)}
 ${f('Emotional register', idea.emotional_register)}
 ${f('First message concept', idea.first_message_concept)}
 ${f('Fixes / takes', idea.addresses_gap)}
 ${f('Differentiation', idea.differentiation)}

## HARD RULES
1. FIRST MESSAGE: in medias res, already mid-scene when the user arrives, implements the concept's hook exactly, ends on a beat that demands the user's reply. 300-800 words. No greeting, no biography dump, no wall of pure narration.
2. LENGTHS: description 250-500 words; personality 80-200 words; 5-8 discoverability tags.
3. VOICE: distinct and consistent — example_dialogue proves it.
4. SELF-CHECK: hook_delivery and anchor_mechanics must concretely explain how the delivered text implements the hook and sustains the anchor. If you cannot articulate it, the text is wrong — fix it before responding.
5. NO banned cores as the premise: ${BASE_CLICHES.join('; ')}
 ${currentDraft ? `\n## Current draft (may include the user's edits — preserve them except where the requested changes apply)\n${JSON.stringify(currentDraft, null, 1)}\n` : ''}${feedback ? `\n## Requested changes\n${feedback}\n` : ''}
Respond ONLY with the JSON object.`;
}