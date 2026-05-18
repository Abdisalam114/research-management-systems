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
| Director | Strategic policies (`/policies`), faculty analytics table, grant success %, annual report JSON |
| Coordinator | Faculty dashboard on `/dashboard` (proposal queue by department) |
| Finance | `/finance-reports` — utilization + grant summary |
| Publications | Book/chapter type, `communityImpact` field (schema) |
| Profile | Research interests + publication list |

Re-run `npm run seed` after pulling. Existing DB documents get new fields on next save.

---

## What this MVP already delivers (summary)

- MERN stack: Express + MongoDB + React (Vite)
- JWT auth, four roles, route guards (`frontend/src/App.jsx`, `backend/src/middleware/auth.js`)
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
| Ethics approval workflow | ❌ | No ethics model, states, or committee UI (seed text only on milestones) |
| Version control (history, compare, prior files) | ⚠️ | `version` number increments on resubmit; **no** revision history store or compare UI |
| Assign named reviewers | ❌ | Coordinator review only; no reviewer assignment table |

---

## 2. Research Project Management

| Requirement | Status | Notes / location |
|-------------|--------|------------------|
| Approved project registry | ✅ | `GET /api/projects`; `ProjectsList.jsx`, `ProjectDetails.jsx` |
| Project timeline tracking | ❌ | `startDate` / `endDate` on model; no timeline/Gantt UI |
| Milestones monitoring | ⚠️ | `Project.milestones` in schema + seed; **no** API/UI to add or complete |
| Research team management | ⚠️ | `teamMembers` strings in schema + seed; **no** API/UI to assign users |
| Progress reports | ✅ | `POST /api/projects/:id/progress`; `ProjectProgressUpdate.jsx` |
| Project status / dates update (UI) | ⚠️ | Status enum exists; no general update endpoint in UI |

---

## 3. Grant & Funding Management

| Requirement | Status | Notes / location |
|-------------|--------|------------------|
| Grant application | ✅ | Researcher create/edit/submit; `Grants.jsx`, `grantRoutes.js` |
| Budget planning (at grant stage) | ⚠️ | `Budget.grantId` links budget to grant; no grant budget template |
| Funding source tracking | ⚠️ | Free-text `fundingSource`, `donorRef` on `Grant` |
| Grant compliance | ⚠️ | `complianceNotes` field only |
| Director approve / reject grants | ✅ | `POST /api/grants/:id/director-decision` |
| Finance officer grant approval | ❌ | Director only on `grantRoutes.js` |

---

## 4. Publication & Output Tracking

| Requirement | Status | Notes / location |
|-------------|--------|------------------|
| Journal articles | ✅ | Type `journal_article` |
| Conference papers | ✅ | Type `conference_paper` |
| Patents | ✅ | Type `patent` |
| Theses | ✅ | Type `thesis` |
| Books / book chapters | ❌ | Closest: `other`; no dedicated book type |
| Community research impact | ❌ | No impact / altmetrics module |
| Submit outputs | ✅ | Researcher submit flow |
| Coordinator validation | ✅ | `POST /api/publications/:id/validate` — **faculty_coordinator only** |
| Citation metrics (external) | ⚠️ | Manual `citationCount`; DOI/ORCID fields; no API integration |

---

## 5. Research Repository

| Requirement | Status | Notes / location |
|-------------|--------|------------------|
| Store datasets | ✅ | `RepositoryItem` types; `Repository.jsx` |
| Store publications / theses / documents | ✅ | Upload + list + access levels |
| Store proposals in repository | ⚠️ | Proposals use `Proposal.document`; not a repository item type |
| Access control (private / group / institution) | ✅ | `repositoryController.listItems` |
| Institutional repository integration | ❌ | No DSpace/OAI-PMH/SSO/harvest |

---

## 6. Finance & Budget Tracking

| Requirement | Status | Notes / location |
|-------------|--------|------------------|
| Research budget allocation | ⚠️ | `totalAllocated` on budget; researcher creates budget |
| Expense tracking | ✅ | Budget line items type `expense` |
| Budget approval workflow | ✅ | Finance `PATCH` item status; `Budgets.jsx` queue |
| Procurement for research | ⚠️ | Item type `procurement`; no PO/vendor workflow |
| Financial reports (export / formal) | ❌ | Dashboard counts only; no PDF/CSV reports |
| Payment processing (RA, travel, equipment) | ❌ | No dedicated payment modules |

---

## 7. Research Analytics & Reporting

| Requirement | Status | Notes / location |
|-------------|--------|------------------|
| Director performance dashboard | ✅ | `DirectorDashboard.jsx`, `GET /api/analytics/institutional` |
| Charts (projects, grants, output) | ✅ | Recharts on director dashboard |
| Institutional section on dashboard | ✅ | `InstitutionalAnalyticsSections.jsx` (`#institutional-analytics`) |
| Role dashboard metrics (non-director) | ✅ | `GET /api/analytics/dashboard`; `Dashboard.jsx` |
| Publications per faculty | ❌ | No faculty breakdown API/charts |
| Research productivity (per researcher/faculty) | ⚠️ | Aggregate counts only |
| Citation metrics (automated) | ❌ | Manual field on publications |
| Grant success rate | ❌ | No submitted vs approved ratio |
| Annual research reports | ❌ | No report builder or export |

`/analytics` for director redirects to dashboard analytics section.

---

## 8. Collaboration & Communication

| Requirement | Status | Notes / location |
|-------------|--------|------------------|
| Research groups | ✅ | `Groups.jsx`, `researchGroupRoutes.js` |
| Notifications | ✅ | `Notifications.jsx`, hooks in grant/budget/publication flows |
| Messaging system | ✅ | `Messages.jsx`, `conversationRoutes.js` |
| Inter-faculty collaboration (beyond groups) | ⚠️ | Groups only; no faculty-wide collaboration hub |
| Group chat | ❌ | Messages are not tied to `ResearchGroup` |
| Real-time push (WebSocket) | ❌ | Polling / refresh only |

---

## 3. User roles & key features

### Role 1: Research Director

| Feature (from spec) | Status | MVP |
|---------------------|--------|-----|
| Strategic research management (policies, themes, programs) | ❌ | Not in scope of MVP |
| Proposal approval system | ✅ | Director decision + review page |
| Assign reviewers | ❌ | — |
| Research performance dashboard | ✅ | `DirectorDashboard.jsx` |
| Grant & funding oversight | ✅ | Grant director decision; analytics funding |
| Institutional research reports | ⚠️ | Dashboard analytics; no annual PDF report |
| Research compliance / ethics monitoring | ❌ | — |
| Create / manage users | ✅ | `PendingUsers.jsx`, `POST /api/users` |
| Departments (CRUD) | ⚠️ | API `departmentRoutes.js`; **no** frontend page |

**Routes:** `/dashboard`, `/analytics` (redirect), `/pending-users`, full module access per sidebar.

---

### Role 2: Faculty Research Coordinator

| Feature (from spec) | Status | MVP |
|---------------------|--------|-----|
| Faculty research monitoring | ⚠️ | Can view proposals/projects/publications; no faculty dashboard |
| Proposal pre-review | ✅ | `coordinatorReview` |
| Research collaboration (groups) | ✅ | Groups module |
| Faculty research reporting | ❌ | No faculty report generator |
| Publication verification | ✅ | **Only** coordinator can validate (API) |

**No access:** budgets (sidebar), `/pending-users`, institutional analytics.

---

### Role 3: Finance Officer

| Feature (from spec) | Status | MVP |
|---------------------|--------|-----|
| Research budget management | ✅ | View all budgets; approve/pay/reject items |
| Grant financial tracking | ⚠️ | View grants; cannot approve grants |
| Payment processing | ❌ | — |
| Financial reporting | ❌ | — |

**No access:** proposals, projects (not in `App.jsx` or sidebar).

---

### Role 4: Researcher

| Feature (from spec) | Status | MVP |
|---------------------|--------|-----|
| Research proposal submission | ✅ | Create, edit, submit, upload |
| Project management (timeline, team) | ⚠️ | Progress updates only |
| Publication submission | ✅ | Full CRUD + submit |
| Grant applications | ✅ | Create/submit grants |
| Budget proposal (items) | ✅ | Own budgets |
| Research profile | ⚠️ | `Profile.jsx` basic fields; no rich publication portfolio |

---

## Frontend routes (quick reference)

| Path | Roles |
|------|--------|
| `/dashboard` | All |
| `/analytics` | Director (→ dashboard section) |
| `/pending-users` | Director |
| `/proposals`, `/proposals/new`, `/proposals/:id`, `/proposals/:id/review` | Researcher + coordinator + director (review: coordinator + director) |
| `/projects`, `/projects/:id`, `/projects/:id/progress` | Researcher + coordinator + director (progress: researcher) |
| `/grants`, `/budgets`, `/publications`, `/repository`, `/groups` | See `App.jsx` |
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
