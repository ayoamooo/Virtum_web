/* eslint-disable no-console */
const BASE = process.env.BASE_URL || 'http://localhost:5001';

async function jsonFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  console.log('Auth smoke: starting...');
  const health = await jsonFetch('/api/health');
  assert(health.ok, 'Health check failed');
  const firebaseCfg = await jsonFetch('/api/auth/firebase-config');
  assert(firebaseCfg.ok, `firebase-config failed (${firebaseCfg.status})`);
  assert(firebaseCfg.data && typeof firebaseCfg.data.enabled === 'boolean', 'firebase-config payload is invalid');

  console.log('Auth smoke: PASS');
}

run().catch((e) => {
  console.error('Auth smoke: FAIL');
  console.error(e.message);
  process.exit(1);
});
