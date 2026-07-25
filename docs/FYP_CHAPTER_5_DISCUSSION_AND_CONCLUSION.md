# CHAPTER V: DISCUSSION AND CONCLUSION
## (Mobile and Web Development based FYPs)

**Project Title:** Design and Implementation of a Web-Based Research Management System for Jamhuriya University  
**Specialization:** Computer Applications (Mobile and Web based FYP)  
**Faculty:** Faculty of Computer and Information Technology  
**University:** Jamhuriya University of Science and Technology (JUST)

---

## 5.1 Introduction

This chapter interprets the implementation results of the Jamhuriya Research Management System (JUST RMS), evaluates achievement of the research objectives, compares the work with related systems and local practice, states limitations, and recommends future improvements. It closes the Mobile and Web based Final Year Project report for the Computer Applications specialization.

The discussion draws on the working MERN stack application documented in Chapter IV (implementation screenshots, functional tests, API design, and security controls). Chapter V therefore focuses on meaning, contribution, and next steps rather than repeating interface descriptions.

## 5.2 Discussion

The implemented system demonstrates that a **single web platform** can replace fragmented paper and spreadsheet research administration for Jamhuriya University. Automation of project creation after proposal approval and structured finance workflows (grant authorization, purchase orders, and payments) reduces manual hand-offs and improves transparency for Directors, Coordinators, Finance officers, and researchers.

Thesis supervision support (title workflow, chapter progress, meetings, and final manuscript upload in PDF or Word) extends the RMS beyond funded faculty research into **undergraduate FYP group management**. This aligns with Faculty of Computer and Information Technology practice, where supervisors and faculty coordinators must track student groups through title acceptance and final document submission.

User-interface consistency (navy and sky theme, shared status badges, and role-filtered menus) improved clarity during testing. The active role model matches institutional practice: the **Research Director** owns ethics decisions and external funding / donor reporting, while **Finance** owns purchase-order review.

Unexpected findings during development included the need for strict program-tier headers on file downloads (for example, ethics certificates) and the importance of keeping legacy status strings (for example, historical `procurement_approved`) while changing live roles—so database history remains readable without breaking validation. Undergraduate and Postgraduate isolation via `X-Program-Tier` also required careful session handling so Director portal switches do not leak records across tiers.

### 5.2.1 Comparison with Existing Studies

University research information systems internationally often cover proposals, ethics, grants, and repositories as separate products. Local practice at many Somali universities still relies on paper forms, email attachments, and spreadsheets. Table 5.1 summarizes how JUST RMS differs from that fragmented practice.

**Table 5.1 Comparison of typical practice and JUST RMS**

| Aspect | Typical manual / fragmented practice | JUST RMS (this study) |
|--------|--------------------------------------|------------------------|
| Proposal tracking | Email and hard copies | Online drafts, versions, multi-stage review |
| Ethics | Separate committee paperwork | Integrated JUREC path; Director decision and certificate |
| Project creation | Manual after approval | Automatic on Director approval |
| Finance | Spreadsheets | Budgets, PO pipeline, payments in one portal |
| Thesis groups | Offline supervisor notes | Structured groups, meetings, final upload |
| Portals | Mixed UG/PG files | Isolated Undergraduate and Postgraduate data |

Compared with generic project tools (for example, Trello or Google Drive alone), JUST RMS is **domain-specific**: it encodes Jamhuriya roles, funding-call applications, ethics clearance, and thesis rules. Compared with heavy commercial ERPs, it is lighter, open to student maintenance, and tailored to Jamhuriya’s two-portal (Undergraduate / Postgraduate) model. The contribution of this FYP is therefore a working, role-aware institutional prototype rather than a general-purpose task board.

## 5.3 Conclusion

This FYP successfully designed and implemented a **web-based Research Management System** for Jamhuriya University using the **MERN stack** (MongoDB, Express.js, React.js, and Node.js). The system digitizes the research lifecycle, supports role-based access control, isolates Undergraduate and Postgraduate portals, and includes thesis supervision features required for faculty practice. Testing confirmed that core workflows—from proposal submission through ethics, approval, project creation, finance, publications, and thesis final upload—operate as intended.

In practical terms, JUST RMS provides one institutional portal where Research Directors, Faculty Coordinators, Finance officers, University Leadership, and Researchers (principal investigators / supervisors) can complete their duties without relying on disconnected paper trails. Screenshots and test results in Chapter IV document that the delivered interfaces and APIs match these goals.

### 5.3.1 Achievement of the Objectives

*(Align labels with your Chapter I wording if slightly different.)*

**Table 5.2 Achievement of research objectives**

| # | Objective | Achievement | Evidence |
|---|-----------|-------------|----------|
| 1 | Digitize proposal submission and review | **Fully achieved** | Proposal forms, documents, multi-stage review UI/API |
| 2 | Automate project creation after Director approval | **Fully achieved** | Project record created on approval |
| 3 | Manage grants, budgets, payments, and POs (Finance) | **Fully achieved** | Funding calls, grants, budgets, Finance PO review, payments |
| 4 | Track publications and repository assets | **Fully achieved** | Publications and repository modules |
| 5 | Provide role-based dashboards and reports | **Fully achieved** | Director/Finance/Coordinator/KPI dashboards; analytics PDF where implemented |
| 6 | Support UG and PG portals | **Fully achieved** | Tier middleware, Director portal switch, seed accounts per portal |

Additional delivered scope beyond the six aims: **Ethics (JUREC)**, **Thesis groups** (including final PDF/Word upload), and a clear institutional role model (Finance owns PO review; Director owns ethics and donor reports).

## 5.4 Limitations

1. **No native mobile application** — access on phones and tablets is through the responsive web interface only.  
2. **Email/SMS notifications** are limited; in-app notifications are the primary channel.  
3. **Professional penetration testing** (OWASP ZAP/Burp full scan) was not completed within the FYP timeframe.  
4. **Email delivery / external calendar** integration was not built.  
5. **Multi-campus / multi-university tenancy** is out of scope.  
6. Some historical **demo/probe scripts** exist in the repository for development only and are not part of the production user experience.  
7. **Production hosting**, SSL, and long-term backup policies depend on university IT after handover.

## 5.5 Recommendations

1. Develop a **native or Progressive Web App** for supervisors and students on mobile.  
2. Add **email notifications** for title decisions, ethics outcomes, funding-call publish events, and payment status changes.  
3. Conduct formal **security audit** and harden production headers/rate limits.  
4. Integrate **Turnitin / plagiarism** reporting links into thesis final-document workflow.  
5. Expand **analytics** for faculty accreditation and annual research reporting.  
6. Train Directors, Coordinators, and Finance officers with the institutional user guide before full rollout.  
7. Keep **seed vs production** data separate; run `npm run seed` only in controlled environments.

## 5.6 Closing Remarks

JUST RMS shows that a focused student FYP can deliver a usable institutional research portal when requirements are grounded in real university roles and workflows. The MERN implementation is maintainable, the Undergraduate/Postgraduate split protects data boundaries, and thesis final-document upload closes an important gap for undergraduate supervision. With the recommendations above—especially mobile access, email alerts, and security hardening—the prototype is ready to evolve into a production service under Jamhuriya University IT and Research Office governance.

---

## Formatting notes (Chapter V)

- Font: Times New Roman 12; line spacing 2.0 for body text (JUST FYP guideline).  
- Expand comparison citations with APA 7th / IEEE references from Chapter II.  
- Before submission: Turnitin ≤ 20%; be ready to explain architecture, RBAC, and thesis upload in the viva.  
- Word export: `docs/FYP_Chapter5_Word/Chapter_5_Discussion_and_Conclusion.docx`

---

*End of Chapter V — JUST RMS Mobile/Web FYP*
