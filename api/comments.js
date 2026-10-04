// Public: read and post comments. Owner (password header): delete comments
const crypto = require("crypto");
const { redis, isAdmin, KEY } = require("./_lib");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const q = req.method === "GET" ? req.query : req.body || {};
    const id = String(q.story || "").slice(0, 100);
    if (!id) return res.status(400).json({ error: "Missing story." });
    const ck = "marginalia:comments:" + id;
    if (req.method === "POST") {
      if (q.delete) {
        if (!isAdmin(req)) return res.status(401).json({ error: "Wrong password." });
        await redis("HDEL", ck, String(q.delete));
      } else {
        const name = String(q.name || "").trim().slice(0, 40) || "Reader", text = String(q.text || "").trim().slice(0, 1000);
        if (!text) return res.status(400).json({ error: "Please write something first." });
        if (!(await redis("HEXISTS", KEY, id))) return res.status(404).json({ error: "Comments are not available for this story yet." });
        const ip = String(req.headers["x-forwarded-for"] || "x").split(",")[0].trim();
        if (!(await redis("SET", "marginalia:rl:" + ip, "1", "EX", "20", "NX"))) return res.status(429).json({ error: "Please wait a few seconds before commenting again." });
        const cid = crypto.randomBytes(6).toString("hex");
        await redis("HSET", ck, cid, JSON.stringify({ id: cid, name, text, ch: Math.max(0, Math.min(9999, Math.round(+q.ch) || 0)), ts: Date.now() }));
      }
    } else if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const raw = (await redis("HGETALL", ck)) || [];
    const vals = Array.isArray(raw) ? raw.filter((_, i) => i % 2) : Object.values(raw);
    const comments = vals.map(v => { try { return JSON.parse(v); } catch (e) { return null; } }).filter(Boolean).sort((a, b) => b.ts - a.ts).slice(0, 200);
    res.status(200).json({ comments });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
