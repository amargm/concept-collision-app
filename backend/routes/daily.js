const express = require('express');
const admin = require('firebase-admin');

const router = express.Router();

const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET;

// ── GET /daily ────────────────────────────────────────────────────────────────
// Returns today's daily collision (public, no auth required).

router.get('/', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const db = admin.firestore();

  const snap = await db.collection('daily').doc(today).get();
  if (!snap.exists) {
    return res.status(404).json({ error: 'not_found', date: today });
  }

  return res.json({ date: today, ...snap.data() });
});

// ── POST /admin/generate-daily ────────────────────────────────────────────────
// Secured by X-Scheduler-Secret header. Intended for Cloud Scheduler invocation.

router.post('/admin/generate-daily', async (req, res) => {
  const secret = req.headers['x-scheduler-secret'];
  if (!SCHEDULER_SECRET || secret !== SCHEDULER_SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  const prompt = `Generate a thought-provoking philosophical or scientific problem that a curious thinker would want to explore structurally. Return ONLY a JSON object with a single field "problem" containing one sentence.`;

  let problem;
  try {
    const r = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.0, maxOutputTokens: 100, responseMimeType: 'application/json' },
      }),
    });
    const d = await r.json();
    const text = d?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    problem = JSON.parse(text).problem;
  } catch (err) {
    console.error('generate-daily: problem generation failed', err);
    return res.status(502).json({ error: 'generation_failed' });
  }

  // Now run a core collision on that problem
  const corePrompt = `You are a cross-domain structural pattern engine. Find 4 wildly different domains that share the structural pattern of the user's problem.

Respond ONLY with valid JSON:
{
  "structural_essence": "string",
  "collisions": [{"domain":"string","title":"string","how_they_solved_it":"string","bridge":"string"}],
  "synthesis": "string"
}`;

  let result;
  try {
    const r = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: problem }] }],
        systemInstruction: { parts: [{ text: corePrompt }] },
        generationConfig: { temperature: 0.9, maxOutputTokens: 1500, responseMimeType: 'application/json' },
      }),
    });
    const d = await r.json();
    const text = d?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    result = JSON.parse(text);
  } catch (err) {
    console.error('generate-daily: collision failed', err);
    return res.status(502).json({ error: 'collision_failed' });
  }

  const db = admin.firestore();
  await db.collection('daily').doc(today).set({
    problem,
    result,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return res.json({ date: today, problem, result });
});

module.exports = router;
