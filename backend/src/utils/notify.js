const { Notification } = require("../models/Notification");
const { User, USER_STATUSES } = require("../models/User");
const { sendEmailToUser } = require("./emailNotify");
const fs = require("fs");
const path = require("path");

function debugLog(hypothesisId, location, message, data) {
  // #region agent log
  try {
    const line = JSON.stringify({
      sessionId: "f558f7",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
      runId: "pre-fix",
    });
    fs.appendFileSync(path.join(process.cwd(), "..", "debug-f558f7.log"), `${line}\n`);
    fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
      body: line,
    }).catch(() => {});
  } catch (_) { /* ignore */ }
  // #endregion
}

async function notifyUser(userId, { title, body, link, type = "info", programTier }) {
  // #region agent log
  debugLog("C", "notify.js:notifyUser", "notifyUser called", {
    userId: String(userId || ""),
    type,
    title: title || null,
    hasProgramTier: Boolean(programTier),
  });
  // #endregion
  if (!userId) return;
  try {
    const doc = await Notification.create({
      userId,
      type,
      title: title || "Notification",
      body: body || "",
      link: link || "",
      ...(programTier ? { programTier } : {}),
    });
    // #region agent log
    debugLog("C", "notify.js:notifyUser:created", "Notification.create ok", {
      notificationId: String(doc._id),
      type: doc.type,
    });
    // #endregion
  } catch (err) {
    // #region agent log
    debugLog("C", "notify.js:notifyUser:error", "Notification.create failed", {
      error: err?.message || String(err),
      type,
    });
    // #endregion
    throw err;
  }
  const appUrl = process.env.CLIENT_ORIGIN?.split(",")[0]?.trim() || "http://localhost:5173";
  const emailBody = `${body || ""}\n\nOpen: ${appUrl}${link || ""}`;
  sendEmailToUser(userId, title || "Jamhuriya RMS", emailBody).catch(() => {});
}

async function notifyUsersByRole(role, payload, programTier) {
  const filter = { role, status: USER_STATUSES.ACTIVE };
  if (programTier) filter.programTier = programTier;
  const users = await User.find(filter).select("_id");
  await Promise.all(users.map((u) => notifyUser(u._id, { ...payload, programTier })));
}

module.exports = { notifyUser, notifyUsersByRole };
