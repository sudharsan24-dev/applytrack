import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/database.js';
import { createApp } from '../server/app.js';

let server, db, origin;
let aliceCookie, bobCookie, recordId;
const payload = { company: 'Example Labs', role: 'React Intern', location: 'Chennai', status: 'Applied', applied_on: '2026-01-01', job_url: 'https://example.com/jobs/1', notes: 'Preparing for the interview.' };
async function request(path, { method = 'GET', body, cookie, requestOrigin } = {}) {
  const response = await fetch(`${origin}/api${path}`, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...(requestOrigin ? { Origin: requestOrigin } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
}
before(async () => {
  db = await openDatabase({ driver: 'sqlite', filename: ':memory:' });
  const app = createApp(db, { origin: 'http://localhost:5173', production: false });
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); await db.close(); });

test('anonymous access is rejected', async () => {
  assert.equal((await request('/applications')).status, 401);
  assert.equal((await request('/applications', { method: 'POST', body: payload })).status, 401);
});
test('registration validates input and creates a protected session', async () => {
  assert.equal((await request('/auth/register', { method: 'POST', body: { name: 'A', email: 'not-email', password: 'abcdefghij' } })).status, 400);
  assert.equal((await request('/auth/register', { method: 'POST', body: { name: 'A', email: 'a@example.com', password: 'short' } })).status, 400);
  const result = await request('/auth/register', { method: 'POST', body: { name: 'Alice', email: 'ALICE@example.com', password: 'password-1234' } });
  assert.equal(result.status, 201);
  assert.equal(result.data.user.email, 'alice@example.com');
  assert.ok(!('password_hash' in result.data.user));
  assert.match(result.headers.get('set-cookie'), /HttpOnly/);
  assert.match(result.headers.get('set-cookie'), /SameSite=Lax/);
  aliceCookie = result.cookie;
  const stored = await db.get('SELECT password_hash FROM users WHERE email = ?', ['alice@example.com']);
  assert.notEqual(stored.password_hash, 'password-1234');
  const session = await db.get('SELECT token_hash FROM sessions');
  assert.notEqual(session.token_hash, aliceCookie.split('=')[1]);
  assert.deepEqual((await request('/applications', { cookie: aliceCookie })).data.applications, []);
  assert.equal((await request('/auth/register', { method: 'POST', body: { name: 'Alice', email: 'alice@example.com', password: 'password-1234' } })).status, 409);
});
test('creates and updates applications with all fields preserved', async () => {
  const created = await request('/applications', { method: 'POST', body: payload, cookie: aliceCookie });
  assert.equal(created.status, 201);
  recordId = created.data.application.id;
  assert.equal((await request('/applications', { cookie: aliceCookie })).data.applications.length, 1);
  const changed = { ...payload, status: 'Interview', notes: 'Technical round next week', company: 'Updated Labs', role: 'Full Stack Intern', applied_on: '2026-01-02', location: 'Remote', job_url: 'https://example.com/jobs/2' };
  const updated = await request(`/applications/${recordId}`, { method: 'PUT', body: changed, cookie: aliceCookie });
  assert.equal(updated.status, 200);
  for (const [key, value] of Object.entries(changed)) assert.equal(updated.data.application[key], value);
  const persisted = (await request('/applications', { cookie: aliceCookie })).data.applications[0];
  assert.equal(persisted.status, 'Interview');
});
test('rejects invalid dates, status, links and oversized values', async () => {
  for (const override of [{ applied_on: '2026-02-30' }, { applied_on: '9999-01-01' }, { status: 'Unknown' }, { job_url: 'javascript:alert(1)' }, { company: 'x'.repeat(101) }, { role: '' }]) {
    assert.equal((await request('/applications', { method: 'POST', body: { ...payload, ...override }, cookie: aliceCookie })).status, 400);
  }
});
test('another user cannot see, change or delete Alice’s application', async () => {
  const bob = await request('/auth/register', { method: 'POST', body: { name: 'Bob', email: 'bob@example.com', password: 'password-1234' } });
  bobCookie = bob.cookie;
  assert.deepEqual((await request('/applications', { cookie: bobCookie })).data.applications, []);
  assert.equal((await request(`/applications/${recordId}`, { method: 'PUT', body: payload, cookie: bobCookie })).status, 404);
  assert.equal((await request(`/applications/${recordId}`, { method: 'DELETE', body: {}, cookie: bobCookie })).status, 404);
});
test('rejects cross-origin writes and handles SQL-looking content as data', async () => {
  assert.equal((await request('/applications', { method: 'POST', body: payload, cookie: aliceCookie, requestOrigin: 'https://untrusted.example' })).status, 403);
  const suspicious = "x'); DROP TABLE applications; --";
  const result = await request('/applications', { method: 'POST', body: { ...payload, company: suspicious }, cookie: aliceCookie, requestOrigin: 'http://localhost:5173' });
  assert.equal(result.status, 201);
  assert.equal(result.data.application.company, suspicious);
  assert.equal((await request('/applications', { cookie: aliceCookie })).data.applications.length, 2);
});
test('login rejects a wrong password and logout invalidates the old session', async () => {
  assert.equal((await request('/auth/login', { method: 'POST', body: { email: 'alice@example.com', password: 'wrong' } })).status, 401);
  assert.equal((await request('/auth/logout', { method: 'POST', body: {}, cookie: aliceCookie })).status, 200);
  assert.equal((await request('/auth/me', { cookie: aliceCookie })).status, 401);
  const login = await request('/auth/login', { method: 'POST', body: { email: 'alice@example.com', password: 'password-1234' } });
  assert.equal(login.status, 200);
  aliceCookie = login.cookie;
  assert.equal((await request('/applications', { cookie: aliceCookie })).data.applications.length, 2);
});
test('delete removes only the selected application', async () => {
  assert.equal((await request(`/applications/${recordId}`, { method: 'DELETE', body: {}, cookie: aliceCookie })).status, 200);
  assert.equal((await request(`/applications/${recordId}`, { method: 'DELETE', body: {}, cookie: aliceCookie })).status, 404);
  assert.equal((await request('/applications', { cookie: aliceCookie })).data.applications.length, 1);
});
test('each demo is isolated and seeds eight fictional applications', async () => {
  const a = await request('/auth/demo', { method: 'POST', body: {} });
  const b = await request('/auth/demo', { method: 'POST', body: {} });
  assert.equal(a.status, 201);
  assert.equal(a.data.user.isDemo, true);
  assert.notEqual(a.data.user.id, b.data.user.id);
  const recordsA = (await request('/applications', { cookie: a.cookie })).data.applications;
  const recordsB = (await request('/applications', { cookie: b.cookie })).data.applications;
  assert.equal(recordsA.length, 8);
  assert.equal(recordsB.length, 8);
  assert.ok(recordsA.every(x => !recordsB.some(y => y.id === x.id)));
});
test('expired sessions cannot access the API', async () => {
  await db.run('UPDATE sessions SET expires_at = ? WHERE user_id = (SELECT id FROM users WHERE email = ?)', [Date.now() - 1, 'bob@example.com']);
  assert.equal((await request('/auth/me', { cookie: bobCookie })).status, 401);
});
