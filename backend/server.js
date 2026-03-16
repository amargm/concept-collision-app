const express = require('express');
const admin = require('firebase-admin');

// ── Firebase Admin init ───────────────────────────────────────────────────────
// On Cloud Run, uses Application Default Credentials automatically.
// Locally, set GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
admin.initializeApp();

const app = express();
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/collide', require('./routes/collide'));
app.use('/', require('./routes/usage'));
app.use('/daily', require('./routes/daily'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '8080', 10);
app.listen(PORT, () => {
  console.log(`ConceptCollision backend listening on port ${PORT}`);
});
