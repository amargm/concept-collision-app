const express = require('express');
const admin = require('firebase-admin');
const { verifyAuth } = require('../middleware/auth');

const router = express.Router();

const FREE_COLLISION_LIMIT = parseInt(process.env.FREE_COLLISION_LIMIT || '10', 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || 'v1beta';
const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent`;
const PROMPT_VERSION = 'v1';

// ── System prompts by mode ────────────────────────────────────────────────────

const PROMPTS = {
  core: `You are a cross-domain structural pattern engine. Your job is NOT to give advice or summaries. You find problems from completely unrelated domains that share the same deep structural pattern as the user's problem — and show how each domain solved it differently.

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
- Prioritize obscure, surprising domains over obvious ones`,

  learning: `You are a cross-domain structural pattern engine focused on learning and pedagogy. Find how completely unrelated fields have solved the same structural learning challenge the user describes. Surface the deepest pedagogical patterns.

Respond ONLY with valid JSON using this exact structure:
{
  "structural_essence": "One sentence: the abstract learning/pedagogical pattern",
  "collisions": [
    {
      "domain": "Domain name",
      "title": "The analogous learning problem in that domain",
      "how_they_solved_it": "2-3 sentences. Specific techniques used.",
      "bridge": "1-2 sentences. How this maps back to the user's learning challenge."
    }
  ],
  "synthesis": "One insight about learning that emerges from seeing all four domains together."
}

Rules:
- Exactly 4 collisions
- Focus on domains with strong pedagogical traditions (e.g. martial arts, apprenticeship trades, oral cultures, animal training)
- The bridge must be actionable and specific`,

  narrative: `You are a master storyteller and cross-domain pattern engine. Find 4 real historical, cultural, or mythological moments that share the exact structural pattern of the user's situation. Tell each as a vivid story.

Respond ONLY with valid JSON. No markdown, no preamble, no explanation outside the JSON.

Return this exact structure:
{
  "structural_essence": "One sentence: the abstract structural pattern in the user's situation",
  "narratives": [
    {
      "domain": "Domain name (e.g. Byzantine Diplomacy, Edo Period Japan, West African Oral Tradition)",
      "setting": "Specific place and time, 3-6 words uppercase (e.g. CONSTANTINOPLE, 1453 or THE AMAZON BASIN, 16TH CENTURY)",
      "story": "3-4 sentences of vivid narrative prose. Name real people, places, events. Write like a storyteller, not an academic.",
      "bridge": "1-2 sentences. The exact structural insight that maps this story back to the user's situation."
    }
  ],
  "synthesis": "One powerful insight that emerges only when you see all four stories together. Reframes the user's situation."
}

Rules:
- Exactly 4 narratives
- Draw from mythology, pre-modern history, indigenous traditions, ancient empires, oral cultures, ritual structures
- Never use modern films, novels, or post-1900 events
- Each setting must be specific: a real place and approximate time in uppercase
- The story field must read as narrative prose, not an explanation
- The bridge must be illuminating and specific to the user's situation`,

  chain: `You are a cross-domain structural pattern engine. The user has identified a structural essence themselves and provided domains they want explored. Your job is to find how each specified domain has addressed this exact structural pattern.

Respond ONLY with valid JSON using this exact structure:
{
  "structural_essence": "Restate the user's structural essence in one crisp sentence",
  "collisions": [
    {
      "domain": "The domain as specified",
      "title": "The analogous problem in that domain",
      "how_they_solved_it": "2-3 sentences. Concrete, specific, not vague.",
      "bridge": "1-2 sentences. The exact structural insight mapping back to the original problem."
    }
  ],
  "synthesis": "One insight that emerges from seeing all specified domains together."
}

Rules:
- One collision per domain specified by user
- Stay strictly within the domains given
- The bridge must be genuinely illuminating`,

  deeper: `You are a cross-domain structural pattern engine going deeper into a single domain. The user wants to explore how 3 distinct sub-disciplines, historical movements, periods, or schools of thought WITHIN one specific domain have each addressed the same structural problem differently.

Respond ONLY with valid JSON using this exact structure:
{
  "structural_essence": "Restate the structural essence in one crisp sentence",
  "collisions": [
    {
      "domain": "Specific sub-field, period, or movement within the given domain (e.g. 'Byzantine Military Logistics' not just 'Military')",
      "title": "The analogous problem within that sub-field",
      "how_they_solved_it": "2-3 sentences. Concrete, specific — name figures, periods, mechanisms.",
      "bridge": "1-2 sentences. The structural insight that maps back to the original problem."
    }
  ],
  "synthesis": "One insight that emerges from going deeper into this domain."
}

Rules:
- Exactly 3 collisions
- All 3 must be meaningfully distinct sub-aspects within the given domain
- Be highly specific (e.g. 'Byzantine military logistics' not 'European history')
- Never use the parent domain name verbatim as a sub-domain name
- The bridge must be genuinely illuminating, not generic`,
};

// ── POST /collide ─────────────────────────────────────────────────────────────

router.post('/', verifyAuth, async (req, res) => {
  const uid = req.user.uid;
  const { problem, mode = 'core', domain, structuralEssence, workspaceProblemId } = req.body;

  if (!problem || typeof problem !== 'string' || problem.trim().length === 0) {
    return res.status(400).json({ error: 'problem_required' });
  }

  const validModes = ['core', 'learning', 'narrative', 'chain', 'deeper'];
  if (!validModes.includes(mode)) {
    return res.status(400).json({ error: 'invalid_mode' });
  }

  if (mode === 'chain' && (!domain || !structuralEssence)) {
    return res.status(400).json({ error: 'chain_mode_requires_domain_and_structuralEssence' });
  }

  if (mode === 'deeper' && (!domain || typeof domain !== 'string' || !structuralEssence)) {
    return res.status(400).json({ error: 'deeper_mode_requires_domain_and_structuralEssence' });
  }

  // ── Rate limit check ───────────────────────────────────────────────────────
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  const userData = userSnap.data();
  if (userData.plan === 'free' && (userData.collisionCount || 0) >= FREE_COLLISION_LIMIT) {
    return res.status(429).json({ error: 'limit_exceeded' });
  }

  if (mode === 'deeper' && userData.plan !== 'pro') {
    return res.status(403).json({ error: 'pro_required' });
  }

  // ── Build prompt ───────────────────────────────────────────────────────────
  let systemPrompt = PROMPTS[mode];
  let userMessage = problem.trim();

  if (mode === 'chain') {
    userMessage = `Structural essence: ${structuralEssence}\n\nDomains to explore: ${Array.isArray(domain) ? domain.join(', ') : domain}\n\nOriginal problem: ${problem.trim()}`;
  }

  if (mode === 'deeper') {
    userMessage = `Structural essence: ${structuralEssence}\n\nDomain to explore deeply: ${domain}\n\nOriginal problem: ${problem.trim()}`;
  }

  // ── Call Gemini ────────────────────────────────────────────────────────────
  let result;
  try {
    const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiRes.ok) {
      const body = await geminiRes.text();
      console.error('Gemini error', geminiRes.status, body.slice(0, 200));
      return res.status(502).json({ error: 'gemini_error', status: geminiRes.status });
    }

    const geminiData = await geminiRes.json();
    const parts = geminiData?.candidates?.[0]?.content?.parts ?? [];
    const responsePart = parts.find(p => !p.thought) ?? parts[0];
    const text = responsePart?.text ?? '';
    result = JSON.parse(text);
  } catch (err) {
    console.error('Gemini call failed', err);
    return res.status(502).json({ error: 'gemini_parse_error' });
  }

  // ── Save to Firestore ──────────────────────────────────────────────────────
  const collisionRef = db.collection('collisions').doc(uid).collection('items').doc();
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Derive domain list from the correct field depending on mode
  const domainList = mode === 'narrative'
    ? (result.narratives?.map((n) => n.domain) ?? [])
    : (result.collisions?.map((c) => c.domain) ?? []);

  await collisionRef.set({
    problem: problem.trim(),
    result,
    timestamp: now,
    mode,
    domains: domainList,
    structuralEssence: result.structural_essence ?? '',
    promptVersion: PROMPT_VERSION,
    bookmarked: false,
  });

  // ── Increment usage ────────────────────────────────────────────────────────
  await userRef.update({
    collisionCount: admin.firestore.FieldValue.increment(1),
  });

  // ── Workspace attribution ──────────────────────────────────────────────────
  if (workspaceProblemId && typeof workspaceProblemId === 'string' && workspaceProblemId.trim()) {
    const problemRef = db
      .collection('problems')
      .doc(uid)
      .collection('items')
      .doc(workspaceProblemId.trim());

    try {
      const problemSnap = await problemRef.get();
      if (problemSnap.exists) {
        const pd = problemSnap.data();

        const collisionEntry = {
          collisionId: collisionRef.id,
          timestamp: admin.firestore.Timestamp.now(),
          mode,
          domains: domainList,
          keyInsightCardIds: [],
        };

        const newCollisionCount = (pd.collisionCount || 0) + 1;
        const noteCount = pd.noteCount || 0;
        const keyInsightCount = pd.keyInsightCount || 0;
        const engagementScore = newCollisionCount + (noteCount * 0.5) + keyInsightCount;

        const categoryUpdate = {};
        for (const domainName of domainList) {
          const safeKey = domainName.replace(/[^a-zA-Z0-9]/g, '_');
          categoryUpdate[`coverageByCategory.${safeKey}`] = admin.firestore.FieldValue.increment(1);
        }

        const stageUpdate = pd.stage === 'waiting' ? { stage: 'thinking' } : {};

        await problemRef.update({
          collisions: admin.firestore.FieldValue.arrayUnion(collisionEntry),
          collisionCount: admin.firestore.FieldValue.increment(1),
          lastCollidedAt: admin.firestore.FieldValue.serverTimestamp(),
          engagementScore,
          ...stageUpdate,
          ...categoryUpdate,
        });
      }
    } catch (err) {
      // Non-fatal — attribution failure must not break the collision response
      console.error('Workspace attribution failed', err);
    }
  }

  // ── Search index: history (non-fatal, fire-and-forget) ────────────────────
  db.collection('search_index').doc(uid).set({
    historyIndex: admin.firestore.FieldValue.arrayUnion({
      collisionId:  collisionRef.id,
      problemText:  problem.trim(),
      domains:      domainList,
      timestamp:    admin.firestore.Timestamp.now(),
    }),
  }, { merge: true }).catch(err => console.error('historyIndex write failed', err));

  return res.json({ id: collisionRef.id, result });
});

module.exports = router;
