/** Local calendar YYYY-MM-DD (avoids UTC shifting the day in Somalia / UTC+3). */
export function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dateIso(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Earliest date the user may pick: today, or later if extra floors are given. */
export function minSelectableDate(...extras) {
  const dates = [todayIso(), ...extras.map(dateIso).filter(Boolean)].sort();
  return dates[dates.length - 1];
}

export function isDateInPast(value) {
  const iso = dateIso(value);
  return Boolean(iso) && iso < todayIso();
}

export function pastDateMessage(fieldLabel = "Date") {
  return `${fieldLabel} cannot be in the past`;
}
