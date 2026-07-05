# URGMS Gap Analysis — Jamhuriya RMS
# Falanqaynta Fogaanta (Somali + English)

**Reference / Tixraac:** University Research Grant Management System (URGMS) infographic  
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

Jamhuriya RMS implements the **core research lifecycle** shown in the URGMS diagram: application → ethics → review → project → grant → budget → publication → repository. After **Phases 1–4 (July 2026)**, approximately **72–75%** of the full URGMS blueprint is covered. Remaining gaps: **external integrations** (ERP, HR, SSO), **dedicated reviewer portal**, **KPI dashboard**, and **automated email/SMS**.

### Somali

Jamhuriya RMS wuxuu qabtaa **socodka cilmi-baarista ee asaasiga ah** ee ku muuqda sawirka URGMS. Ka dib **Phase 1–4 (July 2026)**, qiyaastii **72–75%** qorshaha buuxa waa la dhisay. Weli ma jiraan: **isku-xirka dibadda** (ERP, HR, SSO), **reviewer portal gaar ah**, **KPI dashboard**, iyo **email/SMS otomaatig ah**.

---

## 2. Stakeholders / Dadka Isticmaala

| URGMS stakeholder | Jamhuriya RMS role / module | Status |
|-------------------|----------------------------|--------|
| Researchers / PI | `researcher` | ✅ |
| Department | `faculty_coordinator` (faculty-scoped) | ✅ |
| Research Office | `research_director` | ✅ |
| Finance Office | `finance_officer` | ✅ |
| Procurement Office | `procurement_officer` — PO queue before director | ✅ |
| HR Office | — | ❌ |
| Ethics Committee | `ethics_committee` + Director JUREC (`/ethics`) | ✅ |
| Reviewers | Assign reviewers on proposals | ⚠️ No dedicated reviewer portal |
| Leadership | Director dashboard + analytics | ✅ |
| Donors | `donorRef` on grants + filter | ⚠️ Field only, no donor portal |

### Somali — Sharaxaad

- **Cilmi-baaraha, Isku-duwaha, Agaasimaha, Maaliyadda** — dhammaan waa la dhisay.
- **Ethics Committee, Procurement Officer** — roles cusub la dhisay (July 2026).
- **HR, Donor portal, Reviewer portal** — weli ma jiraan.

---

## 3. Six-Step Grant Lifecycle / Lixda Tallaabo

### Step 1 — Funding & Call Management  
**URGMS:** Funding opportunities, internal calls (e.g. Seed Grants), eligibility criteria, notifications.

| Feature | EN | SO | Status | RMS location |
|---------|----|----|--------|--------------|
| Published funding calls | Open calls researchers can browse | Call-yada la daabaco | ⚠️ | `/funding-calls` — basic module exists |
| Internal seed / institutional grants | University-initiated grant rounds | Deeqaha gudaha | ⚠️ | Funding calls + grants |
| Eligibility rules | Who can apply (UG/PG, faculty, deadline) | Shuruudaha u qalmitaanka | ⚠️ | UG/PG portal + call deadlines |
| Call notifications | Alert when new call opens | Ogeysiis marka call cusub furmo | ⚠️ | General notifications only |
| Link grant application to a call | Application tied to specific opportunity | Grant ku xiran call gaar ah | ⚠️ | Partial — grants + funding calls |
| Funding source text | Donor / source name on grant | Magaca deeq-bixiyaha | ⚠️ | `Grant.fundingSource`, `donorRef` |

**Gap summary:** Step 1 improved with `/funding-calls` but call-to-grant linking and eligibility rules remain partial.

**Recommendation / Talobixin:** Strengthen call–grant linkage and eligibility rules — see Section 9.

---

### Step 2 — Application Management  
**URGMS:** Registration, proposal submission, budget preparation, ethics document upload.

| Feature | Status | RMS location |
|---------|--------|--------------|
| Researcher registration | ✅ | Director creates users (`/pending-users`) |
| Proposal submission + documents | ✅ | `/proposals`, `ProposalForm.jsx` |
| Budget at application stage | ✅ | `Proposal.budgetBreakdown`, `ProposalApplicationExtras.jsx` |
| Ethics application form | ✅ | `/ethics`, 7 required fields |
| Ethics documents upload | ✅ | Multer uploads on ethics + proposals |
| Ethics linked to proposal | ✅ | `proposalEthicsLink.js`, submit gate |

**Somali:** Codsiga proposal-ka, miisaaniyadda marxaladda codsiga, compliance docs, iyo foomka anshaxa — dhammaan waa buuxa (July 2026).

---

### Step 3 — Review & Approval Management  
**URGMS workflow:** Admin screening → Peer review → Committee review → Ethics review → Finance review → Final approval (Director).

| URGMS stage | Status | RMS implementation |
|-------------|--------|---------------------|
| 1. Administrative screening | ⚠️ | Coordinator pre-review only |
| 2. Peer review | ❌ | Assign reviewers API exists; no peer scoring UI |
| 3. Committee review | ❌ | Not separate from director decision |
| 4. Ethics review & approval | ✅ | JUREC + **`ethics_committee` role** can approve |
| 5. Finance review | ❌ | Finance sees budgets after grant; no pre-approval gate |
| 6. Final approval (Director) | ✅ | `POST /api/proposals/:id/director-decision` |
| Ethics: Approve / Revise / Reject | ✅ | Director ethics decision + revision flow |
| Grant director decision | ✅ | `POST /api/grants/:id/director-decision` |

**Somali:** Anshaxa (JUREC) iyo ansixinta ugu dambeysa ee Director waa adag yihiin. Peer review, committee, iyo finance review ka hor approval — weli ma jiraan sida sawirka.

---

### Step 4 — Project Management  
**URGMS:** Project setup, work plans, milestones, budget management, communication log.

| Feature | Status | RMS location |
|---------|--------|--------------|
| Auto project on proposal approval | ✅ | `proposalController.directorDecision` |
| Timeline (start/end dates) | ✅ | `ProjectDetails.jsx` |
| Milestones | ✅ | Add/complete milestones |
| Research team | ✅ | `teamMembers` on project |
| Progress reports | ✅ | `/projects/:id/progress` |
| Budget management | ✅ | `/budgets` |
| Communication log | ✅ | `Project.communicationLog`, execution panel |
| **Thesis supervision** (extension) | ✅ | `/thesis` — groups, title workflow, chapters, meetings, activity log |

**Somali:** Maamulka mashruuca waa fiican. Thesis module waa dheeri ka baxsan URGMS asalka.

---

### Step 5 — Monitoring & Reporting  
**URGMS:** Progress monitoring, technical/financial reports, KPI tracking, publications.

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
**URGMS:** Final reports, audits, asset handover, archiving.

| Feature | Status | RMS location |
|---------|--------|--------------|
| Final report submission | ✅ | `POST /api/projects/:id/closure/submit` |
| Audit / compliance sign-off | ✅ | 5-item closure checklist + Director + Finance approval |
| Asset handover register | ✅ | `closure.assetHandover` field |
| Archiving to repository | ⚠️ | Manual repository upload; project archive status |
| Grant status `closed` | ⚠️ | Project closure workflow; grant `closed` partial |

**Somali:** Xiritaanka mashruuca waa la dhisay (July 2026): checklist, final report, lessons learned, Director → Finance → archive.

---

## 4. Shared Services / Adeegyada Wadaagga ah

| URGMS service | EN status | SO | RMS |
|---------------|-----------|-----|-----|
| Workflow & Approvals | ✅ Core flows | Socodka ansixinta | Proposals, grants, budgets, publications |
| Document Management | ✅ Uploads | Maareynta dukumeentiyada | Multer + repository |
| Ethics & Compliance | ✅ JUREC | Anshaxa & u hoggaansanaanta | `/ethics`, certificate PDF |
| Audit Trail (full activity log) | ✅ | `/audit-trail`, `listRecentAudit` API |
| Notifications & Alerts | ✅ | Ogeysiisyada | `/notifications` |
| Electronic Signatures | ⚠️ | Saxiix elektaroonig | JUREC PDF signature + stamp only |
| Search, Reports & Analytics | ⚠️ | Raadinta & warbixinnada | Dashboards, PDF reports; no global search |
| Security | ✅ | Amniga | JWT, RBAC, UG/PG `programTier` |

---

## 5. Dashboards / Dashboard-yada

| URGMS dashboard | RMS | Status |
|-----------------|-----|--------|
| Researcher — My Applications, Projects, Tasks | `Dashboard.jsx`, role metrics | ✅ |
| Research Office — Proposals, Under Review, Approved | Director + Coordinator dashboards | ✅ |
| Finance — Budgets, Expenditures, Cash Flow | `FinanceDashboard.jsx`, `/finance-reports` | ✅ |
| Leadership — Total Funding, Success Rate, Impact | `DirectorDashboard.jsx`, institutional analytics | ✅ |

**Somali:** Afarta dashboard ee sawirka — dhammaan waxay u dhigmaan waxa naga jira, inkastoo qaar ay yihiin fudud marka loo eego URGMS buuxa.

---

## 6. System Architecture / Qaab-dhismeedka

| URGMS layer | RMS | Status |
|-------------|-----|--------|
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
| Email / SMS Gateway | ⚠️ In-app notifications only |
| University Identity (SSO/LDAP) | ❌ |
| OAI-PMH repository export | ✅ `/api/repository/oai/export` |

---

## 7. Coverage Scorecard / Dhibcaha Guud

| URGMS section | Coverage | Priority to close gap |
|---------------|----------|------------------------|
| Stakeholders (10 roles) | ~70% | Medium |
| Step 1 — Funding & Calls | ~45% | Medium |
| Step 2 — Applications | ~95% | Low |
| Step 3 — Review & Approval | ~60% | High |
| Step 4 — Project Management | ~95% | Low |
| Step 5 — Monitoring & Reporting | ~80% | Low |
| Step 6 — Project Closure | ~85% | Low |
| Shared Services | ~85% | Low |
| Dashboards | ~85% | Low |
| Architecture & Integrations | ~50% | Long-term |

**Overall / Guud ahaan:** ~**73%** of URGMS blueprint (July 2026 — after Phases 1–4).

---

## 8. What Jamhuriya RMS Has Beyond URGMS Diagram  
## Waxa ka baxsan Sawirka URGMS

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

## 9. Recommended Build Order / Taxanaha Dhismaha

Based on URGMS gaps and current MVP stability:

| Phase | Module | EN rationale | SO |
|-------|--------|--------------|-----|
| **3.1** | **Funding Calls (`/funding-calls`)** | Closes Step 1; links grants to published opportunities | Xir fogaanta Tallaabada 1 |
| 3.2 | Multi-stage review workflow | Peer + committee steps before director | Peer review + committee |
| 3.3 | Finance pre-approval gate | Finance sign-off before grant activation | Maaliyadda ka hor ansixinta |
| 3.4 | Project closure module | Final report, archive, grant `closed` | Xiritaanka mashruuca |
| 3.5 | System-wide audit trail | Unified activity log on all entities | Diiwaanka ficillada oo dhan |
| 3.6 | KPI dashboard | Leadership metrics from URGMS | KPI dashboard |
| 3.7 | External integrations | Email, SSO, ERP (optional) | Isku-xirka dibadda |

### Step 1 — Funding Calls (proposed scope)

If you approve building Step 1 next, minimum viable scope:

**Director**
- Create / edit / publish / close a funding call
- Set: title, description, amount cap, deadline, eligibility (UG/PG/faculty), documents required

**Researcher**
- Browse open calls
- Apply via grant form pre-filled from call (callId on Grant)

**API sketch**
- `FundingCall` model
- `GET/POST /api/funding-calls`
- `POST /api/funding-calls/:id/publish`
- Grant create requires optional `callId` when applying to a call

**Somali:** Haddii aad ogolaato, tallaabada xigta waa **Funding Calls module** — Director wuxuu daabacaa deeqaha furan, Researcher-kuna wuxuu codsanayaa call gaar ah.

---

## 10. Quick Reference — RMS Modules Today

| Module | Route | URGMS step |
|--------|-------|------------|
| Ethics (REC/JUREC) | `/ethics` | Step 2 & 3 |
| Proposals | `/proposals` | Step 2 & 3 |
| Projects | `/projects` | Step 4 |
| Grants | `/grants` | Step 1 (partial) & 2 |
| Budgets | `/budgets` | Step 4 & 5 |
| Publications | `/publications` | Step 5 |
| Repository | `/repository` | Step 5 & 6 |
| Groups | `/groups` | Step 4 (collaboration) |
| Thesis | `/thesis` | Extension |
| Payments | `/payments` | Step 4 & 5 |
| Procurement | `/procurement` | Step 4 |
| Finance Reports | `/finance-reports` | Step 5 |
| Research Workflow | `/research-workflow` | Step 5 |

---

## 11. Document Maintenance

- Update this file when a URGMS gap is closed.
- Technical detail also in `docs/SPEC_GAP_ANALYSIS.md` (English, module-by-module).
- System diagram (downloadable): `docs/RMS_SYSTEM_DIAGRAM.html`.
- Reference image: URGMS infographic (University Research Grant Management System).

---

*Jamhuriya University — Research Management Systems · Gap analysis vs URGMS blueprint*
