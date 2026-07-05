# JUST RMS — Full System Guide (English + Somali)
# Tilmaamaha Buuxa ee Nidaamka

**JUST RMS** waa nidaamka maamulka cilmi-baarista ee Jamhuriya University. Waxaa lagu maamulaa safka **Proposal → Ethics → Review → Project → Finance → Publication → Closure**.

> **Note:** This is the full step-by-step guide from your session (July 5, 2026).  
> For **new features added after that** (Phases 1–4 details), also read [WHATS_NEW_JULY_2026.md](./WHATS_NEW_JULY_2026.md).

---

## 1. What is this system? / Waa maxay systemkan?

| English | Somali |
|---------|--------|
| A web app for managing university research from idea to project closure | App web ah oo lagu maamulo cilmi-baarista jaamacadda — laga bilaabo fikrad ilaa xiritaanka mashruuca |
| Two portals: **Undergraduate (UG)** and **Postgraduate (PG)** — data is separated | Laba portal: **Undergraduate** iyo **Postgraduate** — xogtu waa kala go'an |
| Only the **Research Director** can switch between UG and PG | Kaliya **Research Director** ayaa beddeli kara UG iyo PG |

---

## 2. Who uses it? / Yaa isticmaala?

| Role | English job | Shaqada (Somali) |
|------|-------------|------------------|
| **Research Director** | Runs the whole office; final approvals | Maamulka guud; ansixinta ugu dambeysa |
| **Faculty Coordinator** | Faculty-level review, thesis groups, reports | Daraasaadka faculty-ga; thesis groups |
| **Finance Officer** | Budgets, payments, procurement payment, finance closure | Miisaaniyad, lacag bixin, xiritaanka maaliyadeed |
| **Ethics Committee** | Ethics (JUREC) approve/reject | Ansixinta anshaxa (JUREC) |
| **Procurement Officer** | Reviews purchase orders before director | Dib u eegista PO ka hor director |
| **Researcher** | Proposals, projects, grants, publications, thesis supervision | Proposal, project, grant, publication, thesis |

---

## 3. Login & portal / Galitaanka

**English**
1. Open the app → Login with email + password
2. If you are **Director** → choose **Undergraduate** or **Postgraduate**
3. Everyone else → auto-assigned to **one portal only** (UG or PG)

**Somali**
1. Fur app-ka → gal email + password
2. Haddii aad tahay **Director** → dooro **Undergraduate** ama **Postgraduate**
3. Dadka kale → hal portal kaliya (UG ama PG)

**Test accounts (after `npm run seed`):**

| Email | Password | Role |
|-------|----------|------|
| `director@rms.edu` | `Director2024!` | Director |
| `coordinator@rms.edu` | `Coordinator2024!` | Coordinator |
| `finance@rms.edu` | `Finance2024!` | Finance |
| `ethics@rms.edu` | `Ethics2024!` | Ethics Committee |
| `procurement@rms.edu` | `Procurement2024!` | Procurement |
| `asha@rms.edu` | `Researcher2024!` | Researcher |

---

## 4. Full journey — step by step / Safka buuxa

### STEP 1 — Funding & calls / Lacag bixinta & calls

**English:** Director publishes **Funding Calls**. Researchers see open calls and apply for **Grants**.

**Somali:** Director wuxuu daabacaa **Funding Calls**. Researchers waxay arkaan calls furan waxayna codsadaan **Grants**.

**Where:** Sidebar → **Funding Calls**, **Grants**

---

### STEP 2 — Application (Proposal) / Codsiga (Proposal)

**English — Researcher:**
1. **Proposals** → **New proposal**
2. Fill: title, abstract, department, research area
3. Upload main document (PDF)
4. Add **budget lines** (category, amount)
5. Upload **compliance docs** (data protection, etc.)
6. Upload **supporting docs** (CV, letters, MoU)
7. Complete **Ethics form (JUREC)** on the same page
8. **Save draft** → **Submit to Director**

**Somali — Researcher:**
1. **Proposals** → proposal cusub
2. Buuxi: cinwaan, abstract, department, research area
3. Soo geli document-ka ugu weyn
4. Ku dar **budget** (qaybaha iyo lacagta)
5. Soo geli **compliance documents**
6. Soo geli **supporting documents**
7. Buuxi **foomka Ethics (JUREC)** isla bogga
8. **Save** → **Submit to Director**

**Where:** Sidebar → **Proposals**

---

### STEP 3 — Review & approval / Dib u eegis & ansixin

**English — order:**
1. **Admin screening** — Director/Coordinator
2. **Peer review** — assigned reviewers
3. **Committee review** — scientific committee
4. **Ethics review** — Ethics Committee or Director (`/ethics`)
5. **Finance review** — Finance Officer (proposal budget)
6. **Final decision** — Director **Approve** or **Reject**
7. If approved → **Project** is created automatically

**Somali — taxanaha:**
1. **Admin screening**
2. **Peer review** — reviewers la magacaabay
3. **Committee review**
4. **Ethics** — Ethics Committee ama Director
5. **Finance review** — Finance Officer
6. **Go'aanka ugu dambeeya** — Director **Approve/Reject**
7. Haddii la aqbalo → **Project** si otomaatig ah ayaa loo abuuraa

**Where:** **Proposals** (review), **Peer Reviews**, **Ethics**

---

### STEP 4 — Project management / Maamulka mashruuca

**English — after approval:**
1. **Projects** → open your project
2. Set timeline, **milestones**, **team members**
3. **Work plan** — phases, dates, owners
4. **Activities/tasks** — todo → in progress → done
5. **Communication log** — meetings, emails, notes
6. **Progress reports** — % complete + notes
7. Link **Grants**, manage **Budget** on **Finance & Budgets**

**Somali — ka dib ansixinta:**
1. **Projects** → fur mashruucaaga
2. Deji waqtiga, **milestones**, **kooxda**
3. **Work plan** — marxalado iyo taariikh
4. **Activities** — hawlaha maalinlaha ah
5. **Communication log** — kulamo, emails, qoraalo
6. **Progress reports** — % iyo qoraal
7. **Grants**, **Finance & Budgets**

**Where:** Sidebar → **Projects**, **Finance & Budgets**

---

### STEP 5 — Finance & procurement / Maaliyad & iibsashada

**English:**
1. Researcher creates **budget** for project/grant
2. **Payment requests** — Director approves → Finance pays
3. **Purchase orders (PO):**
   - Researcher creates PO
   - **Procurement Officer** reviews
   - **Director** approves
   - **Finance** pays

**Somali:**
1. Researcher wuxuu abuuraa **budget**
2. **Payment requests** — Director → Finance
3. **Purchase orders:**
   - Researcher abuuraa PO
   - **Procurement** dib u eegis
   - **Director** ansixiyo
   - **Finance** bixisaa

**Where:** **Finance & Budgets**, **Finance Reports**, **Donor Reports**

---

### STEP 6 — Outputs / Natiijooyinka

**English:**
- **Publications** — papers, workflow stages
- **Research Workflow** — 11-step research journey
- **Repository** — datasets, documents (OAI-PMH export)
- **Thesis** — groups (min 4 students), title workflow, chapters, meetings
- **Groups** — collaboration groups

**Somali:**
- **Publications** — warqadaha cilmi-baarista
- **Research Workflow** — safka 11-tallaabo
- **Repository** — kaydinta documents
- **Thesis** — kooxo (ugu yaraan 4 arday), cinwaan, cutubyo, kulamo
- **Groups** — kooxaha iskaashiga

---

### STEP 7 — Monitoring & reports / La socodka

**English:**
- **Dashboard** — KPIs, charts (Director/Coordinator/Finance)
- **Finance Reports** — budget utilization
- **Donor Reports** — grants by donor reference
- **Audit Trail** — who did what, when (Director/Coordinator)

**Somali:**
- **Dashboard** — tirakoob iyo jaantusyo
- **Finance Reports** — isticmaalka miisaaniyadda
- **Donor Reports** — deeq bixiyeyaasha
- **Audit Trail** — cidda maxay samaysay, goorma

---

### STEP 8 — Project closure / Xiritaanka mashruuca

**English — Researcher submits:**
1. Complete **closure checklist** (5 items): publications archived, assets handed over, data archived, finance cleared, ethics closed
2. **Final report** + **asset handover** + **lessons learned**
3. **Director** approves closure
4. **Finance** approves
5. **Director** archives project → status **Closed**

**Somali:**
1. Buuxi **checklist** (5 qodob)
2. **Final report** + **asset handover** + **lessons learned**
3. **Director** ansixiyo
4. **Finance** ansixiyo
5. **Director** archive → **Closed**

**Where:** **Projects** → open project → scroll to **Project closure**

---

## 5. Sidebar map / Khariidada menu-ga

| Menu | Who mainly uses it |
|------|-------------------|
| Dashboard | Everyone |
| Research Workflow | Researcher, Coordinator, Director |
| Ethics | Researcher, Ethics Committee, Coordinator, Director |
| Proposals | Researcher (create), staff (review) |
| Peer Reviews | Reviewers, staff |
| Projects | Researcher, staff |
| Publications | Researcher, staff |
| Thesis | Researcher (supervisor), Coordinator, Director |
| Funding Calls / Grants | Researcher, Finance, Director |
| Finance & Budgets | Researcher, Finance, Procurement, Director |
| Finance Reports / Donor Reports | Finance, Director |
| Audit Trail | Director, Coordinator |
| Repository | Researcher, staff |
| Messages / Notifications | Everyone |
| Users / Departments | Director only |

---

## 6. Simple picture / Sawir fudud

```
Funding Call → Grant Application

Proposal + Ethics + Budget + Docs
        ↓
Multi-stage Review
        ↓
Director Approves → Project Created
        ↓
Work Plan + Activities + Budget
        ↓
Payments + Procurement
        ↓
Publications + Repository + Progress Reports
        ↓
Closure Checklist + Lessons Learned
        ↓
Director + Finance Approve → Archived / Closed
```

---

## 7. One sentence summary / Hal jumlad

**English:** You propose research with ethics and budget → staff review it → if approved you get a project → you run it with finance and reports → you close it with a checklist and lessons learned.

**Somali:** Waxaad soo gudbisaa cilmi-baarista + ethics + budget → shaqaalaha way dib u eegaan → haddii la aqbalo waxaad heshaa project → waad maamushaa lacag iyo warbixin → ugu dambayn waxaad xirtaa checklist + lessons learned.

---

## 8. Related docs / Docs kale

| File | Purpose |
|------|---------|
| [FULL_SYSTEM_GUIDE_SOM_EN.docx](./FULL_SYSTEM_GUIDE_SOM_EN.docx) | **Word version** — fur Microsoft Word |
| [WHATS_NEW_JULY_2026.md](./WHATS_NEW_JULY_2026.md) | New features detail (Phases 1–4) |
| [FULL_SYSTEM_REAL_EXAMPLE.docx](./FULL_SYSTEM_REAL_EXAMPLE.docx) | Real example — one research story 100% |
| [ROLES_AND_STAGES_GUIDE.docx](./ROLES_AND_STAGES_GUIDE.docx) | Every role & stage in Somali |
