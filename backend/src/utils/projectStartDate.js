const { AppError } = require("./AppError");

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Project timeline starts at creation — never before approval / project record. */
function resolveProjectStartDate(project) {
  if (!project) return null;
  const created = project.createdAt ? new Date(project.createdAt) : null;
  const stored = project.startDate ? new Date(project.startDate) : null;
  if (!created && !stored) return null;
  if (!created) return stored;
  if (!stored) return created;
  return stored < created ? created : stored;
}

function assertDateOnOrAfterProjectStart(project, value, { fieldLabel = "Date" } = {}) {
  if (!value) return;
  const start = resolveProjectStartDate(project);
  if (!start) return;
  if (startOfDay(value) < startOfDay(start)) {
    throw new AppError(
      `${fieldLabel} cannot be before project start (${startOfDay(start).toISOString().slice(0, 10)})`,
      400
    );
  }
}

module.exports = { resolveProjectStartDate, assertDateOnOrAfterProjectStart, startOfDay };
