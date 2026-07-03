const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { EthicsApplication, ETHICS_STATUSES } = require("../models/EthicsApplication");
const { Proposal, ETHICS_STATUSES: PROPOSAL_ETHICS_STATUSES } = require("../models/Proposal");
const { AppError } = require("../utils/AppError");
const { notifyUser, notifyUsersByRole } = require("../utils/notify");
const {
  buildJurecApprovalMeta,
  buildCertificateNotificationBody,
  previewJurecCertificate,
  resolveSignatory,
  renderJurecCertificatePdf,
} = require("../utils/jurecCertificate");

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
    submittedAt: a.submittedAt,
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
  const filter = req.tierWhere({});
  if (role === "researcher") filter.researcherId = id;
  const applications = await EthicsApplication.find(filter).sort({ createdAt: -1 });
  res.json({ applications: applications.map(sanitize) });
}

async function getEthicsApplication(req, res) {
  const a = await EthicsApplication.findOne(req.tierWhere({ _id: req.params.id }));
  if (!a) throw new AppError("Application not found", 404);
  const isOwner = String(a.researcherId) === String(req.user.id);
  const isStaff = ["research_director", "faculty_coordinator"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);
  res.json({ application: sanitize(a) });
}

async function createEthicsApplication(req, res) {
  const a = new EthicsApplication(req.tierAssign({ researcherId: req.user.id, status: ETHICS_STATUSES.DRAFT }));
  applyPayload(a, req.body || {});
  await a.save();
  res.status(201).json({ application: sanitize(a) });
}

async function updateEthicsApplication(req, res) {
  const a = await EthicsApplication.findOne(req.tierWhere({ _id: req.params.id }));
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
  const a = await EthicsApplication.findOne(req.tierWhere({ _id: req.params.id }));
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
  a.submittedAt = new Date();
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
      programTier: a.programTier,
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

function parseOptionalDate(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

async function directorDecision(req, res) {
  const {
    decision,
    rejectionReason,
    serialNumber,
    refNumber,
    certificateNumber,
    academicYear,
    year,
    reviewedAt,
    receivedAt,
    signedAt,
    signatoryKey,
    signatoryTitle,
    chairpersonLine,
    includeSignature,
    includeStamp,
    principalInvestigator,
    facultyCenter,
    projectTitle,
  } = req.body || {};
  if (!["approve", "reject"].includes(decision)) {
    throw new AppError("decision must be 'approve' or 'reject'", 400);
  }
  const a = await EthicsApplication.findOne(req.tierWhere({ _id: req.params.id }));
  if (!a) throw new AppError("Application not found", 404);
  if (a.status !== ETHICS_STATUSES.SUBMITTED) {
    throw new AppError("Only submitted applications can be reviewed", 400);
  }

  if (decision === "approve") {
    const issueDate = parseOptionalDate(signedAt, new Date());
    const jurec = await buildJurecApprovalMeta(a, {
      EthicsApplication,
      tierFilter: req.tierWhere({}),
      issueDate,
      reviewedAt: reviewedAt ? parseOptionalDate(reviewedAt, null) : undefined,
    });
    const signatory = resolveSignatory(
      signatoryKey === "director" ? null : signatoryKey,
      signatoryKey === "director" ? req.user.fullName : chairpersonLine || null
    );
    const finalChairperson = chairpersonLine?.trim() || signatory.line;
    a.status = ETHICS_STATUSES.APPROVED;
    a.approval = {
      decision: "approved",
      signedByUserId: req.user.id,
      signedByName: signatory.name,
      signedAt: issueDate,
      certificateId: certificateNumber?.trim() || jurec.certificateNumber,
      serialNumber: serialNumber?.trim() || jurec.serialNumber,
      refNumber: refNumber?.trim() || jurec.refNumber,
      certificateNumber: certificateNumber?.trim() || jurec.certificateNumber,
      academicYear: academicYear ? String(academicYear).trim() : defaultAcademicYear(),
      year: year ? String(year).trim() : String(issueDate.getFullYear()),
      receivedAt: parseOptionalDate(receivedAt, jurec.receivedAt),
      reviewedAt: parseOptionalDate(reviewedAt, jurec.reviewedAt),
      chairpersonLine: finalChairperson,
      signatoryKey: signatoryKey || signatory.key || "joint",
      signatoryTitle: signatoryTitle?.trim() || signatory.title || "Chairperson",
      includeSignature: includeSignature !== false,
      includeStamp: includeStamp !== false,
      displayPrincipalInvestigator: principalInvestigator ? String(principalInvestigator).trim() : "",
      displayFacultyCenter: facultyCenter ? String(facultyCenter).trim() : "",
      displayProjectTitle: projectTitle ? String(projectTitle).trim() : "",
      rejectionReason: "",
    };
    if (a.proposalId) {
      await Proposal.updateOne({ _id: a.proposalId }, { ethicsStatus: PROPOSAL_ETHICS_STATUSES.APPROVED });
    }

    // #region agent log
    try {
      fs.appendFileSync(
        path.join(__dirname, "../../../debug-15a9cf.log"),
        `${JSON.stringify({
          sessionId: "15a9cf",
          location: "ethicsController.js:directorDecision",
          message: "JUREC certificate issued",
          data: {
            applicationId: String(a._id),
            refNumber: a.approval.refNumber,
            certificateNumber: a.approval.certificateNumber,
            hypothesisId: "H-JUREC",
            runId: "jurec-cert",
          },
          timestamp: Date.now(),
        })}\n`
      );
    } catch (_) {}
    // #endregion
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
    if (decision === "approve") {
      const certBody = buildCertificateNotificationBody(a, a.approval);
      await notifyUser(a.researcherId, {
        type: "ethics",
        title: "JUREC Ethical Approval Certificate Issued",
        body: certBody,
        link: `/ethics?applicationId=${a._id}`,
        programTier: a.programTier,
      });
      // #region agent log
      try {
        fs.appendFileSync(
          path.join(__dirname, "../../../debug-15a9cf.log"),
          `${JSON.stringify({
            sessionId: "15a9cf",
            location: "ethicsController.js:notifyResearcher",
            message: "JUREC notification sent",
            data: {
              researcherId: String(a.researcherId),
              bodyLength: certBody.length,
              bodyPreview: certBody.slice(0, 120),
              hypothesisId: "H-NOTIFY-ETHICS",
              runId: "jurec-notify-fix",
            },
            timestamp: Date.now(),
          })}\n`
        );
      } catch (_) {}
      // #endregion
    } else {
      await notifyUser(a.researcherId, {
        type: "ethics",
        title: "Ethics application rejected",
        body: a.projectTitle,
        link: "/ethics",
        programTier: a.programTier,
      });
    }
  } catch (err) {
    // #region agent log
    try {
      fs.appendFileSync(
        path.join(__dirname, "../../../debug-15a9cf.log"),
        `${JSON.stringify({
          sessionId: "15a9cf",
          location: "ethicsController.js:notifyResearcher",
          message: "JUREC notification FAILED",
          data: { error: err.message, hypothesisId: "H-NOTIFY-ETHICS", runId: "jurec-notify-fix" },
          timestamp: Date.now(),
        })}\n`
      );
    } catch (_) {}
    // #endregion
  }

  res.json({ message: `Application ${decision}d`, application: sanitize(a) });
}

async function previewCertificate(req, res) {
  const a = await EthicsApplication.findOne(req.tierWhere({ _id: req.params.id }));
  if (!a) throw new AppError("Application not found", 404);
  if (req.user.role !== "research_director") throw new AppError("Only the research director can preview certificates", 403);
  if (a.status !== ETHICS_STATUSES.SUBMITTED) {
    throw new AppError("Certificate preview is only available for submitted applications awaiting approval", 400);
  }

  const preview = await previewJurecCertificate(a, {
    EthicsApplication,
    tierFilter: req.tierWhere({}),
  });

  const signatories = [
    ...preview.signatories,
    { key: "director", name: `${req.user.fullName || "Research Director"} (you)`, title: "Chairperson", line: req.user.fullName || "Research Director" },
    { key: "custom", name: "Custom signatory name", title: "Chairperson", line: "" },
  ];

  res.json({
    preview: {
      refNumber: preview.refNumber,
      certificateNumber: preview.certificateNumber,
      serialNumber: preview.serialNumber,
      signedAt: preview.signedAt,
      receivedAt: preview.receivedAt,
      reviewedAt: preview.reviewedAt,
      principalInvestigator: preview.principalInvestigator,
      facultyCenter: preview.facultyCenter,
      projectTitle: preview.projectTitle,
      chairpersonLine: preview.chairpersonLine,
      signatoryTitle: preview.signatoryTitle,
    },
    signatories,
  });
}

async function downloadCertificate(req, res) {
  const a = await EthicsApplication.findOne(req.tierWhere({ _id: req.params.id }));
  if (!a) throw new AppError("Application not found", 404);
  if (a.status !== ETHICS_STATUSES.APPROVED) {
    throw new AppError("Certificate is only available for approved applications", 400);
  }
  const isOwner = String(a.researcherId) === String(req.user.id);
  const isStaff = ["research_director", "faculty_coordinator"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  const margin = 60;
  const pageWidth = 595.28;
  const fileRef = (a.approval?.refNumber || a.approval?.certificateNumber || a._id)
    .replace(/[^\w.-]+/g, "-")
    .slice(0, 80);

  const doc = new PDFDocument({ size: "A4", margin });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="JUREC-certificate-${fileRef}.pdf"`);
  doc.pipe(res);

  renderJurecCertificatePdf(doc, a, {
    margin,
    pageWidth,
    logoPath: resolveJamhuriyaLogoPath(),
  });

  doc.end();
}

module.exports = {
  listEthicsApplications,
  getEthicsApplication,
  createEthicsApplication,
  updateEthicsApplication,
  submitEthicsApplication,
  directorDecision,
  previewCertificate,
  downloadCertificate,
};
