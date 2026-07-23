# What's New — July 2026 / Waxa Cusub
# Jamhuriya RMS — Phases 1–4 + Thesis fixes

**Read this first if you already know the old RMS.**  
**Akhri tan marka hore haddii aad taqaanid RMS-kii hore.**

---

## Quick list / Liiska kooban

| # | Feature | Menu / Route | Who uses it |
|---|---------|--------------|-------------|
| 1 | **Audit Trail** | `/audit-trail` | Director, Coordinator |
| 2 | **Finance Reports** | `/finance-reports` | Director, Finance |
| 3 | **Donor Reports** | `/donor-reports` | Director, Finance |
| 4 | **Project closure** | Projects → open project | Researcher → Director → Finance |
| 5 | **Proposal budget at apply** | Proposals → New | Researcher |
| 6 | **Compliance + supporting docs** | Proposals → New | Researcher |
| 7 | **Ethics = Research Director** | `/ethics` | `research_director` |
| 8 | **Finance owns PO review** | `/budgets` PO queue | `finance_officer` |
| 9 | **Work plan + activities** | Projects → execution panel | Researcher, staff |
| 10 | **Communication log** | Projects → execution panel | Researcher, staff |
| 11 | **Thesis min 4 students** | `/thesis` | Coordinator, Director |
| 12 | **Title accepted fix** | `/thesis` badges/stats | All thesis users |

---

## Phase 1 — Monitoring & closure / La socodka & xiritaan

### 1.1 Audit Trail (`/audit-trail`)

**EN:** System-wide activity log. Filter by entity: proposals, projects, grants, ethics, publications, funding calls.

**SO:** Diiwaanka ficillada nidaamka oo dhan. Filter ku samee nooca entity.

**Who:** `research_director`, `faculty_coordinator`

**How to use:**
1. Sidebar → **Audit Trail**
2. Dropdown → choose entity type or "All entities"
3. Table shows: time, action, entity, actor, detail

---

### 1.2 Finance Reports (`/finance-reports`)

**EN:** Restored dedicated page (was redirecting to budgets). Shows budget allocation vs spend summary.

**SO:** Bog warbixin maaliyadeed oo gooni ah — miisaaniyadda la qoondeeyay vs la isticmaalay.

**Who:** `research_director`, `finance_officer`

---

### 1.3 Project closure (Phase 6)

**EN:** Full closure workflow on **Project Details** page.

**SO:** Xiritaanka mashruuca si rasmi ah — bogga Project Details.

**Closure checklist (all 5 must be checked before submit):**

| Key | English | Somali |
|-----|---------|--------|
| publicationsArchived | Publications archived in repository | Daabacaadaha waa la kaydiyay repository |
| assetsHandedOver | Assets handed over to university | Hantida waa loo wareejiyay jaamacadda |
| dataArchived | Research data archived securely | Xogta cilmi-baarista si ammaan ah loo kaydiyay |
| financialCleared | Financial accounts cleared | Akoonnada maaliyadeed waa la nadiifiyay |
| ethicsClosed | Ethics obligations closed | Waajibaadka anshaxa waa la xiray |

**Also required:** Final report (text), asset handover notes, **lessons learned**

**Workflow:**

```
Researcher submits closure
    → Director approves closure
    → Finance approves closure
    → Director archives project
```

**Statuses:** `none` → `submitted` → `director_approved` → `finance_approved` → archived

---

## Phase 2 — Application extras / Codsiga proposal

**Location:** Proposals → **New proposal** (or edit draft)

### 2.1 Proposal budget (`budgetBreakdown`)

**EN:** Line-item budget **at application stage** (not only after grant).

Each line: **Category**, **Description**, **Amount**, currency (default USD).

**SO:** Miisaaniyadda qodob qodob ah marka proposal la gudbinayo.

**Example categories:** Equipment, Travel, Personnel, Consumables

---

### 2.2 Compliance documents

**Types:**
- Data protection checklist
- Environmental compliance
- Institutional checklist
- Other compliance

Upload PDF/DOC per type.

**SO:** Dukumeentiyada u hoggaansanaanta (data protection, deegaanka, iwm.)

---

### 2.3 Supporting documents

**Types:**
- CV / resume
- Letter of support
- MoU / partnership
- Other supporting doc

**SO:** CV, warqad taageero, MoU, iwm.

---

## Phase 3 — Roles update / Doorashooyin (current)

### 3.1 Ethics = Research Director (no separate Ethics Committee login)

**EN:** Ethics / JUREC decisions are made by the **Research Director** on `/ethics`. The separate `ethics_committee` account was removed.

**SO:** Ethics / JUREC waxaa go’aamiya **Research Director**. Akoonka `ethics_committee` waa laga saaray.

**Login:** `director@rms.edu` / `Director2024!`

**Menu:** Ethics (+ full Director menus)

---

### 3.2 Finance Officer owns Purchase Order review (Procurement removed)

**EN:** Finance reviews **Purchase Orders** before Director. The separate Procurement Officer role was removed.

**SO:** Finance ayaa eega PO ka hor Director. Doorarka Procurement waa laga saaray.

**Login:** `finance@rms.edu` / `Finance2024!` (UG) · `finance.pg@rms.edu` (PG)

**PO workflow (updated):**

```
Researcher creates PO (status: requested)
    → Finance Officer approves/rejects (status: procurement_approved — legacy status name)
    → Director approves/rejects
    → Finance pays or rejects
```

**Where:** Finance & Budgets → **Finance PO review queue** (finance role)

---

### 3.3 Donor Reports (`/donor-reports`)

**EN:** Summary by `donorRef` on grants — total awarded, open funding calls, per-donor breakdown.

**SO:** Warbixin deeq-bixiyeyaasha (`donorRef`) — wadarta la siiyay, call-yada furan.

**Who:** Director, Finance

---

## Phase 4 — Project execution / Fulinta mashruuca

**Location:** Projects → open project → **Project execution panel** (below milestones)

### 4.1 Work plan

**EN:** Add phases with: phase name, start date, end date, deliverables, status.

**SO:** Qorshaha shaqada — marxalado leh taariikh iyo natiijooyin.

Click **+ Phase** to add rows. Save execution panel.

---

### 4.2 Activities / tasks

**EN:** Task list per project: title, assignee, due date, status (pending / in_progress / done).

**SO:** Liiska hawlaha mashruuca.

---

### 4.3 Communication log

**EN:** Staff and PI log institutional communications (subject, notes, date). Newest first.

**SO:** Diiwaanka isgaarsiinta mashruuca — cidda la hadlay, mawduuca, taariikhda.

**Who can log:** Project owner (researcher) + staff roles (director, coordinator, finance)

---

## Thesis fixes / Saxitaannada Thesis

### Min 4 students per group

**EN:** Every thesis group must have **at least 4 students**. Backend rejects create/update with fewer.

**SO:** Koox kasta waa in ay leedahay **ugu yaraan 4 arday**.

Seed data updated so demo groups have 4 students each.

---

### Title accepted badge / stats fix

**EN:** Groups with legacy data (title set but `titleProposal.status = none`) now show **Title accepted** correctly. Stats count matches badges.

**SO:** Kooxaha hore ee title la aqbalay laakiin status-ku qaldanaa — hadda waa la isku waafajiyay.

---

## Seed accounts (current)

Run `cd backend && npm run seed` then login with Finance for PO review:

| Email | Password | Role |
|-------|----------|------|
| finance@rms.edu | Finance2024! | Finance Officer (UG) — PO review + pay |
| finance.pg@rms.edu | Finance2024! | Finance Officer (PG) |

Removed: `ethics@`, `reviewer@`, `procurement@` (and `.pg` variants).

---

## Coverage update / Cusbooneysiinta qiyaasta

After Phases 1–4, approximate full specification coverage: **~78%** (was ~58% in June 2026 gap doc).

Still missing / weli ma jiraan:
- External ERP/HR/SSO integrations
- Dedicated reviewer portal
- Formal KPI dashboard
- Automated email/SMS gateway

See updated `SYSTEM_GAP_ANALYSIS_SOM_EN.md` for details.
