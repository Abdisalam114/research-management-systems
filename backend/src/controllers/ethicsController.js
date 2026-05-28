const PDFDocument = require("pdfkit");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { EthicsApplication, ETHICS_STATUSES } = require("../models/EthicsApplication");
const { Proposal, ETHICS_STATUSES: PROPOSAL_ETHICS_STATUSES } = require("../models/Proposal");
const { AppError } = require("../utils/AppError");
const { notifyUser, notifyUsersByRole } = require("../utils/notify");

function sanitize(a) {
  return {
    id: a._id,
    proposalId: a.proposalId,
    researcherId: a.researcherId,
    status: a.status,
    principal: a.principal,
    coResearcher: a.coResearcher,
    otherInvestigators: a.otherInvestigators,
    projectTitle: a.projectTitle,
    projectLevel: a.projectLevel,
    startDate: a.startDate,
    endDate: a.endDate,
    backgroundLiterature: a.backgroundLiterature,
    aimsObjectives: a.aimsObjectives,
    rationale: a.rationale,
    design: a.design,
    subjectTypes: a.subjectTypes,
    subjectTypesSpecify: a.subjectTypesSpecify,
    inclusionCriteria: a.inclusionCriteria,
    exclusionCriteria: a.exclusionCriteria,
    risk: a.risk,
    riskPrecautions: a.riskPrecautions,
    settings: a.settings,
    instruments: a.instruments,
    instrumentsOther: a.instrumentsOther,
    dataCollectionDate: a.dataCollectionDate,
    sampleSize: a.sampleSize,
    dataHandling: a.dataHandling,
    fundingSource: a.fundingSource,
    consent: a.consent,
    dataSafety: a.dataSafety,
    privacy: a.privacy,
    conflictOfInterest: a.conflictOfInterest,
    applicantSignature: a.applicantSignature,
    approval: a.approval,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

const EDITABLE_FIELDS = [
  "principal",
  "coResearcher",
  "otherInvestigators",
  "projectTitle",
  "projectLevel",
  "startDate",
  "endDate",
  "backgroundLiterature",
  "aimsObjectives",
  "rationale",
  "design",
  "subjectTypes",
  "subjectTypesSpecify",
  "inclusionCriteria",
  "exclusionCriteria",
  "risk",
  "riskPrecautions",
  "settings",
  "instruments",
  "instrumentsOther",
  "dataCollectionDate",
  "sampleSize",
  "dataHandling",
  "fundingSource",
  "consent",
  "dataSafety",
  "privacy",
  "conflictOfInterest",
  "applicantSignature",
];

function applyPayload(target, payload) {
  for (const key of EDITABLE_FIELDS) {
    if (payload[key] !== undefined) target[key] = payload[key];
  }
}

async function listEthicsApplications(req, res) {
  const { role, id } = req.user;
  const filter = {};
  if (role === "researcher") filter.researcherId = id;
  const applications = await EthicsApplication.find(filter).sort({ createdAt: -1 });
  res.json({ applications: applications.map(sanitize) });
}

async function getEthicsApplication(req, res) {
  const a = await EthicsApplication.findById(req.params.id);
  if (!a) throw new AppError("Application not found", 404);
  const isOwner = String(a.researcherId) === String(req.user.id);
  const isStaff = ["research_director", "faculty_coordinator"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);
  res.json({ application: sanitize(a) });
}

async function createEthicsApplication(req, res) {
  const a = new EthicsApplication({ researcherId: req.user.id, status: ETHICS_STATUSES.DRAFT });
  applyPayload(a, req.body || {});
  await a.save();
  res.status(201).json({ application: sanitize(a) });
}

async function updateEthicsApplication(req, res) {
  const a = await EthicsApplication.findById(req.params.id);
  if (!a) throw new AppError("Application not found", 404);
  if (String(a.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);
  if (![ETHICS_STATUSES.DRAFT, ETHICS_STATUSES.REJECTED].includes(a.status)) {
    throw new AppError("Only draft / rejected applications can be edited", 400);
  }
  applyPayload(a, req.body || {});
  await a.save();
  res.json({ application: sanitize(a) });
}

async function submitEthicsApplication(req, res) {
  const a = await EthicsApplication.findById(req.params.id);
  if (!a) throw new AppError("Application not found", 404);
  if (String(a.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);
  if (![ETHICS_STATUSES.DRAFT, ETHICS_STATUSES.REJECTED].includes(a.status)) {
    throw new AppError("Only draft / rejected applications can be submitted", 400);
  }
  const { isEthicsFormComplete } = require("../utils/proposalEthicsLink");
  if (!isEthicsFormComplete(a)) {
    throw new AppError(
      "Complete all required ethics fields (title, principal name, level, aims, design, signature) before submitting.",
      400
    );
  }
  a.status = ETHICS_STATUSES.SUBMITTED;
  if (!a.applicantSignature?.signedAt) {
    a.applicantSignature = {
      name: a.applicantSignature?.name || `${a.principal?.firstName || ""} ${a.principal?.lastName || ""}`.trim(),
      signedAt: new Date(),
    };
  }
  await a.save();

  try {
    await notifyUsersByRole("research_director", {
      type: "ethics",
      title: a.proposalId ? "Ethics form submitted with proposal" : "New ethics application submitted",
      body: a.projectTitle,
      link: a.proposalId ? `/proposals/${a.proposalId}/review` : "/ethics",
    });
  } catch {
    /* notifications best-effort */
  }

  res.json({ message: "Submitted", application: sanitize(a) });
}

function resolveJamhuriyaLogoPath() {
  const candidates = [
    path.join(__dirname, "../../assets/jamhuriya-logo.png"),
    path.join(__dirname, "../../../frontend/src/assets/jamhuriya-logo.png"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function defaultAcademicYear() {
  const y = new Date().getFullYear();
  return `${y}/${y + 1}`;
}

async function directorDecision(req, res) {
  const { decision, rejectionReason, serialNumber, academicYear, year } = req.body || {};
  if (!["approve", "reject"].includes(decision)) {
    throw new AppError("decision must be 'approve' or 'reject'", 400);
  }
  const a = await EthicsApplication.findById(req.params.id);
  if (!a) throw new AppError("Application not found", 404);
  if (a.status !== ETHICS_STATUSES.SUBMITTED) {
    throw new AppError("Only submitted applications can be reviewed", 400);
  }

  if (decision === "approve") {
    a.status = ETHICS_STATUSES.APPROVED;
    a.approval = {
      decision: "approved",
      signedByUserId: req.user.id,
      signedByName: req.user.fullName || "Research Director",
      signedAt: new Date(),
      certificateId: `ETH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      serialNumber: serialNumber ? String(serialNumber).trim() : `REC-${Date.now()}`,
      academicYear: academicYear ? String(academicYear).trim() : defaultAcademicYear(),
      year: year ? String(year).trim() : String(new Date().getFullYear()),
      rejectionReason: "",
    };
    if (a.proposalId) {
      await Proposal.updateOne({ _id: a.proposalId }, { ethicsStatus: PROPOSAL_ETHICS_STATUSES.APPROVED });
    }
  } else {
    a.status = ETHICS_STATUSES.REJECTED;
    a.approval = {
      ...a.approval,
      decision: "rejected",
      signedByUserId: req.user.id,
      signedByName: req.user.fullName || "Research Director",
      signedAt: new Date(),
      rejectionReason: rejectionReason ? String(rejectionReason) : "Rejected by Research Director",
    };
    if (a.proposalId) {
      await Proposal.updateOne({ _id: a.proposalId }, { ethicsStatus: PROPOSAL_ETHICS_STATUSES.REJECTED });
    }
  }
  await a.save();

  try {
    await notifyUser(a.researcherId, {
      type: "ethics",
      title: `Ethics application ${decision === "approve" ? "approved — certificate issued" : "rejected"}`,
      body: a.projectTitle,
      link: "/ethics",
    });
  } catch {
    /* notifications best-effort */
  }

  res.json({ message: `Application ${decision}d`, application: sanitize(a) });
}

function writeLine(doc, label, value) {
  doc.font("Helvetica-Bold").text(label, { continued: true }).font("Helvetica").text(` ${value || "—"}`);
}

async function downloadCertificate(req, res) {
  const a = await EthicsApplication.findById(req.params.id);
  if (!a) throw new AppError("Application not found", 404);
  if (a.status !== ETHICS_STATUSES.APPROVED) {
    throw new AppError("Certificate is only available for approved applications", 400);
  }
  const isOwner = String(a.researcherId) === String(req.user.id);
  const isStaff = ["research_director", "faculty_coordinator"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  const margin = 60;
  const pageWidth = 595.28;
  const contentWidth = pageWidth - margin * 2;
  const academicYear = a.approval?.academicYear || defaultAcademicYear();
  const certYear =
    a.approval?.year ||
    (a.approval?.signedAt ? String(new Date(a.approval.signedAt).getFullYear()) : String(new Date().getFullYear()));
  const certificateId = a.approval?.certificateId || "—";

  const doc = new PDFDocument({ size: "A4", margin });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="ethics-certificate-${a.approval.certificateId || a._id}.pdf"`
  );
  doc.pipe(res);

  let y = margin;

  // Top band — academic year, year, certificate ID (uppermost on certificate)
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a");
  doc.text(`Academic Year: ${academicYear}`, margin, y, { width: contentWidth, align: "center" });
  y += 18;
  doc.fontSize(11).fillColor("#334155");
  doc.text(`Year: ${certYear}`, margin, y, { width: contentWidth, align: "center" });
  y += 16;
  doc.text(`Serial Number: ${a.approval?.serialNumber || "—"}`, margin, y, { width: contentWidth, align: "center" });
  y += 16;
  doc.text(`Certificate ID: ${certificateId}`, margin, y, { width: contentWidth, align: "center" });
  y += 22;

  const logoPath = resolveJamhuriyaLogoPath();
  if (logoPath) {
    const logoW = 78;
    doc.image(logoPath, (pageWidth - logoW) / 2, y, { width: logoW });
    y += logoW + 14;
  }

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a");
  doc.text("Jamhuriya University of Science & Technology", margin, y, { width: contentWidth, align: "center" });
  y += 14;
  doc.font("Helvetica").fontSize(9).fillColor("#64748b");
  doc.text("Research Ethical Committee (REC)", margin, y, { width: contentWidth, align: "center" });
  y += 20;

  doc.y = y;
  doc.font("Helvetica-Bold").fontSize(20).fillColor("#0ea5e9").text("ETHICAL CLEARANCE CERTIFICATE", { align: "center" });
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(10).fillColor("#64748b").text("Faculty of Applied Medical Sciences", { align: "center" });
  doc.moveDown(1);

  doc.strokeColor("#0ea5e9").lineWidth(1.2).moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
  doc.moveDown(1);

  doc.fillColor("#0f172a").fontSize(11);
  doc.text("I certify that this study titled:", { align: "left" });
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(13).text(a.projectTitle || "—", { align: "center" });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(11);
  writeLine(doc, "Proposed by the primary investigator:", `${a.principal?.firstName || ""} ${a.principal?.lastName || ""}`.trim() || "—");
  doc.moveDown(0.4);

  doc.font("Helvetica-Bold").text("Co-investigators:");
  doc.font("Helvetica");
  const cos = [
    a.coResearcher?.firstName ? `${a.coResearcher.firstName} ${a.coResearcher.lastName}`.trim() : null,
    ...(a.otherInvestigators || []).map((n) => (typeof n === "string" ? n : `${n?.firstName || ""} ${n?.lastName || ""}`.trim())).filter(Boolean),
  ].filter(Boolean);
  if (cos.length) cos.forEach((n, i) => doc.text(`${i + 1}. ${n}`));
  else doc.text("—");
  doc.moveDown(0.8);

  doc.fontSize(11).text(
    "The Research Ethical Clearance application form was reviewed and the protocol for scientific or scholarly merit was examined, as well as the protection of human / animal subjects was ensured. Investigators are hereby granted ethical clearance to conduct the research.",
    { align: "justify" }
  );

  doc.moveDown(2);
  doc.strokeColor("#94a3b8").lineWidth(0.5).moveTo(margin, doc.y).lineTo(margin + 220, doc.y).stroke();
  doc.fontSize(10).fillColor("#0f172a").text("Signature of Chairman of REC", margin, doc.y + 4);
  doc.text(`Name: ${a.approval?.signedByName || "—"}`, margin);
  doc.text(`Date: ${a.approval?.signedAt ? new Date(a.approval.signedAt).toLocaleDateString() : "—"}`, margin);

  doc.end();
}

module.exports = {
  listEthicsApplications,
  getEthicsApplication,
  createEthicsApplication,
  updateEthicsApplication,
  submitEthicsApplication,
  directorDecision,
  downloadCertificate,
};
