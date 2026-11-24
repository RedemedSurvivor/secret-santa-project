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
      if (!line.trim()) continue;
      const parts = line.split(',');
      if (parts.length >= 6) {
        const rawName = (parts[1] || '').trim();
        const branch = (parts[2] || '').trim();
        const rawPhone = (parts[5] || '').trim().replace(/[^\d+]/g, '');

        if (rawName && rawPhone && (rawPhone.startsWith('254') || rawPhone.startsWith('07') || rawPhone.startsWith('01') || rawPhone.startsWith('+254'))) {
          // Normalize phone
          let p = rawPhone;
          if (p.startsWith('+')) p = p.slice(1);
          if (p.startsWith('07') || p.startsWith('01')) p = '254' + p.slice(1);

          const cleanName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
          phoneMap[cleanName] = p;

          // Also map specific common aliases
          if (rawName.toLowerCase().includes('charles') && branch.toLowerCase().includes('wambugu')) {
            phoneMap['charleswambugu'] = p;
          }
          if (rawName.toLowerCase().includes('charles') && branch.toLowerCase().includes('mwangi')) {
            phoneMap['charlesmwangi'] = p;
          }
          if (rawName.toLowerCase().includes('liam') || rawName.toLowerCase().includes('mumbi')) {
            phoneMap['mamaliam'] = p;
            phoneMap['mumbi'] = p;
          }
          if (rawName.toLowerCase().includes('esther')) {
            phoneMap['muthonimamaesther'] = p;
          }
          if (rawName.toLowerCase().includes('curtis')) {
            phoneMap['muthonimamacurtis'] = p;
          }
        }
      }
    }

    return res.status(200).json({ ok: true, numbers: phoneMap, rawLines: lines.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
