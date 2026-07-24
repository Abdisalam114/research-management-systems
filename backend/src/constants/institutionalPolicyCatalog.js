/**
 * Canonical institutional policies — one entry per major RMS function/module.
 * Seeded per program tier (undergraduate & postgraduate).
 */
const POLICY_MODULE_KEYS = Object.freeze([
  "system_overview",
  "roles_access",
  "program_tiers",
  "audit_notifications",
  "proposals_voluntary",
  "proposals_grant_call",
  "proposal_review",
  "projects",
  "research_workflow",
  "publications",
  "repository",
  "collaboration_groups",
  "thesis_groups",
  "peer_review",
  "funding_calls",
  "grants_finance",
  "budgets_procurement",
  "project_closure",
  "donor_reporting",
  "kpi_analytics",
  "ethics_application",
  "ethics_certificate",
]);

const INSTITUTIONAL_POLICY_CATALOG = [
  {
    moduleKey: "system_overview",
    category: "general",
    title: "JUST Research Management System — Purpose & Scope",
    body: `This policy defines the Jamhuriya University Research Management System (JUST RMS) as the single institutional portal for research proposals, ethics clearance, funded projects, budgets, publications, and compliance records.

Scope:
• All faculty, researchers, graduate students, and administrative offices must use RMS for research administration unless exempted in writing by the Research Office.
• External donors and partner agencies are recorded via donor reference fields on funding calls; the Research Director manages external calls and donor reports (no separate donor login).
• Records created in RMS constitute the official institutional research file for audit and accreditation purposes.`,
  },
  {
    moduleKey: "roles_access",
    category: "general",
    title: "Institutional Roles & Access Control",
    body: `Access to RMS modules is role-based. Users may not share credentials or perform actions outside their assigned role.

Role responsibilities:
• Researcher / PI — proposals, ethics forms, projects, publications, repository uploads for owned projects.
• Faculty Coordinator — department proposal pre-review, publication validation support, faculty-level oversight.
• Research Director — final proposal approval (project creation), ethics review & JUREC certificate, user management, departments, institutional analytics, external funding calls, donor reporting, and former HR coordination visibility.
• University Leadership — peer review assignments, grant awards, KPI review, institutional policy maintenance.
• Finance Officer — grant funding approval, budgets, purchase-order review (before Director), payments, finance reports, project closure (finance).

Only the Research Director may create or activate user accounts. Separate HR Officer and Donor Agency logins are not used.`,
  },
  {
    moduleKey: "program_tiers",
    category: "general",
    title: "Undergraduate & Postgraduate Portal Separation",
    body: `RMS operates two institutional portals: Undergraduate and Postgraduate. The Research Director selects the active portal at login; other users are assigned to one tier.

Policy requirements:
• Research records, proposals, projects, and ethics applications are stored within the user's program tier and are not mixed across tiers.
• Institutional policies, funding rules, and notifications apply within the selected portal context.
• Cross-tier reporting is limited to Research Director and Leadership analytics unless explicitly authorized.`,
  },
  {
    moduleKey: "audit_notifications",
    category: "general",
    title: "Audit Trail, Notifications & Accountability",
    body: `All significant actions in RMS (submissions, approvals, rejections, budget changes, closures) are logged in the audit trail where applicable.

Researchers and staff must:
• Respond to in-system notifications within the deadlines stated in module-specific policies.
• Retain supporting documents in the repository when required by ethics or grant conditions.
• Report discrepancies to the Research Office immediately.

The Research Director and Faculty Coordinators may review audit events for compliance monitoring.`,
  },
  {
    moduleKey: "proposals_voluntary",
    category: "research",
    title: "Voluntary Research Proposals",
    body: `Voluntary research is initiated by a Researcher / PI without a linked funding call.

Requirements:
• Create the proposal via Proposals → New Voluntary Proposal with abstract, department, research area, and supporting document.
• If human subjects or ethical risk applies, complete the linked JUREC ethics application before final submission.
• Submit once; subsequent changes follow revision workflow set by the Faculty Coordinator and Research Director.
• Approved voluntary proposals create an active project under Projects.`,
  },
  {
    moduleKey: "proposals_grant_call",
    category: "research",
    title: "Grant Fund Call Proposals",
    body: `Funded research must start from an open Funding Call — not from the voluntary proposal form.

Process:
• Researcher applies through Funding Calls → Apply on an eligible call.
• Proposal must include budget, compliance files, and ethics form when required by the call.
• Accepted proposals proceed through finance review (if funded) and director approval before grant activation.
• Approved grant-fund-call proposals create both a project and linked grant record.`,
  },
  {
    moduleKey: "proposal_review",
    category: "research",
    title: "Multi-Stage Proposal Review Workflow",
    body: `Proposals pass through structured review stages visible on the proposal review page:

1. Admin screening — Faculty Coordinator or Research Director.
2. Peer review — University Leadership members assigned by the Research Director (score 1–5 with comments).
3. Committee review — Faculty Coordinator / Research Director recommendation.
4. Finance review — Finance Officer (grant fund call proposals only; not required for voluntary).
5. Director decision — approve (creates project), request revision, or reject.

No final approval is issued until ethics clearance is complete when ethics is required.`,
  },
  {
    moduleKey: "projects",
    category: "research",
    title: "Active Projects & Progress Reporting",
    body: `Each approved proposal becomes one institutional project.

Policy:
• The PI owns day-to-day project records including progress updates, milestones, and team membership.
• Project status reflects lifecycle: active, closing, or completed.
• Project deletion is restricted; PIs may delete only when no linked publications, grants, or closure records block removal.
• Research Director may delete projects for institutional cleanup when authorized.`,
  },
  {
    moduleKey: "research_workflow",
    category: "research",
    title: "Research Workflow Status & Milestones",
    body: `The Research Workflow module tracks publication and output milestones per project.

Requirements:
• Researchers maintain workflow status aligned with actual research progress.
• Faculty Coordinators and the Research Director use workflow views for monitoring delays and bottlenecks.
• Workflow data supports KPI and accreditation reporting; false reporting is a conduct violation.`,
  },
  {
    moduleKey: "publications",
    category: "research",
    title: "Publications & Outputs — One Output per Project",
    body: `Each project may have at most one publication/output record in RMS (1:1 model).

Rules:
• Researchers register outputs linked to an owned project.
• Draft and rejected outputs may be edited or deleted by the PI; submitted outputs follow coordinator/director validation.
• Duplicate outputs for the same project are not permitted by the system.
• Validated outputs appear in institutional analytics and repository linkage where applicable.`,
  },
  {
    moduleKey: "repository",
    category: "research",
    title: "Institutional Repository & Document Uploads",
    body: `The Repository stores project-scoped files (instruments, datasets metadata, reports, ethics attachments).

Policy:
• Every upload must be linked to a project the user owns or staff access permits.
• Researchers upload only for their projects; staff access is read/manage per role.
• Institution access level applies unless restricted by ethics or donor confidentiality.
• Deletion follows project ownership rules; directors may remove non-compliant files.`,
  },
  {
    moduleKey: "collaboration_groups",
    category: "research",
    title: "Research Collaboration & Groups",
    body: `Research groups support multi-investigator collaboration and messaging.

Requirements:
• Group creators must be active researchers or staff with group-creation rights.
• Membership changes must reflect actual collaboration agreements.
• Group communications supplement but do not replace official ethics, grant, or HR records.`,
  },
  {
    moduleKey: "thesis_groups",
    category: "research",
    title: "Thesis Supervision Groups",
    body: `Thesis groups manage supervised student research teams (minimum membership rules enforced by the system).

HR Officers and Coordinators:
• Verify group composition meets institutional minimums before formal supervision begins.
• Align thesis group records with department registration where applicable.

Students and supervisors must not use thesis groups to bypass ethics or proposal requirements for human-subjects research.`,
  },
  {
    moduleKey: "peer_review",
    category: "research",
    title: "Peer Review Assignments (University Leadership)",
    body: `Peer review of proposals is performed by assigned University Leadership accounts (formerly a separate reviewer role).

Process:
• Research Director assigns leadership reviewers on the proposal review page.
• Assignees receive notifications and submit scored reviews (1–5) with comments.
• Conflict of interest must be declared to the Research Office; reassignment is mandatory when conflict exists.
• Leadership reviewers do not issue final approval — that authority rests with the Research Director.`,
  },
  {
    moduleKey: "funding_calls",
    category: "funding",
    title: "Internal & External Funding Calls",
    body: `Funding calls announce available research funds.

Rules:
• Internal and external calls are created and published by the Research Director.
• Calls display deadline, eligibility, and required attachments; late applications are not accepted unless extended in writing.
• Closed calls remain visible for audit of accepted applications.`,
  },
  {
    moduleKey: "grants_finance",
    category: "funding",
    title: "Grant Awards & Finance Approval",
    body: `Grants link funded proposals to financial authority.

Workflow:
• Upon proposal acceptance, finance review confirms budget alignment.
• Finance Officer approves grant funding release via Grant funding approval.
• Grant status must be active before purchase-order and payment modules consume budget.
• Leadership may participate in award visibility; financial authority remains with Finance and Research Director.`,
  },
  {
    moduleKey: "budgets_procurement",
    category: "funding",
    title: "Budgets, Payments & Purchase Orders",
    body: `Budgets track allocated funds, line items, payments, and purchase orders per grant/project.

Policy:
• Researchers view budgets for owned projects; Finance processes disbursements and purchase-order review.
• Finance Officer reviews purchase orders against approved budget lines before director-level clearance where required.
• Unbudgeted expenditure requires prior written approval from Finance and the Research Director.`,
  },
  {
    moduleKey: "project_closure",
    category: "funding",
    title: "Project Closure — Finance Sign-off",
    body: `Projects entering closure require finance confirmation that obligations are settled.

Finance Officer:
• Reviews remaining budget, pending payments, and purchase-order queues.
• Completes finance closure step before the project is marked completed institutionally.

PIs must submit final progress and outputs before requesting closure.`,
  },
  {
    moduleKey: "donor_reporting",
    category: "funding",
    title: "Donor Reporting & External Funds",
    body: `The Research Director (with Finance) monitors external funding through donor reports and donor-reference fields on funding calls and grants.

Requirements:
• External funding calls are created by the Research Director; donor agency name/reference is stored on the call.
• Researchers acknowledge donor terms when applying; compliance is monitored by Research Director and Finance.
• Reports exported from RMS donor modules are suitable for external submission unless marked draft.`,
  },
  {
    moduleKey: "kpi_analytics",
    category: "funding",
    title: "KPI Dashboard & Institutional Analytics",
    body: `KPI and analytics modules aggregate proposals, projects, grants, publications, and ethics metrics.

Access:
• Research Director, Faculty Coordinators, and Leadership use dashboards for planning and accreditation.
• Aggregated data must not be used to identify individual researchers in external publications without consent and ethics approval.
• Leadership uses KPI trends for policy review — not for individual performance discipline without HR process.`,
  },
  {
    moduleKey: "ethics_application",
    category: "ethics",
    title: "JUREC Ethics Application & Submission",
    body: `Human-subjects and sensitive research requires a JUREC ethics application in RMS before final proposal approval.

Researchers must:
• Complete all mandatory ethics form sections (design, risk, consent, data handling, signatures).
• Link the ethics application to the proposal when submitting voluntary or grant-call applications.
• Save drafts until complete; submit to REC when ready.

Ethics applications are reviewed only by the Research Director in RMS (no separate ethics committee login).`,
  },
  {
    moduleKey: "ethics_certificate",
    category: "ethics",
    title: "Ethics Clearance, Certificate & Project Creation",
    body: `The Research Director reviews submitted ethics applications, may approve with JUREC certificate or reject with reasons.

Sequence:
1. Researcher submits ethics + proposal.
2. Director approves ethics and issues certificate when appropriate.
3. Director approves proposal — system creates the project.

Proposal approval that creates a project is blocked until ethics is approved when ethics is required. Certificate PDFs are available for download after approval.`,
  },
];

module.exports = {
  POLICY_MODULE_KEYS,
  INSTITUTIONAL_POLICY_CATALOG,
};
