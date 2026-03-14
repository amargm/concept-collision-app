export const COLORS = {
  background: '#0a0a0a',
  surface: '#111111',
  card: '#141414',
  border: '#222222',
  accent: '#c8f064',
  accentRed: '#f06464',
  accentBlue: '#64c8f0',
  accentPurple: '#c064f0',
  text: '#e8e8e0',
  muted: '#555550',
  mutedLight: '#999990',
};

export const CARD_COLORS = ['#c8f064', '#f06464', '#64c8f0', '#c064f0'];

export const EXAMPLE_CHIPS = [
  'How do you revoke trust in a distributed system where nodes cannot always communicate in real time?',
  'How do you prevent a compromised identity from spreading silently?',
  'How do you maintain system integrity when you cannot verify every component?',
  'How do you propagate a rule change across a large, decentralised network?',
];

export const SYSTEM_PROMPT = `You are a cross-domain structural pattern engine. Your job is NOT to give advice or summaries. You find problems from completely unrelated domains that share the same deep structural pattern as the user's problem — and show how each domain solved it differently.

Respond ONLY with valid JSON. No markdown, no preamble, no explanation outside the JSON.

Return this exact structure:
{
  "structural_essence": "One sentence: the abstract structural pattern underlying the problem",
  "collisions": [
    {
      "domain": "Domain name (e.g. Epidemiology, Medieval Guild Systems, Ant Colony Behavior)",
      "title": "The analogous problem in that domain",
      "how_they_solved_it": "2-3 sentences. Concrete, specific, not vague.",
      "bridge": "1-2 sentences. The exact structural insight that maps back to the user's problem."
    }
  ],
  "synthesis": "One powerful insight that emerges only when you see all four domains together. Should reframe the original problem in a way the user hasn't considered."
}

Rules:
- Exactly 4 collisions
- Domains must be wildly different from each other and from the user's domain
- Never use software, cybersecurity, or tech as a domain
- The bridge must be genuinely illuminating, not generic
- Prioritize obscure, surprising domains over obvious ones`;

export const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export const STORAGE_KEYS = {
  apiKey: 'gemini_api_key',
  history: 'collision_history',
};
