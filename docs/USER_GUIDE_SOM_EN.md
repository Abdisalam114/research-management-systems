# JUST RMS — User Guide (English + Somali)
# Tilmaamaha Isticmaalaha

**System:** Jamhuriya University Research Management System (JUST RMS)  
**Portals:** Undergraduate (UG) · Postgraduate (PG)  
**Last updated:** July 2026

---

## Where to find this file / Meesha aad ka hesho

Open in Cursor/VS Code or any browser:

```
docs/USER_GUIDE_SOM_EN.md
```

Other docs in the same folder:

| File | Content |
|------|---------|
| `WHATS_NEW_JULY_2026.md` | **All new features** — Phases 1–4, roles, thesis (read first) |
| `ROLES_AND_STAGES_GUIDE.txt` | Roles & stages (Somali, Word-ready) |
| `ROLES_AND_STAGES_GUIDE.docx` | Same as above in Word |
| `SYSTEM_GAP_ANALYSIS_SOM_EN.md` | What is built vs full system specification |
| `SPEC_GAP_ANALYSIS.md` | Technical module analysis (English) |
| `FULL_SYSTEM_REAL_EXAMPLE.txt` | End-to-end example walkthrough |
| `RMS_SYSTEM_DIAGRAM.html` | Open in browser — system diagram |
| `THESIS_PRESENTATION_SLIDES.txt` | Thesis module slides |

Generate PDFs (after `npm install` in backend):

```bash
cd backend
npm run docs:pdf
```

Creates: `docs/DATABASE_STRUCTURE.pdf`, `docs/SYSTEM_DOCUMENTATION.pdf`

---

## 1. What is JUST RMS? / Waa maxay?

| English | Somali |
|---------|--------|
| Web system to manage research from proposal to project closure | Nidaam web ah oo cilmi-baarista laga maamulo laga bilaabo proposal ilaa xiritaanka mashruuca |
| Two separate portals: UG and PG | Laba portal oo kala go’an: Undergraduate iyo Postgraduate |
| Director switches portals; all other users stay on one portal | Director ayaa beddela portal; dadka kale hal portal ayay ku jiraan |

---

## 2. Roles / Doorashada mas’uuliyadda

| Role | English | Somali |
|------|---------|--------|
| `research_director` | Research Director — final approvals, users, analytics, ethics, external funding & donor reports | Agaasimaha cilmi-baarista |
| `faculty_coordinator` | Faculty Coordinator — faculty review, thesis | Isku-duwaha faculty-ga |
| `finance_officer` | Finance — budgets, PO review, payments | Sarkaalka maaliyadda |
| `researcher` | Researcher / PI — proposals, projects, supervision | Cilmi-baarista |
| `leadership` | University Leadership — peer review, KPI | Hogaanka jaamacadda |

Procurement, HR Officer, and Donor Agency logins were removed — Finance owns PO review; Director owns former HR/donor duties.

---

## 3. Login / Galitaanka

1. Open `http://localhost:5173` → **Login**
2. **Director** → choose **Undergraduate** or **Postgraduate**
3. Others → automatic portal from account

**Seed accounts** (run `npm run seed` first):

| Email | Password | Role |
|-------|----------|------|
| director@rms.edu | Director2024! | Director |
| coordinator@rms.edu | Coordinator2024! | Coordinator |
| finance@rms.edu | Finance2024! | Finance |
| asha@rms.edu | Researcher2024! | Researcher |

---

## 4. Step-by-step workflow / Safka tallaabo tallaabo

### Step 1 — Funding & calls / Deeqaha

**EN:** Director publishes **Funding Calls**. Researcher applies via **Grants**.  
**SO:** Director wuxuu daabacaa **Funding Calls**. Researcher wuxuu codsadaa **Grants**.

**Menu:** Funding Calls · Grants

---

### Step 2 — Application / Codsiga

**EN — Researcher:**
1. Proposals → New proposal
2. Title, abstract, department, research area
3. Main PDF document
4. **Budget lines** (category, amount)
5. **Compliance documents**
6. **Supporting documents** (CV, letters, MoU)
7. **Ethics form (JUREC)** on same page
8. Save draft → Submit to Director

**SO — Researcher:** Isla tallaabooyinka kor ku xusan — Proposals → proposal cusub → buuxi dhammaan qaybaha → Submit.

**Menu:** Proposals

---

### Step 3 — Review / Dib u eegis

**Order / Taxane:**

1. Admin screening  
2. Peer review (University Leadership — Peer Reviews page)  
3. Committee review  
4. Ethics (Research Director on Ethics page)  
5. Finance review (proposal budget)  
6. Director final decision → **Approved** creates **Project**

**SO:** Marka la ansixiyo → **Project** si otomaatig ah ayaa la abuuraa.

**Menu:** Proposals · Peer Reviews · Ethics

---

### Step 4 — Project / Mashruuca

**EN:**
- Timeline, milestones, team
- **Work plan** (phases, dates)
- **Activities / tasks**
- **Communication log**
- Progress reports
- Budgets linked to grant/project

**SO:** Mashruuca waxaad ku maamushaa milestones, work plan, hawlaha, communication log, iyo warbixinno.

**Menu:** Projects · Finance & Budgets

---

### Step 5 — Finance & purchase orders / Maaliyad & PO

**EN:**
1. Budget for project/grant  
2. Payment request → Director → Finance pays  
3. Purchase order: Researcher → **Finance review** → **Director** → **Finance pays**

**SO:** PO: Researcher → Finance dib-u-eegis → Director → Finance bixisaa.

**Menu:** Finance & Budgets · Finance Reports · Donor Reports

---

### Step 6 — Outputs / Natiijooyin

| Module | EN | SO |
|--------|----|----|
| Publications | Track papers & workflow | Daabacaadaha |
| Research Workflow | 11-step journey | Safka cilmi-baarista |
| Repository | Documents & datasets | Kaydka xogta |
| Thesis | Groups (min 4 students), title, chapters | Thesis & tababbar |
| Groups | Collaboration | Iskaashiga |

---

### Step 7 — Monitoring / La socodka

- **Dashboard** — KPIs  
- **Finance Reports** — budget use  
- **Donor Reports** — by donor reference  
- **Audit Trail** — activity log (Director/Coordinator)

---

### Step 8 — Closure / Xiritaan

**EN — Researcher must:**
1. Check all **5 closure checklist** items  
2. Write **final report**, **asset handover**, **lessons learned**  
3. Submit → Director approves → Finance approves → Director archives  

**SO:** Buuxi checklist (5 qodob) + final report + lessons learned → Director → Finance → Archive.

**Menu:** Projects → open project → Project closure section

---

## 5. Sidebar map / Menu-ga

| Menu | Main users |
|------|------------|
| Dashboard | Everyone |
| Research Workflow | Researcher, Coordinator, Director |
| Ethics | Researcher, Director (approves JUREC) |
| Proposals | Researcher, Coordinator, Director, Leadership, Finance |
| Peer Reviews | University Leadership |
| Projects | Researcher, Coordinator, Director, HR |
| Publications | Researcher, Coordinator, Director |
| Thesis | Researcher (supervisor), Coordinator, Director, HR |
| Funding Calls / Grants | Researcher, Finance, Director, Leadership, Donor |
| Finance & Budgets | Researcher, Finance, Director |
| Finance Reports / Donor Reports | Finance, Director, Donor |
| Audit Trail | Director, Coordinator |
| Repository | Researcher, Coordinator, Director |
| Users / Departments | Director only |

---

## 6. One-line summary / Koobid

**EN:** Propose with ethics + budget → staff review → project → run with finance → close with checklist.  
**SO:** Proposal + ethics + budget → dib u eegis → project → maaliyad → xiritaan checklist.

---

## 7. Run the app / Sida loo shido

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Or from root: `npm run dev`

Browser: **http://localhost:5173**

---

## 8. What's new (July 2026) / Waxa cusub

**Full detail:** see **[WHATS_NEW_JULY_2026.md](./WHATS_NEW_JULY_2026.md)**

### Phase 1 — Audit, reports, closure

| Feature | Route | Users |
|---------|-------|-------|
| Audit Trail | `/audit-trail` | Director, Coordinator |
| Finance Reports | `/finance-reports` | Director, Finance |
| Project closure + 5-item checklist + lessons learned | Projects → details | Researcher → Director → Finance → Archive |

**Closure checklist items:** publications archived · assets handed over · data archived · financial cleared · ethics closed

### Phase 2 — Proposal application

On **Proposals → New proposal**:

- **Budget lines** — category, description, amount (at apply time)
- **Compliance docs** — data protection, environmental, institutional, other
- **Supporting docs** — CV, letter of support, MoU, other

### Phase 3 — Roles (current)

Active roles: Director, Coordinator, Finance, Researcher, HR, Leadership, Donor.

Removed: Ethics Committee, Peer Reviewer, Procurement Officer accounts.

| Role | Login | Main page |
|------|-------|-----------|
| Finance Officer | finance@rms.edu | Budgets — PO review + pay |
| University Leadership | leadership@rms.edu | Peer Reviews |

**PO flow:** Researcher → **Finance review** → Director → Finance pays

**Ethics:** Research Director only (`/ethics`)

**Donor Reports** (`/donor-reports`) — grants grouped by donor reference

### Phase 4 — Project execution

On **Project Details** → execution panel:

- **Work plan** — phases with dates & deliverables
- **Activities** — tasks with assignee & status
- **Communication log** — institutional contact history

### Thesis fixes

- Minimum **4 students** per thesis group (enforced backend + form)
- **Title accepted** badge/stats aligned for legacy seed data

---

## 9. Related docs / Docs kale

| File | Purpose |
|------|---------|
| [WHATS_NEW_JULY_2026.md](./WHATS_NEW_JULY_2026.md) | **All new features — detailed** |
| [DOCS_INDEX.md](./DOCS_INDEX.md) | Index of every doc file |
| [SYSTEM_GAP_ANALYSIS_SOM_EN.md](./SYSTEM_GAP_ANALYSIS_SOM_EN.md) | Specification vs built (updated July 2026) |
