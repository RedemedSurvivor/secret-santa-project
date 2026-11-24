// Vercel Serverless Function: /api/spin
// Tracks which private tokens have spun (without storing any pairing/recipient info).

const TOKENS = [
  'niJkMuPx5R', 'ZkCefEMGcx', 'sSLTZvKrFN', 'Q2K3PipgbJ', '9aywW8gyz4', 'NTtLoawQTq',
  'Lydmg5qspz', 'M2APYHUTyE', 'FxYvZTtX54', '5bQ598oW8T', 'pX238b3uK6', '68e63gjNgE',
  'R78a2sQ44V', 'B7a3vE53kM', '2524cP6a3S', '2zX3jM8s4P', '8bN2vK5w3Q', 'QK58oLaUbd',
  '2fT7xQ9v4K', '3mZ8wP2c6V', '5vR4nL7y9X', 'pjFhqi9t4f', '5obR5FBUjx', 'nNnaCHS9XJ'
];

const NAMESPACE = 'njithi-santa-2026';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const token = String(body.token || '').trim();
      if (!TOKENS.includes(token)) {
        return res.status(400).json({ error: 'Invalid token' });
      }
      const r = await fetch(`https://abacus.jasoncameron.dev/hit/${NAMESPACE}/${token}`);
      const data = await r.json().catch(() => ({}));
      return res.status(200).json({ ok: true, value: data.value || 1 });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      const spun = {};
      await Promise.all(
        TOKENS.map(async (token) => {
          try {
            const r = await fetch(`https://abacus.jasoncameron.dev/get/${NAMESPACE}/${token}`);
            if (r.ok) {
              const data = await r.json();
              spun[token] = (data.value || 0) > 0;
            } else {
              spun[token] = false;
            }
          } catch {
            spun[token] = false;
          }
        })
      );
      return res.status(200).json({ spun });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
