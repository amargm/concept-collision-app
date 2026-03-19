const express = require('express');
const admin = require('firebase-admin');
const { verifyAuth } = require('../middleware/auth');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function engagementScore(collisionCount, noteCount, keyInsightCount) {
  return collisionCount + (noteCount * 0.5) + keyInsightCount;
}

// ── POST /workspace/save ──────────────────────────────────────────────────────
// Saves a problem to problems/{uid}/items and appends to workspaceIndex.
// Body: { text: string, source?: 'queued'|'elevated' }
router.post('/save', verifyAuth, async (req, res) => {
  const uid = req.user.uid;
  const { text, source = 'queued' } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text_required' });
  }

  const db = admin.firestore();
  const problemRef = db.collection('problems').doc(uid).collection('items').doc();

  const now = admin.firestore.FieldValue.serverTimestamp();
  const nowTs = admin.firestore.Timestamp.now();

  const problemData = {
    problem:          text.trim(),
    stage:            'waiting',
    source,
    collisionCount:   0,
    collisionIds:     [],
    domains:          [],
    keyInsights:      [],
    noteCount:        0,
    keyInsightCount:  0,
    engagementScore:  0,
    isDeleted:        false,
    createdAt:        now,
    updatedAt:        now,
  };

  try {
    await problemRef.set(problemData);

    // Update search index — non-fatal
    db.collection('search_index').doc(uid).set({
      workspaceIndex: admin.firestore.FieldValue.arrayUnion({
        problemId: problemRef.id,
        text:      text.trim(),
        stage:     'waiting',
        domains:   [],
        updatedAt: nowTs,
      }),
    }, { merge: true }).catch(err => console.error('workspaceIndex write failed', err));

    return res.json({ id: problemRef.id });
  } catch (err) {
    console.error('POST /workspace/save error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /workspace ────────────────────────────────────────────────────────────
// Returns all non-deleted problems for user, ordered by updatedAt desc.
router.get('/', verifyAuth, async (req, res) => {
  const uid = req.user.uid;
  const db = admin.firestore();

  try {
    const snap = await db
      .collection('problems')
      .doc(uid)
      .collection('items')
      .where('isDeleted', '==', false)
      .orderBy('updatedAt', 'desc')
      .get();

    const problems = snap.docs.map(d => ({
      id:             d.id,
      ...d.data(),
      createdAt:      d.data().createdAt?.toDate?.()?.toISOString() ?? null,
      updatedAt:      d.data().updatedAt?.toDate?.()?.toISOString() ?? null,
      lastCollidedAt: d.data().lastCollidedAt?.toDate?.()?.toISOString() ?? null,
    }));

    return res.json({ problems });
  } catch (err) {
    console.error('GET /workspace error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ── PATCH /workspace/:problemId ───────────────────────────────────────────────
// General update: stage, closing fields, etc. Also syncs workspaceIndex entry.
// Body: any subset of { stage, closingType, closingNote, closedAt, ... }
router.patch('/:problemId', verifyAuth, async (req, res) => {
  const uid = req.user.uid;
  const { problemId } = req.params;

  if (!problemId) {
    return res.status(400).json({ error: 'invalid_problem_id' });
  }

  // Strip fields that must not be overwritten directly
  const { noteId, text, createdAt, ...allowedUpdates } = req.body;

  const db = admin.firestore();
  const problemRef = db.collection('problems').doc(uid).collection('items').doc(problemId);

  try {
    const snap = await problemRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'problem_not_found' });
    }

    const nowTs = admin.firestore.Timestamp.now();
    await problemRef.update({
      ...allowedUpdates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Sync workspaceIndex — update matching entry (read-modify-write on array)
    const indexRef = db.collection('search_index').doc(uid);
    indexRef.get().then(indexSnap => {
      const indexData = indexSnap.data() ?? {};
      const workspaceIndex = (indexData.workspaceIndex ?? []).map(entry => {
        if (entry.problemId !== problemId) { return entry; }
        return {
          ...entry,
          stage:     allowedUpdates.stage ?? entry.stage,
          updatedAt: nowTs,
        };
      });
      return indexRef.set({ workspaceIndex }, { merge: true });
    }).catch(err => console.error('workspaceIndex sync failed', err));

    return res.json({ success: true });
  } catch (err) {
    console.error('PATCH /workspace/:problemId error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ── DELETE /workspace/:problemId ──────────────────────────────────────────────
// Soft delete: sets isDeleted:true and removes from workspaceIndex.
router.delete('/:problemId', verifyAuth, async (req, res) => {
  const uid = req.user.uid;
  const { problemId } = req.params;

  if (!problemId) {
    return res.status(400).json({ error: 'invalid_problem_id' });
  }

  const db = admin.firestore();
  const problemRef = db.collection('problems').doc(uid).collection('items').doc(problemId);

  try {
    const snap = await problemRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'problem_not_found' });
    }

    await problemRef.update({
      isDeleted: true,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Remove from workspaceIndex — non-fatal
    const indexRef = db.collection('search_index').doc(uid);
    indexRef.get().then(indexSnap => {
      const indexData = indexSnap.data() ?? {};
      const workspaceIndex = (indexData.workspaceIndex ?? [])
        .filter(entry => entry.problemId !== problemId);
      return indexRef.set({ workspaceIndex }, { merge: true });
    }).catch(err => console.error('workspaceIndex delete sync failed', err));

    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /workspace/:problemId error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

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

    const noteTimestamp = createdAt
      ? admin.firestore.Timestamp.fromDate(new Date(createdAt))
      : admin.firestore.Timestamp.now();

    const noteEntry = {
      noteId:    noteId.trim(),
      text:      text.trim(),
      createdAt: noteTimestamp,
    };

    const collisionCount   = pd.collisionCount   || 0;
    const keyInsightCount  = pd.keyInsightCount  || 0;
    const currentNoteCount = (pd.noteCount       || 0) + 1;
    const score = engagementScore(collisionCount, currentNoteCount, keyInsightCount);

    const subcollectionRef = problemRef.collection('notes').doc(noteId.trim());

    await Promise.all([
      problemRef.update({
        notes:           admin.firestore.FieldValue.arrayUnion(noteEntry),
        noteCount:       admin.firestore.FieldValue.increment(1),
        engagementScore: score,
        updatedAt:       admin.firestore.FieldValue.serverTimestamp(),
      }),
      subcollectionRef.set({
        text:      text.trim(),
        createdAt: noteTimestamp,
      }),
    ]);

    return res.json({ success: true, engagementScore: score });
  } catch (err) {
    console.error('PATCH /workspace/:problemId/note error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
