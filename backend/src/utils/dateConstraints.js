const { AppError } = require("./AppError");

const CAMPUS_TZ = "Africa/Mogadishu";

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** YYYY-MM-DD in the campus timezone (JUST / Somalia). */
function todayCalendarIso(timeZone = CAMPUS_TZ) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Calendar day for a date-only field. HTML date values are stored as UTC midnight
 * (`2026-08-14T00:00:00.000Z`) — use the ISO date so that day stays Aug 14.
 */
function calendarDateIso(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** UTC midnight of today's campus calendar date — deadline day is still open. */
function startOfTodayUtc() {
  return new Date(`${todayCalendarIso()}T00:00:00.000Z`);
}

/** Deadline remains valid through the end of that calendar day. */
function isDeadlinePassed(deadline) {
  if (!deadline) return false;
  const day = calendarDateIso(deadline);
  return Boolean(day) && day < todayCalendarIso();
}

function todayStart() {
  return startOfDay(new Date());
}

function isSameCalendarDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return startOfDay(da).getTime() === startOfDay(db).getTime();
}

/**
 * Reject newly chosen dates that are before today.
 * Existing stored values may stay unchanged so saving other fields still works.
 */
function assertDateNotInPast(value, { fieldLabel = "Date", allowUnchangedFrom } = {}) {
  if (!value) return;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new AppError(`${fieldLabel} is invalid`, 400);
  if (isSameCalendarDay(d, allowUnchangedFrom)) return;
  if (startOfDay(d) < todayStart()) {
    throw new AppError(`${fieldLabel} cannot be in the past`, 400);
  }
}

function assertDateOnOrAfter(later, earlier, { fieldLabel = "End date", earlierLabel = "start date" } = {}) {
  if (!later || !earlier) return;
  if (startOfDay(later) < startOfDay(earlier)) {
    throw new AppError(`${fieldLabel} cannot be before ${earlierLabel}`, 400);
  }
}

module.exports = {
  startOfDay,
  todayStart,
  todayCalendarIso,
  calendarDateIso,
  startOfTodayUtc,
  isDeadlinePassed,
  isSameCalendarDay,
  assertDateNotInPast,
  assertDateOnOrAfter,
};
