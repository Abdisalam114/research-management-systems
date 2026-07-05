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

After `npm run seed`, **13 institutional accounts** are created. Verify anytime:

```bash
cd backend
node src/scripts/verifySeedUsers.js
```

Expected output: `13/13 users correct`.

**Portal rules**

- **Research Director** (`director@rms.edu`) — choose **Undergraduate** or **Postgraduate** at login.
- All other accounts are fixed to **one portal** (UG or PG); they cannot switch.

### Undergraduate (UG)

| Role | Email | Password | Name |
|------|-------|----------|------|
| Research Director | `director@rms.edu` | `Director2024!` | Dr. Catherine Morrison |
| Faculty Coordinator | `coordinator@rms.edu` | `Coordinator2024!` | Dr. Emma Richardson |
| Finance Officer | `finance@rms.edu` | `Finance2024!` | Michael Brooks |
| Ethics Committee | `ethics@rms.edu` | `Ethics2024!` | Dr. Hassan Ali |
| Procurement Officer | `procurement@rms.edu` | `Procurement2024!` | Samira Noor |
| Researcher | `asha@rms.edu` | `Researcher2024!` | Dr. Sarah Chen |
| Researcher | `sahra@rms.edu` | `Researcher2024!` | Dr. Priya Sharma |

### Postgraduate (PG)

| Role | Email | Password | Name |
|------|-------|----------|------|
| Faculty Coordinator | `coordinator.pg@rms.edu` | `Coordinator2024!` | Dr. Robert Clarke |
| Finance Officer | `finance.pg@rms.edu` | `Finance2024!` | Linda Martinez |
| Ethics Committee | `ethics.pg@rms.edu` | `Ethics2024!` | Dr. Amina Farah |
| Procurement Officer | `procurement.pg@rms.edu` | `Procurement2024!` | Omar Said |
| Researcher | `mahad@rms.edu` | `Researcher2024!` | Dr. James Okonkwo |
| Researcher | `amina@rms.edu` | `Researcher2024!` | Amina Yusuf |

**Login shortcuts:** Ethics Committee → `/ethics` · Procurement Officer → `/budgets`

Default passwords can be overridden via `backend/.env`: `SEED_DIRECTOR_PASSWORD`, `SEED_COORDINATOR_PASSWORD`, `SEED_FINANCE_PASSWORD`, `SEED_ETHICS_PASSWORD`, `SEED_PROCUREMENT_PASSWORD`, `SEED_RESEARCHER_PASSWORD`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run seed` | Bootstrap users and realistic institutional research data |
| `node src/scripts/verifySeedUsers.js` | Verify all 13 seed accounts (role, portal, password) |
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
| **[docs/URGMS_GAP_ANALYSIS_SOM_EN.md](docs/URGMS_GAP_ANALYSIS_SOM_EN.md)** | URGMS blueprint vs implementation |
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
