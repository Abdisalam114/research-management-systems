const { sendProtectedUpload } = require("../utils/uploadsPath");

async function downloadUpload(req, res) {
  sendProtectedUpload(res, req.query.path);
}

module.exports = { downloadUpload };
