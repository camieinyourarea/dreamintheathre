// Public: read and post comments and replies. Owner (password header): delete comments
const crypto = require("crypto");
const { redis, isAdmin, KEY } = require("./_lib");

const parse = raw => {
  const vals = Array.isArray(raw) ? raw.filter((_, i) => i % 2) : Object.values(raw || {});
  return vals.map(v => { try { return JSON.parse(v); } catch (e) { return null; } }).filter(Boolean);
};

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
        const del = String(q.delete), kids = parse(await redis("HGETALL", ck)).filter(c => c.parent === del).map(c => c.id);
        await redis("HDEL", ck, del, ...kids);
      } else if (q.like) {
        const v = String(q.vid || "").slice(0, 64), cid = String(q.like);
        if (v.length < 8) return res.status(400).json({ error: "Invalid visitor." });
        if (!(await redis("HEXISTS", ck, cid))) return res.status(400).json({ error: "That comment no longer exists." });
        const lk = "marginalia:likes:" + id, f = cid + "|" + v;
        if (await redis("HEXISTS", lk, f)) await redis("HDEL", lk, f); else await redis("HSET", lk, f, "1");
      } else {
        const name = String(q.name || "").trim().slice(0, 40) || "Reader", text = String(q.text || "").trim().slice(0, 1000);
        if (!text) return res.status(400).json({ error: "Please write something first." });
        if (!(await redis("HEXISTS", KEY, id))) return res.status(404).json({ error: "Comments are not available for this story yet." });
        let parent = "";
        if (q.parent) {
          const pj = await redis("HGET", ck, String(q.parent));
          if (!pj) return res.status(400).json({ error: "That comment no longer exists." });
          const pc = JSON.parse(pj); parent = pc.parent || pc.id; // replies stay one level deep
        }
        const ip = String(req.headers["x-forwarded-for"] || "x").split(",")[0].trim();
        if (!(await redis("SET", "marginalia:rl:" + ip, "1", "EX", "20", "NX"))) return res.status(429).json({ error: "Please wait a few seconds before commenting again." });
        const cid = crypto.randomBytes(6).toString("hex");
        await redis("HSET", ck, cid, JSON.stringify({ id: cid, name, text, parent, ch: Math.max(0, Math.min(9999, Math.round(+q.ch) || 0)), ts: Date.now() }));
      }
    } else if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const me = String(q.vid || "").slice(0, 64), comments = parse(await redis("HGETALL", ck)).sort((a, b) => b.ts - a.ts).slice(0, 500);
    const lr = (await redis("HGETALL", "marginalia:likes:" + id)) || [], flat = Array.isArray(lr) ? lr : Object.entries(lr).flat(), counts = {}, mine = {};
    for (let i = 0; i < flat.length; i += 2) { const [cid, v] = String(flat[i]).split("|"); counts[cid] = (counts[cid] || 0) + 1; if (v === me) mine[cid] = true; }
    comments.forEach(c => { c.likes = counts[c.id] || 0; c.liked = !!mine[c.id]; });
    res.status(200).json({ comments });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
