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
npm run seed:admin
npm run seed:demo
npm run seed:modules
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

### Default logins (after seed)

| Role | Email | Password |
|------|-------|----------|
| Research Director | `admin@rms.edu` | `admin123` |
| Researcher | `asha@just.edu` | `Passw0rd!` |
| Finance Officer | `finance@just.edu` | `Finance123!` |
| Faculty Coordinator | `coordinator@just.edu` | `Coordinator123!` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run db:audit` | Count documents per collection (backend) |
| `npm run seed:modules` | Sample grants, budgets, publications, etc. |

## License

Private / institutional use.
