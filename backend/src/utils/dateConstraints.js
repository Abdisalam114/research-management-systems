const { AppError } = require("./AppError");

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
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
  isSameCalendarDay,
  assertDateNotInPast,
  assertDateOnOrAfter,
};
