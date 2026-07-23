# System Gap Analysis — Jamhuriya RMS
# Falanqaynta Fogaanta (Somali + English)

**Reference / Tixraac:** Jamhuriya Research Management System (RMS) specification diagram  
**Target system / Nidaamka la barbardhigayo:** Jamhuriya Research Management System (RMS)  
**Date / Taariikh:** July 2026 (updated after Phases 1–4)  
**Codebase:** `research-management-systems` (MERN: React + Express + MongoDB)

> **See also:** [WHATS_NEW_JULY_2026.md](./WHATS_NEW_JULY_2026.md) for every feature added in July 2026.

---

## Legend / Calaamadaha

| Symbol | English | Somali |
|--------|---------|--------|
| ✅ | Implemented end-to-end | La sameeyay oo shaqeynaya |
| ⚠️ | Partial / limited | Qayb ahaan / xaddidan |
| ❌ | Not implemented | Weli lama sameyn |

---

## 1. Executive Summary / Koobid

### English

Jamhuriya RMS implements the **core research lifecycle** shown in the full system specification: application → ethics → review → project → grant → budget → publication → repository. After **Phases 1–4 (July 2026)** and **thesis completion features**, approximately **92%** of the full specification is covered. Remaining gaps: **external integrations** (ERP, HR payroll sync, SSO), **KPI dashboard**, and **automated email/SMS**.

### Somali

Jamhuriya RMS wuxuu qabtaa **socodka cilmi-baarista ee asaasiga ah** ee ku muuqda qorshaha buuxa ee nidaamka. Ka dib **Phase 1–4 (July 2026)**, qiyaastii **78%** qorshaha buuxa waa la dhisay. Weli ma jiraan: **isku-xirka dibadda** (ERP, HR, SSO), **KPI dashboard**, iyo **email/SMS otomaatig ah**.

---

## 2. Stakeholders / Dadka Isticmaala

| Specified stakeholder | Jamhuriya RMS role / module | Status |
|-----------------------|----------------------------|--------|
| Researchers / PI | `researcher` | ✅ |
| Department | `faculty_coordinator` (faculty-scoped) | ✅ |
| Research Office | `research_director` | ✅ |
| Finance Office | `finance_officer` | ✅ |
| Finance Office | `finance_officer` — budgets, PO review before director, payments | ✅ |
| HR Office | `hr_officer` | ⚠️ User + project/thesis access; no payroll module |
| Ethics Committee | `ethics_committee` + Director JUREC (`/ethics`) | ✅ |
| Reviewers | `peer_reviewer` + assign reviewers API | ⚠️ Peer review UI; not full standalone portal |
| Leadership | `leadership` + Director analytics | ✅ |
| Donors | `donor_agency` + `donorRef` on grants | ⚠️ Donor reports page; not full external portal |

### Somali — Sharaxaad

- **Cilmi-baaraha, Isku-duwaha, Agaasimaha, Maaliyadda** — dhammaan waa la dhisay.
- **Ethics Committee, Procurement, HR, Reviewer, Leadership, Donor** — roles cusub la dhisay (2026).
- **HR payroll sync, Donor portal buuxa** — weli ma jiraan.

---

## 3. Six-Step Grant Lifecycle / Lixda Tallaabo

### Step 1 — Funding & Call Management  
**Specification:** Funding opportunities, internal calls (e.g. Seed Grants), eligibility criteria, notifications.

| Feature | EN | SO | Status | RMS location |
|---------|----|----|--------|--------------|
| Published funding calls | Open calls researchers can browse | Call-yada la daabaco | ✅ | `/funding-calls` |
| Internal seed / institutional grants | University-initiated grant rounds | Deeqaha gudaha | ⚠️ | Funding calls + grants |
| Eligibility rules | Who can apply (UG/PG, faculty, deadline) | Shuruudaha u qalmitaanka | ⚠️ | UG/PG portal + call deadlines |
| Call notifications | Alert when new call opens | Ogeysiis marka call cusub furmo | ⚠️ | General notifications only |
| Link grant application to a call | Application tied to specific opportunity | Grant ku xiran call gaar ah | ✅ | Grant requires `callId` |
| Funding source text | Donor / source name on grant | Magaca deeq-bixiyaha | ✅ | `Grant.fundingSource`, `donorRef` |

**Gap summary:** Step 1 strong; eligibility automation and call alerts remain partial.

---

### Step 2 — Application Management  
**Specification:** Registration, proposal submission, ethics document upload. Budget on funding-call grant only (not on proposal).

| Feature | Status | RMS location |
|---------|--------|--------------|
| Researcher registration | ✅ | Director creates users (`/pending-users`) |
| Proposal submission + documents | ✅ | `/proposals`, `ProposalForm.jsx` |
| Budget at grant/call stage | ✅ | `Grant.budgetBreakdown`, `GrantBudgetLines.jsx` |
| Ethics application form | ✅ | `/ethics`, 7 required fields |
| Ethics documents upload | ✅ | Multer uploads on ethics + proposals |
| Ethics linked to proposal | ✅ | `proposalEthicsLink.js`, submit gate |

**Somali:** Codsiga proposal-ka, foomka anshaxa, iyo miisaaniyadda grant/call — waa buuxa.

---

### Step 3 — Review & Approval Management  
**Required workflow:** Admin screening → Peer review → Committee review → Ethics review → Finance review → Final approval (Director).

| Review stage | Status | RMS implementation |
|--------------|--------|---------------------|
| 1. Administrative screening | ✅ | `ProposalMultiStageReview.jsx`, admin screening API |
| 2. Peer review | ⚠️ | Assign reviewers + scoring UI; `peer_reviewer` role |
| 3. Committee review | ⚠️ | Committee review API + UI |
| 4. Ethics review & approval | ✅ | JUREC + `ethics_committee` role |
| 5. Finance review | ⚠️ | Finance proposal review API; grant finance gate ✅ |
| 6. Final approval (Director) | ✅ | `POST /api/proposals/:id/director-decision` |
| Grant final approval (Leadership) | ✅ | `leadership` role on grant decision |

**Somali:** Anshaxa iyo ansixinta ugu dambeysa waa adag yihiin. Peer/committee/finance review — qayb ahaan waa jira.

---

### Step 4 — Project Management  
**Specification:** Project setup, work plans, milestones, budget management, communication log.

| Feature | Status | RMS location |
|---------|--------|--------------|
| Auto project on proposal approval | ✅ | `proposalController.directorDecision` |
| Timeline (start/end dates) | ✅ | `ProjectDetails.jsx` |
| Milestones | ✅ | Add/complete milestones |
| Research team | ✅ | `teamMembers` on project |
| Progress reports | ✅ | `/projects/:id/progress` |
| Budget management | ✅ | `/budgets` |
| Communication log | ✅ | `Project.communicationLog`, execution panel |
| **Thesis supervision** (extension) | ✅ | `/thesis` — groups, title workflow, chapters, meetings |

**Somali:** Maamulka mashruuca waa fiican. Thesis module waa dheeri ka baxsan qorshaha asalka.

---

### Step 5 — Monitoring & Reporting  
**Specification:** Progress monitoring, technical/financial reports, KPI tracking, publications.

| Feature | Status | RMS location |
|---------|--------|--------------|
| Progress monitoring | ✅ | Project progress updates |
| Technical reports | ⚠️ | Progress text; no formal template |
| Financial reports | ✅ | `/finance-reports`, analytics API |
| KPI tracking | ❌ | No KPI dashboard |
| Publications tracking | ✅ | `/publications` workflow |
| Research Workflow Status | ✅ | `/research-workflow` |
| Faculty / annual reports | ✅ | PDF export on dashboard |
| Citation metrics | ✅ | CrossRef DOI refresh |

**Somali:** Warbixinnada maaliyadeed iyo publications waa jira. KPI tracking rasmi ah ma jiro.

---

### Step 6 — Project Closure  
**Specification:** Final reports, audits, asset handover, archiving.

| Feature | Status | RMS location |
|---------|--------|--------------|
| Final report submission | ✅ | `POST /api/projects/:id/closure/submit` |
| Audit / compliance sign-off | ✅ | 5-item closure checklist + Director + Finance approval |
| Asset handover register | ✅ | `closure.assetHandover` field |
| Archiving to repository | ⚠️ | Manual repository upload; project archive status |
| Grant status `closed` | ⚠️ | Project closure workflow; grant `closed` partial |

**Somali:** Xiritaanka mashruuca waa la dhisay: checklist, final report, lessons learned, Director → Finance → archive.

---

## 4. Shared Services / Adeegyada Wadaagga ah

| Required service | EN status | SO | RMS |
|------------------|-----------|-----|-----|
| Workflow & Approvals | ✅ Core flows | Socodka ansixinta | Proposals, grants, budgets, publications |
| Document Management | ✅ Uploads | Maareynta dukumeentiyada | Multer + repository |
| Ethics & Compliance | ✅ JUREC | Anshaxa & u hoggaansanaanta | `/ethics`, certificate PDF |
| Audit Trail (full activity log) | ✅ | `/audit-trail`, `listRecentAudit` API |
| Notifications & Alerts | ⚠️ | Ogeysiisyada | `/notifications` in-app only |
| Electronic Signatures | ⚠️ | Saxiix elektaroonig | JUREC PDF signature + stamp only |
| Search, Reports & Analytics | ⚠️ | Raadinta & warbixinnada | Dashboards, PDF reports; no global search |
| Security | ✅ | Amniga | JWT, RBAC, UG/PG `programTier` |

---

## 5. Dashboards / Dashboard-yada

| Required dashboard | RMS | Status |
|--------------------|-----|--------|
| Researcher — My Applications, Projects, Tasks | `Dashboard.jsx`, role metrics | ✅ |
| Research Office — Proposals, Under Review, Approved | Director + Coordinator dashboards | ✅ |
| Finance — Budgets, Expenditures, Cash Flow | `FinanceDashboard.jsx`, `/finance-reports` | ✅ |
| Leadership — Total Funding, Success Rate, Impact | `DirectorDashboard.jsx`, institutional analytics | ✅ |

**Somali:** Afarta dashboard ee qorshaha — dhammaan waxay u dhigmaan waxa naga jira, inkastoo qaar ay yihiin fudud marka loo eego qorshaha buuxa.

---

## 6. System Architecture / Qaab-dhismeedka

| Architecture layer | RMS | Status |
|--------------------|-----|--------|
| Web App (Responsive UI) | React + Vite | ✅ |
| Application Server (Logic) | Express `/api/*` | ✅ |
| Database Server | MongoDB | ✅ |
| File Storage (Documents) | Local/uploads + repository | ✅ |
| Backup Server | — | ❌ Ops/deployment concern |
| Security Layer (SSL) | JWT + route guards | ⚠️ SSL at deploy time |

### Integrations / Isku-xirka

| Integration | Status |
|-------------|--------|
| Finance / ERP | ❌ |
| HR / Payroll | ❌ |
| Email / SMS Gateway | ⚠️ In-app + SMTP/outbox (`emailNotify.js`) |
| University Identity (SSO/LDAP) | ❌ |
| OAI-PMH repository export | ✅ `/api/repository/oai/export` |

---

## 7. Coverage Scorecard / Dhibcaha Guud

| System section | Coverage | Priority to close gap |
|----------------|----------|------------------------|
| Stakeholders (10 roles) | ~92% | Low |
| Step 1 — Funding & Calls | ~88% | Low |
| Step 2 — Applications | ~95% | Low |
| Step 3 — Review & Approval | ~88% | Low |
| Step 4 — Project Management | ~95% | Low |
| Step 5 — Monitoring & Reporting | ~90% | Low |
| Step 6 — Project Closure | ~88% | Low |
| Shared Services | ~90% | Low |
| Dashboards | ~92% | Low |
| Architecture & Integrations | ~55% | Long-term |
| KPI tracking | ✅ | `/kpi-dashboard` |
| Global search | ✅ | `/search`, `GET /api/search` |
| Email notifications | ⚠️ | In-app + SMTP/outbox |
| Technical report PDF | ✅ | `GET /api/projects/:id/technical-report.pdf` |
| Auto-archive to repository | ✅ | On project archive |
| Internal vs external calls | ✅ | `callType` on FundingCall |

**Overall / Guud ahaan:** ~**92%** of full system specification — **thesis-ready (90%+)**.

---

## 8. What Jamhuriya RMS Has Beyond the Original Specification  
## Waxa ka baxsan Qorshaha Asalka

| Extension | Description (EN) | Sharaxaad (SO) |
|-----------|------------------|----------------|
| Thesis module | Title: students choose → supervisor enters → coordinator accepts; chapters & meetings | Thesis: magac doorasho → supervisor geliyo → coordinator aqbalo |
| JUREC certificate editor | Full preview/edit before approve; serial, dates, signatory, stamp | Shahaadada JUREC oo la beddeli karo ka hor ansixinta |
| Dual-tab authentication | sessionStorage per browser tab | Labo user isla browser kala tabs |
| UG / PG portals | Data separated by `programTier` | UG iyo PG gooni gooni |
| Research policies | Director `/policies` (themes, programs) | Siyaasadaha cilmi-baarista |
| Procurement (PO) | Full PO lifecycle | Purchase Orders |
| Payments module | RA, travel, equipment, publication fees | Bixinta lacagaha |

---

## 9. Recommended Build Order / Taxanaha Dhismaha (thesis scope)

**Completed for thesis (July 2026):** KPI dashboard, email notifications (SMTP/outbox), call eligibility rules, technical report PDF, global search, internal/external call types, auto-archive to repository.

Features deferred to **future work** (not required for 90%+ thesis defense):

| Priority | Module | EN rationale | SO |
|----------|--------|--------------|-----|
| **Future** | External integrations | SSO, ERP, full HR payroll | Isku-xirka dibadda |
| **Future** | SMS gateway | Mobile alerts beyond email | Ogeysiis SMS |

**Somali:** Nidaamku waa **92%** — diyaar qalin-jabinta. ERP/SSO waa mustaqbal, ma aha shuruud qalin-jabinta.

---

## 10. Quick Reference — RMS Modules Today

| Module | Route | Lifecycle phase |
|--------|-------|-----------------|
| Ethics (REC/JUREC) | `/ethics` | Phase 2 & 3 |
| Proposals | `/proposals` | Phase 2 & 3 |
| Projects | `/projects` | Phase 4 |
| Grants | `/grants` | Phase 1 & 2 |
| Budgets | `/budgets` | Phase 4 & 5 |
| Publications | `/publications` | Phase 5 |
| Repository | `/repository` | Phase 5 & 6 |
| Groups | `/groups` | Phase 4 (collaboration) |
| Thesis | `/thesis` | Extension |
| Payments | `/payments` | Phase 4 & 5 |
| Procurement | `/procurement` | Phase 4 |
| Finance Reports | `/finance-reports` | Phase 5 |
| KPI Dashboard | `/kpi-dashboard` | Phase 5 (leadership) |
| Global Search | `/search` | Shared |
| Research Workflow | `/research-workflow` | Phase 5 |

---

## 11. Document Maintenance

- Update this file when a specification gap is closed.
- Technical detail also in `docs/SPEC_GAP_ANALYSIS.md` (English, module-by-module).
- System diagram (downloadable): `docs/RMS_SYSTEM_DIAGRAM.html`.
- Reference: Jamhuriya RMS specification diagram (6-phase lifecycle).

---

*Jamhuriya University — Research Management Systems · Gap analysis vs full system specification*
