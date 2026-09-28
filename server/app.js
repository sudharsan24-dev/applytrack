import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const scrypt = promisify(scryptCallback);
const lifetime = 7 * 24 * 60 * 60 * 1000;
const statuses = ['Applied', 'Interview', 'Offer', 'Rejected'];
const hashToken = token => createHash('sha256').update(token).digest('hex');
const safeUser = user => ({ id: user.id, name: user.name, email: user.email, isDemo: Boolean(user.is_demo) });
const fail = (status, message) => Object.assign(new Error(message), { status });
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [salt, digest] = stored.split(':');
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(digest, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function textField(value, label, max, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') throw fail(400, `${label} must be text.`);
  const text = value.trim();
  if ((required && !text) || text.length > max) throw fail(400, `${label} is required and must be under ${max + 1} characters.`);
  return text;
}
function applicationInput(body) {
  const company = textField(body.company, 'Company', 100, true);
  const role = textField(body.role, 'Role', 150, true);
  const location = textField(body.location, 'Location', 120);
  const notes = textField(body.notes, 'Notes', 4000);
  const job_url = textField(body.job_url, 'Job link', 1000);
  const applied_on = textField(body.applied_on, 'Application date', 10, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(applied_on) || !Number.isFinite(Date.parse(applied_on)) || new Date(applied_on).toISOString().slice(0, 10) !== applied_on || applied_on < '2000-01-01' || applied_on > new Date().toISOString().slice(0, 10)) throw fail(400, 'Choose a valid application date between 2000 and today.');
  if (!statuses.includes(body.status)) throw fail(400, 'Choose a valid application status.');
  if (job_url) {
    try { if (!['https:', 'http:'].includes(new URL(job_url).protocol)) throw new Error(); }
    catch { throw fail(400, 'Job link must start with https:// or http://.'); }
  }
  return { company, role, location, status: body.status, applied_on, job_url, notes };
}

export function createApp(db, options = {}) {
  const app = express();
  app.disable('x-powered-by');
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const origin = options.origin || process.env.APP_ORIGIN || 'http://localhost:5173';
  app.use(helmet({ strictTransportSecurity: production ? undefined : false, contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': production ? [] : null } } }));
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') && req.get('origin') !== origin) return next(fail(403, 'This request came from an untrusted origin.'));
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.is('application/json')) return next(fail(415, 'Send application/json.'));
    next();
  });
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many attempts. Please try again in 15 minutes.' } }));

  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: production, path: '/', maxAge: lifetime };
  function readToken(req) {
    return (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('applytrack_session='))?.slice('applytrack_session='.length);
  }
  async function session(req, res, user) {
    const old = readToken(req);
    if (old) await db.run('DELETE FROM sessions WHERE token_hash = ?', [hashToken(old)]);
    const token = randomBytes(32).toString('hex');
    await db.run('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);
    await db.run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [hashToken(token), user.id, Date.now() + lifetime]);
    res.cookie('applytrack_session', token, cookieOptions);
    return safeUser(user);
  }
  async function authenticate(req, res, next) {
    const token = readToken(req);
    const user = token && await db.get('SELECT users.* FROM users JOIN sessions ON sessions.user_id = users.id WHERE sessions.token_hash = ? AND sessions.expires_at > ?', [hashToken(token), Date.now()]);
    if (!user) throw fail(401, 'Please sign in to continue.');
    req.user = user;
    next();
  }
  async function insertApplication(userId, fields) {
    const record = { id: randomUUID(), ...fields, created_at: Date.now(), updated_at: Date.now() };
    await db.run('INSERT INTO applications (id, user_id, company, role, location, status, applied_on, job_url, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [record.id, userId, record.company, record.role, record.location, record.status, record.applied_on, record.job_url, record.notes, record.created_at, record.updated_at]);
    return record;
  }

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.post('/api/auth/register', async (req, res) => {
    const name = textField(req.body?.name, 'Name', 80, true);
    const email = textField(req.body?.email, 'Email', 254, true).toLowerCase();
    const password = req.body?.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, 'Enter a valid email address.');
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) throw fail(400, 'Use a password with 10 to 128 characters.');
    if (await db.get('SELECT id FROM users WHERE email = ?', [email])) throw fail(409, 'An account with this email already exists.');
    const user = { id: randomUUID(), name, email, is_demo: 0 };
    try {
      await db.run('INSERT INTO users (id, name, email, password_hash, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?)', [user.id, name, email, await hashPassword(password), 0, Date.now()]);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY' || error.code?.startsWith('ERR_SQLITE') && error.message.includes('UNIQUE')) throw fail(409, 'An account with this email already exists.');
      throw error;
    }
    res.status(201).json({ user: await session(req, res, user) });
  });
  app.post('/api/auth/login', async (req, res) => {
    const email = textField(req.body?.email, 'Email', 254, true).toLowerCase();
    const password = req.body?.password;
    if (typeof password !== 'string' || password.length > 128) throw fail(400, 'Enter a valid password.');
    const user = await db.get('SELECT * FROM users WHERE email = ? AND is_demo = 0', [email]);
    // A dummy derivation avoids skipping the slow hash for unknown accounts.
    const valid = await verifyPassword(password, user?.password_hash || `${'0'.repeat(32)}:${'0'.repeat(128)}`);
    if (!user || !valid) throw fail(401, 'Email or password is incorrect.');
    res.json({ user: await session(req, res, user) });
  });
  app.post('/api/auth/demo', async (req, res) => {
    await db.run('DELETE FROM users WHERE is_demo = 1 AND created_at < ?', [Date.now() - lifetime]);
    const user = { id: randomUUID(), name: 'Alex', email: `${randomUUID()}@demo.invalid`, is_demo: 1 };
    await db.run('INSERT INTO users (id, name, email, password_hash, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?)', [user.id, user.name, user.email, await hashPassword(randomBytes(32).toString('hex')), 1, Date.now()]);
    const samples = [
      ['Orbit Labs', 'Frontend Developer Intern', 'Chennai · Hybrid', 'Interview', 2, 'Technical round scheduled. Revise React hooks and JavaScript fundamentals.'],
      ['Northstar', 'Full Stack Developer Intern', 'Bengaluru · On-site', 'Applied', 3, 'Applied through the careers page.'],
      ['Forma Studio', 'React Developer', 'Remote', 'Applied', 4, 'Personalized the cover letter for the product team.'],
      ['Mono Technologies', 'Software Engineer Intern', 'Chennai · On-site', 'Offer', 6, 'Review the internship duration and learning opportunities.'],
      ['Pulse Systems', 'Backend Developer Intern', 'Hyderabad · Hybrid', 'Interview', 8, 'Prepare Node.js, SQL joins and REST API concepts.'],
      ['Arc Digital', 'Web Developer Intern', 'Remote', 'Applied', 10, 'Shared portfolio and GitHub profile.'],
      ['Loom Works', 'Junior Frontend Developer', 'Bengaluru · Hybrid', 'Rejected', 13, 'Keep practising and apply again when a suitable role opens.'],
      ['Vertex Labs', 'Full Stack Intern', 'Chennai · Hybrid', 'Applied', 16, 'Follow up after two weeks.']
    ];
    for (const [company, role, location, status, days, notes] of samples) await insertApplication(user.id, { company, role, location, status, applied_on: new Date(Date.now() - days * 86400000).toISOString().slice(0, 10), job_url: '', notes });
    res.status(201).json({ user: await session(req, res, user) });
  });
  app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: safeUser(req.user) }));
  app.post('/api/auth/logout', async (req, res) => {
    const token = readToken(req);
    if (token) await db.run('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
    res.clearCookie('applytrack_session', { httpOnly: true, sameSite: 'lax', secure: production, path: '/' });
    res.json({ ok: true });
  });
  app.get('/api/applications', authenticate, async (req, res) => {
    const applications = await db.all('SELECT id, company, role, location, status, applied_on, job_url, notes, created_at, updated_at FROM applications WHERE user_id = ? ORDER BY applied_on DESC, created_at DESC', [req.user.id]);
    res.json({ applications });
  });
  app.post('/api/applications', authenticate, async (req, res) => res.status(201).json({ application: await insertApplication(req.user.id, applicationInput(req.body || {})) }));
  app.put('/api/applications/:id', authenticate, async (req, res) => {
    const old = await db.get('SELECT id FROM applications WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!old) throw fail(404, 'Application not found.');
    const fields = applicationInput(req.body || {});
    await db.run('UPDATE applications SET company = ?, role = ?, location = ?, status = ?, applied_on = ?, job_url = ?, notes = ?, updated_at = ? WHERE id = ? AND user_id = ?', [...Object.values(fields), Date.now(), req.params.id, req.user.id]);
    res.json({ application: await db.get('SELECT id, company, role, location, status, applied_on, job_url, notes, created_at, updated_at FROM applications WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]) });
  });
  app.delete('/api/applications/:id', authenticate, async (req, res) => {
    if (!await db.get('SELECT id FROM applications WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])) throw fail(404, 'Application not found.');
    await db.run('DELETE FROM applications WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  const dist = resolve('dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*path}', (req, res) => res.sendFile(resolve(dist, 'index.html')));
  }
  app.use((err, req, res, next) => {
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.type === 'entity.parse.failed' ? 'Invalid JSON.' : err.message });
    console.error('Request failed:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });
  return app;
}
