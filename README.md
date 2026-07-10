# Jamhuriya Research Management System (RMS)

MERN stack research management system for Jamhuriya University: proposals, projects, grants, budgets, publications, repository, groups, analytics, and notifications.

## Stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT auth
- **Frontend:** React, Vite, Recharts

## Quick start

### Prerequisites

- Node.js 18+
- MongoDB running locally (`mongodb://localhost:27017/rms`)

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run seed
npm run dev
```

API: `http://localhost:5000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173` (Vite proxies `/api` to the backend in dev)

### First-time bootstrap

`npm run seed` creates institutional user accounts and **realistic English research records** for both undergraduate and postgraduate portals — proposals, projects, grants, budgets, publications, groups, thesis supervision, ethics applications, repository items, and notifications.

Roughly **12 records per module per portal** (200+ documents total on a fresh database). No demo prefixes or placeholder labels.

Configure bootstrap passwords in `backend/.env` (`SEED_*` variables) or edit `backend/src/scripts/seedData.js`.

## Seed user accounts

After `npm run seed`, **19 institutional accounts** are created. Verify anytime:

```bash
cd backend
node src/scripts/verifySeedUsers.js
```

Expected output: `19/19 users correct`.

### Thesis coverage (90%+)

Jamhuriya RMS targets **92%** coverage of the full 6-phase specification — thesis-ready for defense.

Verify programmatically:

```bash
cd backend
npm run verify:thesis
```

Expected output: `Overall: 92%` and `Thesis-ready (90%+): YES`.

Full gap analysis: [`docs/SYSTEM_GAP_ANALYSIS_SOM_EN.md`](docs/SYSTEM_GAP_ANALYSIS_SOM_EN.md).  
New routes: `/kpi-dashboard` (director, coordinator, finance, leadership), `/search` (all users), technical report PDF on project details.

**Portal rules**

- **Research Director** (`director@rms.edu`) — choose **Undergraduate** or **Postgraduate** at login (Research Office).
- All other accounts are fixed to **one portal** (UG or PG); they cannot switch.

### Stakeholder → system role

| Stakeholder (Somali) | System role | Seed account (UG) |
|------------------------|-------------|-------------------|
| Researchers / PI | `researcher` | `asha@rms.edu` (UG), `mahad@rms.edu` (PG) |
| Department | `faculty_coordinator` | `coordinator@rms.edu` |
| Research Office | `research_director` | `director@rms.edu` |
| Finance Office | `finance_officer` | `finance@rms.edu` |
| Procurement Office | `procurement_officer` | `procurement@rms.edu` |
| HR Office | `hr_officer` | `hr@rms.edu` |
| Ethics Committee | `ethics_committee` | `ethics@rms.edu` |
| Reviewers (peer review) | `peer_reviewer` | `reviewer@rms.edu` |
| Leadership (final award) | `leadership` | `leadership@rms.edu` |
| Donor / External Agency | `donor_agency` | `donor@rms.edu` |

### Undergraduate (UG)

| Role | Email | Password | Name |
|------|-------|----------|------|
| Research Director | `director@rms.edu` | `Director2024!` | Dr. Catherine Morrison |
| Faculty Coordinator | `coordinator@rms.edu` | `Coordinator2024!` | Dr. Emma Richardson |
| Finance Officer | `finance@rms.edu` | `Finance2024!` | Michael Brooks |
| Ethics Committee | `ethics@rms.edu` | `Ethics2024!` | Dr. Hassan Ali |
| Procurement Officer | `procurement@rms.edu` | `Procurement2024!` | Samira Noor |
| Peer Reviewer | `reviewer@rms.edu` | `Reviewer2024!` | Dr. Omar Khaled |
| HR Officer | `hr@rms.edu` | `Hr2024!` | Fatima Ahmed |
| Leadership | `leadership@rms.edu` | `Leadership2024!` | Prof. Ibrahim Warsame |
| Donor Agency | `donor@rms.edu` | `Donor2024!` | UNESCO Program Liaison |
| Researcher | `asha@rms.edu` | `Researcher2024!` | Dr. Sarah Chen |

### Postgraduate (PG)

| Role | Email | Password | Name |
|------|-------|----------|------|
| Faculty Coordinator | `coordinator.pg@rms.edu` | `Coordinator2024!` | Dr. Robert Clarke |
| Finance Officer | `finance.pg@rms.edu` | `Finance2024!` | Linda Martinez |
| Ethics Committee | `ethics.pg@rms.edu` | `Ethics2024!` | Dr. Amina Farah |
| Procurement Officer | `procurement.pg@rms.edu` | `Procurement2024!` | Omar Said |
| Peer Reviewer | `reviewer.pg@rms.edu` | `Reviewer2024!` | Dr. Layla Hassan |
| HR Officer | `hr.pg@rms.edu` | `Hr2024!` | Yusuf Ali |
| Leadership | `leadership.pg@rms.edu` | `Leadership2024!` | Prof. Halima Nur |
| Donor Agency | `donor.pg@rms.edu` | `Donor2024!` | WHO EMRO Liaison |
| Researcher | `mahad@rms.edu` | `Researcher2024!` | Dr. James Okonkwo |

**Login shortcuts:** Ethics → `/ethics` · Procurement → `/budgets` · Peer Reviewer → `/review-assignments` · HR → `/projects` · Leadership → `/grants` · Donor → `/donor-reports`

Default passwords can be overridden via `backend/.env`: `SEED_DIRECTOR_PASSWORD`, `SEED_COORDINATOR_PASSWORD`, `SEED_FINANCE_PASSWORD`, `SEED_ETHICS_PASSWORD`, `SEED_PROCUREMENT_PASSWORD`, `SEED_REVIEWER_PASSWORD`, `SEED_HR_PASSWORD`, `SEED_LEADERSHIP_PASSWORD`, `SEED_DONOR_PASSWORD`, `SEED_RESEARCHER_PASSWORD`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run seed` | Bootstrap users and realistic institutional research data |
| `node src/scripts/verifySeedUsers.js` | Verify all 19 seed accounts (role, portal, password) |
| `npm run db:audit` | Count documents per collection (backend) |

## Documentation

All files are in the **`docs/`** folder. Start with **[docs/DOCS_INDEX.md](docs/DOCS_INDEX.md)**.

| Document | Purpose |
|----------|---------|
| **[docs/FULL_SYSTEM_GUIDE_SOM_EN.docx](docs/FULL_SYSTEM_GUIDE_SOM_EN.docx)** | **Full guide (Word)** — English + Somali step-by-step (qeybta xalay) |
| **[docs/FULL_SYSTEM_GUIDE_SOM_EN.md](docs/FULL_SYSTEM_GUIDE_SOM_EN.md)** | Same guide — Markdown |
| **[docs/WHATS_NEW_JULY_2026.md](docs/WHATS_NEW_JULY_2026.md)** | New features — Phases 1–4 detail |
| **[docs/USER_GUIDE_SOM_EN.md](docs/USER_GUIDE_SOM_EN.md)** | Main guide — summary |
| **[docs/ROLES_AND_STAGES_GUIDE.docx](docs/ROLES_AND_STAGES_GUIDE.docx)** | Roles & stages (Somali, Word) |
| **[docs/RMS_SYSTEM_DIAGRAM.html](docs/RMS_SYSTEM_DIAGRAM.html)** | System diagram — open in browser |
| **[docs/SYSTEM_GAP_ANALYSIS_SOM_EN.md](docs/SYSTEM_GAP_ANALYSIS_SOM_EN.md)** | Full specification vs implementation |
| **[docs/SPEC_GAP_ANALYSIS.md](docs/SPEC_GAP_ANALYSIS.md)** | Technical module gap analysis |

Generate PDFs (not committed until you run this):

```bash
cd backend && npm run docs:pdf
```

Creates `docs/DATABASE_STRUCTURE.pdf` and `docs/SYSTEM_DOCUMENTATION.pdf`.

## Free online deployment (no cost)

Host the full app **free** with:

| Service | Free tier | Purpose |
|---------|-----------|---------|
| [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) | M0 cluster (512 MB) | Database |
| [Render.com](https://render.com) | Web service (750 hrs/mo) | API + React UI |

### Step 1 — MongoDB Atlas (free database)

1. Create account at [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas/register)
2. Create a **free M0** cluster
3. Database Access → add user + password
4. Network Access → **Allow access from anywhere** (`0.0.0.0/0`) for Render
5. Connect → copy connection string, e.g. `mongodb+srv://USER:PASS@cluster.mongodb.net/rms`

### Step 2 — Deploy on Render (free)

1. Push this repo to GitHub (already done if you use `research-management-systems`)
2. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
3. Connect repo `Abdisalam114/research-management-systems` — Render reads `render.yaml`
4. Set environment variables when prompted:
   - `MONGO_URI` = your Atlas connection string
   - `CLIENT_ORIGIN` = your Render URL (set after first deploy), e.g. `https://just-rms.onrender.com`
5. Deploy — first build takes ~5 minutes
6. Open **Shell** on the service → run once: `cd backend && npm run seed`
7. Sign in with the director account configured in your environment variables

**Note:** Free Render services sleep after ~15 min idle; first load after sleep may take 30–60 seconds.

### Alternative — split frontend/backend

- **Backend:** Render web service (`backend/` only, `SERVE_FRONTEND=false`)
- **Frontend:** [Vercel](https://vercel.com) or Render static site — set `VITE_API_URL=https://your-api.onrender.com`
