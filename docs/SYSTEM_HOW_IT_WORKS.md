# JUST RMS — Sida System-ku u Shaqeeyo / How the System Works

**Jamhuriya University of Science & Technology — Research Management System (MERN)**

Portals: **Undergraduate (UG)** and **Postgraduate (PG)**. Shared staff pick a portal after login; researchers stay on their `programTier`.

---

## 1. Roles / Doorarka

| Role | Login (demo) | Main work |
|------|----------------|-----------|
| Research Director | `director@rms.edu` | Assign reviewers/committee/finance; ethics certificate; final proposal approve; oversight |
| Faculty Coordinator | `coordinator@rms.edu` | Committee review (when assigned) |
| University Leadership | `leadership@rms.edu` | Peer review (when assigned) |
| Finance Officer | `finance@rms.edu` | Proposal finance review (grant only); budgets; project closure finance |
| Researcher | e.g. `asha@rms.edu` (UG), `mahad@rms.edu` (PG) | Proposals, ethics, projects, publications |
| HR | (staff) | Users / HR modules as configured |
| Donor | (staff) | Donor / funding views as configured |

Default password for demo accounts: see project README / seed notes.

---

## 2. Two proposal kinds

1. **Voluntary** — no grant fund call. Finance review stage is **skipped**.
2. **Grant fund call** — linked to a funding call. Finance review is **required** after committee.

---

## 3. Proposal review flow (Phase 3) — both portals same

```
Researcher submits proposal (+ ethics when required)
        ↓
Director: Assign & send to reviewer (Leadership)
        ↓
Leadership: peer score & comment
        ↓
Director: Complete peer stage (when assignees done)
        ↓
Director: Assign & send to committee (Faculty Coordinators)
        ↓
Coordinator: committee decision (must be assigned)
        ↓
[Grant only] Director: Assign & send to finance
        ↓
[Grant only] Finance: approve / reject (must be assigned)
        ↓
Director: Proposal decision (Approve creates Project)
```

### Rules

- **No Admin screening Pass/Fail UI** — assigning peer reviewers advances the workflow.
- **Proposal decision is locked** until Multi-stage review reaches **ready for director**.
- **Assign-first:** committee and finance decisions require prior assignment.
- Ethics (JUREC certificate) is **separate** from faculty committee — ethics approval does **not** auto-pass committee.
- List chips: **Sent to reviewer**, **Sent to committee**, **Sent to finance**.

---

## 4. After approval

- **Approve proposal** → creates an **active Project**.
- Grant projects: budgets, payments, procurement path as configured.
- **Project closure:** Director checklist → Finance clears finances → project closes.
- Publications / repository can link to the project.

---

## 5. Where each role works

| Task | Path / menu |
|------|-------------|
| Director review | Proposals → Review |
| Peer assignments | Peer Reviews / Review assignments |
| Finance proposal queue | Finance → Proposal reviews (`/finance/reviews`) |
| Ethics | Ethics module (Director issues certificate) |
| Projects | Projects |
| Funding calls | Funding Calls (Director) |

---

## 6. Tech stack (short)

- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Database:** MongoDB
- **Auth:** JWT; portal header `X-Program-Tier` for staff

Run locally:

```bash
# backend
cd backend && npm run dev

# frontend
cd frontend && npm run dev
```

Typical URLs: API `http://localhost:5000`, UI `http://localhost:5173`.

---

## 7. Diagrams

Open in a browser:

- `docs/RMS_SYSTEM_DIAGRAM.html`
- `docs/SYSTEM_FLOW_SIMPLE.html`

---

*This document describes the live JUST RMS behaviour (UG + PG). Older gap-analysis or draft notes are removed so docs stay aligned with the running system.*
