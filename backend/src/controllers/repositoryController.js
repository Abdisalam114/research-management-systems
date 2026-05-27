const { RepositoryItem, REPOSITORY_ACCESS } = require("../models/RepositoryItem");
const { ResearchGroup } = require("../models/ResearchGroup");
const { Publication, PUBLICATION_STATUSES } = require("../models/Publication");
const { AppError } = require("../utils/AppError");

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
    projectId: i.projectId,
    uploadedBy: i.uploadedBy,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

async function listItems(req, res) {
  const { role } = req.user;

  if (["research_director", "faculty_coordinator"].includes(role)) {
    const items = await RepositoryItem.find({}).sort({ createdAt: -1 });
    return res.json({ items: items.map(sanitizeItem) });
  }

  if (role === "finance_officer") {
    // Finance can see institution-wide items only (safest default)
    const items = await RepositoryItem.find({ access: REPOSITORY_ACCESS.INSTITUTION }).sort({ createdAt: -1 });
    return res.json({ items: items.map(sanitizeItem) });
  }

  // Researcher: can see own uploads + institution + groups they belong to
  const groups = await ResearchGroup.find({ "members.userId": req.user.id }).select("_id");
  const groupIds = groups.map((g) => g._id);

  const items = await RepositoryItem.find({
    $or: [
      { uploadedBy: req.user.id },
      { access: REPOSITORY_ACCESS.INSTITUTION },
      { access: REPOSITORY_ACCESS.GROUP, groupId: { $in: groupIds } },
    ],
  }).sort({ createdAt: -1 });

  return res.json({ items: items.map(sanitizeItem) });
}

async function uploadItem(req, res) {
  const { type, title, description, tags, access, groupId, projectId } = req.body || {};
  if (!type || !title) throw new AppError("type and title are required", 400);
  if (!req.file) throw new AppError("file is required", 400);

  const normalizedAccess = access && Object.values(REPOSITORY_ACCESS).includes(access) ? access : REPOSITORY_ACCESS.PRIVATE;
  const normalizedGroupId = normalizedAccess === REPOSITORY_ACCESS.GROUP ? groupId || null : null;

  if (normalizedAccess === REPOSITORY_ACCESS.GROUP) {
    if (!normalizedGroupId) throw new AppError("groupId is required for group access", 400);
    const group = await ResearchGroup.findById(normalizedGroupId);
    if (!group) throw new AppError("Research group not found", 404);
    const isMember = (group.members || []).some((m) => String(m.userId) === String(req.user.id));
    if (!isMember) throw new AppError("Forbidden", 403);
  }

  const item = await RepositoryItem.create({
    type,
    title: String(title).trim(),
    description: description ? String(description) : "",
    tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
    filePath: `/uploads/${req.file.filename}`,
    fileSize: req.file.size || 0,
    access: normalizedAccess,
    groupId: normalizedGroupId,
    projectId: projectId || null,
    uploadedBy: req.user.id,
  });

  res.status(201).json({ item: sanitizeItem(item) });
}

async function getItem(req, res) {
  const { id } = req.params;
  const item = await RepositoryItem.findById(id);
  if (!item) throw new AppError("Repository item not found", 404);

  const isStaff = ["research_director", "faculty_coordinator"].includes(req.user.role);
  if (isStaff) return res.json({ item: sanitizeItem(item) });

  if (String(item.uploadedBy) === String(req.user.id)) return res.json({ item: sanitizeItem(item) });

  if (item.access === REPOSITORY_ACCESS.INSTITUTION) return res.json({ item: sanitizeItem(item) });

  if (item.access === REPOSITORY_ACCESS.GROUP && item.groupId) {
    const group = await ResearchGroup.findById(item.groupId);
    const isMember = group && (group.members || []).some((m) => String(m.userId) === String(req.user.id));
    if (isMember) return res.json({ item: sanitizeItem(item) });
  }

  throw new AppError("Forbidden", 403);
}

async function oaiExport(req, res) {
  const baseUrl =
    process.env.REPOSITORY_PUBLIC_URL ||
    `${req.protocol}://${req.get("host")}`;

  const [pubItems, validatedPublications] = await Promise.all([
    RepositoryItem.find({ access: REPOSITORY_ACCESS.INSTITUTION }).sort({ createdAt: -1 }).limit(500),
    Publication.find({ status: PUBLICATION_STATUSES.VALIDATED }).sort({ createdAt: -1 }).limit(500),
  ]);

  const records = [];

  pubItems.forEach((it) => {
    records.push({
      identifier: `oai:just-rms:repo:${it._id}`,
      datestamp: it.updatedAt || it.createdAt,
      title: it.title,
      type: it.type,
      description: it.description,
      tags: it.tags || [],
      url: it.filePath ? `${baseUrl}${it.filePath}` : "",
    });
  });

  validatedPublications.forEach((p) => {
    records.push({
      identifier: `oai:just-rms:publication:${p._id}`,
      datestamp: p.updatedAt || p.createdAt,
      title: p.title,
      type: p.type,
      description: p.communityImpact || p.venue || "",
      tags: p.authors || [],
      url: p.url || (p.doi ? `https://doi.org/${p.doi}` : ""),
    });
  });

  const recordsXml = records
    .map((r) => {
      const subjects = (r.tags || [])
        .map((t) => `<dc:subject>${xmlEscape(t)}</dc:subject>`)
        .join("");
      return `<record>
    <header>
      <identifier>${xmlEscape(r.identifier)}</identifier>
      <datestamp>${new Date(r.datestamp).toISOString()}</datestamp>
    </header>
    <metadata>
      <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"
                 xmlns:dc="http://purl.org/dc/elements/1.1/"
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">
        <dc:title>${xmlEscape(r.title)}</dc:title>
        <dc:type>${xmlEscape(r.type)}</dc:type>
        <dc:description>${xmlEscape(r.description || "")}</dc:description>
        ${subjects}
        ${r.url ? `<dc:identifier>${xmlEscape(r.url)}</dc:identifier>` : ""}
        <dc:publisher>Jamhuriya University RMS</dc:publisher>
      </oai_dc:dc>
    </metadata>
  </record>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="ListRecords" metadataPrefix="oai_dc">${xmlEscape(baseUrl)}</request>
  <ListRecords>
${recordsXml}
  </ListRecords>
</OAI-PMH>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.send(xml);
}

module.exports = { listItems, uploadItem, getItem, oaiExport };

