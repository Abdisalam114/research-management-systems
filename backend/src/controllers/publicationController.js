const { Publication, PUBLICATION_STATUSES } = require("../models/Publication");
const { AppError } = require("../utils/AppError");
const { notifyUser, notifyUsersByRole } = require("../utils/notify");

function sanitizePublication(p) {
  return {
    id: p._id,
    title: p.title,
    type: p.type,
    year: p.year,
    venue: p.venue,
    doi: p.doi,
    orcid: p.orcid,
    url: p.url,
    authors: p.authors,
    citationCount: p.citationCount,
    status: p.status,
    researcherId: p.researcherId,
    validatedBy: p.validatedBy,
    validatedAt: p.validatedAt,
    validationComment: p.validationComment,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function listPublications(req, res) {
  const { role } = req.user;
  const filter = {};

  if (role === "researcher") filter.researcherId = req.user.id;
  // coordinator/director can view all, finance can view all (MVP: allow staff)

  const pubs = await Publication.find(filter).sort({ createdAt: -1 });
  res.json({ publications: pubs.map(sanitizePublication) });
}

async function getPublication(req, res) {
  const { id } = req.params;
  const pub = await Publication.findById(id);
  if (!pub) throw new AppError("Publication not found", 404);

  const isOwner = String(pub.researcherId) === String(req.user.id);
  const isStaff = ["faculty_coordinator", "research_director"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  res.json({ publication: sanitizePublication(pub) });
}

async function createPublication(req, res) {
  const { title, type, year, venue, doi, orcid, url, authors } = req.body || {};
  if (!title) throw new AppError("title is required", 400);

  const pub = await Publication.create({
    title: String(title).trim(),
    type,
    year,
    venue: venue ? String(venue).trim() : "",
    doi: doi ? String(doi).trim() : "",
    orcid: orcid ? String(orcid).trim() : "",
    url: url ? String(url).trim() : "",
    authors: Array.isArray(authors) ? authors.map((a) => String(a).trim()).filter(Boolean) : [],
    researcherId: req.user.id,
    status: PUBLICATION_STATUSES.DRAFT,
  });

  res.status(201).json({ publication: sanitizePublication(pub) });
}

async function updatePublication(req, res) {
  const { id } = req.params;
  const pub = await Publication.findById(id);
  if (!pub) throw new AppError("Publication not found", 404);
  if (String(pub.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);

  if (![PUBLICATION_STATUSES.DRAFT, PUBLICATION_STATUSES.REJECTED].includes(pub.status)) {
    throw new AppError("Only draft or rejected publications can be edited", 400);
  }

  const { title, type, year, venue, doi, orcid, url, authors, citationCount } = req.body || {};
  if (title !== undefined) pub.title = String(title).trim();
  if (type !== undefined) pub.type = type;
  if (year !== undefined) pub.year = year;
  if (venue !== undefined) pub.venue = String(venue).trim();
  if (doi !== undefined) pub.doi = String(doi).trim();
  if (orcid !== undefined) pub.orcid = String(orcid).trim();
  if (url !== undefined) pub.url = String(url).trim();
  if (citationCount !== undefined) pub.citationCount = citationCount;
  if (authors !== undefined) {
    pub.authors = Array.isArray(authors) ? authors.map((a) => String(a).trim()).filter(Boolean) : [];
  }

  await pub.save();
  res.json({ publication: sanitizePublication(pub) });
}

async function submitPublication(req, res) {
  const { id } = req.params;
  const pub = await Publication.findById(id);
  if (!pub) throw new AppError("Publication not found", 404);
  if (String(pub.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);
  if (pub.status !== PUBLICATION_STATUSES.DRAFT) throw new AppError("Only draft publications can be submitted", 400);

  pub.status = PUBLICATION_STATUSES.SUBMITTED;
  await pub.save();

  try {
    await notifyUsersByRole("faculty_coordinator", {
      type: "publication",
      title: "Publication submitted for validation",
      body: pub.title,
      link: "/publications",
    });
  } catch {
    /* notifications are best-effort */
  }

  res.json({ message: "Publication submitted", publication: sanitizePublication(pub) });
}

async function validatePublication(req, res) {
  const { id } = req.params;
  const { decision, comment } = req.body || {};
  if (!comment) throw new AppError("comment is required", 400);
  if (!["validated", "rejected"].includes(decision)) throw new AppError("Invalid decision", 400);

  const pub = await Publication.findById(id);
  if (!pub) throw new AppError("Publication not found", 404);
  if (pub.status !== PUBLICATION_STATUSES.SUBMITTED) throw new AppError("Publication is not validation-ready", 400);

  pub.status = decision === "validated" ? PUBLICATION_STATUSES.VALIDATED : PUBLICATION_STATUSES.REJECTED;
  pub.validatedBy = req.user.id;
  pub.validatedAt = new Date();
  pub.validationComment = String(comment);
  await pub.save();

  try {
    await notifyUser(pub.researcherId, {
      type: "publication",
      title: `Publication ${decision === "validated" ? "validated" : "rejected"}`,
      body: pub.title,
      link: "/publications",
    });
  } catch {
    /* notifications are best-effort */
  }

  res.json({ message: "Validation saved", publication: sanitizePublication(pub) });
}

module.exports = {
  listPublications,
  getPublication,
  createPublication,
  updatePublication,
  submitPublication,
  validatePublication,
};

