// Public: only published stories (visual-novel scenes and pictures load only when played)
const { allStories } = require("./_lib");
module.exports = async (req, res) => {
  try {
    const { stories, ready } = await allStories();
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=60");
    res.status(200).json({
      ready,
      stories: stories.filter(s => s.published !== false).map(s => (s.type === "vn" ? { ...s, vn: undefined } : s))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
