import { handle } from './core.js';

export const vercelHandler = route => async (req, res) => {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { status, data } = await handle(route, { method: req.method, auth, body, platform: 'vercel' });
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(data);
};
