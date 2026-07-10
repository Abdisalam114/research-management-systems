const fs = require("fs");
const path = require("path");
const { User } = require("../models/User");

const OUTBOX_DIR = path.join(process.cwd(), "logs");
const OUTBOX_FILE = path.join(OUTBOX_DIR, "email-outbox.log");

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function appendOutbox(entry) {
  try {
    if (!fs.existsSync(OUTBOX_DIR)) fs.mkdirSync(OUTBOX_DIR, { recursive: true });
    fs.appendFileSync(OUTBOX_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // best-effort
  }
}

async function sendEmailToAddress(to, subject, text) {
  if (!to) return { sent: false, reason: "no_recipient" };
  const payload = { to, subject, text: String(text || "").slice(0, 2000), at: new Date().toISOString() };

  if (!smtpConfigured()) {
    appendOutbox({ ...payload, mode: "outbox" });
    return { sent: false, reason: "smtp_not_configured", outbox: true };
  }

  try {
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: subject || "Jamhuriya RMS notification",
      text: text || "",
    });
    return { sent: true };
  } catch (err) {
    appendOutbox({ ...payload, mode: "failed", error: err.message });
    return { sent: false, reason: err.message };
  }
}

async function sendEmailToUser(userId, subject, text) {
  if (!userId) return { sent: false };
  const user = await User.findById(userId).select("email fullName").lean();
  if (!user?.email) return { sent: false, reason: "user_email_missing" };
  return sendEmailToAddress(user.email, subject, text);
}

module.exports = { sendEmailToAddress, sendEmailToUser, smtpConfigured };
