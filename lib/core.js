// Logika bersama untuk Netlify & Vercel: auth, validasi, penyimpanan.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

export const DEFAULTS = {
  name: 'Nama Kamu',
  role: 'Desainer & Pengembang Web',
  loc: 'Jakarta',
  tz: 'Asia/Jakarta',
  status: 'Terbuka untuk proyek baru',
  bio: 'Saya membuat produk digital yang rapi dan mudah dipakai. Semua proyek dan tempat saya hadir ada di bawah ini.',
  accent: '#f26000',
  theme: 'auto',
  footer: '© Nama Kamu',
  links: [
    { t: 'Website Utama', d: 'Portofolio dan studi kasus', u: 'https://contoh.com', on: true, hl: true },
    { t: 'Blog', d: 'Catatan tentang desain dan kode', u: 'https://blog.contoh.com', on: true, hl: false },
    { t: 'Toko Online', d: 'Template dan aset digital', u: 'https://toko.contoh.com', on: true, hl: false },
    { t: 'Hubungi Saya', d: 'Untuk kolaborasi dan proyek', u: 'mailto:halo@contoh.com', on: true, hl: false }
  ]
};

const KEY = 'linkbio:config';
const TTL = 7 * 24 * 3600 * 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- auth ---------- */
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const secret = () => process.env.SESSION_SECRET || sha('lb-session:' + (process.env.ADMIN_PASSWORD || '')).toString('hex');

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return body + '.' + sig;
}

function verify(token) {
  if (!process.env.ADMIN_PASSWORD || typeof token !== 'string') return false;
  const [body, sig] = token.split('.');
  if (!body || !sig) return false;
  const want = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return typeof p.exp === 'number' && p.exp > Date.now();
  } catch { return false; }
}

const passwordOk = input => crypto.timingSafeEqual(sha(input), sha(process.env.ADMIN_PASSWORD || ''));

/* ---------- validasi ---------- */
const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);

function cleanUrl(v) {
  const u = str(v, 500);
  if (!u) return '';
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) && !/^[a-z0-9.-]+:\d+/i.test(u)) return ''; // tolak javascript:, data:, dll
  return u;
}

export function sanitize(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Data tidak valid.');
  let tz = str(d.tz, 60);
  if (tz) { try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { tz = DEFAULTS.tz; } }
  const links = (Array.isArray(d.links) ? d.links : []).slice(0, 40).map(l => ({
    t: str(l && l.t, 80),
    d: str(l && l.d, 140),
    u: cleanUrl(l && l.u),
    on: !(l && l.on === false),
    hl: !!(l && l.hl)
  })).filter(l => l.u && l.t);
  return {
    name: str(d.name, 60) || DEFAULTS.name,
    role: str(d.role, 100),
    loc: str(d.loc, 40),
    tz,
    status: str(d.status, 60),
    bio: str(d.bio, 300),
    accent: /^#[0-9a-f]{6}$/i.test(d.accent) ? d.accent.toLowerCase() : DEFAULTS.accent,
    theme: ['auto', 'light', 'dark'].includes(d.theme) ? d.theme : 'auto',
    footer: str(d.footer, 80),
    links
  };
}

/* ---------- penyimpanan ---------- */
function upstash(url, token) {
  const call = async cmd => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || 'Upstash error ' + r.status);
    return j.result;
  };
  return {
    name: 'upstash',
    get: async () => { const v = await call(['GET', KEY]); return v ? JSON.parse(v) : null; },
    set: d => call(['SET', KEY, JSON.stringify(d)])
  };
}

async function netlifyBlobs() {
  const { getStore } = await import('@netlify/blobs');
  const store = getStore({ name: 'linkbio', consistency: 'strong' });
  return {
    name: 'netlify-blobs',
    get: () => store.get('config', { type: 'json' }),
    set: d => store.setJSON('config', d)
  };
}

function fileStore() {
  const file = new URL('../.data/config.json', import.meta.url);
  return {
    name: 'file',
    get: async () => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; } },
    set: async d => { await fs.mkdir(new URL('../.data/', import.meta.url), { recursive: true }); await fs.writeFile(file, JSON.stringify(d, null, 2)); }
  };
}

async function storage(platform) {
  const e = process.env;
  const url = e.UPSTASH_REDIS_REST_URL || e.KV_REST_API_URL;
  const token = e.UPSTASH_REDIS_REST_TOKEN || e.KV_REST_API_TOKEN;
  if (url && token) return upstash(url, token);
  if (platform === 'netlify') return netlifyBlobs();
  if (platform === 'local') return fileStore();
  return null;
}

/* ---------- handler utama ---------- */
export async function handle(route, { method, auth, body, platform }) {
  const out = (status, data) => ({ status, data });
  const authed = () => verify(auth);
  try {
    if (route === 'links') {
      if (method === 'GET') {
        const st = await storage(platform);
        const saved = st ? await st.get() : null;
        return out(200, saved && Array.isArray(saved.links) ? saved : DEFAULTS);
      }
      if (method === 'PUT') {
        if (!authed()) return out(401, { error: 'Sesi habis. Masuk lagi.' });
        const st = await storage(platform);
        if (!st) return out(503, { code: 'no_storage', error: 'Penyimpanan belum disiapkan. Lihat README (bagian Vercel).' });
        const clean = sanitize(body);
        await st.set(clean);
        return out(200, clean);
      }
    }
    if (route === 'login' && method === 'POST') {
      if (!process.env.ADMIN_PASSWORD) return out(500, { error: 'ADMIN_PASSWORD belum diatur di environment variables.' });
      const pw = body && typeof body.password === 'string' ? body.password : '';
      if (!passwordOk(pw)) { await sleep(800); return out(401, { error: 'Kata sandi salah.' }); }
      return out(200, { token: sign({ exp: Date.now() + TTL }) });
    }
    if (route === 'session' && method === 'GET') {
      if (!authed()) return out(401, { error: 'Belum masuk.' });
      const st = await storage(platform).catch(() => null);
      return out(200, { ok: true, storage: st ? st.name : 'none' });
    }
    return out(405, { error: 'Metode tidak didukung.' });
  } catch (e) {
    console.error('[api]', route, e);
    return out(500, { error: 'Terjadi kesalahan di server: ' + (e && e.message ? e.message : 'tidak diketahui') });
  }
}
