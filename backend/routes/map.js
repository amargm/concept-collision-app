const express = require('express');
const admin = require('firebase-admin');
const { verifyAuth } = require('../middleware/auth');

const router = express.Router();

const AGGREGATE_SECRET = process.env.AGGREGATE_SECRET || '';

// ── Category assignment ───────────────────────────────────────────────────────
const CATEGORY_KEYWORDS = {
  Biology: ['biology', 'ecology', 'evolution', 'genetics', 'microbiology', 'neuroscience',
    'anatomy', 'botany', 'zoology', 'marine', 'organism', 'cellular', 'bacteria', 'virus',
    'dna', 'gene', 'species', 'bird', 'insect', 'plant', 'fungus', 'mycology', 'immunology'],
  History: ['history', 'medieval', 'ancient', 'roman', 'greek', 'renaissance', 'war',
    'empire', 'colonial', 'ottoman', 'civilization', 'dynasty', 'feudal', 'victorian',
    'industrial revolution', 'tribe', 'archaeological', 'mythology'],
  Physics: ['physics', 'thermodynamics', 'quantum', 'mechanics', 'astronomy', 'chemistry',
    'geology', 'mathematics', 'statistics', 'fluid', 'optics', 'electromagnetic', 'nuclear',
    'cosmology', 'astrophysics', 'crystallography', 'metallurgy', 'acoustics'],
  Ecology: ['ecology', 'environment', 'climate', 'ocean', 'wildlife', 'conservation',
    'agriculture', 'permaculture', 'watershed', 'ecosystem', 'habitat', 'biodiversity',
    'soil', 'coral', 'reef', 'forestry', 'drought', 'hydrology'],
};

function categorize(domain) {
  const lower = domain.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return 'Other';
}

// ── GET /map — serve map summary from Firestore ───────────────────────────────
router.get('/', verifyAuth, async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('map_data').doc('summary').get();
    if (!doc.exists) {
      return res.json({ nodes: [], edges: [], totalCollisions: 0 });
    }
    return res.json(doc.data());
  } catch (err) {
    console.error('GET /map error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /map/aggregate — called nightly by Cloud Scheduler ──────────────────
// Requires header: X-Aggregate-Secret: <AGGREGATE_SECRET env var>
router.post('/aggregate', async (req, res) => {
  const secret = req.headers['x-aggregate-secret'];
  if (!secret || !AGGREGATE_SECRET || secret !== AGGREGATE_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const db = admin.firestore();

    // Collection group query across all users' collision items
    const snapshot = await db.collectionGroup('items').get();

    const domainCount = {};       // domain -> total appearances
    const coCount = {};           // "a|b" sorted key -> co-occurrence count
    const domainProblems = {};    // domain -> { problem -> count }
    let totalCollisions = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      const domains = Array.isArray(data.domains) ? data.domains : [];
      const problem = typeof data.problem === 'string' ? data.problem.trim() : '';
      if (domains.length === 0) return;

      totalCollisions++;

      for (const domain of domains) {
        domainCount[domain] = (domainCount[domain] || 0) + 1;
        if (problem) {
          if (!domainProblems[domain]) domainProblems[domain] = {};
          domainProblems[domain][problem] = (domainProblems[domain][problem] || 0) + 1;
        }
      }

      // Pairwise co-occurrences
      for (let i = 0; i < domains.length; i++) {
        for (let j = i + 1; j < domains.length; j++) {
          const key = [domains[i], domains[j]].sort().join('|');
          coCount[key] = (coCount[key] || 0) + 1;
        }
      }
    });

    const nodes = Object.entries(domainCount).map(([domain, count]) => ({
      id: domain,
      domain,
      count,
      category: categorize(domain),
      topProblems: Object.entries(domainProblems[domain] || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([p]) => p),
    }));

    // Only include edges that co-occurred at least twice
    const edges = Object.entries(coCount)
      .filter(([, w]) => w >= 2)
      .map(([key, weight]) => {
        const [source, target] = key.split('|');
        return { source, target, weight };
      });

    await db.collection('map_data').doc('summary').set({
      nodes,
      edges,
      totalCollisions,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ ok: true, nodes: nodes.length, edges: edges.length, totalCollisions });
  } catch (err) {
    console.error('POST /map/aggregate error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
