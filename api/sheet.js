export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const sheetUrl = 'https://docs.google.com/spreadsheets/d/1v7b_UXMgc5ICkLv-tNYdXt5fE9oBGnSOd2vRk9vtBuY/export?format=csv&gid=0&_t=' + Date.now();
    const response = await fetch(sheetUrl);
    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to fetch Google Sheet' });
    }
    const text = await response.text();
    const lines = text.split('\n');

    const phoneMap = {};
    for (const line of lines) {
      // Find rows that have a phone number (e.g. 254... or 07...)
      const match = line.match(/(254\d{9}|07\d{8}|01\d{8})/);
      if (match) {
        const phone = match[1];
        // match name before the phone number
        const cols = line.split(',');
        for (const col of cols) {
          const clean = col.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          if (clean && clean.length > 2 && !clean.includes('branch') && !clean.includes('cousin')) {
            phoneMap[clean] = phone;
          }
        }
      }
    }

    return res.status(200).json({ ok: true, numbers: phoneMap, rawLines: lines.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
