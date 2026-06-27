/**
 * Realistic English research records for institutional seeding.
 * No demo prefixes, sample labels, or placeholder titles.
 */
const { PROPOSAL_STATUSES } = require("../models/Proposal");
const { GRANT_STATUSES } = require("../models/Grant");
const { PUBLICATION_STATUSES, WORKFLOW_STAGES } = require("../models/Publication");
const { ETHICS_STATUSES } = require("../models/EthicsApplication");
const { THESIS_STATUSES } = require("../models/ThesisGroup");
const { PROGRAM_TIERS } = require("../constants/programTier");

const RECORDS_PER_TIER = 12;

const UNDERGRADUATE_PROPOSALS = [
  {
    title: "Predictive Analytics for Undergraduate Course Performance",
    abstract: "This study applies regression and gradient-boosted models to historical grade data to identify early indicators of academic risk and support timely advising interventions.",
    department: "Computer Science",
    researchArea: "Educational Data Mining",
    status: PROPOSAL_STATUSES.APPROVED,
  },
  {
    title: "Campus Event Management Mobile Application",
    abstract: "Design and evaluation of a cross-platform mobile app that centralizes event discovery, RSVP tracking, and push notifications for student organizations.",
    department: "Information Technology",
    researchArea: "Software Engineering",
    status: PROPOSAL_STATUSES.APPROVED,
  },
  {
    title: "Machine Learning Approaches to Network Intrusion Detection",
    abstract: "Comparison of random forest, SVM, and neural network classifiers on labeled campus network traffic to detect anomalous connection patterns.",
    department: "Computer Science",
    researchArea: "Cybersecurity",
    status: PROPOSAL_STATUSES.UNDER_REVIEW,
  },
  {
    title: "Solar Panel Performance Assessment on University Buildings",
    abstract: "Twelve-month field study measuring energy yield, inverter efficiency, and maintenance costs of rooftop photovoltaic installations.",
    department: "Engineering",
    researchArea: "Renewable Energy",
    status: PROPOSAL_STATUSES.APPROVED,
  },
  {
    title: "Digital Payment Adoption Among University Students",
    abstract: "Structured survey of 400 students examining mobile wallet usage, trust factors, and barriers to cashless transactions on campus.",
    department: "Business Administration",
    researchArea: "Financial Technology",
    status: PROPOSAL_STATUSES.SUBMITTED,
  },
  {
    title: "RFID-Based Automated Attendance Tracking System",
    abstract: "Prototype hardware and software solution for lecture attendance using low-cost RFID readers integrated with the learning management system.",
    department: "Information Technology",
    researchArea: "Embedded Systems",
    status: PROPOSAL_STATUSES.APPROVED,
  },
  {
    title: "Comparative Evaluation of Modern JavaScript Frontend Frameworks",
    abstract: "Benchmark of React, Vue, and Svelte on rendering performance, bundle size, and developer productivity for medium-scale dashboard applications.",
    department: "Computer Science",
    researchArea: "Web Development",
    status: PROPOSAL_STATUSES.DRAFT,
  },
  {
    title: "IoT Water Quality Monitoring for Municipal Supply Points",
    abstract: "Deployment of pH, turbidity, and conductivity sensors with LoRaWAN connectivity for near-real-time water quality dashboards.",
    department: "Environmental Science",
    researchArea: "Environmental Monitoring",
    status: PROPOSAL_STATUSES.APPROVED,
  },
  {
    title: "Blockchain Feasibility Study for Academic Credential Verification",
    abstract: "Analysis of permissioned ledger architectures for issuing and verifying tamper-evident diplomas and transcripts.",
    department: "Computer Science",
    researchArea: "Distributed Systems",
    status: PROPOSAL_STATUSES.UNDER_REVIEW,
  },
  {
    title: "Usability Evaluation of the University E-Learning Platform",
    abstract: "Heuristic evaluation and user testing with faculty and students to prioritize UX improvements in course navigation and assessment workflows.",
    department: "Information Technology",
    researchArea: "Human-Computer Interaction",
    status: PROPOSAL_STATUSES.SUBMITTED,
  },
  {
    title: "Energy Consumption Profiling of Computer Laboratory Facilities",
    abstract: "Metering study of desktop, server, and HVAC loads to recommend scheduling policies that reduce peak electricity demand.",
    department: "Engineering",
    researchArea: "Energy Efficiency",
    status: PROPOSAL_STATUSES.APPROVED,
  },
  {
    title: "Design of a Peer-Support Chatbot for Student Mental Health",
    abstract: "Rule-based and retrieval-augmented conversational agent triaged by counselors, evaluated for response quality and escalation accuracy.",
    department: "Psychology",
    researchArea: "Digital Health",
    status: PROPOSAL_STATUSES.REVISION_REQUESTED,
  },
];

const POSTGRADUATE_PROPOSALS = [
  {
    title: "Deep Learning for Early Detection of Diabetic Retinopathy",
    abstract: "Convolutional neural network trained on fundus imaging datasets with clinician-in-the-loop validation for referral decision support.",
    department: "Public Health",
    researchArea: "Medical Imaging",
    status: PROPOSAL_STATUSES.APPROVED,
  },
  {
    title: "Reinforcement Learning for Microgrid Energy Dispatch",
    abstract: "Agent-based optimization of battery storage and diesel generator scheduling under variable solar generation and campus load profiles.",
    department: "Engineering",
    researchArea: "Power Systems",
    status: PROPOSAL_STATUSES.APPROVED,
  },
  {
    title: "Systematic Review of Antimicrobial Resistance Interventions in Primary Care",
    abstract: "PRISMA-compliant synthesis of randomized trials and quasi-experimental studies on stewardship programs and prescribing guidelines.",
    department: "Public Health",
    researchArea: "Health Policy",
    status: PROPOSAL_STATUSES.UNDER_REVIEW,
  },
  {
    title: "Clinical Record De-identification Using Transformer Language Models",
    abstract: "Fine-tuned BERT pipeline for detecting and masking protected health identifiers in unstructured clinical notes.",
    department: "Computer Science",
    researchArea: "Natural Language Processing",
    status: PROPOSAL_STATUSES.APPROVED,
  },
  {
    title: "Structural Health Monitoring of Bridges with Wireless Sensor Networks",
    abstract: "Vibration-based damage detection algorithms applied to accelerometer data from a pilot bridge instrumentation campaign.",
    department: "Engineering",
    researchArea: "Civil Engineering",
    status: PROPOSAL_STATUSES.SUBMITTED,
  },
  {
    title: "Policy Analysis of National Higher Education Research Funding Models",
    abstract: "Mixed-methods comparison of competitive grants, block funding, and performance-based allocation across OECD member states.",
    department: "Education",
    researchArea: "Higher Education Policy",
    status: PROPOSAL_STATUSES.APPROVED,
  },
  {
    title: "Longitudinal Cohort Study on Maternal Health Outcomes",
    abstract: "Three-year follow-up of antenatal care quality indicators, birth complications, and postpartum readmission rates in regional hospitals.",
    department: "Public Health",
    researchArea: "Epidemiology",
    status: PROPOSAL_STATUSES.APPROVED,
  },
  {
    title: "High-Performance Computing for Regional Climate Model Downscaling",
    abstract: "MPI-parallel workflow for generating kilometer-scale precipitation projections used in agricultural planning scenarios.",
    department: "Environmental Science",
    researchArea: "Climate Science",
    status: PROPOSAL_STATUSES.DRAFT,
  },
  {
    title: "Mixed-Methods Evaluation of Community Health Worker Programs",
    abstract: "Integration of household survey data and qualitative interviews to assess vaccination coverage and referral completeness.",
    department: "Public Health",
    researchArea: "Community Health",
    status: PROPOSAL_STATUSES.UNDER_REVIEW,
  },
  {
    title: "Secure Multi-Party Computation for Shared Health Registry Analytics",
    abstract: "Cryptographic protocol design enabling cross-institutional prevalence estimates without exposing patient-level records.",
    department: "Computer Science",
    researchArea: "Privacy-Preserving Computing",
    status: PROPOSAL_STATUSES.APPROVED,
  },
  {
    title: "Meta-Analysis of Vaccine Hesitancy Communication Strategies",
    abstract: "Quantitative synthesis of messaging trials measuring intent-to-vaccinate across SMS, community outreach, and clinician-led counseling.",
    department: "Public Health",
    researchArea: "Health Communication",
    status: PROPOSAL_STATUSES.SUBMITTED,
  },
  {
    title: "Renewable Energy Integration in Urban Distribution Networks",
    abstract: "Load-flow and fault-analysis study of increased rooftop solar penetration on medium-voltage feeders serving mixed-use districts.",
    department: "Engineering",
    researchArea: "Electrical Engineering",
    status: PROPOSAL_STATUSES.APPROVED,
  },
];

const GRANT_TEMPLATES = [
  { title: "Internal Research Excellence Fund", fundingSource: "University Research Office", amountRequested: 15000, status: GRANT_STATUSES.ACTIVE, awardRatio: 1 },
  { title: "Faculty Innovation Grant", fundingSource: "Faculty of Science & Technology", amountRequested: 8500, status: GRANT_STATUSES.ACTIVE, awardRatio: 1 },
  { title: "WHO Regional Health Research Award", fundingSource: "World Health Organization", amountRequested: 42000, status: GRANT_STATUSES.ACTIVE, awardRatio: 0.85 },
  { title: "National Science Foundation Pilot Study", fundingSource: "National Science Foundation", amountRequested: 75000, status: GRANT_STATUSES.APPROVED, awardRatio: 0.9 },
  { title: "EU Horizon Partnership — Digital Health", fundingSource: "European Commission", amountRequested: 120000, status: GRANT_STATUSES.SUBMITTED, awardRatio: 0 },
  { title: "Industry Collaboration — IoT Analytics", fundingSource: "TechBridge Industries", amountRequested: 28000, status: GRANT_STATUSES.ACTIVE, awardRatio: 1 },
  { title: "Campus Sustainability Challenge Fund", fundingSource: "Green Campus Initiative", amountRequested: 12000, status: GRANT_STATUSES.APPROVED, awardRatio: 1 },
  { title: "Graduate Thesis Support Grant", fundingSource: "Graduate School", amountRequested: 6000, status: GRANT_STATUSES.ACTIVE, awardRatio: 1 },
  { title: "Clinical Trials Infrastructure Grant", fundingSource: "Ministry of Health", amountRequested: 95000, status: GRANT_STATUSES.SUBMITTED, awardRatio: 0 },
  { title: "Open Data Commons Research Award", fundingSource: "Open Knowledge Foundation", amountRequested: 18000, status: GRANT_STATUSES.ACTIVE, awardRatio: 0.75 },
  { title: "Engineering Equipment Acquisition Grant", fundingSource: "Engineering Faculty Board", amountRequested: 35000, status: GRANT_STATUSES.ACTIVE, awardRatio: 1 },
  { title: "Early Career Researcher Seed Fund", fundingSource: "Research Council", amountRequested: 22000, status: GRANT_STATUSES.DRAFT, awardRatio: 0 },
];

const PUBLICATION_TEMPLATES = [
  { title: "Benchmarking Gradient Boosting for Educational Risk Prediction", type: "journal_article", venue: "Journal of Learning Analytics", year: 2025, status: PUBLICATION_STATUSES.VALIDATED, workflowStage: WORKFLOW_STAGES.PUBLISHED, citations: 14 },
  { title: "A Mobile-First Architecture for Campus Event Coordination", type: "conference", venue: "IEEE International Conference on Software Engineering Education", year: 2024, status: PUBLICATION_STATUSES.VALIDATED, workflowStage: WORKFLOW_STAGES.PUBLISHED, citations: 6 },
  { title: "Comparative Analysis of Intrusion Detection Models on Campus Networks", type: "paper", venue: "Computers & Security", year: 2025, status: PUBLICATION_STATUSES.SUBMITTED, workflowStage: WORKFLOW_STAGES.IN_PROCESS, citations: 0 },
  { title: "Field Performance of Rooftop Solar Installations in Tropical Climates", type: "journal_article", venue: "Renewable Energy", year: 2024, status: PUBLICATION_STATUSES.VALIDATED, workflowStage: WORKFLOW_STAGES.PUBLISHED, citations: 22 },
  { title: "Student Adoption Patterns in Mobile Payment Ecosystems", type: "case_study", venue: "FinTech Review", year: 2025, status: PUBLICATION_STATUSES.VALIDATED, workflowStage: WORKFLOW_STAGES.PIPELINE, citations: 3 },
  { title: "Deep Learning Screening for Diabetic Retinopathy in Low-Resource Settings", type: "journal_article", venue: "The Lancet Digital Health", year: 2025, status: PUBLICATION_STATUSES.VALIDATED, workflowStage: WORKFLOW_STAGES.PUBLISHED, citations: 41 },
  { title: "Reinforcement Learning for Hybrid Microgrid Dispatch Under Uncertainty", type: "journal_article", venue: "Applied Energy", year: 2024, status: PUBLICATION_STATUSES.VALIDATED, workflowStage: WORKFLOW_STAGES.PUBLISHED, citations: 18 },
  { title: "Antimicrobial Stewardship in Primary Care: A Systematic Review", type: "review", venue: "BMJ Open", year: 2025, status: PUBLICATION_STATUSES.SUBMITTED, workflowStage: WORKFLOW_STAGES.IN_PROCESS, citations: 0 },
  { title: "De-identification of Clinical Narratives with Domain-Adapted Transformers", type: "conference", venue: "ACL Clinical NLP Workshop", year: 2024, status: PUBLICATION_STATUSES.VALIDATED, workflowStage: WORKFLOW_STAGES.PUBLISHED, citations: 9 },
  { title: "Wireless Sensing for Bridge Condition Assessment", type: "journal_article", venue: "Structural Health Monitoring", year: 2025, status: PUBLICATION_STATUSES.DRAFT, workflowStage: WORKFLOW_STAGES.SUBMITTED, citations: 0 },
  { title: "Funding Model Reforms in Higher Education Research Systems", type: "book_chapter", venue: "Oxford University Press — Higher Education Policy", year: 2024, status: PUBLICATION_STATUSES.VALIDATED, workflowStage: WORKFLOW_STAGES.PUBLISHED, citations: 5 },
  { title: "Community Health Worker Programs and Vaccination Coverage", type: "journal_article", venue: "Global Health Action", year: 2025, status: PUBLICATION_STATUSES.VALIDATED, workflowStage: WORKFLOW_STAGES.PIPELINE, citations: 7 },
];

const COLLABORATION_GROUPS = [
  { name: "Applied Machine Learning Lab", description: "Interdisciplinary team working on predictive models for education, health, and infrastructure." },
  { name: "Campus Sustainability Research Network", description: "Faculty and students studying energy, water, and waste reduction on university campuses." },
  { name: "Digital Health Informatics Group", description: "Researchers developing clinical NLP, telemedicine workflows, and secure health data systems." },
  { name: "Power Systems and Renewable Energy Unit", description: "Engineering researchers focused on microgrids, grid integration, and storage optimization." },
  { name: "Public Health Evidence Synthesis Team", description: "Systematic reviews, meta-analyses, and policy briefs on population health interventions." },
  { name: "Software Engineering Practice Group", description: "Applied software research including mobile systems, web platforms, and developer tooling." },
  { name: "Environmental Monitoring Collective", description: "IoT sensing, remote sensing, and field studies on air, water, and land use." },
  { name: "Higher Education Policy Observatory", description: "Comparative studies of funding, access, and research productivity in universities." },
  { name: "Cybersecurity Research Alliance", description: "Network security, cryptography, and privacy research with industry partners." },
  { name: "Community-Engaged Research Partnership", description: "Co-designed studies with local hospitals, schools, and municipal agencies." },
  { name: "Biomedical Imaging Research Cluster", description: "Medical image analysis, screening tools, and clinician validation studies." },
  { name: "Climate and Agriculture Modeling Group", description: "Downscaled climate projections supporting regional food security planning." },
];

const THESIS_GROUPS = [
  {
    title: "Optimizing Course Recommendation Systems with Collaborative Filtering",
    department: "Computer Science",
    faculty: "Faculty of Computing",
    facultyResearchArea: "Educational Data Mining",
    status: THESIS_STATUSES.IN_PROGRESS,
    meetingSchedule: "Biweekly — Wednesdays 14:00, Engineering Lab 204",
    students: [
      { fullName: "Daniel Okafor", studentId: "UG2021041", email: "d.okafor@student.rms.edu" },
      { fullName: "Maria Santos", studentId: "UG2021088", email: "m.santos@student.rms.edu" },
    ],
  },
  {
    title: "Design and Usability of a Campus Mobility Dashboard",
    department: "Information Technology",
    faculty: "Faculty of Computing",
    facultyResearchArea: "Human-Computer Interaction",
    status: THESIS_STATUSES.PROPOSED,
    meetingSchedule: "Monthly — first Monday 10:00, IT Building Room 12",
    students: [{ fullName: "Ethan Walker", studentId: "UG2021120", email: "e.walker@student.rms.edu" }],
  },
  {
    title: "Machine Learning Detection of Network Anomalies in Enterprise Wi-Fi",
    department: "Computer Science",
    faculty: "Faculty of Computing",
    facultyResearchArea: "Cybersecurity",
    status: THESIS_STATUSES.IN_PROGRESS,
    meetingSchedule: "Weekly — Fridays 09:00, Cyber Lab 3",
    students: [{ fullName: "Aisha Rahman", studentId: "UG2020067", email: "a.rahman@student.rms.edu" }],
  },
  {
    title: "Cost-Benefit Analysis of Rooftop Solar on Academic Campuses",
    department: "Engineering",
    faculty: "Faculty of Engineering",
    facultyResearchArea: "Renewable Energy",
    status: THESIS_STATUSES.SUBMITTED,
    meetingSchedule: "Biweekly — Tuesdays 11:00, Energy Systems Lab",
    students: [{ fullName: "Thomas Nguyen", studentId: "UG2020093", email: "t.nguyen@student.rms.edu" }],
  },
  {
    title: "Deep Learning Models for Diabetic Retinopathy Screening",
    department: "Public Health",
    faculty: "Faculty of Medicine & Health Sciences",
    facultyResearchArea: "Medical Imaging",
    status: THESIS_STATUSES.IN_PROGRESS,
    meetingSchedule: "Weekly — Thursdays 15:30, Medical Research Wing",
    students: [{ fullName: "Grace Mbeki", studentId: "PG2022004", email: "g.mbeki@student.rms.edu" }],
  },
  {
    title: "Microgrid Dispatch Policies Under Stochastic Solar Generation",
    department: "Engineering",
    faculty: "Faculty of Engineering",
    facultyResearchArea: "Power Systems",
    status: THESIS_STATUSES.IN_PROGRESS,
    meetingSchedule: "Biweekly — Mondays 13:00, Power Lab 1",
    students: [
      { fullName: "Oliver Chen", studentId: "PG2022011", email: "o.chen@student.rms.edu" },
      { fullName: "Fatima Al-Hassan", studentId: "PG2022019", email: "f.alhassan@student.rms.edu" },
    ],
  },
  {
    title: "Systematic Review Protocol for Primary Care Antimicrobial Stewardship",
    department: "Public Health",
    faculty: "Faculty of Medicine & Health Sciences",
    facultyResearchArea: "Health Policy",
    status: THESIS_STATUSES.PROPOSED,
    meetingSchedule: "Monthly — third Wednesday 16:00, Library Study Room B",
    students: [{ fullName: "Rachel Kim", studentId: "PG2022033", email: "r.kim@student.rms.edu" }],
  },
  {
    title: "Privacy-Preserving Analytics on Multi-Institutional Health Registries",
    department: "Computer Science",
    faculty: "Faculty of Computing",
    facultyResearchArea: "Privacy-Preserving Computing",
    status: THESIS_STATUSES.DEFENDED,
    meetingSchedule: "Completed — defense held March 2025",
    students: [{ fullName: "Samuel Ortiz", studentId: "PG2021045", email: "s.ortiz@student.rms.edu" }],
  },
  {
    title: "Structural Vibration Monitoring for Bridge Asset Management",
    department: "Engineering",
    faculty: "Faculty of Engineering",
    facultyResearchArea: "Civil Engineering",
    status: THESIS_STATUSES.IN_PROGRESS,
    meetingSchedule: "Weekly — Wednesdays 08:30, Structures Lab",
    students: [{ fullName: "Lucia Fernandez", studentId: "PG2022050", email: "l.fernandez@student.rms.edu" }],
  },
  {
    title: "Climate Downscaling Methods for Agricultural Planning",
    department: "Environmental Science",
    faculty: "Faculty of Science",
    facultyResearchArea: "Climate Science",
    status: THESIS_STATUSES.IN_PROGRESS,
    meetingSchedule: "Biweekly — Thursdays 10:00, HPC Suite",
    students: [{ fullName: "Benjamin Clarke", studentId: "PG2022062", email: "b.clarke@student.rms.edu" }],
  },
  {
    title: "Evaluating Digital Payment Trust Among Undergraduate Cohorts",
    department: "Business Administration",
    faculty: "Faculty of Business",
    facultyResearchArea: "Financial Technology",
    status: THESIS_STATUSES.COMPLETED,
    meetingSchedule: "Completed — May 2025",
    students: [{ fullName: "Sophie Miller", studentId: "UG2020078", email: "s.miller@student.rms.edu" }],
  },
  {
    title: "Community Health Worker Impact on Childhood Immunization Rates",
    department: "Public Health",
    faculty: "Faculty of Medicine & Health Sciences",
    facultyResearchArea: "Community Health",
    status: THESIS_STATUSES.IN_PROGRESS,
    meetingSchedule: "Weekly — Tuesdays 14:00, Community Health Center",
    students: [{ fullName: "David Mensah", studentId: "PG2022077", email: "d.mensah@student.rms.edu" }],
  },
];

const DEPARTMENTS = [
  { name: "Computer Science", code: "CS", faculty: "Faculty of Computing" },
  { name: "Information Technology", code: "IT", faculty: "Faculty of Computing" },
  { name: "Engineering", code: "ENG", faculty: "Faculty of Engineering" },
  { name: "Public Health", code: "PH", faculty: "Faculty of Medicine & Health Sciences" },
  { name: "Environmental Science", code: "ENV", faculty: "Faculty of Science" },
  { name: "Business Administration", code: "BUS", faculty: "Faculty of Business" },
  { name: "Psychology", code: "PSY", faculty: "Faculty of Social Sciences" },
  { name: "Education", code: "EDU", faculty: "Faculty of Education" },
];

const REPOSITORY_ITEMS = [
  { type: "dataset", title: "Campus Network Traffic Labeled Flow Records 2024", description: "Anonymized NetFlow captures with intrusion labels for ML benchmarking.", tags: ["cybersecurity", "dataset", "network"] },
  { type: "publication", title: "Solar Yield Monitoring Dataset — Rooftop Installations", description: "Hourly generation readings from three campus buildings over 12 months.", tags: ["renewable-energy", "dataset"] },
  { type: "thesis", title: "Final Thesis — Privacy-Preserving Health Registry Analytics", description: "Approved postgraduate thesis manuscript and supplementary protocols.", tags: ["thesis", "health-informatics"] },
  { type: "document", title: "IRB-Approved Survey Instrument — Digital Payment Study", description: "Validated questionnaire and consent forms for the 2024 student finance survey.", tags: ["survey", "ethics", "instrument"] },
  { type: "dataset", title: "Fundus Imaging Subset for Retinopathy Classification", description: "De-identified training split with clinician adjudication labels.", tags: ["medical-imaging", "deep-learning"] },
  { type: "document", title: "Microgrid Dispatch Simulation Model Documentation", description: "Model parameters, load profiles, and reproducibility notes for the PG energy study.", tags: ["microgrid", "simulation"] },
  { type: "publication", title: "Preprint — Antimicrobial Stewardship Systematic Review Protocol", description: "PROSPERO-registered protocol and search strategy appendix.", tags: ["systematic-review", "protocol"] },
  { type: "dataset", title: "Water Quality Sensor Readings — Municipal Supply Points", description: "IoT sensor exports with QA flags and calibration metadata.", tags: ["water-quality", "iot"] },
  { type: "document", title: "Campus Event App — Technical Architecture Specification", description: "API design, deployment diagram, and security considerations.", tags: ["software-engineering", "architecture"] },
  { type: "thesis", title: "Undergraduate Thesis — RFID Attendance System", description: "Complete thesis including hardware schematics and evaluation results.", tags: ["thesis", "embedded-systems"] },
  { type: "dataset", title: "Climate Downscaling Output — Regional Precipitation Projections", description: "NetCDF outputs at 1 km resolution for 2020–2050 scenarios.", tags: ["climate", "netcdf"] },
  { type: "document", title: "Community Health Worker Interview Codebook", description: "Qualitative coding framework for the mixed-methods CHW evaluation.", tags: ["qualitative", "codebook"] },
];

const NOTIFICATION_TEMPLATES = [
  { type: "proposal", title: "Proposal submitted for review", body: "Your research proposal has been submitted and assigned to the faculty review queue." },
  { type: "proposal", title: "Proposal approved", body: "Your proposal was approved. A project record has been created and ethics clearance may proceed." },
  { type: "grant", title: "Grant application received", body: "The research office has received your grant application and started compliance checks." },
  { type: "grant", title: "Grant award confirmed", body: "Congratulations — your grant has been awarded. Budget tracking is now available." },
  { type: "budget", title: "Budget item pending approval", body: "A new budget line item requires finance officer review." },
  { type: "budget", title: "Budget item approved", body: "Your requested equipment purchase has been approved by finance." },
  { type: "publication", title: "Publication submitted for validation", body: "Your publication record was submitted and awaits faculty coordinator validation." },
  { type: "publication", title: "Publication validated", body: "Your publication has been validated and added to the institutional research output report." },
  { type: "project", title: "Progress report reminder", body: "Please submit a quarterly progress report for your active research project." },
  { type: "repository", title: "Repository upload processed", body: "Your dataset upload completed successfully and is available under the selected access level." },
  { type: "system", title: "Ethics application update", body: "Your ethics application status has changed — review the decision in the ethics module." },
  { type: "message", title: "New message in research group", body: "You have unread messages in your collaboration group workspace." },
];

function proposalsForTier(programTier) {
  return programTier === PROGRAM_TIERS.POSTGRADUATE ? POSTGRADUATE_PROPOSALS : UNDERGRADUATE_PROPOSALS;
}

module.exports = {
  RECORDS_PER_TIER,
  UNDERGRADUATE_PROPOSALS,
  POSTGRADUATE_PROPOSALS,
  GRANT_TEMPLATES,
  PUBLICATION_TEMPLATES,
  COLLABORATION_GROUPS,
  THESIS_GROUPS,
  DEPARTMENTS,
  REPOSITORY_ITEMS,
  NOTIFICATION_TEMPLATES,
  proposalsForTier,
};
