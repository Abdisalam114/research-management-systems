# Jamhuriya Research Management System (RMS)

MERN research management system for Jamhuriya University of Science & Technology (JUST): proposals, ethics, multi-stage review, projects, grants, budgets, publications, repository, groups, analytics, and notifications.

## Stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT
- **Frontend:** React, Vite, Recharts

## Quick start

### Prerequisites

- Node.js 18+
- MongoDB (`mongodb://localhost:27017/rms` or Atlas)

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

After login, all roles open **Dashboard**. Shared staff pick **Undergraduate (UG)** or **Postgraduate (PG)** portal.

## How proposals are reviewed (UG + PG same)

```
Submit → Assign peer (Leadership) → Peer reviews
      → Assign committee (Coordinator) → Committee decision
      → [Grant only] Assign finance → Finance review
      → Director Approve → Project created
```

- **Voluntary** proposals skip finance review.
- **Grant fund call** proposals require finance after committee.
- Proposal final decision stays locked until multi-stage review is complete.
- Ethics (JUREC certificate) is separate from faculty committee.

Full Word guide: **[docs/SYSTEM_HOW_IT_WORKS.docx](docs/SYSTEM_HOW_IT_WORKS.docx)**

## Seed accounts

```bash
cd backend
npm run seed
node src/scripts/verifySeedUsers.js
npm run verify:stakeholders
```

### Shared staff (pick UG or PG after login)

| Role | Email | Password |
|------|-------|----------|
| Research Director | `director@rms.edu` | `Director2024!` |
| Faculty Coordinator | `coordinator@rms.edu` | `Coordinator2024!` |
| Finance Officer | `finance@rms.edu` | `Finance2024!` |
| Leadership (peer review) | `leadership@rms.edu` | `Leadership2024!` |

### Researchers (locked to one portal)

| Role | Email | Password | Portal |
|------|-------|----------|--------|
| Researcher | `asha@rms.edu` | `Researcher2024!` | Undergraduate |
| Researcher | `mahad@rms.edu` | `Researcher2024!` | Postgraduate |

Override passwords via `backend/.env` (`SEED_*_PASSWORD`).

### Role summary

| Who | Main work |
|-----|-----------|
| Researcher | Proposals, ethics, projects, publications |
| Leadership | Peer review when assigned |
| Faculty Coordinator | Committee review when assigned |
| Finance | Grant finance review (`/finance/reviews`), budgets, closure finance |
| Research Director | Assign peer/committee/finance, ethics certificate, final approve |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run seed` | Bootstrap users and sample research data |
| `node src/scripts/verifySeedUsers.js` | Verify seed accounts |
| `npm run verify:stakeholders` | Login + API check per role |
| `npm run db:audit` | Document counts per collection |

## Documentation (Word only)

| Document | Purpose |
|----------|---------|
| **[docs/SYSTEM_HOW_IT_WORKS.docx](docs/SYSTEM_HOW_IT_WORKS.docx)** | Official system flow (start here) |
| [docs/USER_GUIDE_SOM_EN.docx](docs/USER_GUIDE_SOM_EN.docx) | Short user guide (SO + EN) |
| [docs/HOW_TO_USE_SYSTEM_SOM_EN.docx](docs/HOW_TO_USE_SYSTEM_SOM_EN.docx) | How to use |
| [docs/FULL_SYSTEM_GUIDE_SOM_EN.docx](docs/FULL_SYSTEM_GUIDE_SOM_EN.docx) | Full journey by role |
| [docs/ROLES_AND_STAGES_GUIDE.docx](docs/ROLES_AND_STAGES_GUIDE.docx) | Roles & stages |
| [docs/RMS_SYSTEM_DIAGRAM.html](docs/RMS_SYSTEM_DIAGRAM.html) | Diagram (browser) |

## Free online deployment

| Service | Purpose |
|---------|---------|
| [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) | Free M0 database |
| [Render.com](https://render.com) | API + UI (`render.yaml`) |

1. Create Atlas cluster; allow `0.0.0.0/0`; copy `MONGO_URI`.
2. Render → Blueprint → this repo; set `MONGO_URI` and `CLIENT_ORIGIN`.
3. After deploy, Shell once: `cd backend && npm run seed`.
4. Sign in with director account.

Free Render apps sleep after idle; first wake may take 30–60 seconds.
