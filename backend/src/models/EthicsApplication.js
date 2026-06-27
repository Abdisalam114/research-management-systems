const mongoose = require("mongoose");
const { programTierField } = require("../constants/programTierField");

const ETHICS_STATUSES = Object.freeze({
  DRAFT: "draft",
  SUBMITTED: "submitted",
  APPROVED: "approved",
  REJECTED: "rejected",
});

const ETHICS_LEVELS = Object.freeze(["undergraduate", "pgd", "master"]);
const RISK_LEVELS = Object.freeze(["no_risk", "minimal", "great"]);
const SUBJECT_TYPES = Object.freeze(["human", "animal", "records", "others"]);
const INSTRUMENTS = Object.freeze([
  "interview",
  "experimental",
  "focus_group",
  "record_review",
  "observation",
  "survey",
  "others",
]);
const CONSENT_LANGUAGES = Object.freeze(["somali", "english", "other"]);

const personSchema = new mongoose.Schema(
  {
    lastName: { type: String, default: "" },
    firstName: { type: String, default: "" },
    title: { type: String, default: "" },
    faculty: { type: String, default: "" },
    department: { type: String, default: "" },
    qualification: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
  },
  { _id: false }
);

const ethicsSchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      default: null,
      index: true,
      unique: true,
      sparse: true,
    },
    researcherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: Object.values(ETHICS_STATUSES),
      default: ETHICS_STATUSES.DRAFT,
      index: true,
    },

    // Section I — Applicants
    principal: { type: personSchema, default: () => ({}) },
    coResearcher: { type: personSchema, default: () => ({}) },
    otherInvestigators: { type: [String], default: [] },

    // Section II — Project details
    projectTitle: { type: String, default: "" },
    projectLevel: { type: String, enum: [...ETHICS_LEVELS, ""], default: "" },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    backgroundLiterature: { type: String, default: "" },
    aimsObjectives: { type: String, default: "" },
    rationale: { type: String, default: "" },
    design: { type: String, default: "" },
    subjectTypes: { type: [String], default: [] }, // entries from SUBJECT_TYPES
    subjectTypesSpecify: { type: String, default: "" },
    inclusionCriteria: { type: String, default: "" },
    exclusionCriteria: { type: String, default: "" },
    risk: {
      level: { type: String, enum: [...RISK_LEVELS, ""], default: "" },
      description: { type: String, default: "" },
    },
    riskPrecautions: {
      has: { type: Boolean, default: false },
      description: { type: String, default: "" },
    },
    settings: { type: String, default: "" },
    instruments: { type: [String], default: [] }, // entries from INSTRUMENTS
    instrumentsOther: { type: String, default: "" },
    dataCollectionDate: { type: String, default: "" },
    sampleSize: { type: String, default: "" },
    dataHandling: {
      confidentiality: { type: String, default: "" },
      retention: { type: String, default: "" },
    },
    fundingSource: { type: String, default: "" },

    // Section III — Consent / Safety / Privacy / Conflict
    consent: {
      hasForm: { type: Boolean, default: false },
      language: { type: String, enum: [...CONSENT_LANGUAGES, ""], default: "" },
      languageOther: { type: String, default: "" },
      interpreter: { type: Boolean, default: false },
      items: { type: [String], default: [] },
      seekingFrom: { type: String, default: "" },
    },
    dataSafety: {
      handling: { type: String, default: "" },
      rawDataPost: { type: String, default: "" },
      retentionDetails: { type: String, default: "" },
      accessRights: { type: String, default: "" },
    },
    privacy: {
      sharesData: { type: Boolean, default: false },
      sharesDataWith: { type: String, default: "" },
      sharingInform: { type: String, default: "" },
      identifiable: { type: Boolean, default: false },
      identifiableProtection: { type: String, default: "" },
    },
    conflictOfInterest: {
      collaborationHas: { type: Boolean, default: false },
      collaborationWith: { type: String, default: "" },
      financialHas: { type: Boolean, default: false },
      financialDescription: { type: String, default: "" },
      reviewedHas: { type: Boolean, default: false },
      reviewedBy: { type: String, default: "" },
    },

    // Section IV — Declaration / approval
    applicantSignature: {
      name: { type: String, default: "" },
      signedAt: { type: Date, default: null },
    },
    approval: {
      decision: { type: String, enum: ["", "approved", "rejected"], default: "" },
      signedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      signedByName: { type: String, default: "" },
      signedAt: { type: Date, default: null },
      certificateId: { type: String, default: "" },
      serialNumber: { type: String, default: "" },
      academicYear: { type: String, default: "" },
      year: { type: String, default: "" },
      rejectionReason: { type: String, default: "" },
    },
    ...programTierField,
  },
  { timestamps: true }
);

const EthicsApplication = mongoose.model("EthicsApplication", ethicsSchema);

module.exports = {
  EthicsApplication,
  ETHICS_STATUSES,
  ETHICS_LEVELS,
  RISK_LEVELS,
  SUBJECT_TYPES,
  INSTRUMENTS,
  CONSENT_LANGUAGES,
};
