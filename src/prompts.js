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
          exploits_patterns: { type: 'array', items: { type: 'string' }, description: 'Which parent mechanic / strength this idea inherits' },
          addresses_gap: { type: 'string', description: 'Which weakness it fixes or which ignored angle it takes' },
          hook: { type: 'string', description: 'The in-medias-res opening moment — specific dramatic situation happening NOW, stakes visible' },
          anchor: { type: 'string', description: 'The retention mechanic — why a user stays after message 3' },
          character_core: { type: 'string', description: 'Who the bot is: flaw, want, contradiction' },
          relationship_dynamic: { type: 'string', description: 'Power balance and emotional geometry between bot and user' },
          emotional_register: { type: 'string', description: 'The core feeling targeted; MUST differ across ideas in this batch' },
          first_message_concept: { type: 'string', description: 'How the opening message plays out — concept, not full text' },
          differentiation: { type: 'string', description: 'Versus the closest source: what this does differently AND why a user would pick it over the original' },
          risk: { type: 'string', description: 'The likeliest failure mode — be honest' },
        },
        required: IDEA_STRING_FIELDS,
      },
    },
  },
  required: ['ideas'],
};

// ——— Idea Evolution: fuse 2+ kept ideas into hybrids ———
export function buildEvolvePrompt(ideas, { steering = '' } = {}) {
  const list = ideas.map((i, n) => `### Parent ${n + 1}: ${i.title}
- Logline: ${i.logline}
- Archetype: ${i.premise_archetype}
- Hook: ${i.hook}
- Anchor: ${i.anchor}
- Character core: ${i.character_core}
- Register: ${i.emotional_register}
- Kept because: (user marked this idea "keep")`).join('\n\n');

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

// ——— A/B Variations: one concept, multiple executions ———
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
1. SAME CORE: title, archetype, character_core, relationship_dynamic, emotional_register match the source concept. Only executional fields differ.
2. RADICAL DIFFERENCE: the ${count} variations should feel like ${count} different writers tackling the same brief.
3. Concrete hooks, named anchors, specificity, honest risk.
 ${idea.risk ? `\nNote the concept's known risk: ${idea.risk} — at least one variation should actively mitigate it.\n` : ''}
Respond ONLY with the JSON object.`;
}