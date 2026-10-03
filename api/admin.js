// Owner only: read everything, save or delete stories
const { redis, allStories, isAdmin, KEY, READY } = require("./_lib");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!isAdmin(req)) return res.status(401).json({ error: "Wrong password." });
  try {
    if (req.method === "GET") return res.status(200).json(await allStories());
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { stories, delete: del } = req.body || {};
    if (del) await redis("HDEL", KEY, String(del));
    if (Array.isArray(stories)) {
      const args = [];
      for (const s of stories) if (s && s.id) args.push(String(s.id), JSON.stringify(s));
      if (args.length) await redis("HSET", KEY, ...args);
    }
    await redis("SET", READY, "1");
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
