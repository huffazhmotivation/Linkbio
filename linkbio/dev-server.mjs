// Server lokal sederhana untuk mencoba tanpa Netlify/Vercel CLI.
// Jalankan: ADMIN_PASSWORD=rahasia npm run dev  ->  http://localhost:8888
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from './lib/core.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const port = process.env.PORT || 8888;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    let raw = '';
    for await (const c of req) raw += c;
    let body = null; try { body = raw ? JSON.parse(raw) : null; } catch {}
    const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const { status, data } = await handle(url.pathname.slice(5), { method: req.method, auth, body, platform: 'local' });
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify(data));
  }
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[\/\\])+/, '');
  if (p.endsWith('/') || p === '/admin') p = path.join(p, 'index.html');
  try {
    const buf = await fs.readFile(path.join(root, p));
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, () => console.log('http://localhost:' + port + '  (admin: /admin/)'));
