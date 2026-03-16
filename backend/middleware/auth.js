const admin = require('firebase-admin');

/**
 * Verifies Firebase ID token from Authorization: Bearer <token>.
 * Attaches decoded token to req.user on success.
 */
async function verifyAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
  }

  const idToken = header.slice(7);
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

module.exports = { verifyAuth };
