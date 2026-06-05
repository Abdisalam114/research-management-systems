/**
 * Generates docs/DATABASE_STRUCTURE.pdf from Mongoose model definitions.
 * Run: node src/scripts/generateDatabaseDocsPdf.js
 */
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const OUT_PATH = path.resolve(__dirname, "../../../docs/DATABASE_STRUCTURE.pdf");

const COLORS = {
  title: "#0f172a",
  heading: "#0369a1",
  subheading: "#334155",
  muted: "#64748b",
  line: "#cbd5e1",
};

const COLLECTIONS = [
  {
    name: "users",
    model: "User",
    purpose: "Authentication, roles, and researcher profiles.",
    fields: [
      ["fullName", "String", "Required — display name"],
      ["email", "String", "Required, unique, lowercase"],
      ["password", "String", "Required, bcrypt hashed (select: false)"],
      ["role", "Enum", "research_director | faculty_coordinator | finance_officer | researcher"],
      ["department", "String", "Required"],
      ["rank", "String", "Required academic rank"],
      ["researchInterests", "String", "Comma-separated interests"],
      ["status", "Enum", "pending | active | rejected"],
      ["isProtected", "Boolean", "Protected seeded/admin accounts"],
      ["refreshToken", "String", "JWT refresh token (select: false)"],
      ["createdAt / updatedAt", "Date", "Auto timestamps"],
    ],
    refs: [],
  },
  {
    name: "departments",
    model: "Department",
    purpose: "Faculty departments under Jamhuriya University.",
    fields: [
      ["name", "String", "Required, unique"],
      ["code", "String", "Required, unique (e.g. CS)"],
      ["faculty", "String", "Faculty / kulliyad name"],
      ["createdBy", "ObjectId → User", "Who created the record"],
      ["createdAt / updatedAt", "Date", "Auto timestamps"],
    ],
    refs: ["User (createdBy)"],
  },
  {
    name: "proposals",
    model: "Proposal",
    purpose: "Research proposals submitted before project creation.",
    fields: [
      ["title, abstract", "String", "Required"],
      ["department, researchArea", "String", "Required"],
      ["document", "String", "Uploaded file path (optional)"],
      ["version", "Number", "Default 1"],
      ["versionHistory", "Array", "Version snapshots with document + note"],
      ["researcherId", "ObjectId → User", "Proposal owner"],
      ["ethicsApplicationId", "ObjectId → EthicsApplication", "Linked ethics form"],
      ["status", "Enum", "draft | submitted | under_review | approved | rejected | revision_requested"],
      ["requiresEthics", "Boolean", "Default true"],
      ["ethicsStatus", "Enum", "not_required | pending | approved | rejected | revision_requested"],
      ["ethicsComments", "Array", "role, comment, at"],
      ["assignedReviewers", "Array", "userId, assignedBy, assignedAt"],
      ["reviewerComments", "Array", "role, comment, at"],
      ["submittedAt", "Date", "Submission timestamp"],
      ["createdAt / updatedAt", "Date", "Auto timestamps"],
    ],
    refs: ["User (researcherId, reviewers)", "EthicsApplication"],
  },
  {
    name: "ethicsapplications",
    model: "EthicsApplication",
    purpose: "REC ethics application form (linked 1:1 to a proposal when applicable).",
    fields: [
      ["proposalId", "ObjectId → Proposal", "Unique sparse index"],
      ["researcherId", "ObjectId → User", "Applicant"],
      ["status", "Enum", "draft | submitted | approved | rejected"],
      ["principal / coResearcher", "Object", "Person: name, title, faculty, department, phone, email"],
      ["otherInvestigators", "String[]", "Up to 6 names"],
      ["projectTitle, projectLevel", "String", "Level: undergraduate | pgd | master"],
      ["startDate / endDate", "Date", "Project dates"],
      ["backgroundLiterature, aimsObjectives, rationale, design", "String", "Research design"],
      ["subjectTypes", "String[]", "human | animal | records | others"],
      ["inclusionCriteria / exclusionCriteria", "String", "Participant criteria"],
      ["risk.level", "Enum", "no_risk | minimal | great"],
      ["instruments", "String[]", "interview | survey | observation | etc."],
      ["consent", "Object", "hasForm, language (somali|english|other), items[]"],
      ["dataSafety / privacy / conflictOfInterest", "Object", "Data handling & COI"],
      ["applicantSignature", "Object", "name, signedAt"],
      ["approval", "Object", "decision, certificateId, serialNumber, academicYear, signedByUserId"],
      ["createdAt / updatedAt", "Date", "Auto timestamps"],
    ],
    refs: ["Proposal", "User (researcherId, signedByUserId)"],
  },
  {
    name: "projects",
    model: "Project",
    purpose: "Active research projects created from approved proposals.",
    fields: [
      ["proposalId", "ObjectId → Proposal", "Source proposal"],
      ["title", "String", "Required"],
      ["researcherId", "ObjectId → User", "Principal Investigator (PI)"],
      ["teamMembers", "Array", "name, userId, role"],
      ["milestones", "Array", "title, dueDate, completed"],
      ["startDate / endDate", "Date", "Project timeline"],
      ["status", "Enum", "active | completed | on_hold"],
      ["progressReports", "Array", "note, progressPercent, createdBy, createdAt"],
      ["createdAt / updatedAt", "Date", "Auto timestamps"],
    ],
    refs: ["Proposal", "User (researcherId, teamMembers, progressReports.createdBy)"],
  },
  {
    name: "publications",
    model: "Publication",
    purpose: "Research outputs and faculty publication workflow.",
    fields: [
      ["title", "String", "Required"],
      ["type", "Enum", "paper | journal_article | conference | book | book_chapter | patent | thesis | review | case_study | letter_to_editor | community_research_impact"],
      ["year, venue, doi, orcid, url", "Mixed", "Bibliographic metadata"],
      ["authors", "String[]", "Author list"],
      ["citationCount", "Number", "Default 0"],
      ["communityImpact", "String", "Impact description"],
      ["status", "Enum", "draft | submitted | validated | rejected"],
      ["workflowStage", "Enum", "submitted | in_process | pipeline | published"],
      ["researcherId", "ObjectId → User", "Owner"],
      ["validatedBy / validatedAt", "ObjectId / Date", "Coordinator/director validation"],
      ["validationComment", "String", "Review note"],
      ["createdAt / updatedAt", "Date", "Auto timestamps"],
    ],
    refs: ["User (researcherId, validatedBy)"],
  },
  {
    name: "grants",
    model: "Grant",
    purpose: "Funding applications and awarded grants.",
    fields: [
      ["title, fundingSource, donorRef", "String", "Grant details"],
      ["currency", "String", "Default USD"],
      ["amountRequested / amountAwarded", "Number", "Funding amounts"],
      ["status", "Enum", "draft | submitted | approved | rejected | active | closed"],
      ["complianceNotes", "String", "Donor compliance notes"],
      ["researcherId", "ObjectId → User", "Applicant"],
      ["projectId", "ObjectId → Project", "Linked project"],
      ["submittedAt / decidedAt", "Date", "Workflow dates"],
      ["createdAt / updatedAt", "Date", "Auto timestamps"],
    ],
    refs: ["User", "Project"],
  },
  {
    name: "budgets",
    model: "Budget",
    purpose: "Budget allocation for grants and projects.",
    fields: [
      ["grantId", "ObjectId → Grant", "Optional grant link"],
      ["projectId", "ObjectId → Project", "Optional project link"],
      ["ownerResearcherId", "ObjectId → User", "Budget owner"],
      ["totalAllocated", "Number", "Total budget cap"],
      ["currency", "String", "Default USD"],
      ["financeNotes", "String", "Finance officer notes"],
      ["items[]", "Array", "type (expense|procurement), description, amount, status (pending|approved|paid|rejected)"],
      ["createdAt / updatedAt", "Date", "Auto timestamps"],
    ],
    refs: ["Grant", "Project", "User"],
  },
  {
    name: "payments",
    model: "Payment",
    purpose: "Payment requests against budgets (director → finance workflow).",
    fields: [
      ["category", "Enum", "research_assistant | equipment | travel | publication_fee | other"],
      ["budgetId", "ObjectId → Budget", "Required"],
      ["payee, purpose", "String", "Required"],
      ["amount, currency", "Number / String", "Payment amount"],
      ["status", "Enum", "requested | director_approved | paid | rejected"],
      ["requestedBy", "ObjectId → User", "Requester"],
      ["directorApprovedBy / directorApprovedAt", "ObjectId / Date", "Director approval"],
      ["paidBy / paidAt", "ObjectId / Date", "Finance disbursement"],
      ["paymentMethod", "Enum", "cash | bank_transfer | mobile_money | check | other"],
      ["referenceNumber, notes", "String", "Payment reference"],
      ["projectId / grantId", "ObjectId", "Optional links"],
      ["createdAt / updatedAt", "Date", "Auto timestamps"],
    ],
    refs: ["Budget", "User", "Project", "Grant"],
  },
  {
    name: "purchaseorders",
    model: "PurchaseOrder",
    purpose: "Procurement orders against budgets.",
    fields: [
      ["poNumber", "String", "Purchase order number"],
      ["budgetId", "ObjectId → Budget", "Required"],
      ["vendorName, vendorContact", "String", "Vendor details"],
      ["items[]", "Array", "description, quantity, unitPrice"],
      ["totalAmount", "Number", "Auto-calculated from items"],
      ["status", "Enum", "requested | director_approved | paid | rejected"],
      ["projectId / grantId", "ObjectId", "Optional links"],
      ["requestedBy", "ObjectId → User", "Requester"],
      ["directorApprovedBy / paidBy", "ObjectId → User", "Approvers"],
      ["paymentMethod", "Enum", "cash | bank_transfer | mobile_money | check | other"],
      ["createdAt / updatedAt", "Date", "Auto timestamps"],
    ],
    refs: ["Budget", "User", "Project", "Grant"],
  },
  {
    name: "researchgroups",
    model: "ResearchGroup",
    purpose: "Collaboration groups for researchers (join/leave + group chat).",
    fields: [
      ["name", "String", "Required, unique"],
      ["description", "String", "Group description"],
      ["kind", "Enum", "collaboration | thesis"],
      ["departmentId", "ObjectId → Department", "Optional department"],
      ["createdBy", "ObjectId → User", "Creator"],
      ["members[]", "Array", "userId, role (lead|member), joinedAt"],
      ["createdAt / updatedAt", "Date", "Auto timestamps"],
    ],
    refs: ["Department", "User"],
  },
  {
    name: "thesisgroups",
    model: "ThesisGroup",
    purpose: "Thesis supervision: students, supervisor, meetings.",
    fields: [
      ["title", "String", "Thesis title"],
      ["students[]", "Array", "fullName, studentId, email"],
      ["researchGroupId", "ObjectId → ResearchGroup", "Linked chat/collaboration group"],
      ["supervisorId", "ObjectId → User", "Supervising researcher"],
      ["coordinatorId", "ObjectId → User", "Faculty coordinator"],
      ["department, faculty, facultyResearchArea", "String", "Academic context"],
      ["status", "Enum", "proposed | in_progress | submitted | defended | completed"],
      ["meetingSchedule", "String", "Recurring schedule text"],
      ["meetings[]", "Array", "date, location, agenda, notes, loggedBy"],
      ["createdBy", "ObjectId → User", "Creator"],
      ["createdAt / updatedAt", "Date", "Auto timestamps"],
    ],
    refs: ["ResearchGroup", "User"],
  },
  {
    name: "conversations",
    model: "Conversation",
    purpose: "Direct and group messaging between users.",
    fields: [
      ["participants", "ObjectId[] → User", "Chat participants"],
      ["messages[]", "Array", "senderId, body, at"],
      ["lastMessageAt", "Date", "For sorting conversations"],
      ["groupId", "ObjectId → ResearchGroup", "Set for group chats"],
      ["title", "String", "Conversation label"],
      ["createdAt / updatedAt", "Date", "Auto timestamps"],
    ],
    refs: ["User", "ResearchGroup"],
  },
  {
    name: "notifications",
    model: "Notification",
    purpose: "Per-user in-app notifications.",
    fields: [
      ["userId", "ObjectId → User", "Recipient"],
      ["type", "Enum", "proposal | project | grant | budget | publication | repository | message | system"],
      ["title, body, link", "String", "Notification content"],
      ["readAt", "Date", "Null = unread"],
      ["createdAt / updatedAt", "Date", "Auto timestamps"],
    ],
    refs: ["User"],
  },
  {
    name: "repositoryitems",
    model: "RepositoryItem",
    purpose: "Institutional repository file catalog (PDF, CSV, Excel).",
    fields: [
      ["type", "Enum", "dataset | publication | thesis | document"],
      ["title, description, tags", "String", "Metadata"],
      ["filePath, fileSize", "String / Number", "Stored file"],
      ["access", "Enum", "private | group | institution"],
      ["groupId", "ObjectId → ResearchGroup", "Group-scoped access"],
      ["projectId", "ObjectId → Project", "Project link"],
      ["uploadedBy", "ObjectId → User", "Uploader"],
      ["createdAt / updatedAt", "Date", "Auto timestamps"],
    ],
    refs: ["ResearchGroup", "Project", "User"],
  },
];

const RELATIONSHIPS = [
  "User → Proposal (researcherId)",
  "User → EthicsApplication (researcherId)",
  "Proposal ↔ EthicsApplication (1:1 via proposalId / ethicsApplicationId)",
  "Proposal → Project (approved proposal creates project)",
  "User → Project (researcherId = PI)",
  "Project → Grant → Budget → Payment / PurchaseOrder",
  "User → Publication (researcherId)",
  "ResearchGroup → Conversation (groupId for group chat)",
  "ThesisGroup → ResearchGroup (researchGroupId)",
  "User → Notification (userId)",
  "User → RepositoryItem (uploadedBy)",
  "Department → ResearchGroup (departmentId)",
];

const WORKFLOW = [
  "1. Researcher registers → User (status: pending → active after approval)",
  "2. Researcher creates Proposal + EthicsApplication (draft)",
  "3. Submit to Director → status: submitted",
  "4. Director reviews ethics + proposal → approved",
  "5. System creates Project from approved proposal",
  "6. Researcher applies for Grant → Budget allocated",
  "7. Payments / PurchaseOrders drawn from Budget (director → finance)",
  "8. Publications submitted → validated by coordinator/director",
  "9. Files uploaded to Repository (PDF/CSV/Excel)",
  "10. Collaboration via ResearchGroup + Conversation + Notifications",
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function drawHr(doc) {
  const y = doc.y;
  doc.strokeColor(COLORS.line).moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
  doc.moveDown(0.6);
}

function checkPageBreak(doc, needed = 80) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }
}

function sectionTitle(doc, text) {
  checkPageBreak(doc, 40);
  doc.fillColor(COLORS.heading).fontSize(14).font("Helvetica-Bold").text(text);
  doc.moveDown(0.4);
  doc.fillColor(COLORS.title);
}

function bodyText(doc, text, opts = {}) {
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.subheading).text(text, opts);
  doc.moveDown(0.3);
}

function renderTable(doc, rows) {
  const colWidths = [130, 90, doc.page.width - doc.page.margins.left - doc.page.margins.right - 220];
  const startX = doc.page.margins.left;
  const rowHeight = 18;

  checkPageBreak(doc, rowHeight * (rows.length + 1));

  rows.forEach((row, idx) => {
    checkPageBreak(doc, rowHeight + 4);
    const y = doc.y;
    const isHeader = idx === 0;
    doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(isHeader ? 9 : 8.5);
    doc.fillColor(isHeader ? COLORS.heading : COLORS.subheading);

    let x = startX;
    row.forEach((cell, colIdx) => {
      doc.text(String(cell || ""), x, y, { width: colWidths[colIdx], lineGap: 1 });
      x += colWidths[colIdx];
    });
    doc.y = y + rowHeight;
    if (isHeader) {
      doc.strokeColor(COLORS.line).moveTo(startX, doc.y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), doc.y).stroke();
      doc.moveDown(0.2);
    }
  });
  doc.moveDown(0.5);
}

async function generatePdf() {
  ensureDir(path.dirname(OUT_PATH));

  const doc = new PDFDocument({ size: "A4", margin: 54, bufferPages: true });
  const stream = fs.createWriteStream(OUT_PATH);
  doc.pipe(stream);

  const generatedAt = new Date().toLocaleString();

  // Cover
  doc.fillColor(COLORS.title).font("Helvetica-Bold").fontSize(24).text("Jamhuriya RMS", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(18).fillColor(COLORS.heading).text("Database Structure Documentation", { align: "center" });
  doc.moveDown(1.2);
  doc.font("Helvetica").fontSize(11).fillColor(COLORS.muted).text("Research Management System (MERN Stack)", { align: "center" });
  doc.text("MongoDB + Mongoose ODM", { align: "center" });
  doc.moveDown(2);
  doc.fontSize(10).text(`Generated: ${generatedAt}`, { align: "center" });
  doc.text("Database: rms  |  URI: mongodb://localhost:27017/rms", { align: "center" });
  doc.text("Repository: research-management-systems", { align: "center" });

  doc.addPage();

  // Overview
  sectionTitle(doc, "1. Overview");
  bodyText(doc, "Jamhuriya RMS uses MongoDB with 15 collections (Mongoose models). All collections include createdAt and updatedAt timestamps unless noted.");
  bodyText(doc, "Collections: users, departments, proposals, ethicsapplications, projects, publications, grants, budgets, payments, purchaseorders, researchgroups, thesisgroups, conversations, notifications, repositoryitems.");
  drawHr(doc);

  sectionTitle(doc, "2. User Roles");
  renderTable(doc, [
    ["Role", "Code", "Access"],
    ["Research Director", "research_director", "Institutional oversight, ethics approval, grants"],
    ["Faculty Coordinator", "faculty_coordinator", "Faculty proposals, publication validation"],
    ["Finance Officer", "finance_officer", "Budgets, payments, procurement"],
    ["Researcher", "researcher", "Proposals, projects, publications, groups"],
  ]);
  drawHr(doc);

  sectionTitle(doc, "3. Entity Relationships");
  RELATIONSHIPS.forEach((line) => bodyText(doc, `• ${line}`));
  drawHr(doc);

  sectionTitle(doc, "4. Main Workflow");
  WORKFLOW.forEach((line) => bodyText(doc, line));
  drawHr(doc);

  // Collections
  sectionTitle(doc, "5. Collection Reference");
  doc.moveDown(0.3);

  COLLECTIONS.forEach((col, index) => {
    checkPageBreak(doc, 120);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.heading).text(`${index + 1}. ${col.name} (${col.model})`);
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.subheading).text(col.purpose);
    doc.moveDown(0.4);
    renderTable(doc, [["Field", "Type", "Description"], ...col.fields]);
    if (col.refs.length) {
      doc.font("Helvetica-Oblique").fontSize(9).fillColor(COLORS.muted).text(`References: ${col.refs.join(", ")}`);
      doc.moveDown(0.4);
    }
    drawHr(doc);
  });

  // Footer on all pages
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted);
    doc.text(`Jamhuriya RMS — Database Structure | Page ${i + 1} of ${range.count}`, 54, doc.page.height - 36, {
      align: "center",
      width: doc.page.width - 108,
    });
  }

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  const stats = fs.statSync(OUT_PATH);
  console.log(`PDF written: ${OUT_PATH}`);
  console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB`);
}

generatePdf().catch((err) => {
  console.error(err);
  process.exit(1);
});
