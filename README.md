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

Verify all roles can log in and access their APIs:

```bash
cd backend
npm run verify:stakeholders
```

Expected output: `19/19 users fully working`.

New routes: `/kpi-dashboard` (director, coordinator, finance, leadership), `/search` (all users), technical report PDF on project details.

**Portal rules**

- **Director, Coordinator, Finance, Leadership** — one shared account each; they see **Undergraduate + Postgraduate** records together. Each project/proposal shows an **UG / PG** label.
- **Researchers** stay on one portal (UG or PG) only.

### Stakeholder → system role

| Stakeholder (Somali) | System role | Seed account (UG) |
|------------------------|-------------|-------------------|
| Researchers / PI | `researcher` | `asha@rms.edu` (UG), `mahad@rms.edu` (PG) |
| Department | `faculty_coordinator` | `coordinator@rms.edu` |
| Research Office | `research_director` | `director@rms.edu` |
| Finance Office | `finance_officer` | `finance@rms.edu` (also owns PO review) |
| Leadership (peer review / KPI) | `leadership` | `leadership@rms.edu` |

Finance owns purchase-order review; the Research Director owns external funding and donor reports.

### Shared staff (one account each — UG + PG together)

| Role | Email | Password | Name |
|------|-------|----------|------|
| Research Director | `director@rms.edu` | `Director2024!` | Dr. Catherine Morrison |
| Faculty Coordinator | `coordinator@rms.edu` | `Coordinator2024!` | Dr. Emma Richardson |
| Finance Officer | `finance@rms.edu` | `Finance2024!` | Michael Brooks |
| Leadership | `leadership@rms.edu` | `Leadership2024!` | Prof. Ibrahim Warsame |

### Researchers (portal-scoped)

| Role | Email | Password | Portal |
|------|-------|----------|--------|
| Researcher | `asha@rms.edu` | `Researcher2024!` | Undergraduate (UG) |
| Researcher | `mahad@rms.edu` | `Researcher2024!` | Postgraduate (PG) |

Projects and proposals show an **UG / PG** label so shared staff can tell them apart.

**Login shortcuts:** Finance (PO review + pay) → `/budgets` · Leadership → `/grants` · Director donor reports → `/donor-reports`

Default passwords can be overridden via `backend/.env`: `SEED_DIRECTOR_PASSWORD`, `SEED_COORDINATOR_PASSWORD`, `SEED_FINANCE_PASSWORD`, `SEED_LEADERSHIP_PASSWORD`, `SEED_RESEARCHER_PASSWORD`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run seed` | Bootstrap users and realistic institutional research data |
| `node src/scripts/verifySeedUsers.js` | Verify institutional seed accounts (role, password) |
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
