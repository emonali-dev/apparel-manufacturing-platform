// Supabase stand-in for browser tests: Auth (password map), PostgREST RPC and Storage,
// all executed against the local Postgres with the real migrations and RLS policies.
import { execFileSync } from 'node:child_process';

const PSQL = ['-h', '/var/tmp/pgsb', '-p', '5499', '-U', 'postgres', '-d', 'sb', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'];
export const passwords = new Map();
const files = new Map(); // bucket/path -> {body, type}
export const log = [];

const lit = (v) => { const tag = '$q' + Math.random().toString(36).slice(2, 8) + '$'; return tag + v + tag; };
export function sql(q) {
  try { return { out: execFileSync('psql', [...PSQL, '-c', q], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() }; }
  catch (e) { const m = String(e.stderr || e.message).match(/ERROR:\s+(.*)/); return { err: m ? m[1].trim() : String(e.stderr) }; }
}
function asUser(uid, body) {
  const claims = uid ? JSON.stringify({ sub: uid, role: 'authenticated' }) : '{}';
  return `begin; set local role ${uid ? 'authenticated' : 'anon'}; set local request.jwt.claims = '${claims.replace(/'/g, "''")}'; ${body}; commit;`;
}
const uidOf = (req) => { const a = req.headers()['authorization'] || ''; const m = a.match(/Bearer tok\.([0-9a-f-]{36})/); return m ? m[1] : null; };
function userJson(uid) {
  const r = sql(`select json_build_object('id', id, 'email', email, 'user_metadata', raw_user_meta_data) from auth.users where id = '${uid}'`);
  return JSON.parse(r.out);
}
export function createUser(email, password, meta = {}) {
  const r = sql(`insert into auth.users (email, raw_user_meta_data, email_confirmed_at) values (${lit(email)}, ${lit(JSON.stringify(meta))}::jsonb, now()) returning id`);
  passwords.set(email.toLowerCase(), password);
  return r.out;
}
const session = (uid) => ({ access_token: 'tok.' + uid, refresh_token: 'ref.' + uid, expires_in: 3600, user: userJson(uid) });

export async function install(page) {
  await page.route('https://ketzuhfolwhofrnliirf.supabase.co/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    const body = () => { try { return JSON.parse(req.postData() || '{}'); } catch (e) { return {}; } };
    const uid = uidOf(req);
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });

    if (p === '/auth/v1/token') {
      const b = body();
      if (url.searchParams.get('grant_type') === 'refresh_token') return json(200, session(b.refresh_token.slice(4)));
      const r = sql(`select id from auth.users where lower(email) = lower(${lit(b.email)})`);
      if (!r.out || passwords.get(b.email.toLowerCase()) !== b.password) return json(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return json(200, session(r.out));
    }
    if (p === '/auth/v1/signup') {
      const b = body();
      if (sql(`select 1 from auth.users where lower(email) = lower(${lit(b.email)})`).out) return json(422, { error_code: 'user_already_exists' });
      return json(200, session(createUser(b.email, b.password, b.data || {})));
    }
    if (p === '/auth/v1/user') {
      if (!uid) return json(401, { message: 'NOT_AUTHENTICATED' });
      if (req.method() === 'PUT') { const b = body(); const u = userJson(uid); if (b.password) passwords.set(u.email.toLowerCase(), b.password); return json(200, u); }
      return json(200, userJson(uid));
    }
    if (p === '/auth/v1/logout') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    if (p === '/auth/v1/recover') return json(200, {});

    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice(13).replace(/[^a-z0-9_]/g, '');
      const args = Object.entries(body()).map(([k, v]) => `${k.replace(/[^a-z0-9_]/g, '')} => ${v === null ? 'NULL' : lit(typeof v === 'object' ? JSON.stringify(v) : String(v))}`).join(', ');
      const r = sql(asUser(uid, `select coalesce(to_jsonb(public.${fn}(${args})), 'null'::jsonb)::text`));
      log.push({ fn, err: r.err || null });
      if (r.err) {
        const code = r.err.replace(/^permission denied.*/, 'NOT_AUTHORIZED');
        return json(code === 'NOT_AUTHENTICATED' ? 401 : 400, { message: code, code: 'P0001' });
      }
      return json(200, JSON.parse(r.out.split('\n').pop()));
    }

    let m;
    if ((m = p.match(/^\/storage\/v1\/object\/(public|authenticated)\/([^/]+)\/(.+)$/))) {
      const bucket = m[2], name = decodeURIComponent(m[3]);
      const key = bucket + '/' + name;
      if (m[1] === 'public') {
        if (bucket !== 'apparel-media' || !files.has(key)) return route.fulfill({ status: 404, body: 'not found' });
      } else {
        const r = sql(asUser(uid, `select count(*) from storage.objects where bucket_id = ${lit(bucket)} and name = ${lit(name)}`));
        if (r.err || r.out.split('\n').pop() !== '1') return json(400, { message: 'Object not found' });
      }
      const f = files.get(key);
      return route.fulfill({ status: 200, contentType: f.type, body: f.body, headers: { 'access-control-allow-origin': '*' } });
    }
    if ((m = p.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/)) && req.method() === 'POST') {
      const bucket = m[1], name = m[2].split('/').map(decodeURIComponent).join('/');
      if (!uid) return json(401, { message: 'NOT_AUTHENTICATED' });
      const r = sql(asUser(uid, `insert into storage.objects (bucket_id, name, owner, metadata) values (${lit(bucket)}, ${lit(name)}, '${uid}', '{}')`));
      log.push({ fn: 'storage.upload ' + bucket + '/' + name, err: r.err || null });
      if (r.err) return json(403, { message: 'new row violates row-level security policy', error: 'Unauthorized' });
      files.set(bucket + '/' + name, { body: req.postDataBuffer(), type: req.headers()['content-type'] });
      return json(200, { Key: bucket + '/' + name });
    }
    if ((m = p.match(/^\/storage\/v1\/object\/([^/]+)$/)) && req.method() === 'DELETE') {
      const b = body();
      (b.prefixes || []).forEach((n) => { sql(asUser(uid, `delete from storage.objects where bucket_id = ${lit(m[1])} and name = ${lit(n)}`)); files.delete(m[1] + '/' + n); });
      return json(200, []);
    }
    return json(404, { message: 'emulator: unhandled ' + req.method() + ' ' + p });
  });
}
