import { handle } from '../../lib/core.js';

export const config = { path: ['/api/links', '/api/login', '/api/session'] };

export default async req => {
  const route = new URL(req.url).pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  let body = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') { try { body = await req.json(); } catch { body = null; } }
  const auth = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { status, data } = await handle(route, { method: req.method, auth, body, platform: 'netlify' });
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
};
