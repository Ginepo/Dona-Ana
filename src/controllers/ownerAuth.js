const { createHash, randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');
const { db } = require('../repositories/menuRepository');

const password = process.env.OWNER_PASSWORD;
const salt = randomBytes(16);
const passwordHash = password && password.length >= 16
  ? scryptSync(password, salt, 64)
  : null;
const ttl = 8 * 60 * 60 * 1000;
const cookieName = 'dona_ana_owner';
const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/'
};

db.exec(`
  CREATE TABLE IF NOT EXISTS owner_sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );
`);

const addSession = db.prepare('INSERT INTO owner_sessions VALUES (?, ?)');
const findSession = db.prepare('SELECT 1 FROM owner_sessions WHERE token_hash = ? AND expires_at > ?');
const removeSession = db.prepare('DELETE FROM owner_sessions WHERE token_hash = ?');
const removeExpired = db.prepare('DELETE FROM owner_sessions WHERE expires_at <= ?');

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function sessionHash(req) {
  const match = (req.headers.cookie ?? '').match(/(?:^|;\s*)dona_ana_owner=([a-f0-9]{64})(?:;|$)/);
  return match ? hashToken(match[1]) : null;
}

function requireOwner(req, res, next) {
  const hash = sessionHash(req);
  if (!passwordHash || !hash || !findSession.get(hash, Date.now())) {
    return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  }
  next();
}

function login(req, res) {
  if (!passwordHash) {
    return res.status(503).json({ error: 'El acceso de propietario todavía no está configurado.' });
  }

  const candidate = req.body?.password;
  if (typeof candidate !== 'string' || candidate.length > 256 ||
      !timingSafeEqual(scryptSync(candidate, salt, 64), passwordHash)) {
    return res.status(401).json({ error: 'Contraseña incorrecta.' });
  }

  const previous = sessionHash(req);
  if (previous) removeSession.run(previous);

  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  removeExpired.run(now);
  addSession.run(hashToken(token), now + ttl);
  res.cookie(cookieName, token, { ...cookieOptions, maxAge: ttl });
  res.json({ signedIn: true });
}

function logout(req, res) {
  const hash = sessionHash(req);
  if (hash) removeSession.run(hash);
  res.clearCookie(cookieName, cookieOptions);
  res.json({ signedIn: false });
}

module.exports = { login, logout, requireOwner };
