// Public: only published stories
const { allStories } = require("./_lib");
module.exports = async (req, res) => {
  try {
    const { stories, ready } = await allStories();
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=60");
    res.status(200).json({ ready, stories: stories.filter(s => s.published !== false) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
