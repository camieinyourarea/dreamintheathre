// Public: one full story (including visual-novel scenes and pictures)
const { redis, KEY } = require("./_lib");
module.exports = async (req, res) => {
  try {
    const raw = await redis("HGET", KEY, String(req.query.id || ""));
    const s = raw ? JSON.parse(raw) : null;
    if (!s || s.published === false) return res.status(404).json({ error: "Not found." });
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=60");
    res.status(200).json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
