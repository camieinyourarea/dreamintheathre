// Public: star ratings (1-5), one per visitor id
const { redis, KEY } = require("./_lib");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const q = req.method === "GET" ? req.query : req.body || {};
    const id = String(q.story || "").slice(0, 100), vid = String(q.vid || "").slice(0, 64);
    if (!id) return res.status(400).json({ error: "Missing story." });
    const rk = "marginalia:rate:" + id;
    if (req.method === "POST") {
      const score = Math.round(+q.score);
      if (!(score >= 1 && score <= 5) || vid.length < 8) return res.status(400).json({ error: "Invalid rating." });
      if (!(await redis("HEXISTS", KEY, id))) return res.status(404).json({ error: "Ratings are not available for this story yet." });
      await redis("HSET", rk, vid, String(score));
    } else if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const vals = ((await redis("HVALS", rk)) || []).map(Number);
    const mine = vid ? await redis("HGET", rk, vid) : null;
    res.status(200).json({ count: vals.length, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, mine: mine ? +mine : 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
