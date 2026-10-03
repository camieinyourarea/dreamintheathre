const crypto = require("crypto");
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "marginalia:stories", READY = "marginalia:ready";

async function redis(...cmd) {
  if (!URL_ || !TOKEN) throw new Error("Database is not connected yet (Upstash Redis variables are missing).");
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN }, body: JSON.stringify(cmd) });
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d.result;
}

async function allStories() {
  const [raw, ready] = await Promise.all([redis("HGETALL", KEY), redis("EXISTS", READY)]);
  const vals = Array.isArray(raw) ? raw.filter((_, i) => i % 2) : Object.values(raw || {});
  const stories = vals.map(v => { try { return JSON.parse(v); } catch (e) { return null; } }).filter(Boolean);
  stories.sort((a, b) => (b.updated || 0) - (a.updated || 0));
  return { stories, ready: !!ready };
}

function isAdmin(req) {
  const a = Buffer.from(String(req.headers["x-admin-password"] || ""));
  const b = Buffer.from(process.env.ADMIN_PASSWORD || "");
  return b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { redis, allStories, isAdmin, KEY, READY };
