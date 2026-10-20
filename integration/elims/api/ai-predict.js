// Copy to ELIMS /api/ai-predict.js. This runs on Vercel, never in the browser.
// Uses the caller's Supabase JWT so database row policies remain in force.
const MODELS = new Set(['arima', 'lstm', 'xgboost', 'lightgbm', 'nature-hybrid', 'fault-rf']);
const GASES = { H2: 'h2', CH4: 'ch4', C2H2: 'c2h2', C2H4: 'c2h4', C2H6: 'c2h6', CO: 'co', CO2: 'co2' };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const { AI_API_URL, AI_API_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (![AI_API_URL, AI_API_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY].every(Boolean)) {
    return res.status(503).json({ error: 'AI integration is not configured' });
  }
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in first' });
  const body = req.body || {};
  const { transformerId, model = 'arima', forecastMonths = 12, gases = ['H2', 'CH4', 'C2H2', 'C2H4', 'C2H6', 'CO', 'CO2'] } = body;
  if (typeof transformerId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(transformerId) ||
      !MODELS.has(model) || !Number.isInteger(forecastMonths) || forecastMonths < 1 || forecastMonths > 60 ||
      !Array.isArray(gases) || !gases.length || gases.some(gas => !Object.hasOwn(GASES, gas))) {
    return res.status(400).json({ error: 'Invalid prediction request' });
  }
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: authorization };
  const base = SUPABASE_URL.replace(/\/$/, '');
  try {
    const user = await fetch(`${base}/auth/v1/user`, { headers, signal: AbortSignal.timeout(15000) });
    if (!user.ok) return res.status(401).json({ error: 'Session expired' });
    const id = encodeURIComponent(transformerId);
    const [assetResponse, testsResponse] = await Promise.all([
      fetch(`${base}/rest/v1/tx_asset_transformers?id=eq.${id}&select=*&limit=1`, { headers, signal: AbortSignal.timeout(15000) }),
      fetch(`${base}/rest/v1/tx_oil_tests?transformer_id=eq.${id}&select=*&order=test_date.desc&limit=1000`, { headers, signal: AbortSignal.timeout(15000) }),
    ]);
    if (!assetResponse.ok || !testsResponse.ok) return res.status(502).json({ error: 'Cannot read transformer history' });
    const [assets, tests] = await Promise.all([assetResponse.json(), testsResponse.json()]);
    if (!assets.length) return res.status(404).json({ error: 'Transformer unavailable for this account' });
    // Preserve missing readings: exclude incomplete records, never turn null into zero.
    const required = model === 'fault-rf' ? Object.keys(GASES) : gases;
    const history = tests.filter(row => row.test_date && required.every(gas =>
      row[GASES[gas]] !== null && row[GASES[gas]] !== '' && Number.isFinite(Number(row[GASES[gas]]))
    )).reverse().map(row => ({
      date: row.test_date,
      ...Object.fromEntries(Object.entries(GASES).filter(([, field]) => row[field] != null)
        .map(([gas, field]) => [gas, Number(row[field])])),
    }));
    if (!history.length) return res.status(422).json({ error: 'No complete records for the selected gases' });
    const asset = assets[0];
    const payload = {
      transformer: { id: transformerId, maker: asset.maker || '', brand: asset.brand || '',
        voltage: String(asset.voltage || ''), loadMVA: Number(asset.load_mva || 0),
        oilType: asset.oil_type || '', paperType: asset.paper_type || 'Not specified' },
      history, gases, forecast_months: forecastMonths,
    };
    const prediction = await fetch(`${AI_API_URL.replace(/\/$/, '')}/api/predict/${model}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AI-Token': AI_API_TOKEN },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(240000),
    });
    const result = await prediction.json();
    return res.status(prediction.status).json(result);
  } catch (error) {
    return res.status(error.name === 'TimeoutError' ? 504 : 502).json({ error: 'AI service unavailable or timed out' });
  }
}
