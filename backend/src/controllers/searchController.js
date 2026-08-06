const { AppError } = require("../utils/AppError");
const { runGlobalSearch } = require("../services/globalSearchService");

async function globalSearch(req, res) {
  const q = String(req.query?.q || "").trim();
  if (q.length < 2) throw new AppError("Search query must be at least 2 characters", 400);

  const payload = await runGlobalSearch(req);
  res.json(payload);
}

module.exports = { globalSearch };
