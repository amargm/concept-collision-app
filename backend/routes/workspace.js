const express = require('express');
const admin = require('firebase-admin');
const { verifyAuth } = require('../middleware/auth');

const router = express.Router();

// ── PATCH /workspace/:problemId/note ─────────────────────────────────────────
// Appends a note to problems/{uid}/items/{problemId} and recalcs engagementScore.
// Body: { noteId: string, text: string, createdAt: ISO-string | number }
router.patch('/:problemId/note', verifyAuth, async (req, res) => {
  const uid = req.user.uid;
  const { problemId } = req.params;
  const { noteId, text, createdAt } = req.body;

  if (!problemId || typeof problemId !== 'string') {
    return res.status(400).json({ error: 'invalid_problem_id' });
  }
  if (!noteId || typeof noteId !== 'string') {
    return res.status(400).json({ error: 'note_id_required' });
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text_required' });
  }

  const db = admin.firestore();
  const problemRef = db
    .collection('problems')
    .doc(uid)
    .collection('items')
    .doc(problemId);

  try {
    const snap = await problemRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'problem_not_found' });
    }

    const pd = snap.data();

    // Build note entry (for problem doc notes array)
    const noteTimestamp = createdAt
      ? admin.firestore.Timestamp.fromDate(new Date(createdAt))
      : admin.firestore.Timestamp.now();

    const noteEntry = {
      noteId:    noteId.trim(),
      text:      text.trim(),
      createdAt: noteTimestamp,
    };

    // Recalculate engagement score
    const collisionCount   = pd.collisionCount   || 0;
    const keyInsightCount  = pd.keyInsightCount  || 0;
    const currentNoteCount = (pd.noteCount       || 0) + 1;
    const engagementScore  = collisionCount + (currentNoteCount * 0.5) + keyInsightCount;

    // Write to problem doc (notes array + score) and notes subcollection in parallel
    const subcollectionRef = problemRef.collection('notes').doc(noteId.trim());

    await Promise.all([
      problemRef.update({
        notes:           admin.firestore.FieldValue.arrayUnion(noteEntry),
        noteCount:       admin.firestore.FieldValue.increment(1),
        engagementScore,
        updatedAt:       admin.firestore.FieldValue.serverTimestamp(),
      }),
      subcollectionRef.set({
        text:      text.trim(),
        createdAt: noteTimestamp,
      }),
    ]);

    return res.json({ success: true, engagementScore });
  } catch (err) {
    console.error('PATCH /workspace/:problemId/note error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
