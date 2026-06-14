import { round } from '../../shared/money.js';
import { getAppSetting, setAppSetting } from '../../shared/settings-store.js';

export async function exchangeRate(env) {
  const cacheKey = 'exchange_rate_usd_pen';
  const cached = await getAppSetting(env, cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed.rate > 0 && Date.now() - Number(parsed.timestamp || 0) < 6 * 60 * 60 * 1000) {
        return {
          ok: true,
          base: 'USD',
          target: 'PEN',
          rate: parsed.rate,
          updatedAt: parsed.updatedAt || '',
          source: parsed.source || 'cache',
        };
      }
    } catch {
      // Malformed cache should not break the dashboard.
    }
  }

  let rate = 3.85;
  let updatedAt = new Date().toISOString();
  let source = 'fallback';

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const nextRate = Number(data?.rates?.PEN);
    if (nextRate > 0) {
      rate = round(nextRate);
      updatedAt = data?.time_last_update_utc || updatedAt;
      source = 'open.er-api.com';
    }
  } catch (_error) {
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.rate > 0) {
          return {
            ok: true,
            base: 'USD',
            target: 'PEN',
            rate: parsed.rate,
            updatedAt: parsed.updatedAt || '',
            source: `${parsed.source || 'cache'}:stale`,
          };
        }
      } catch {
        // Fall through to fallback value.
      }
    }
  }

  await setAppSetting(env, cacheKey, JSON.stringify({ rate, timestamp: Date.now(), updatedAt, source }));
  return { ok: true, base: 'USD', target: 'PEN', rate, updatedAt, source };
}
