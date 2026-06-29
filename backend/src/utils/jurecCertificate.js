const { ETHICS_STATUSES } = require("../models/EthicsApplication");

const CHAIRPERSON_DEFAULT = "Kasim Abdi Jimale/Dr.Nur Rashid Ahmed";
const COMMITTEE_NAME = "JAMHURIYA UNIVERSITY RESEARCH ETHICS COMMITTEE";
const UNIVERSITY_NAME = "Jamhuriya University of Science and Technology";

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
  const pi = principalInvestigatorName(application);
  const faculty = facultyCenterLabel(application);
  const title = application.projectTitle || "—";

  return [
    COMMITTEE_NAME,
    `Ref: ${approval.refNumber}\t\t\t\tDate: ${formatJurecDate(approval.signedAt)}`,
    "",
    "ETHICAL APPROVAL CERTIFICATE",
    "On Research Involving Human Subjects",
    "",
    `Certificate Number: ${approval.certificateNumber}`,
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
  y = doc.y + 14;

  doc.font("Helvetica-Bold").text("Date of Issue:", margin, y, { continued: true });
  doc.font("Helvetica").text(` ${formatJurecDate(approval.signedAt)}`);
  y = doc.y + 18;

  doc.font("Helvetica-Bold").text("Principal Investigator:", margin, y);
  y = doc.y + 4;
  doc.font("Helvetica").text(principalInvestigatorName(application), margin, y);
  y = doc.y + 14;

  doc.font("Helvetica-Bold").text("Faculty/Center:", margin, y);
  y = doc.y + 4;
  doc.font("Helvetica").text(facultyCenterLabel(application), margin, y);
  y = doc.y + 14;

  doc.font("Helvetica-Bold").text("Title of Project:", margin, y);
  y = doc.y + 4;
  doc.font("Helvetica").text(application.projectTitle || "—", margin, y, { width: contentWidth, align: "left" });
  y = doc.y + 14;

  doc.font("Helvetica").fontSize(10).text(
    `The committee has considered the research proposal and accompanying documents submitted by the principal investigator. The committee confirms that the research adheres to the ethical standards and guidelines set forth by ${UNIVERSITY_NAME} and relevant national and international regulations.`,
    margin,
    y,
    { width: contentWidth, align: "justify" }
  );
  y = doc.y + 20;

  doc.font("Helvetica-Bold").fontSize(10).text("Approval Details:", margin, y);
  y = doc.y + 14;

  doc.font("Helvetica").fontSize(10);
  doc.text(
    `Received: ${formatJurecDateShort(approval.receivedAt)}\tReviewed: ${formatJurecDateShort(approval.reviewedAt)}\tApproved: ${formatJurecDateShort(approval.signedAt)}`,
    margin,
    y,
    { width: contentWidth }
  );
  y = doc.y + 36;

  doc.text(approval.chairpersonLine || CHAIRPERSON_DEFAULT, margin, y);
  y += 14;
  doc.text("Chairperson", margin, y);
  y += 14;
  doc.text("Jamhuriya University Research Ethics Committee", margin, y);
  y += 14;
  doc.text("Mogadishu – Somalia", margin, y);
}

module.exports = {
  CHAIRPERSON_DEFAULT,
  COMMITTEE_NAME,
  formatJurecDate,
  formatJurecDateShort,
  buildJurecApprovalMeta,
  buildCertificateNotificationBody,
  renderJurecCertificatePdf,
};
