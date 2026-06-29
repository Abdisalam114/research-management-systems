const { RepositoryItem, REPOSITORY_ACCESS } = require("../models/RepositoryItem");
const { ResearchGroup } = require("../models/ResearchGroup");
const { validateProjectQuery } = require("../utils/projectScopedRecords");

async function fetchItemsForUser(req) {
  const { role } = req.user;
  const tw = (base = {}) => (req.tierWhere ? req.tierWhere(base) : base);
  const projectFilter = {};

  if (req.query?.projectId) {
    await validateProjectQuery(req, req.query.projectId, { ownerOnly: role === "researcher" });
    projectFilter.projectId = req.query.projectId;
  }

  if (["research_director", "faculty_coordinator"].includes(role)) {
    return RepositoryItem.find(tw({ ...projectFilter })).sort({ createdAt: -1 });
  }

  if (role === "finance_officer") {
    return RepositoryItem.find(tw({ access: REPOSITORY_ACCESS.INSTITUTION, ...projectFilter })).sort({ createdAt: -1 });
  }

  const groups = await ResearchGroup.find(tw({ "members.userId": req.user.id })).select("_id");
  const groupIds = groups.map((g) => g._id);

  const accessOr = [
    { uploadedBy: req.user.id },
    { access: REPOSITORY_ACCESS.INSTITUTION },
    { access: REPOSITORY_ACCESS.GROUP, groupId: { $in: groupIds } },
  ];

  if (Object.keys(projectFilter).length) {
    return RepositoryItem.find(tw({ ...projectFilter, $or: accessOr })).sort({ createdAt: -1 });
  }

  return RepositoryItem.find(tw({ $or: accessOr })).sort({ createdAt: -1 });
}

function itemsToExportRows(items, fileBaseUrl = "") {
  return items.map((it) => ({
    title: it.title || "",
    type: it.type || "",
    access: it.access || "",
    description: it.description || "",
    file: it.filePath ? `${fileBaseUrl}${it.filePath}` : "",
    created: it.createdAt ? new Date(it.createdAt).toISOString() : "",
  }));
}

function escapeCsv(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows) {
  const headers = ["Title", "Type", "Access", "Description", "File", "Created"];
  const keys = ["title", "type", "access", "description", "file", "created"];
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(keys.map((k) => escapeCsv(row[k])).join(","));
  });
  return lines.join("\r\n");
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowsToExcelXml(rows) {
  const headers = ["Title", "Type", "Access", "Description", "File", "Created"];
  const keys = ["title", "type", "access", "description", "file", "created"];
  const headerCells = headers.map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join("");
  const body = rows
    .map(
      (row) =>
        `<Row>${keys.map((k) => `<Cell><Data ss:Type="String">${xmlEscape(row[k])}</Data></Cell>`).join("")}</Row>`
    )
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Repository"><Table>
<Row>${headerCells}</Row>
${body}
</Table></Worksheet></Workbook>`;
}

function inferTypeFromFilename(filename) {
  const ext = String(filename || "")
    .toLowerCase()
    .split(".")
    .pop();
  if (ext === "pdf") return "document";
  if (ext === "csv") return "dataset";
  if (ext === "xlsx" || ext === "xls") return "dataset";
  return "document";
}

module.exports = {
  fetchItemsForUser,
  itemsToExportRows,
  rowsToCsv,
  rowsToExcelXml,
  inferTypeFromFilename,
};
