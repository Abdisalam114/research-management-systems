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

### Default logins (after `npm run seed`)

All users are defined in **`backend/src/scripts/seedData.js`** only.

| Role | Email | Password |
|------|-------|----------|
| Research Director | `director@rms.edu` | `Director2024!` |
| Faculty Coordinator | `coordinator@rms.edu` | `Coordinator2024!` |
| Finance Officer | `finance@rms.edu` | `Finance2024!` |
| Researcher | `asha@rms.edu` / `mahad@rms.edu` | `Researcher2024!` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run seed` | **Single seed** — all users + sample data |
| `npm run db:audit` | Count documents per collection (backend) |

## Specification vs MVP (gap analysis)

Your full university RMS specification (8 modules, 4 roles) is mapped to what this repo **implements today** vs what is **still missing**:

→ **[docs/SPEC_GAP_ANALYSIS.md](docs/SPEC_GAP_ANALYSIS.md)**

Use that document when planning Phase 2; it is kept in sync with the codebase (routes, roles, partial features).

## License

Private / institutional use.
