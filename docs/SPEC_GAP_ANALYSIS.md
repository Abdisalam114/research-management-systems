# University RMS — Specification vs Current MVP

This document maps your **8 core modules** and **4 user roles** to what is implemented in **Jamhuriya RMS MVP** (`just-rms-mvp`) as of the current codebase.  

Legend:

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented (API + UI, usable end-to-end) |
| ⚠️ | Partial (schema, seed, or limited flow only) |
| ❌ | Not implemented |

---

## Phase 2 implemented (university spec alignment)

Recent additions mapping to your 8 modules / 4 roles:

| Area | Added |
|------|--------|
| Proposals | Ethics workflow (`ethicsStatus`, ethics decision API), version history on document change, assign reviewers (director) |
| Projects | Timeline dates, milestones UI, research team UI, `PUT /api/projects/:id` |
| Director | Strategic policies (`/policies`), faculty analytics table, grant success %, annual report JSON + PDF |
| Coordinator | Faculty dashboard on `/dashboard`, faculty research report JSON + PDF |
| Finance | `/finance-reports`, budgets + payments + PO review on `/budgets` (`/api/procurement` API) |
| Publications | Book/chapter type, `communityImpact` field, director can also validate, CrossRef DOI citation refresh |
| Profile | Research interests + publication list |
| Repository | OAI-PMH style export endpoint (`/api/repository/oai/export`) |
| Collaboration | Group chat (one conversation per research group via `GET /api/conversations/group/:groupId`) |
| Departments | Director CRUD page at `/departments` |

Re-run `npm run seed` after pulling. Existing DB documents get new fields on next save.

---

## What this MVP already delivers (summary)

- MERN stack: Express + MongoDB + React (Vite)
- JWT auth, seven active roles, route guards (`frontend/src/App.jsx`, `backend/src/middleware/auth.js`)
  Active: research_director, faculty_coordinator, finance_officer, researcher, hr_officer, leadership, donor_agency
  Removed separate logins: ethics_committee, peer_reviewer, procurement_officer
- Unified seed: `backend/src/scripts/seed.js` + `backend/src/scripts/seedData.js`
- Director creates users only (`POST /api/users`); public register disabled
- Director dashboard with charts + institutional analytics section on `/dashboard`
- Core flows: proposals → review → director decision → project; grants; budgets; publications; repository; groups; notifications; messages

---

## 1. Research Proposal Management

| Requirement | Status | Notes / location |
|-------------|--------|------------------|
| Proposal submission | ✅ | `POST /api/proposals`, submit; `ProposalForm.jsx`, `ProposalsList.jsx` |
| Upload proposal documents | ✅ | Multer on create/update; `Proposal.document` |
| Proposal review | ✅ | Coordinator `POST /api/proposals/:id/review`; `ProposalReview.jsx` |
| Proposal status tracking | ✅ | `draft` → `submitted` → `under_review` → `approved` / `rejected` / `revision_requested` |
| Director approve / reject / revision | ✅ | `POST /api/proposals/:id/director-decision` |
| Auto project on approval | ✅ | `proposalController.directorDecision` creates `Project` |
| Ethics approval workflow | ✅ | `ethicsStatus`, `POST /api/proposals/:id/ethics-decision`; submit gated on ethics approval |
| Version control (history, compare, prior files) | ✅ | `versionHistory` array with snapshots; new revision on document replace |
| Assign named reviewers | ✅ | `POST /api/proposals/:id/assign-reviewers`; director-only |

---

## 2. Research Project Management

| Requirement | Status | Notes / location |
|-------------|--------|------------------|
| Approved project registry | ✅ | `GET /api/projects`; `ProjectsList.jsx`, `ProjectDetails.jsx` |
| Project timeline tracking | ✅ | `startDate`/`endDate` editable on `ProjectDetails.jsx` |
| Milestones monitoring | ✅ | Milestones add/complete in `ProjectDetails.jsx` and `PUT /api/projects/:id` |
| Research team management | ✅ | `teamMembers` subdocs (`name`, `userId`, `role`) editable in UI |
| Progress reports | ✅ | `POST /api/projects/:id/progress`; `ProjectProgressUpdate.jsx` |
| Project status / dates update (UI) | ✅ | `PUT /api/projects/:id` for status + timeline (researcher + director) |

---

## 3. Grant & Funding Management

| Requirement | Status | Notes / location |
|-------------|--------|------------------|
| Grant application | ✅ | Researcher create/edit/submit; `Grants.jsx`, `grantRoutes.js` |
| Budget planning (at grant stage) | ⚠️ | `Budget.grantId` links budget to grant; no grant budget template |
| Funding source tracking | ⚠️ | Free-text `fundingSource`, `donorRef` on `Grant` |
| Grant compliance | ⚠️ | `complianceNotes` field only |
| Director approve / reject grants | ✅ | `POST /api/grants/:id/director-decision` |
| Donor-funded grants tracker | ✅ | `donorRef` field + filter toggle on Grants page (director) |
| Finance officer grant approval | ❌ | Director only on `grantRoutes.js` |

---

## 4. Publication & Output Tracking

| Requirement | Status | Notes / location |
|-------------|--------|------------------|
| Journal articles | ✅ | Type `journal_article` |
| Conference papers | ✅ | Type `conference_paper` |
| Patents | ✅ | Type `patent` |
| Theses | ✅ | Type `thesis` |
| Books / book chapters | ✅ | Type `book_chapter` |
| Community research impact | ✅ | `communityImpact` field |
| Submit outputs | ✅ | Researcher submit flow |
| Coordinator + director validation | ✅ | `POST /api/publications/:id/validate` — both roles |
| Citation metrics (external) | ✅ | `POST /api/publications/:id/citations/refresh` — CrossRef DOI lookup |

---

## 5. Research Repository

| Requirement | Status | Notes / location |
|-------------|--------|------------------|
| Store datasets | ✅ | `RepositoryItem` types; `Repository.jsx` |
| Store publications / theses / documents | ✅ | Upload + list + access levels |
| Store proposals in repository | ⚠️ | Proposals use `Proposal.document`; not a repository item type |
| Access control (private / group / institution) | ✅ | `repositoryController.listItems` |
| Institutional repository integration | ✅ | `GET /api/repository/oai/export` — OAI-PMH/Dublin Core XML |

---

## 6. Finance & Budget Tracking

| Requirement | Status | Notes / location |
|-------------|--------|------------------|
| Research budget allocation | ⚠️ | `totalAllocated` on budget; researcher creates budget |
| Expense tracking | ✅ | Budget line items type `expense` |
| Budget approval workflow | ✅ | Finance `PATCH` item status; `Budgets.jsx` queue |
| Purchase Orders for research | ✅ | `PurchaseOrder` model + `/api/procurement` + Finance PO queue on `/budgets` |
| Financial reports (export / formal) | ✅ | `FinanceReports.jsx` + `GET /api/analytics/finance-report` |
| Payment processing (RA, travel, equipment) | ✅ | `Payment` model + payment flows on `/budgets` |

---

## 7. Research Analytics & Reporting

| Requirement | Status | Notes / location |
|-------------|--------|------------------|
| Director performance dashboard | ✅ | `DirectorDashboard.jsx`, `GET /api/analytics/institutional` |
| Charts (projects, grants, output) | ✅ | Recharts on director dashboard |
| Institutional section on dashboard | ✅ | `InstitutionalAnalyticsSections.jsx` (`#institutional-analytics`) |
| Role dashboard metrics (non-director) | ✅ | `GET /api/analytics/dashboard`; `Dashboard.jsx` |
| Publications per faculty | ✅ | `facultyAnalytics` on institutional endpoint + `FacultyAnalyticsSection.jsx` |
| Research productivity (per researcher/faculty) | ✅ | `GET /api/analytics/faculty-report` (coordinator) + table |
| Citation metrics (automated) | ✅ | CrossRef refresh button on Publications page |
| Grant success rate | ✅ | `grantSuccessRate` on institutional analytics |
| Annual research reports | ✅ | `GET /api/analytics/annual-report.pdf` + dashboard button |
| Faculty PDF report | ✅ | `GET /api/analytics/faculty-report.pdf` + dashboard button |

`/analytics` for director redirects to dashboard analytics section.

---

## 8. Collaboration & Communication

| Requirement | Status | Notes / location |
|-------------|--------|------------------|
| Research groups | ✅ | `Groups.jsx`, `researchGroupRoutes.js` |
| Notifications | ✅ | `Notifications.jsx`, hooks in grant/budget/publication flows |
| Messaging system | ✅ | `Messages.jsx`, `conversationRoutes.js` |
| Inter-faculty collaboration (beyond groups) | ✅ | Groups span departments; coordinator/director can see all |
| Group chat | ✅ | `GET /api/conversations/group/:groupId` opens shared chat tied to group members |
| Real-time push (WebSocket) | ❌ | Polling / refresh only (deferred) |

---

## 3. User roles & key features

### Role 1: Research Director

| Feature (from spec) | Status | MVP |
|---------------------|--------|-----|
| Strategic research management (policies, themes, programs) | ✅ | `ResearchPolicy` model + `/policies` page (themes, priorities, programs) |
| Proposal approval system | ✅ | Director decision + review page |
| Assign reviewers | ✅ | `POST /api/proposals/:id/assign-reviewers` |
| Research performance dashboard | ✅ | `DirectorDashboard.jsx` |
| Grant & funding oversight | ✅ | Grant director decision; donor filter; analytics funding |
| Institutional research reports | ✅ | Annual report JSON + PDF download |
| Research compliance / ethics monitoring | ✅ | Ethics decision API + status badge on proposals |
| Create / manage users | ✅ | `PendingUsers.jsx`, `POST /api/users` |
| Departments (CRUD) | ✅ | `/departments` page with create/update/delete |

**Routes:** `/dashboard`, `/analytics` (redirect), `/pending-users`, full module access per sidebar.

---

### Role 2: Faculty Research Coordinator

| Feature (from spec) | Status | MVP |
|---------------------|--------|-----|
| Faculty research monitoring | ✅ | `CoordinatorDashboard.jsx` (queue + counts + report) |
| Proposal pre-review | ✅ | `coordinatorReview` |
| Research collaboration (groups + chat) | ✅ | Groups module + per-group chat |
| Faculty research reporting | ✅ | JSON + PDF endpoints + dashboard download |
| Publication verification | ✅ | Coordinator + director can validate |

**No access:** budgets (sidebar), `/pending-users`, institutional analytics.

---

### Role 3: Finance Officer

| Feature (from spec) | Status | MVP |
|---------------------|--------|-----|
| Research budget management | ✅ | View all budgets; approve/pay/reject items |
| Grant financial tracking | ⚠️ | View grants; director still approves; finance can see donor-funded |
| Payment processing | ✅ | `/budgets` — payment requests (RA, equipment, travel, publication fee, other) — request, approve, mark paid |
| Purchase Orders | ✅ | `/budgets` Finance PO queue (vendor, items; flow: requested → finance-reviewed → director_approved → paid) |
| Financial reporting | ✅ | `/finance-reports` page + finance-report API |

**No access:** proposals, projects (not in `App.jsx` or sidebar).

---

### Role 4: Researcher

| Feature (from spec) | Status | MVP |
|---------------------|--------|-----|
| Research proposal submission | ✅ | Create, edit, submit, upload |
| Project management (timeline, team, milestones) | ✅ | `ProjectDetails.jsx` editing |
| Publication submission + CrossRef citations | ✅ | Full CRUD + submit + DOI refresh |
| Grant applications + donor reference | ✅ | Create/submit grants |
| Budget + payment + PO requests | ✅ | Own budgets + payment requests + PO requests (Finance reviews PO) |
| Research profile | ✅ | `Profile.jsx` with research interests + publication portfolio |

---

## Frontend routes (quick reference)

| Path | Roles |
|------|--------|
| `/dashboard` | All |
| `/analytics` | Director (→ dashboard section) |
| `/pending-users` | Director |
| `/departments` | Director (CRUD) |
| `/policies` | Director |
| `/proposals`, `/proposals/new`, `/proposals/:id`, `/proposals/:id/review` | Researcher + coordinator + director (review: coordinator + director) |
| `/projects`, `/projects/:id`, `/projects/:id/progress` | Researcher + coordinator + director + finance officer (progress: researcher) |
| `/grants`, `/budgets`, `/publications`, `/repository`, `/groups` | See `App.jsx` |
| `/budgets` (payments + PO) | Researcher, finance officer, director |
| `/finance-reports` | Finance officer, director |
| `/faculty-dashboard` | Coordinator |
| `/notifications`, `/messages`, `/profile` | All authenticated |

---

## Recommended build order (Phase 2+)

If extending toward the full university spec without breaking the MVP:

1. Ethics workflow (gate before/at submission)
2. Project milestones + team APIs and UI
3. Analytics by faculty + grant success rate + annual report export
4. Proposal document version history
5. Book publication type; finance formal reports
6. External institutional repository integration

---

## Document maintenance

When adding a feature, update the row in this file and note the API route + page path.  
Seed and demo logins remain in `backend/src/scripts/seedData.js`.
