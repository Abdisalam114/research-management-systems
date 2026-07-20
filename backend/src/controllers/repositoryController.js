const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { RepositoryItem, REPOSITORY_ACCESS } = require("../models/RepositoryItem");
const { ResearchGroup } = require("../models/ResearchGroup");
const { AppError } = require("../utils/AppError");
const { resolveOwnedProjectId, requireOwnedProjectId, validateProjectQuery } = require("../utils/projectScopedRecords");
const {
  fetchItemsForUser,
  itemsToExportRows,
  rowsToCsv,
  rowsToExcelXml,
  inferTypeFromFilename,
} = require("../services/repositoryExportService");
const {
  OAI_DC_PREFIX,
  OAI_REPOSITORY_NAME,
  OAI_ADMIN_EMAIL,
  getPublicBaseUrl,
  getOaiEndpoint,
  wrapOaiResponse,
  oaiError,
  encodeResumptionToken,
  decodeResumptionToken,
  recordXml,
  paginateRecords,
} = require("../utils/oaiPmh");
const {
  SET_REPO,
  SET_PUBLICATIONS,
  loadAllOaiRecords,
  filterRecords,
  findRecordByIdentifier,
  earliestDatestamp,
} = require("../services/oaiRecordService");

function xmlEscape(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeItem(i) {
  return {
    id: i._id,
    type: i.type,
    title: i.title,
    description: i.description,
    tags: i.tags,
    filePath: i.filePath,
    fileSize: i.fileSize,
    access: i.access,
    groupId: i.groupId,
    projectId: i.projectId?._id ? String(i.projectId._id) : i.projectId || null,
    projectTitle:
      i.projectId && typeof i.projectId === "object" && i.projectId.title ? i.projectId.title : null,
    uploadedBy: i.uploadedBy,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

async function listItems(req, res) {
  const items = await fetchItemsForUser(req);
  const populated = await RepositoryItem.populate(items, { path: "projectId", select: "title status" });

  // #region agent log
  try {
    fs.appendFileSync(
      path.join(__dirname, "../../../debug-f558f7.log"),
      `${JSON.stringify({
        sessionId: "f558f7",
        hypothesisId: "REPO1",
        location: "repositoryController.listItems",
        message: "repository list project-scoped",
        data: {
          role: req.user.role,
          projectIdQuery: req.query.projectId ? String(req.query.projectId) : null,
          count: populated.length,
          withProjectId: populated.filter((i) => i.projectId).length,
        },
        timestamp: Date.now(),
      })}\n`
    );
  } catch {
    /* ignore */
  }
  // #endregion

  return res.json({ items: populated.map(sanitizeItem) });
}

async function uploadItem(req, res) {
  const { title, description, tags, access, groupId, projectId } = req.body || {};
  if (!title) throw new AppError("title is required", 400);
  if (!req.file) throw new AppError("file is required", 400);

  const type = inferTypeFromFilename(req.file.originalname);

  const normalizedAccess = access && Object.values(REPOSITORY_ACCESS).includes(access) ? access : REPOSITORY_ACCESS.PRIVATE;
  const normalizedGroupId = normalizedAccess === REPOSITORY_ACCESS.GROUP ? groupId || null : null;

  if (normalizedAccess === REPOSITORY_ACCESS.GROUP) {
    if (!normalizedGroupId) throw new AppError("groupId is required for group access", 400);
    const group = await ResearchGroup.findOne(req.tierWhere({ _id: normalizedGroupId }));
    if (!group) throw new AppError("Research group not found", 404);
    const isMember = (group.members || []).some((m) => String(m.userId) === String(req.user.id));
    if (!isMember) throw new AppError("Forbidden", 403);
  }

  const linkedProjectId =
    req.user.role === "researcher"
      ? await requireOwnedProjectId(req, projectId, req.user.id)
      : projectId
        ? await validateProjectQuery(req, projectId)
        : null;

  if (!linkedProjectId) {
    throw new AppError("projectId is required — select the research project this file belongs to", 400);
  }

  const item = await RepositoryItem.create(req.tierAssign({
    type,
    title: String(title).trim(),
    description: description ? String(description) : "",
    tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
    filePath: `/uploads/${req.file.filename}`,
    fileSize: req.file.size || 0,
    access: normalizedAccess,
    groupId: normalizedGroupId,
    projectId: linkedProjectId,
    uploadedBy: req.user.id,
  }));

  let projectCompletion = null;
  if (linkedProjectId) {
    try {
      const { maybeCompleteFundedProject } = require("../utils/maybeCompleteFundedProject");
      projectCompletion = await maybeCompleteFundedProject(linkedProjectId);
    } catch { /* best-effort */ }
  }

  res.status(201).json({ item: sanitizeItem(item), projectCompletion });
}

async function getItem(req, res) {
  const { id } = req.params;
  const item = await RepositoryItem.findOne(req.tierWhere({ _id: id }));
  if (!item) throw new AppError("Repository item not found", 404);

  const isStaff = ["research_director", "faculty_coordinator"].includes(req.user.role);
  if (isStaff) return res.json({ item: sanitizeItem(item) });

  if (String(item.uploadedBy) === String(req.user.id)) return res.json({ item: sanitizeItem(item) });

  if (item.access === REPOSITORY_ACCESS.INSTITUTION) return res.json({ item: sanitizeItem(item) });

  if (item.access === REPOSITORY_ACCESS.GROUP && item.groupId) {
    const group = await ResearchGroup.findOne(req.tierWhere({ _id: item.groupId }));
    const isMember = group && (group.members || []).some((m) => String(m.userId) === String(req.user.id));
    if (isMember) return res.json({ item: sanitizeItem(item) });
  }

  throw new AppError("Forbidden", 403);
}

async function deleteItem(req, res) {
  const { id } = req.params;
  const item = await RepositoryItem.findOne(req.tierWhere({ _id: id }));
  if (!item) throw new AppError("Repository item not found", 404);

  const isDirector = req.user.role === "research_director";
  const isOwner = String(item.uploadedBy) === String(req.user.id);
  if (!isDirector && !isOwner) throw new AppError("Forbidden", 403);

  const filePath = item.filePath;
  const title = item.title;
  await item.deleteOne();

  if (filePath) {
    try {
      const abs = path.join(process.cwd(), filePath.replace(/^\//, ""));
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch {
      /* optional file cleanup */
    }
  }

  // #region agent log
  try {
    fs.appendFileSync(
      path.join(__dirname, "../../../debug-f558f7.log"),
      `${JSON.stringify({
        sessionId: "f558f7",
        hypothesisId: "REPO2",
        location: "repositoryController.deleteItem",
        message: "repository item deleted",
        data: { id, title, projectId: item.projectId ? String(item.projectId) : null, by: req.user.role },
        timestamp: Date.now(),
      })}\n`
    );
  } catch {
    /* ignore */
  }
  // #endregion

  res.json({ message: "Repository item deleted", id });
}

async function buildExportRows(req) {
  const items = await fetchItemsForUser(req);
  const baseUrl = getPublicBaseUrl(req);
  return itemsToExportRows(items, baseUrl);
}

function logRepositoryExport(format, rowCount) {
}

async function exportRepositoryCsv(req, res) {
  const rows = await buildExportRows(req);
  logRepositoryExport("csv", rows.length);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="JUST-RMS-Repository.csv"');
  res.send(rowsToCsv(rows));
}

async function exportRepositoryExcel(req, res) {
  const rows = await buildExportRows(req);
  logRepositoryExport("xlsx", rows.length);
  res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="JUST-RMS-Repository.xls"');
  res.send(rowsToExcelXml(rows));
}

async function exportRepositoryPdf(req, res) {
  const rows = await buildExportRows(req);
  logRepositoryExport("pdf", rows.length);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="JUST-RMS-Repository.pdf"');

  const doc = new PDFDocument({ size: "A4", margin: 48, layout: "landscape" });
  doc.pipe(res);
  doc.fontSize(18).text("Jamhuriya University — Research Repository", { align: "center" });
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor("#444").text(`Generated: ${new Date().toLocaleString()} • ${rows.length} items`, {
    align: "center",
  });
  doc.fillColor("#000");
  doc.moveDown(1);

  doc.fontSize(9);
  rows.forEach((row, idx) => {
    if (doc.y > doc.page.height - 60) doc.addPage();
    doc.font("Helvetica-Bold").text(`${idx + 1}. ${row.title}`);
    doc.font("Helvetica").text(`${row.type} • ${row.access} • ${row.created.slice(0, 10)}`);
    if (row.description) doc.text(row.description, { width: doc.page.width - 96 });
    if (row.file) doc.fillColor("#0369a1").text(row.file, { link: row.file, underline: true });
    doc.fillColor("#000");
    doc.moveDown(0.6);
  });

  if (!rows.length) doc.text("No repository items to export.");
  doc.end();
}

async function oaiPmhh(req, res, overrides = {}) {
  const q = { ...req.query, ...overrides };
  const verb = String(q.verb || "").trim();
  const metadataPrefix = q.metadataPrefix ? String(q.metadataPrefix) : "";
  const set = q.set ? String(q.set) : "";
  const from = q.from ? String(q.from) : "";
  const until = q.until ? String(q.until) : "";
  const identifier = q.identifier ? String(q.identifier) : "";
  const resumptionToken = q.resumptionToken ? String(q.resumptionToken) : "";

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
if (!verb) {
    return res.status(400).send(oaiError(req, "badVerb", "Missing verb argument", {}));
  }

  const fileBaseUrl = getPublicBaseUrl(req);

  try {
    if (verb === "Identify") {
      const body = `<Identify>
  <repositoryName>${xmlEscape(OAI_REPOSITORY_NAME)}</repositoryName>
  <baseURL>${xmlEscape(getOaiEndpoint(req))}</baseURL>
  <protocolVersion>2.0</protocolVersion>
  <adminEmail>${xmlEscape(OAI_ADMIN_EMAIL)}</adminEmail>
  <earliestDatestamp>${await earliestDatestamp()}</earliestDatestamp>
  <deletedRecord>no</deletedRecord>
  <granularity>YYYY-MM-DDThh:mm:ssZ</granularity>
</Identify>`;
return res.send(wrapOaiResponse(req, body, { verb: "Identify" }));
    }

    if (verb === "ListMetadataFormats") {
      const body = `<ListMetadataFormats>
  <metadataFormat>
    <metadataPrefix>${OAI_DC_PREFIX}</metadataPrefix>
    <schema>http://www.openarchives.org/OAI/2.0/oai_dc.xsd</schema>
    <metadataNamespace>http://www.openarchives.org/OAI/2.0/oai_dc/</metadataNamespace>
  </metadataFormat>
</ListMetadataFormats>`;
      return res.send(wrapOaiResponse(req, body, { verb: "ListMetadataFormats" }));
    }

    if (verb === "ListSets") {
      const body = `<ListSets>
  <set>
    <setSpec>${SET_REPO}</setSpec>
    <setName>Institutional repository deposits</setName>
  </set>
  <set>
    <setSpec>${SET_PUBLICATIONS}</setSpec>
    <setName>Validated research publications</setName>
  </set>
</ListSets>`;
      return res.send(wrapOaiResponse(req, body, { verb: "ListSets" }));
    }

    if (verb === "GetRecord") {
      if (!identifier) {
        return res.status(400).send(oaiError(req, "badArgument", "Missing identifier", { verb, metadataPrefix }));
      }
      if (metadataPrefix !== OAI_DC_PREFIX) {
        return res
          .status(400)
          .send(oaiError(req, "cannotDisseminateFormat", "Unsupported metadataPrefix", { verb, metadataPrefix, identifier }));
      }
      const record = await findRecordByIdentifier(identifier);
      if (!record) {
        return res.status(404).send(oaiError(req, "idDoesNotExist", "Unknown identifier", { verb, metadataPrefix, identifier }));
      }
      const body = `<GetRecord>${recordXml(record, fileBaseUrl, true)}</GetRecord>`;
      return res.send(wrapOaiResponse(req, body, { verb: "GetRecord", metadataPrefix, identifier }));
    }

    if (verb === "ListRecords" || verb === "ListIdentifiers") {
      if (metadataPrefix !== OAI_DC_PREFIX) {
        return res
          .status(400)
          .send(oaiError(req, "cannotDisseminateFormat", "Unsupported metadataPrefix", { verb, metadataPrefix }));
      }

      let offset = 0;
      let activeSet = set;
      let activeFrom = from;
      let activeUntil = until;

      if (resumptionToken) {
        const decoded = decodeResumptionToken(resumptionToken);
        if (!decoded || decoded.verb !== verb || decoded.metadataPrefix !== OAI_DC_PREFIX) {
          return res.status(400).send(oaiError(req, "badResumptionToken", "Invalid resumptionToken", { verb, resumptionToken }));
        }
        offset = decoded.offset || 0;
        activeSet = decoded.set || "";
        activeFrom = decoded.from || "";
        activeUntil = decoded.until || "";
      } else if (set && set !== SET_REPO && set !== SET_PUBLICATIONS) {
        return res.status(400).send(oaiError(req, "noRecordsMatch", "Unknown set", { verb, metadataPrefix, set }));
      }

      const allRecords = filterRecords(await loadAllOaiRecords(), {
        set: activeSet,
        from: activeFrom,
        until: activeUntil,
      });

      const { slice, resumptionToken: nextOffset, completeListSize } = paginateRecords(allRecords, offset);
      const includeMetadata = verb === "ListRecords";

      if (!slice.length && !resumptionToken) {
        return res
          .status(404)
          .send(oaiError(req, "noRecordsMatch", "No records match request", { verb, metadataPrefix, set: activeSet }));
      }

      const recordsBody = slice.map((r) => recordXml(r, fileBaseUrl, includeMetadata)).join("\n");
      let listBody = `<${verb}>\n${recordsBody}`;
      if (nextOffset != null) {
        listBody += `\n  <resumptionToken completeListSize="${completeListSize}">${encodeResumptionToken({
          verb,
          metadataPrefix: OAI_DC_PREFIX,
          set: activeSet,
          from: activeFrom,
          until: activeUntil,
          offset: nextOffset,
        })}</resumptionToken>`;
      }
      listBody += `\n</${verb}>`;
return res.send(
        wrapOaiResponse(req, listBody, {
          verb,
          metadataPrefix,
          ...(activeSet ? { set: activeSet } : {}),
          ...(activeFrom ? { from: activeFrom } : {}),
          ...(activeUntil ? { until: activeUntil } : {}),
          ...(resumptionToken ? { resumptionToken } : {}),
        })
      );
    }

    return res.status(400).send(oaiError(req, "badVerb", `Unsupported verb: ${verb}`, { verb }));
  } catch (err) {
    return res.status(500).send(oaiError(req, "badArgument", err.message || "OAI handler failed", { verb }));
  }
}

/** Backward-compatible alias: full ListRecords export */
async function oaiExport(req, res) {
  return oaiPmhh(req, res, { verb: "ListRecords", metadataPrefix: OAI_DC_PREFIX });
}

module.exports = {
  listItems,
  uploadItem,
  getItem,
  deleteItem,
  exportRepositoryCsv,
  exportRepositoryExcel,
  exportRepositoryPdf,
  oaiPmhh,
  oaiExport,
};

