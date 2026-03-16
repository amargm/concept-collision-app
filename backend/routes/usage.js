const express = require('express');
const admin = require('firebase-admin');
const { verifyAuth } = require('../middleware/auth');

const router = express.Router();

// ── GET /user/usage ───────────────────────────────────────────────────────────

router.get('/user/usage', verifyAuth, async (req, res) => {
  const uid = req.user.uid;
  const db = admin.firestore();

  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  const { collisionCount = 0, plan = 'free' } = snap.data();
  return res.json({ collisionCount, plan });
});

module.exports = router;
