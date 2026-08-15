# Jamhuriya Research Management System (RMS)

MERN research management system for Jamhuriya University of Science & Technology (JUST): proposals, ethics, multi-stage review, projects, grants, budgets, publications, repository, groups, analytics, and notifications.

## VS Code + CMD (Windows) — ugu fudud

1. Install [Node.js 18+](https://nodejs.org/) iyo [MongoDB Community](https://www.mongodb.com/try/download/community). MongoDB ha shaqeyso (`net start MongoDB`).
2. GitHub: **Code → Download ZIP** ama `git clone`, ka dib VS Code ku fur folder-ka `research-management-systems`.
3. VS Code: **Terminal → New Terminal**. Shell-ka ha noqdo **Command Prompt** (CMD). Qor:

```bat
npm run setup
npm run dev
```

Ama Explorer-ka ku labo-click `setup.bat` (marka hore), kadib `start.bat`.

VS Code shortcut: **Terminal → Run Task…** → `1. Setup (first time)`, kadib **Ctrl+Shift+B** (`2. Start RMS`).

4. Browser: [http://localhost:5173](http://localhost:5173)  
   Login: `director@rms.edu` / `Director2024!`

Haddii `setup` fashilmo: Node ma jiro, ama MongoDB ma shaqeyo. Kadib mar kale `npm run setup`.

## Stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT
- **Frontend:** React, Vite, Recharts

## Quick start (any OS)

### Prerequisites

- Node.js 18+
- MongoDB (`mongodb://localhost:27017/rms` or Atlas)

From the **repo root** (not `backend/` or `frontend/`):

```bash
npm run setup
npm run dev
```

- App: `http://localhost:5173`
- API: `http://localhost:5000`

`npm run setup` copies `backend/.env`, installs packages, and seeds demo users. `npm run dev` starts API + UI together (works in CMD and PowerShell).

After login, all roles open **Dashboard**. Shared staff pick **Undergraduate (UG)** or **Postgraduate (PG)** portal.

### Manual (two terminals)

```bash
cd backend
copy .env.example .env
npm install
npm run seed
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

## Users and passwords (demo)

Run `cd backend && npm run seed` once, then log in with:

| Role | Name | Email | Password | Portal |
|------|------|-------|----------|--------|
| Research Director | Dr. Catherine Morrison | `director@rms.edu` | `Director2024!` | Pick UG or PG |
| Faculty Coordinator | Dr. Emma Richardson | `coordinator@rms.edu` | `Coordinator2024!` | Pick UG or PG |
| Finance Officer | Michael Brooks | `finance@rms.edu` | `Finance2024!` | Pick UG or PG |
| Leadership (peer review) | Prof. Ibrahim Warsame | `leadership@rms.edu` | `Leadership2024!` | Pick UG or PG |
| Researcher | Dr. Sarah Chen | `asha@rms.edu` | `Researcher2024!` | Undergraduate only |
| Researcher | Dr. James Okonkwo | `mahad@rms.edu` | `Researcher2024!` | Postgraduate only |

Copy-paste:

```
director@rms.edu       / Director2024!
coordinator@rms.edu    / Coordinator2024!
finance@rms.edu        / Finance2024!
leadership@rms.edu     / Leadership2024!
asha@rms.edu           / Researcher2024!   (UG)
mahad@rms.edu          / Researcher2024!   (PG)
```

Override via `backend/.env`: `SEED_DIRECTOR_PASSWORD`, `SEED_COORDINATOR_PASSWORD`, `SEED_FINANCE_PASSWORD`, `SEED_LEADERSHIP_PASSWORD`, `SEED_RESEARCHER_PASSWORD`.

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

## Seed / verify

```bash
cd backend
npm run seed
node src/scripts/verifySeedUsers.js
npm run verify:stakeholders
```

Accounts and passwords are listed above under **Users and passwords (demo)**.

### Role summary

| Who | Main work |
|-----|-----------|
| Researcher | Proposals, ethics, projects, publications |
| Leadership | Peer review when assigned |
| Faculty Coordinator | Committee review when assigned |
| Finance | Grant finance review (`/finance/reviews`), budgets, closure finance |
| Research Director | Assign peer/committee/finance, ethics certificate, final approve |

## Scripts

From the **repo root**:

| Command | Description |
|---------|-------------|
| `npm run setup` | Copy `.env`, install backend + frontend, seed demo users |
| `npm run dev` | Start API (`:5000`) and app (`:5173`) together |

From `backend/`:

| Command | Description |
|---------|-------------|
| `npm run seed` | Bootstrap users and sample research data |
| `node src/scripts/verifySeedUsers.js` | Verify seed accounts |
| `npm run verify:stakeholders` | Login + API check per role |
| `npm run db:audit` | Document counts per collection |

## Documentation (Word only — complete current system)

| Document | Purpose |
|----------|---------|
| **[docs/SOLUTIONS_ARCHITECTURE.docx](docs/SOLUTIONS_ARCHITECTURE.docx)** | Senior solutions architecture (stack, security, scale)
| **[docs/SYSTEM_COMPLETE.docx](docs/SYSTEM_COMPLETE.docx)** | **Whole system in one Word file** (start here) |
| **[docs/SYSTEM_ARCHITECTURE_CURRENT.docx](docs/SYSTEM_ARCHITECTURE_CURRENT.docx)** | Full architecture (modules, APIs, roles, diagrams) |
| **[docs/DATABASE_STRUCTURE.docx](docs/DATABASE_STRUCTURE.docx)** | Full MongoDB schema (all 18 collections) |
| **[docs/SYSTEM_HOW_IT_WORKS.docx](docs/SYSTEM_HOW_IT_WORKS.docx)** | Full how-to + users/passwords |
| [docs/USER_GUIDE_SOM_EN.docx](docs/USER_GUIDE_SOM_EN.docx) | Short user guide (SO + EN) |
| [docs/HOW_TO_USE_SYSTEM_SOM_EN.docx](docs/HOW_TO_USE_SYSTEM_SOM_EN.docx) | How to use |
| [docs/FULL_SYSTEM_GUIDE_SOM_EN.docx](docs/FULL_SYSTEM_GUIDE_SOM_EN.docx) | Journey by role |
| [docs/ROLES_AND_STAGES_GUIDE.docx](docs/ROLES_AND_STAGES_GUIDE.docx) | Roles & stages |

Close Word if `SYSTEM_ARCHITECTURE.docx` is locked; use `SYSTEM_ARCHITECTURE_CURRENT.docx` instead.

```bash
cd backend
npm run docs:architecture-docx
```

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
