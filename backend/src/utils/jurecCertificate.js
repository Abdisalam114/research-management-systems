const { ETHICS_STATUSES } = require("../models/EthicsApplication");

const CHAIRPERSON_DEFAULT = "Kasim Abdi Jimale/Dr.Nur Rashid Ahmed";
const COMMITTEE_NAME = "JAMHURIYA UNIVERSITY RESEARCH ETHICS COMMITTEE";
const UNIVERSITY_NAME = "Jamhuriya University of Science and Technology";

const JUREC_SIGNATORIES = Object.freeze([
  { key: "kasim", name: "Kasim Abdi Jimale", title: "Chairperson", line: "Kasim Abdi Jimale" },
  { key: "nur", name: "Dr. Nur Rashid Ahmed", title: "Chairperson", line: "Dr. Nur Rashid Ahmed" },
  { key: "joint", name: "Kasim Abdi Jimale / Dr. Nur Rashid Ahmed", title: "Chairperson", line: CHAIRPERSON_DEFAULT },
]);

/** Chairperson choices shown to the Director when issuing a certificate (pick one). */
const JUREC_CHAIRPERSON_OPTIONS = Object.freeze(JUREC_SIGNATORIES.filter((s) => s.key === "kasim" || s.key === "nur"));

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function ordinalDay(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  const mod = n % 10;
  if (mod === 1) return `${n}st`;
  if (mod === 2) return `${n}nd`;
  if (mod === 3) return `${n}rd`;
  return `${n}th`;
}

function formatJurecDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${ordinalDay(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatJurecDateShort(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const month = MONTHS[d.getMonth()].slice(0, 3);
  return `${month} ${d.getDate()} ${d.getFullYear()}`;
}

function monthYearSuffix(value) {
  const d = new Date(value);
  return `${String(d.getMonth() + 1).padStart(2, "0")}${d.getFullYear()}`;
}

function resolveSignatory(signatoryKey, fallbackName) {
  const found = JUREC_SIGNATORIES.find((s) => s.key === signatoryKey);
  if (found) return found;
  if (fallbackName) {
    return { key: "custom", name: fallbackName, title: "Chairperson", line: fallbackName };
  }
  return JUREC_SIGNATORIES.find((s) => s.key === "joint") || JUREC_SIGNATORIES[0];
}

function renderApprovalDetailsBoxes(doc, margin, y, contentWidth, approval) {
  const gap = 12;
  const boxW = (contentWidth - gap * 2) / 3;
  const boxH = 48;
  const items = [
    { label: "Received", date: approval.receivedAt },
    { label: "Reviewed", date: approval.reviewedAt },
    { label: "Approved", date: approval.signedAt },
  ];

  items.forEach((item, i) => {
    const x = margin + i * (boxW + gap);
    doc.roundedRect(x, y, boxW, boxH, 4).lineWidth(1).strokeColor("#94a3b8").stroke();
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f172a");
    doc.text(item.label, x + 6, y + 10, { width: boxW - 12, align: "center" });
    doc.font("Helvetica").fontSize(9).fillColor("#334155");
    doc.text(formatJurecDateShort(item.date), x + 6, y + 28, { width: boxW - 12, align: "center" });
  });

  return y + boxH;
}

function renderOfficialStamp(doc, x, y, size) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;
  doc.save();
  doc.circle(cx, cy, r).lineWidth(1.8).strokeColor("#b91c1c").stroke();
  doc.circle(cx, cy, r - 6).lineWidth(0.8).strokeColor("#b91c1c").stroke();
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#b91c1c");
  doc.text("JUREC", x, y + size * 0.28, { width: size, align: "center" });
  doc.font("Helvetica").fontSize(6);
  doc.text("OFFICIAL STAMP", x, y + size * 0.46, { width: size, align: "center" });
  doc.fontSize(5).text("Jamhuriya University", x, y + size * 0.62, { width: size, align: "center" });
  doc.restore();
}

function renderSignatureBlock(doc, x, y, name, includeSignature) {
  if (includeSignature) {
    doc.save();
    doc.lineWidth(1).strokeColor("#334155");
    doc.moveTo(x, y).bezierCurveTo(x + 35, y - 18, x + 70, y + 10, x + 130, y - 4).stroke();
    doc.font("Helvetica-Oblique").fontSize(11).fillColor("#0f172a").text(name, x, y + 8);
    doc.restore();
  } else {
    doc.font("Helvetica").fontSize(10).fillColor("#0f172a").text(name, x, y);
  }
}

async function previewJurecCertificate(application, { EthicsApplication, tierFilter, issueDate = new Date() }) {
  const meta = await buildJurecApprovalMeta(application, { EthicsApplication, tierFilter, issueDate });
  const signatory = JUREC_CHAIRPERSON_OPTIONS[0];
  return {
    refNumber: "",
    certificateNumber: "",
    serialNumber: meta.serialNumber,
    receivedAt: meta.receivedAt,
    reviewedAt: meta.reviewedAt,
    signedAt: meta.signedAt,
    principalInvestigator: principalInvestigatorName(application),
    facultyCenter: facultyCenterLabel(application),
    projectTitle: application.projectTitle || "",
    chairpersonLine: signatory.line,
    signatoryTitle: signatory.title,
    signatoryKey: signatory.key,
    signatories: JUREC_CHAIRPERSON_OPTIONS.map(({ key, name, title, line }) => ({ key, name, title, line })),
  };
}

function certificatePrincipalName(application, approval) {
  const override = approval?.displayPrincipalInvestigator?.trim();
  if (override) return override;
  return principalInvestigatorName(application);
}

function certificateFacultyCenter(application, approval) {
  const override = approval?.displayFacultyCenter?.trim();
  if (override) return override;
  return facultyCenterLabel(application);
}

function certificateProjectTitle(application, approval) {
  const override = approval?.displayProjectTitle?.trim();
  if (override) return override;
  return application.projectTitle || "—";
}

function facultySlug(principal) {
  const raw = (principal?.faculty || principal?.department || "faculty").trim();
  return raw.replace(/\//g, " ").replace(/\s+/g, " ").slice(0, 32).toLowerCase() || "faculty";
}

function departmentFragment(principal) {
  const dept = (principal?.department || "").trim();
  if (!dept) return "";
  const digits = dept.replace(/\D/g, "");
  if (digits.length >= 3) return digits.slice(-3);
  return "";
}

async function allocateJurecNumbers(EthicsApplication, tierFilter, issueDate) {
  const count = await EthicsApplication.countDocuments({
    status: ETHICS_STATUSES.APPROVED,
    ...tierFilter,
  });
  const seq = String(count + 1).padStart(4, "0");
  return { seq, suffix: monthYearSuffix(issueDate) };
}

function buildJurecRef(seq, faculty, suffix) {
  return `JUREC/${seq}/${faculty}/${suffix}`;
}

function buildCertificateNumber(seq, faculty, deptFragment, suffix) {
  const deptBit = deptFragment ? ` ${deptFragment}` : "";
  return `JUREC${seq}/${faculty}${deptBit}/${suffix}`;
}

function principalInvestigatorName(application) {
  const p = application.principal || {};
  const titled = `${p.title ? `${p.title} ` : ""}${p.firstName || ""} ${p.lastName || ""}`.trim();
  return titled || application.applicantSignature?.name || "—";
}

function facultyCenterLabel(application) {
  const parts = [application.principal?.faculty, application.principal?.department].filter(Boolean);
  return parts.join(" — ") || "—";
}

function defaultReviewedAt(receivedAt, approvedAt) {
  const received = new Date(receivedAt);
  const approved = new Date(approvedAt);
  if (Number.isNaN(received.getTime()) || Number.isNaN(approved.getTime())) {
    return approved;
  }
  return new Date(Math.min(approved.getTime(), received.getTime() + (approved.getTime() - received.getTime()) / 2));
}

async function buildJurecApprovalMeta(application, { EthicsApplication, tierFilter, issueDate = new Date(), reviewedAt }) {
  const faculty = facultySlug(application.principal);
  const deptFragment = departmentFragment(application.principal);
  const { seq, suffix } = await allocateJurecNumbers(EthicsApplication, tierFilter, issueDate);
  const receivedAt =
    application.submittedAt ||
    application.applicantSignature?.signedAt ||
    application.updatedAt ||
    application.createdAt;
  const signedAt = issueDate;
  const reviewed =
    reviewedAt != null ? new Date(reviewedAt) : defaultReviewedAt(receivedAt, signedAt);

  return {
    refNumber: buildJurecRef(seq, faculty, suffix),
    certificateNumber: buildCertificateNumber(seq, faculty, deptFragment, suffix),
    certificateId: buildCertificateNumber(seq, faculty, deptFragment, suffix),
    serialNumber: buildJurecRef(seq, faculty, suffix),
    receivedAt,
    reviewedAt: reviewed,
    signedAt,
    chairpersonLine: CHAIRPERSON_DEFAULT,
  };
}

function buildCertificateNotificationBody(application, approval) {
  const pi = certificatePrincipalName(application, approval);
  const faculty = certificateFacultyCenter(application, approval);
  const title = certificateProjectTitle(application, approval);

  return [
    COMMITTEE_NAME,
    `Ref: ${approval.refNumber}\t\t\t\tDate: ${formatJurecDate(approval.signedAt)}`,
    "",
    "ETHICAL APPROVAL CERTIFICATE",
    "On Research Involving Human Subjects",
    "",
    `Certificate Number: ${approval.certificateNumber}`,
    "",
    `Serial Number: ${approval.serialNumber || approval.refNumber || "—"}`,
    "",
    `Date of Issue: ${formatJurecDate(approval.signedAt)}`,
    "",
    `Principal Investigator: ${pi}`,
    "",
    `Faculty/Center: ${faculty}`,
    "",
    `Title of Project: ${title}`,
    "The committee has considered the research proposal and accompanying documents submitted by the principal investigator. The committee confirms that the research adheres to the ethical standards and guidelines set forth by Jamhuriya University of Science and Technology and relevant national and international regulations.",
    "",
    "Approval Details:",
    "",
    `Received: ${formatJurecDateShort(approval.receivedAt)}\tReviewed: ${formatJurecDateShort(approval.reviewedAt)}\tApproved: ${formatJurecDateShort(approval.signedAt)}`,
    "",
    approval.chairpersonLine || CHAIRPERSON_DEFAULT,
    "Chairperson",
    "Jamhuriya University Research Ethics Committee",
    "Mogadishu – Somalia",
  ].join("\n");
}

function renderJurecCertificatePdf(doc, application, { margin, pageWidth, logoPath }) {
  const approval = application.approval || {};
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a");
  doc.text(COMMITTEE_NAME, margin, y, { width: contentWidth, align: "center" });
  y += 22;

  doc.font("Helvetica").fontSize(10).fillColor("#0f172a");
  doc.text(`Ref: ${approval.refNumber || "—"}`, margin, y, { width: contentWidth * 0.62, align: "left" });
  doc.text(`Date: ${formatJurecDate(approval.signedAt)}`, margin + contentWidth * 0.55, y, {
    width: contentWidth * 0.45,
    align: "right",
  });
  y += 28;

  if (logoPath) {
    const logoW = 64;
    doc.image(logoPath, (pageWidth - logoW) / 2, y, { width: logoW });
    y += logoW + 12;
  }

  doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f172a");
  doc.text("ETHICAL APPROVAL CERTIFICATE", margin, y, { width: contentWidth, align: "center" });
  y += 18;
  doc.font("Helvetica").fontSize(11);
  doc.text("On Research Involving Human Subjects", margin, y, { width: contentWidth, align: "center" });
  y += 26;

  doc.font("Helvetica-Bold").fontSize(10).text("Certificate Number:", margin, y, { continued: true });
  doc.font("Helvetica").text(` ${approval.certificateNumber || "—"}`);
  y = doc.y + 10;

  doc.font("Helvetica-Bold").text("Serial Number:", margin, y, { continued: true });
  doc.font("Helvetica").text(` ${approval.serialNumber || approval.refNumber || "—"}`);
  y = doc.y + 14;

  doc.font("Helvetica-Bold").text("Date of Issue:", margin, y, { continued: true });
  doc.font("Helvetica").text(` ${formatJurecDate(approval.signedAt)}`);
  y = doc.y + 18;

  doc.font("Helvetica-Bold").text("Principal Investigator:", margin, y);
  y = doc.y + 4;
  doc.font("Helvetica").text(certificatePrincipalName(application, approval), margin, y);
  y = doc.y + 14;

  doc.font("Helvetica-Bold").text("Faculty/Center:", margin, y);
  y = doc.y + 4;
  doc.font("Helvetica").text(certificateFacultyCenter(application, approval), margin, y);
  y = doc.y + 14;

  doc.font("Helvetica-Bold").text("Title of Project:", margin, y);
  y = doc.y + 4;
  doc.font("Helvetica").text(certificateProjectTitle(application, approval), margin, y, { width: contentWidth, align: "left" });
  y = doc.y + 14;

  doc.font("Helvetica").fontSize(10).text(
    `The committee has considered the research proposal and accompanying documents submitted by the principal investigator. The committee confirms that the research adheres to the ethical standards and guidelines set forth by ${UNIVERSITY_NAME} and relevant national and international regulations.`,
    margin,
    y,
    { width: contentWidth, align: "justify" }
  );
  y = doc.y + 20;

  doc.font("Helvetica-Bold").fontSize(10).text("Approval Details:", margin, y);
  y = doc.y + 10;

  y = renderApprovalDetailsBoxes(doc, margin, y, contentWidth, approval) + 20;

  const signatory = resolveSignatory(approval.signatoryKey, approval.chairpersonLine || approval.signedByName);
  const includeSignature = approval.includeSignature !== false;
  const includeStamp = approval.includeStamp !== false;
  const sigX = margin;
  const sigY = y + 8;

  renderSignatureBlock(doc, sigX, sigY, signatory.line || signatory.name, includeSignature);
  let blockBottom = sigY + (includeSignature ? 36 : 18);
  doc.font("Helvetica").fontSize(10).fillColor("#0f172a");
  doc.text(signatory.title || approval.signatoryTitle || "Chairperson", sigX, blockBottom);
  blockBottom += 14;
  doc.text("Jamhuriya University Research Ethics Committee", sigX, blockBottom);
  blockBottom += 14;
  doc.text("Mogadishu – Somalia", sigX, blockBottom);

  if (includeStamp) {
    const stampSize = 72;
    renderOfficialStamp(doc, margin + contentWidth - stampSize, sigY - 4, stampSize);
  }
}

module.exports = {
  CHAIRPERSON_DEFAULT,
  COMMITTEE_NAME,
  JUREC_SIGNATORIES,
  JUREC_CHAIRPERSON_OPTIONS,
  formatJurecDate,
  formatJurecDateShort,
  buildJurecApprovalMeta,
  previewJurecCertificate,
  resolveSignatory,
  certificatePrincipalName,
  certificateFacultyCenter,
  certificateProjectTitle,
  buildCertificateNotificationBody,
  renderJurecCertificatePdf,
};
