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

## Scripts

| Command | Description |
|---------|-------------|
| `npm run seed` | Bootstrap users and realistic institutional research data |
| `npm run db:audit` | Count documents per collection (backend) |

## Documentation

| Document | Purpose |
|----------|---------|
| **[docs/RMS_GUIDE.md](docs/RMS_GUIDE.md)** | Comprehensive guide — data architecture, the 11 core models + 3 extra models, real-world workflow |
| **[docs/SPEC_GAP_ANALYSIS.md](docs/SPEC_GAP_ANALYSIS.md)** | Full university spec (8 modules, 4 roles) mapped to what is implemented vs missing |
| **[docs/DATABASE_STRUCTURE.pdf](docs/DATABASE_STRUCTURE.pdf)** | MongoDB collections reference |
| **[docs/SYSTEM_DOCUMENTATION.pdf](docs/SYSTEM_DOCUMENTATION.pdf)** | Full system + API guide |

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
