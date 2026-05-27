# Jamhuriya Research Management System (RMS) — Comprehensive Guide

> **Document Purpose:** This document is the comprehensive guide that explains the architecture and functioning of the Jamhuriya RMS. It focuses on the database models (collections) and their roles in the research lifecycle, with real-world examples.
>
> **Database engine:** MongoDB
> **Database URI (development):** `mongodb://localhost:27017/rms`
> **Database name:** `rms`

---

## 1. Data architecture — core 11 models

The system stores data across the following 11 core collections (models). Each serves a specific purpose in the research ecosystem.

### 1. User Model
- **Function:** Stores the details of individuals using the system, including their role and academic rank. It acts as the core for Role-Based Access Control (RBAC), ensuring users only see data they are authorized to view.
- **Real-world example:**
  - Name: Dr. Ahmed Yusuf
  - Email: `ahmed@rms.edu`
  - Role: Researcher
  - Department: Computer Science (CS)

### 2. Department Model
- **Function:** Stores the names and codes of the university's faculties or departments. Crucial for generating analytical reports to see how much research output each department produces.
- **Real-world example:**
  - Name: Faculty of Computing
  - Code: CS

### 3. Proposal Model
- **Function:** When a researcher has a research idea, they submit it via a Proposal form. Stores the title, abstract, team members, and the estimated budget required.
- **Real-world example:**
  - Title: "The Impact of AI on Education in Somalia"
  - Status: Under review (later → Approved)
  - Estimated budget: $1,200

### 4. Project Model
- **Function:** Once a proposal is approved, it automatically converts into an active project. Tracks the start date, end date, and the percentage of work completed (progress).
- **Real-world example:**
  - Title: (inherited from the proposal)
  - Progress: 45%
  - Status: Active
  - Timeline: Jan 2024 – Dec 2024

### 5. Budget Model
- **Function:** Dedicated to tracking the financial allocation of a specific project and logging expenses. Primarily monitored by the Finance Officer.
- **Real-world example:**
  - Project ID: (linked to the Project model)
  - Total budget: $1,200
  - Expenses: $300 (lab equipment), $150 (travel). Remaining balance: $750.

### 6. Grant Model
- **Function:** Used when a researcher requests funding (either internal university funding or external grants) to support their project. The Director reviews this to approve or reject the request, and the Finance Officer monitors disbursement.
- **Real-world example:**
  - Title: "Funding Request for AI Software Licenses"
  - Amount: $500
  - Status: Approved

### 7. Publication Model
- **Function:** When the research is finalized, the resulting academic paper, conference paper, review, case study, or letter to editor is recorded here. Usually requires verification by the Faculty Coordinator (or Director).
- **Real-world example:**
  - Title: "AI in Education: A Somali Perspective"
  - Venue: IEEE International Conference
  - Type: Conference
  - Status: Validated

### 8. Repository Model (Institutional Repository)
- **Function:** The university's central knowledge bank. Stores raw datasets, graduation theses, publications, and other assets that future students or researchers can utilize. Implemented as the `RepositoryItem` collection. Also exposes an OAI-PMH style export endpoint for institutional repository integration.
- **Real-world example:**
  - Type: Dataset
  - Title: "Student Examination Data 2020–2023"
  - Access level: Institutional (only accessible to university members)

### 9. ResearchGroup Model
- **Function:** Allows multiple faculty members to collaborate on a single project. Assigns a lead researcher alongside other collaborating members. Each group can now open a shared group chat (via Conversation).
- **Real-world example:**
  - Name: "Health Tech Research Group"
  - Members: Dr. Ahmed (Lead), Dr. Sarah, Prof. Ali.

### 10. Conversation Model (Messaging)
- **Function:** Facilitates internal communication. Users can send messages to one another directly within the RMS. Each Research Group can have a dedicated group conversation.
- **Real-world example:**
  - Sender: Dr. Ahmed
  - Receiver: Finance Officer
  - Message: "Please expedite the grant disbursement so I can purchase the required equipment."

### 11. Notification Model
- **Function:** Alerts users of any system changes or actions requiring their attention (e.g., proposal approvals, incoming messages, payment status, system updates).
- **Real-world example:**
  - User: Dr. Ahmed
  - Message: "Your proposal 'The Impact of AI…' has been Approved by the Director."
  - isRead: false

---

## 2. Additional models implemented in this MVP

Beyond the core 11 above, the running system adds the following models to align with the full university spec:

### 12. Payment Model
- **Function:** Payment requests (research-assistant payments, equipment purchases, travel reimbursements, publication fees). Lifecycle: `requested → approved → paid` (or `rejected`).
- **Example:** Travel reimbursement of $1,200 for a conference, approved by the Finance Officer, marked paid with a bank reference number.

### 13. PurchaseOrder Model (Procurement)
- **Function:** Vendor purchase orders with itemised lines (description, quantity, unit price). Lifecycle: `submitted → approved → ordered → received → closed` (or `rejected`).
- **Example:** PO to "Acme Lab" for a microscope worth $5,500.

### 14. ResearchPolicy Model
- **Function:** Director-managed strategic policies, research themes, priorities, and approved programs. Drives the dashboard's strategic management section.
- **Example:** Theme "Climate-resilient agriculture", priority "P1", approved program "Solar Pilot 2026".

---

## 3. The complete journey — a real-world workflow

**Actor:** Dr. Ahmed (a researcher in the CS department).

1. **Idea creation (Proposal, Department, ResearchGroup):** Dr. Ahmed logs in and creates a Proposal titled "Utilizing Solar Energy in Healthcare Facilities". He selects his faculty team (ResearchGroup). The system sends a Notification to the CS Faculty Coordinator for initial review.

2. **Approval and initiation (Project + Notification):** The Research Director reviews the idea and finds it beneficial. Upon clicking Approve, the proposal automatically converts into a live Project. Dr. Ahmed receives a Notification: "Your project has been approved, you may begin."

3. **Funding and expenses (Grant, Budget, Payment, Conversation):** Dr. Ahmed realises he needs specialised solar measurement sensors. He submits a Grant request for $1,000. The Director approves it. As Dr. Ahmed buys the equipment, the $1,000 is logged under Budget expenses; a Payment of $1,000 is requested to the supplier and marked paid by the Finance Officer. Dr. Ahmed uses the Conversation module to thank the Finance Officer.

4. **Procurement (PurchaseOrder):** For a larger equipment buy, Dr. Ahmed issues a Purchase Order to a vendor; Finance approves and marks it received.

5. **Completion and publishing (Publication):** Six months later, Dr. Ahmed achieves 100% progress on his Project. He writes a peer-reviewed academic article (type: paper / conference / review / case_study / letter_to_editor) and submits it. The Faculty Coordinator (or Director) validates it. The university's CrossRef citation lookup keeps the citation count current.

6. **Data archiving (Repository):** The raw climate and solar datasets are uploaded to the Repository. Future engineering students can now download this dataset for their graduation theses. The OAI-PMH endpoint exposes validated outputs to external institutional repositories.

7. **Executive reporting (Analytics):** At the end of the academic year, the Research Director views the dashboard:
   - Dr. Ahmed completed 1 project this year.
   - $1,000 was awarded in grants.
   - 1 publication and 1 dataset were produced.
   - Faculty publications table, grant success rate, and an Annual Report PDF are one click away.

---

## 4. Where the data lives

| Concept (this guide) | Collection in `rms` DB |
|----------------------|-------------------------|
| User                 | `users` |
| Department           | `departments` |
| Proposal             | `proposals` |
| Project              | `projects` |
| Budget               | `budgets` |
| Grant                | `grants` |
| Publication          | `publications` |
| Repository           | `repositoryitems` |
| ResearchGroup        | `researchgroups` |
| Conversation         | `conversations` |
| Notification         | `notifications` |
| Payment              | `payments` |
| PurchaseOrder        | `purchaseorders` |
| ResearchPolicy       | `researchpolicies` |

---

## Conclusion

The Jamhuriya RMS creates a seamless, digital ecosystem that connects the creator (Researcher), the approver (Director / Coordinator), and the funder (Finance Officer). Using these models — the original 11 plus the procurement, payments, and strategic-policies models — the system ensures zero data loss, accelerates the research process, and provides absolute transparency over every research activity in the university.
