export async function readJsonCache(env, key, maxAgeMs) {
  const raw = await getAppSetting(env, key);
  if (!raw) return { fresh: false, value: undefined };

  try {
    const parsed = JSON.parse(raw);
    const timestamp = Number(parsed.timestamp || 0);
    const fresh = Boolean(timestamp && Date.now() - timestamp < maxAgeMs);
    return { fresh, value: parsed.value };
  } catch (_error) {
    return { fresh: false, value: undefined };
  }
}

export async function setJsonCache(env, key, value) {
  await setAppSetting(env, key, JSON.stringify({ value, timestamp: Date.now() }));
}

export function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export async function getAppSetting(env, key) {
  try {
    const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?')
      .bind(key)
      .first();
    return row?.value ? String(row.value) : '';
  } catch (_error) {
    return '';
  }
}

export async function setAppSetting(env, key, value) {
  await env.DB.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).bind(key, value).run();
}
