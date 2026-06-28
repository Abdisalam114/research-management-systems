/**
 * Readable institutional sample records (up to TARGET per module).
 * Seed only fills gaps — existing DB rows are kept.
 */
const TARGET = 10;

const SAMPLE_PROPOSALS = [
  {
    title: "AI-Assisted Early Disease Screening in Low-Resource Clinics",
    abstract:
      "Pilot study on lightweight machine learning tools for triage and early referral in partner clinics with limited imaging infrastructure.",
    department: "Computer Science",
    researchArea: "Artificial Intelligence",
    status: "submitted",
  },
  {
    title: "Renewable Microgrid Optimization for Campus Resilience",
    abstract:
      "Hybrid solar–battery microgrid design to improve uptime for laboratories and student housing during grid outages.",
    department: "Engineering",
    researchArea: "Energy Systems",
    status: "under_review",
  },
  {
    title: "Community Water Quality Monitoring Using Low-Cost Sensors",
    abstract:
      "Citizen science framework with calibrated sensors and open dashboards for borehole and shallow-well monitoring.",
    department: "Environmental Science",
    researchArea: "Public Health",
    status: "approved",
  },
  {
    title: "Digital Agriculture Advisory Platform for Smallholder Farmers",
    abstract:
      "SMS and mobile-web advisories on planting windows, pest alerts, and market prices tailored to Banadir region crops.",
    department: "Agriculture",
    researchArea: "Agri-Informatics",
    status: "draft",
  },
  {
    title: "Blockchain-Based Academic Credential Verification",
    abstract:
      "Permissioned ledger prototype for tamper-evident diplomas and transcript sharing with employer verification portals.",
    department: "Computer Science",
    researchArea: "Cybersecurity",
    status: "revision_requested",
  },
  {
    title: "Maternal Health Outcomes in Urban Displacement Camps",
    abstract:
      "Mixed-methods study on antenatal attendance, referral delays, and midwife capacity in three IDP sites.",
    department: "Public Health",
    researchArea: "Maternal Health",
    status: "submitted",
  },
  {
    title: "Somali–English Medical Translation Using Neural NLP",
    abstract:
      "Domain-adapted translation models evaluated with clinicians for discharge summaries and counselling scripts.",
    department: "Computer Science",
    researchArea: "Natural Language Processing",
    status: "under_review",
  },
  {
    title: "Solar-Powered Desalination for Coastal Fishing Communities",
    abstract:
      "Techno-economic assessment of small-scale RO units paired with photovoltaic arrays and community maintenance models.",
    department: "Engineering",
    researchArea: "Water & Energy",
    status: "approved",
  },
  {
    title: "Cybersecurity Maturity Assessment for University Networks",
    abstract:
      "Baseline audit, policy gap analysis, and phased hardening roadmap for campus Wi-Fi and research servers.",
    department: "Computer Science",
    researchArea: "Information Security",
    status: "rejected",
  },
  {
    title: "Epidemiological Modelling of Malaria Transmission in Riverine Districts",
    abstract:
      "Compartmental models using seasonal rainfall and intervention coverage data from ministry health reports.",
    department: "Public Health",
    researchArea: "Epidemiology",
    status: "approved",
  },
];

const SAMPLE_GRANTS = [
  { title: "Campus Innovation Grant 2025", fundingSource: "Jamhuriya Research Fund", amountRequested: 25000, status: "submitted" },
  { title: "Faculty Equipment Upgrade — Engineering Lab", fundingSource: "Ministry of Education", amountRequested: 18000, status: "approved" },
  { title: "Community Health Outreach Pilot", fundingSource: "WHO Somalia Partnership", amountRequested: 32000, status: "active" },
  { title: "Digital Library & Repository Expansion", fundingSource: "Jamhuriya Research Fund", amountRequested: 12000, status: "draft" },
  { title: "Renewable Energy Demonstration Site", fundingSource: "Green Africa Initiative", amountRequested: 45000, status: "submitted" },
  { title: "Graduate Thesis Support Fund", fundingSource: "Alumni Endowment", amountRequested: 8000, status: "active" },
  { title: "AI Diagnostics Validation Study", fundingSource: "Horizon Health Grant", amountRequested: 28000, status: "submitted" },
  { title: "Agricultural Extension Mobile Toolkit", fundingSource: "FAO Somalia", amountRequested: 15000, status: "submitted" },
  { title: "Cybersecurity Awareness & Training", fundingSource: "Jamhuriya Research Fund", amountRequested: 9500, status: "closed" },
  { title: "Water Quality Sensor Network", fundingSource: "UNICEF Innovation", amountRequested: 22000, status: "approved" },
];

const SAMPLE_PUBLICATIONS = [
  { title: "Machine Learning Screening in Low-Resource Clinics", type: "journal_article", year: 2025, status: "submitted" },
  { title: "Microgrid Optimization for Islanded Campuses", type: "conference", year: 2024, status: "validated" },
  { title: "Systematic Review of Renewable Microgrids in East Africa", type: "review", year: 2025, status: "validated" },
  { title: "Case Study: Mobile Clinic Operations in Mogadishu", type: "case_study", year: 2024, status: "validated" },
  { title: "Governance of AI in Higher Education — A Policy Perspective", type: "letter_to_editor", year: 2025, status: "submitted" },
  { title: "Low-Cost Sensors for Community Water Monitoring", type: "paper", year: 2024, status: "validated" },
  { title: "Blockchain Credentials for Somali Universities", type: "book_chapter", year: 2025, status: "draft" },
  { title: "Patent: Portable Solar Desalination Unit", type: "patent", year: 2023, status: "validated" },
  { title: "MSc Thesis: Maternal Health in IDP Camps", type: "thesis", year: 2024, status: "validated" },
  { title: "Digital Agriculture Advisories — Field Evaluation", type: "paper", year: 2025, status: "submitted" },
  {
    title: "Community WASH Training — Benadir Districts",
    type: "community_research_impact",
    year: 2025,
    status: "validated",
    communityImpact: "3,200 households reached; district health office adopted monitoring checklist.",
  },
  { title: "Introductory Textbook on Somali Public Health Systems", type: "book", year: 2024, status: "validated" },
];

const SAMPLE_COLLAB_GROUPS = [
  { name: "AI & Health Research Network", description: "Interdisciplinary group on clinical AI, ethics, and deployment." },
  { name: "Renewable Energy Collaborative", description: "Microgrids, solar, and campus sustainability projects." },
  { name: "Public Health & Epidemiology Unit", description: "Surveillance, modelling, and community interventions." },
  { name: "Agri-Tech & Food Security Lab", description: "Digital extension, soil sensors, and market analytics." },
  { name: "Cybersecurity & Digital Trust", description: "Network security, identity, and credential systems." },
  { name: "Water & Environment Research Group", description: "Quality monitoring, WASH, and coastal resilience." },
  { name: "Education & Learning Sciences", description: "Pedagogy, assessment, and open educational resources." },
  { name: "Engineering Design & Innovation", description: "Prototyping, makerspace, and industry partnerships." },
  { name: "Economics & Policy Studies Circle", description: "Development economics and institutional policy analysis." },
  { name: "Veterinary & Livestock Research Team", description: "Animal health, pastoral systems, and zoonotic risk." },
];

const SAMPLE_THESIS = [
  {
    title: "Deep Learning for Tuberculosis Detection from Chest X-Rays",
    faculty: "Medicine & Health Sciences",
    department: "Medical Laboratory Science",
    facultyResearchArea: "Medical Imaging & AI",
    meetingSchedule: "Wednesdays 14:00 — Radiology Lab 2",
    status: "in_progress",
    students: [{ fullName: "Hodan Abdi", studentId: "MLS-2021-014", email: "hodan.abdi@student.jamhuriya.edu" }],
  },
  {
    title: "IoT-Based Smart Irrigation for Banana Smallholders",
    faculty: "Veterinary & Agriculture Sciences",
    department: "Agriculture",
    facultyResearchArea: "Precision Agriculture",
    meetingSchedule: "Mondays 10:00 — Agri-Engineering Lab",
    status: "proposed",
    students: [{ fullName: "Yusuf Hassan", studentId: "AGR-2022-031", email: "yusuf.hassan@student.jamhuriya.edu" }],
  },
  {
    title: "Secure Student Information System Migration",
    faculty: "Computer & IT",
    department: "Computer Science",
    facultyResearchArea: "Software Engineering",
    meetingSchedule: "Thursdays 16:00 — CS Building Room 204",
    status: "in_progress",
    students: [{ fullName: "Amina Warsame", studentId: "CS-2021-088", email: "amina.warsame@student.jamhuriya.edu" }],
  },
  {
    title: "Economic Impact of Port Modernization on Local SMEs",
    faculty: "Economics & Management",
    department: "Economics",
    facultyResearchArea: "Development Economics",
    meetingSchedule: "Fridays 11:00 — Faculty Boardroom",
    status: "submitted",
    students: [{ fullName: "Mohamed Farah", studentId: "ECO-2020-007", email: "mohamed.farah@student.jamhuriya.edu" }],
  },
  {
    title: "Solar Mini-Grid Feasibility for Rural Health Posts",
    faculty: "Engineering",
    department: "Electrical Engineering",
    facultyResearchArea: "Renewable Energy",
    meetingSchedule: "Tuesdays 15:00 — Engineering Workshop",
    status: "in_progress",
    students: [{ fullName: "Sahra Ali", studentId: "EE-2022-019", email: "sahra.ali@student.jamhuriya.edu" }],
  },
  {
    title: "Inclusive Education Practices in Multilingual Classrooms",
    faculty: "Education",
    department: "Education",
    facultyResearchArea: "Inclusive Pedagogy",
    meetingSchedule: "Wednesdays 09:00 — Education Resource Centre",
    status: "proposed",
    students: [{ fullName: "Khadija Nur", studentId: "EDU-2023-002", email: "khadija.nur@student.jamhuriya.edu" }],
  },
  {
    title: "Antimicrobial Resistance Surveillance in Poultry Farms",
    faculty: "Veterinary & Agriculture Sciences",
    department: "Veterinary Medicine",
    facultyResearchArea: "One Health",
    meetingSchedule: "Mondays 13:00 — Vet Teaching Hospital",
    status: "defended",
    students: [{ fullName: "Abdirahman Idle", studentId: "VET-2021-045", email: "abdirahman.idle@student.jamhuriya.edu" }],
  },
  {
    title: "Natural Language Processing for Somali Legal Texts",
    faculty: "Computer & IT",
    department: "Computer Science",
    facultyResearchArea: "Computational Linguistics",
    meetingSchedule: "Thursdays 14:00 — Digital Humanities Lab",
    status: "in_progress",
    students: [{ fullName: "Fadumo Osman", studentId: "CS-2022-056", email: "fadumo.osman@student.jamhuriya.edu" }],
  },
  {
    title: "Urban Flood Risk Mapping Using Open Geospatial Data",
    faculty: "Engineering",
    department: "Civil Engineering",
    facultyResearchArea: "GIS & Disaster Risk",
    meetingSchedule: "Sundays 10:00 — GIS Studio",
    status: "completed",
    students: [{ fullName: "Liban Mohamed", studentId: "CE-2020-012", email: "liban.mohamed@student.jamhuriya.edu" }],
  },
  {
    title: "Telemedicine Adoption Among Community Health Workers",
    faculty: "Medicine & Health Sciences",
    department: "Public Health",
    facultyResearchArea: "Digital Health",
    meetingSchedule: "Tuesdays 11:00 — School of Public Health",
    status: "submitted",
    students: [{ fullName: "Hamdi Abukar", studentId: "PH-2022-028", email: "hamdi.abukar@student.jamhuriya.edu" }],
  },
];

const SAMPLE_DEPARTMENTS = [
  { name: "Computer Science", code: "CS", faculty: "Computer & IT" },
  { name: "Information Technology", code: "IT", faculty: "Computer & IT" },
  { name: "Electrical Engineering", code: "EE", faculty: "Engineering" },
  { name: "Civil Engineering", code: "CE", faculty: "Engineering" },
  { name: "Economics", code: "ECO", faculty: "Economics & Management" },
  { name: "Business Administration", code: "BA", faculty: "Economics & Management" },
  { name: "Medicine", code: "MED", faculty: "Medicine & Health Sciences" },
  { name: "Public Health", code: "PH", faculty: "Medicine & Health Sciences" },
  { name: "Education", code: "EDU", faculty: "Education" },
  { name: "Veterinary Medicine", code: "VET", faculty: "Veterinary & Agriculture Sciences" },
];

const SAMPLE_ETHICS = [
  "Community Health Survey in IDP Settlements",
  "Wearable Sensors for Maternal Heart Rate Monitoring",
  "Focus Groups on Agricultural Extension Services",
  "Student Learning Analytics in LMS Platforms",
  "Water Sample Collection from Public Boreholes",
  "Interview Study on Cybersecurity Awareness",
  "Clinical Observation in Outpatient Departments",
  "Animal Trials for Poultry Feed Additives",
  "Record Review of Graduation Outcomes 2020–2024",
  "Mobile App Usability Testing with Volunteers",
];

const SAMPLE_REPOSITORY = [
  { type: "document", title: "Pilot Study Protocol — Community Health", description: "Approved protocol for clinic screening pilot." },
  { type: "dataset", title: "Water Quality Readings — Banadir 2024", description: "Anonymized sensor readings (CSV export)." },
  { type: "publication", title: "Microgrid Load Profiles — Campus East", description: "Supplementary data for energy paper." },
  { type: "thesis", title: "MSc Thesis — Maternal Health in IDP Camps", description: "Final thesis PDF (embargoed 6 months)." },
  { type: "document", title: "Ethics Approval Certificate Template", description: "Standard REC certificate layout." },
  { type: "dataset", title: "Agricultural Advisory SMS Logs", description: "De-identified message metadata." },
  { type: "document", title: "Grant Budget Justification Workbook", description: "Excel template for researchers." },
  { type: "publication", title: "Conference Poster — AI in Clinics", description: "PDF poster presented at regional conference." },
  { type: "document", title: "Cybersecurity Baseline Audit Checklist", description: "Internal IT audit instrument." },
  { type: "dataset", title: "Malaria Incidence by District 2019–2024", description: "Aggregated ministry surveillance data." },
];

const SAMPLE_NOTIFICATIONS = [
  { type: "proposal", title: "New proposal submitted for review", body: "A researcher submitted a proposal awaiting coordinator action.", link: "/proposals" },
  { type: "grant", title: "Grant application received", body: "Campus Innovation Grant 2025 is ready for director review.", link: "/grants" },
  { type: "budget", title: "Budget line pending approval", body: "Lab consumables expense requires finance review.", link: "/budgets" },
  { type: "publication", title: "Publication awaiting validation", body: "A journal article was submitted for director validation.", link: "/publications" },
  { type: "project", title: "Project progress update posted", body: "A researcher added a milestone progress note.", link: "/projects" },
  { type: "repository", title: "New repository deposit", body: "A dataset was uploaded to the institutional repository.", link: "/repository" },
  { type: "system", title: "Scheduled maintenance — Sunday 02:00", body: "Brief downtime for database backups.", link: "/dashboard" },
  { type: "proposal", title: "Revision requested on proposal", body: "Please address reviewer comments and resubmit.", link: "/proposals" },
  { type: "grant", title: "Grant marked active", body: "Community Health Outreach Pilot is now active.", link: "/grants" },
  { type: "system", title: "Welcome to Jamhuriya Research Portal", body: "Explore proposals, projects, grants, and analytics from your dashboard.", link: "/dashboard" },
];

const LEGACY_TITLE_FIXES = {
  Publication: [
    ["SEED: ML Screening in Low-Resource Clinics", "Machine Learning Screening in Low-Resource Clinics"],
    ["SEED: Microgrid Optimization Review", "Microgrid Optimization for Islanded Campuses"],
    ["SEED: Systematic Review of Renewable Microgrids", "Systematic Review of Renewable Microgrids in East Africa"],
    ["SEED: Case Study — Mobile Clinic in Mogadishu", "Case Study: Mobile Clinic Operations in Mogadishu"],
    ["SEED: Letter — On AI Governance in Higher Education", "Governance of AI in Higher Education — A Policy Perspective"],
  ],
  Grant: [["SEED: Campus Innovation Grant", "Campus Innovation Grant 2025"]],
  ResearchGroup: [["SEED: AI & Health Research Group", "AI & Health Research Network"]],
  RepositoryItem: [["SEED: Pilot Study Protocol", "Pilot Study Protocol — Community Health"]],
};

module.exports = {
  TARGET,
  SAMPLE_PROPOSALS,
  SAMPLE_GRANTS,
  SAMPLE_PUBLICATIONS,
  SAMPLE_COLLAB_GROUPS,
  SAMPLE_THESIS,
  SAMPLE_DEPARTMENTS,
  SAMPLE_ETHICS,
  SAMPLE_REPOSITORY,
  SAMPLE_NOTIFICATIONS,
  LEGACY_TITLE_FIXES,
};
