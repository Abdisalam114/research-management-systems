# CHAPTER IV: IMPLEMENTATION AND RESULTS
## (Mobile and Web Development based FYPs)

**Project Title:** Design and Implementation of a Web-Based Research Management System for Jamhuriya University  
**Specialization:** Computer Applications (Mobile and Web based FYP)  
**Faculty:** Faculty of Computer and Information Technology  
**University:** Jamhuriya University of Science and Technology (JUST)

---

## 4.1 Introduction

This chapter presents the implementation, testing, and evaluation of the Jamhuriya Research Management System (JUST RMS). It connects the methodology described in Chapter III to a working web application and reports how the system was built, verified, and assessed against the research objectives.

The system is a **web-based** Final Year Project (responsive in the browser). A separate native mobile application was **out of scope**; mobile access is supported through a responsive React user interface that works on phones and tablets. The implementation covers:

1. Web application screens (researcher, coordinator, finance, director, leadership).  
2. Backend REST API and MongoDB data layer.  
3. Functional, integration, and security testing.  
4. Results that show the system meets the defined requirements for managing the research lifecycle from proposal to closure, including thesis supervision.

---

## 4.2 Snapshots of the System

This section describes the main web interfaces and how they were tested. Screenshots of each module should be inserted in the final bound thesis as **Figure 4.x** (centered, caption below the figure). Example captions:

- Figure 4.1: Login page and demo institutional accounts  
- Figure 4.2: Program portal selection (Undergraduate / Postgraduate)  
- Figure 4.3: Research Director dashboard and analytics  
- Figure 4.4: Proposal submission form with budget and documents  
- Figure 4.5: Multi-stage proposal review pipeline  
- Figure 4.6: Ethics (JUREC) review and certificate download  
- Figure 4.7: Projects list and project workflow panel  
- Figure 4.8: Funding calls and grant application  
- Figure 4.9: Finance & budgets / purchase-order review  
- Figure 4.10: Thesis groups — chapters, meetings, final PDF/Word upload  
- Figure 4.11: Publications and institutional repository  

*(Insert screenshots from the running system at `http://localhost:5173` or the deployed URL.)*

### 4.2.1 Web Application Implementation and Testing

The web client was implemented with **React.js**. Role-based menus and protected routes ensure each user sees only authorized modules. Active institutional roles in the implemented system are:

| Role | Main web modules |
|------|------------------|
| Research Director | Users, departments, proposals, ethics, funding calls, projects, budgets, donor reports, analytics, KPI |
| Faculty Coordinator | Proposals/faculty review, thesis title accept/reject, groups, projects |
| Finance Officer | Budgets, payments, purchase-order review, grant funding approval, finance reports |
| Researcher / PI (Supervisor) | Proposals, projects, grants, publications, repository, thesis supervision, meetings, final thesis upload |
| University Leadership | Peer review scoring, policies, grants visibility, KPI |

Undergraduate (UG) and Postgraduate (PG) data are isolated by program tier. The Research Director selects the portal after login; other accounts are fixed to one portal.

#### 4.2.1.1 Functional Testing

Functional testing used a **black-box** approach: testers entered inputs through the UI and checked expected outputs and database side-effects, without relying on internal code paths for pass/fail decisions.

**Table 4.1 Sample functional test cases (web application)**

| Test ID | Module | Input / Action | Expected Result | Actual Result | Status |
|---------|--------|----------------|-----------------|---------------|--------|
| FT-01 | Auth | Valid director credentials | Login success; portal selection shown | As expected | Pass |
| FT-02 | Auth | Invalid password | Error message; no session | As expected | Pass |
| FT-03 | Proposals | Researcher submits proposal with PDF | Status → submitted; visible to staff | As expected | Pass |
| FT-04 | Review | Leadership submits peer score 1–5 | Peer stage marked; director sees result (no re-entry) | As expected | Pass |
| FT-05 | Ethics | Director approves ethics application | Status approved; certificate downloadable | As expected | Pass |
| FT-06 | Approval | Director approves proposal | Project auto-created and linked | As expected | Pass |
| FT-07 | Grants | Researcher applies via open funding call | Grant draft/application stored with call link | As expected | Pass |
| FT-08 | Finance | Finance authorizes grant budget | Budget available; status updated | As expected | Pass |
| FT-09 | PO | Researcher creates PO → Finance review → Director → Pay | Status pipeline advances; funds deducted | As expected | Pass |
| FT-10 | Thesis | Supervisor proposes title | Coordinator sees Accept/Reject | As expected | Pass |
| FT-11 | Thesis | Supervisor uploads final PDF/Word | File stored; staff can view/download; optional completed status | As expected | Pass |
| FT-12 | Tier | UG user cannot see PG-only records | 403 / empty list for other portal | As expected | Pass |

CRUD operations (create, read, update, delete where allowed), login, validation of required fields, and document upload (PDF/DOC/DOCX) were covered in the test suite and manual role walkthroughs.

#### 4.2.1.2 UI/UX Evaluation

Design principles applied:

- **Consistency:** Shared layout (sidebar, top bar), cards, buttons, and status badges across modules.  
- **Responsiveness:** Layout adapts from desktop to smaller screens; forms wrap without horizontal overflow.  
- **Clarity:** Page headers with filterable statistics; muted helper text; green/amber/red semantic colors for approved/pending/rejected.  
- **Navigation:** Role-filtered sidebar reduces clutter; deep-links from notifications open the related record.

Improvements made after testing feedback included: clearer ethics certificate download (program-tier header), thesis title Accept/Reject on the card, and a unified navy–sky theme across all dashboards.

### 4.2.2 Mobile Application Implementation and Testing

A **native** Android/iOS application was **not developed** in this FYP (declared out of scope). Mobile use is through the **responsive web UI**.

| Criterion | Approach in this FYP |
|-----------|----------------------|
| Mobile app features | Responsive web: login, proposals, notifications, thesis upload on mobile browsers |
| Unit / integration (mobile) | Not applicable for native apps; web client covered under §4.2.1 and §4.3 |
| Device compatibility | Manual checks on Chrome (desktop) and mobile browser viewport; layout remains usable |

*(If the panel asks for “mobile,” explain: Progressive Web / responsive delivery; native app listed under future work in Chapter V.)*

---

## 4.3 Backend and API Development & Testing

### 4.3.1 Backend

The backend was implemented with **Node.js** and **Express.js**. **MongoDB** (via Mongoose) stores institutional research data. The API is organized by domain controllers and routes (proposals, projects, grants, budgets, ethics, thesis groups, analytics, users, notifications, etc.).

**Figure 4.12 (suggested):** Three-tier architecture — React browser client → Express REST API → MongoDB Atlas / local MongoDB.

Main backend responsibilities:

- Authenticate users (JWT) and enforce **role-based access control (RBAC)**.  
- Scope all queries by **program tier** (UG / PG).  
- Persist uploads under `/uploads` and serve static files securely within the app.  
- Trigger side-effects (e.g., create project when proposal is approved; notify staff when supervisor uploads final thesis).

### 4.3.2 API Development

The API follows **RESTful** conventions (`GET`, `POST`, `PATCH`, `PUT`, `DELETE`) under `/api/...`. Clients send `Authorization: Bearer <token>` and `X-Program-Tier` when required.

**Table 4.2 Sample REST endpoints**

| Method | Endpoint (example) | Purpose |
|--------|--------------------|---------|
| POST | `/api/auth/login` | Sign in |
| GET | `/api/proposals` | List proposals (role-scoped) |
| POST | `/api/proposals/:id/submit` | Submit proposal |
| GET | `/api/ethics` | Ethics applications |
| GET | `/api/projects` | Projects |
| POST | `/api/funding-calls` | Create funding call (Director) |
| GET | `/api/grants` | Funding-call applications |
| GET | `/api/budgets` | Budgets / finance views |
| GET | `/api/thesis-groups` | Thesis groups |
| POST | `/api/thesis-groups/:id/final-document` | Upload final thesis PDF/Word |
| GET | `/api/analytics/dashboard` | Dashboard metrics |

### 4.3.3 Testing (Backend and APIs)

Testing goals: verify correctness, error handling, and role restrictions.

- **Manual API checks** with authenticated sessions from the UI and scripts.  
- **Role smoke verification** (`verifyAllStakeholders`-style checks) for all institutional roles.
- **Error handling:** invalid IDs return 404; forbidden roles return 403; missing files return 400.  
- **Load:** institutional seed and realistic record volumes exercised list/filter endpoints without failure in local testing.

---

## 4.4 Security Implementation and Testing

### 4.4.1 Authentication and Authorization

- **Authentication:** Email/password login; passwords hashed (bcrypt); sessions use **JWT** access tokens.  
- **Authorization:** `authorizeRoles(...)` on sensitive routes; frontend `ProtectedRoute` mirrors backend rules.  
- **Portal isolation:** Program-tier middleware prevents cross-portal data leakage.  
- **Account lifecycle:** Only the Research Director creates and activates users for the five active roles.

### 4.4.2 Input Validation

- Required fields validated on create/update (proposals, funding calls, thesis titles, etc.).  
- File uploads restricted to **PDF / DOC / DOCX** with size limits (Multer).  
- Mongoose schemas enforce types and enums (statuses, roles).  
- Client-side checks reduce bad requests; server-side checks remain authoritative.

### 4.4.3 Security Testing Methods

| Activity | Result |
|----------|--------|
| Unauthorized access to director routes | Blocked (403) |
| Researcher accessing another portal’s data | Blocked / empty |
| Invalid JWT | Rejected |
| Upload of disallowed MIME types | Rejected |
| Shared staff accounts | One Director, Coordinator, Finance, and Leadership for the whole system |

No production penetration test with OWASP ZAP/Burp was completed in this FYP timeframe; basic security standards for an institutional intranet-style app were met. Deeper penetration testing is recommended for future hardening (see Chapter V).

---

## 4.5 Implementation Results Summary

**Table 4.3 Mapping of results to project goals**

| Area | Result |
|------|--------|
| Proposal → Project | Director approval creates a linked project automatically |
| Ethics | Director review; approved badge and certificate download |
| Peer review | Leadership scores; director does not re-enter scores |
| Funding & finance | Funding calls, grants, budgets, PO review by Finance, payments |
| Thesis (UG track) | Groups, title accept/reject, chapters, meetings, final PDF/Word upload |
| Portals | UG/PG isolation; Director switches portals |
| Dashboards | Director, Finance, Coordinator, Researcher/Leadership, KPI — unified theme |
| Role model | Five active roles; Finance owns PO review; Director owns ethics and donor reports |

Overall, black-box and role-based testing confirmed that **core end-to-end workflows operate correctly** for the implemented MERN stack system.

---

## Formatting notes (Chapter IV)

- Font: Times New Roman 12; line spacing 2.0 for body text (JUST FYP guideline).  
- Insert screenshots as numbered figures (caption below); place large extras in Appendices.  
- Continue discussion of results in **Chapter V**.

---

*End of Chapter IV — JUST RMS Mobile/Web FYP*
