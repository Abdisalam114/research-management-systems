import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as ethicsApi from "../services/ethicsApi";
import * as proposalApi from "../services/proposalApi";
import { PageHeader } from "../components/PageHeader";
import { EthicsBrandingHeader } from "../components/EthicsBrandingHeader";
import { isEthicsFormComplete } from "../utils/ethicsForm";

const SUBJECT_OPTS = [
  { value: "human", label: "Human" },
  { value: "animal", label: "Animal" },
  { value: "records", label: "Records / data" },
  { value: "others", label: "Others" },
];

const INSTRUMENT_OPTS = [
  { value: "interview", label: "Interviews" },
  { value: "experimental", label: "Experimental test / clinical procedure" },
  { value: "focus_group", label: "Focus group" },
  { value: "record_review", label: "Record review" },
  { value: "observation", label: "Observation" },
  { value: "survey", label: "Survey / Questionnaire" },
  { value: "others", label: "Others" },
];

const CONSENT_ITEMS = [
  "type_of_study",
  "interventions",
  "time_of_study",
  "subject_role",
  "risks",
  "benefit",
  "compensation",
  "cost_reimbursement",
  "right_to_refuse",
  "confidentiality_privacy",
  "researcher_contacts",
];

const STATUS_BADGE = {
  draft: "#7dd3fc",
  submitted: "#38bdf8",
  approved: "#1d4ed8",
  rejected: "#1e3a8a",
};

function Badge({ status }) {
  return (
    <span
      style={{
        background: STATUS_BADGE[status] || "#64748b",
        color: "#fff",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

function emptyForm() {
  return {
    principal: { lastName: "", firstName: "", title: "", faculty: "", department: "", qualification: "", phone: "", email: "" },
    coResearcher: { lastName: "", firstName: "", title: "", faculty: "", department: "", qualification: "", phone: "", email: "" },
    otherInvestigators: [],
    projectTitle: "",
    projectLevel: "",
    startDate: "",
    endDate: "",
    backgroundLiterature: "",
    aimsObjectives: "",
    rationale: "",
    design: "",
    subjectTypes: [],
    subjectTypesSpecify: "",
    inclusionCriteria: "",
    exclusionCriteria: "",
    risk: { level: "", description: "" },
    riskPrecautions: { has: false, description: "" },
    settings: "",
    instruments: [],
    instrumentsOther: "",
    dataCollectionDate: "",
    sampleSize: "",
    dataHandling: { confidentiality: "", retention: "" },
    fundingSource: "",
    consent: { hasForm: false, language: "", languageOther: "", interpreter: false, items: [], seekingFrom: "" },
    dataSafety: { handling: "", rawDataPost: "", retentionDetails: "", accessRights: "" },
    privacy: { sharesData: false, sharesDataWith: "", sharingInform: "", identifiable: false, identifiableProtection: "" },
    conflictOfInterest: { collaborationHas: false, collaborationWith: "", financialHas: false, financialDescription: "", reviewedHas: false, reviewedBy: "" },
    applicantSignature: { name: "" },
  };
}

function toForm(a) {
  if (!a) return emptyForm();
  const dt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  return {
    ...emptyForm(),
    ...a,
    startDate: dt(a.startDate),
    endDate: dt(a.endDate),
    risk: a.risk || { level: "", description: "" },
    riskPrecautions: a.riskPrecautions || { has: false, description: "" },
    consent: { ...emptyForm().consent, ...(a.consent || {}) },
    dataSafety: { ...emptyForm().dataSafety, ...(a.dataSafety || {}) },
    privacy: { ...emptyForm().privacy, ...(a.privacy || {}) },
    conflictOfInterest: { ...emptyForm().conflictOfInterest, ...(a.conflictOfInterest || {}) },
    applicantSignature: { name: a.applicantSignature?.name || "" },
    otherInvestigators: a.otherInvestigators || [],
  };
}

export function EthicsPage() {
  const { accessToken, user } = useAuth();
  const [searchParams] = useSearchParams();
  const proposalIdFromUrl = searchParams.get("proposalId");
  const isResearcher = user?.role === "researcher";
  const isDirector = user?.role === "research_director";

  const [applications, setApplications] = useState([]);
  const [editing, setEditing] = useState(null); // {id, form, status, proposalId?}
  const proposalLoadedRef = useRef(false);
  const load = useCallback(async () => {
    const res = await ethicsApi.listEthicsApplications(accessToken);
    setApplications(res.applications || []);
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  useEffect(() => {
    proposalLoadedRef.current = false;
  }, [proposalIdFromUrl]);

  useEffect(() => {
    if (!accessToken || !proposalIdFromUrl || proposalLoadedRef.current) return;
    (async () => {
      try {
        const res = await proposalApi.getProposalEthicsApplication(accessToken, proposalIdFromUrl);
        proposalLoadedRef.current = true;
        if (res.application) {
          setEditing({
            id: res.application.id,
            form: toForm(res.application),
            approval: res.application.approval,
            status: res.application.status,
            proposalId: res.application.proposalId || proposalIdFromUrl,
          });
        }
      } catch (_) {
        proposalLoadedRef.current = true;
      }
    })();
  }, [accessToken, proposalIdFromUrl]);

  const stats = useMemo(() => {
    const by = (s) => applications.filter((a) => a.status === s).length;
    return [
      { label: "Total", value: applications.length },
      { label: "Draft", value: by("draft") },
      { label: "Submitted", value: by("submitted"), accent: "#38bdf8" },
      { label: "Approved (cert)", value: by("approved"), accent: "#1d4ed8" },
      { label: "Rejected", value: by("rejected") },
    ];
  }, [applications]);

  const directorQueue = applications.filter((a) => a.status === "submitted");

  function openNew() {
    const parts = (user?.fullName || "").trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";
    setEditing({
      form: {
        ...emptyForm(),
        principal: {
          ...emptyForm().principal,
          firstName,
          lastName,
          email: user?.email || "",
          department: user?.department || "",
        },
        applicantSignature: { name: user?.fullName || "" },
      },
    });
  }
  function openEdit(a) {
    setEditing({
      id: a.id,
      form: toForm(a),
      approval: a.approval,
      status: a.status,
      proposalId: a.proposalId,
    });
  }
  function closeEditor() {
    setEditing(null);
  }

  async function save(submit = false) {
    try {
      setError("");
      const linkedProposalId = editing.proposalId || proposalIdFromUrl;
      if (submit && linkedProposalId) {
        setError(
          "Foomkan waxaa la gudbiyaa proposal-ka: tag Proposal Details oo riix «Submit to Director (Proposal + Ethics)»."
        );
        return;
      }
      const payload = { ...editing.form };
      if (payload.startDate === "") payload.startDate = null;
      if (payload.endDate === "") payload.endDate = null;
      let res;
      if (editing.id) {
        res = await ethicsApi.updateEthicsApplication(accessToken, editing.id, payload);
      } else {
        res = await ethicsApi.createEthicsApplication(accessToken, payload);
      }
      if (submit) {
        await ethicsApi.submitEthicsApplication(accessToken, res.application.id);
      }
      const app = res.application;
      if (linkedProposalId) {
        setEditing({
          id: app.id,
          form: toForm(app),
          approval: app.approval,
          status: app.status,
          proposalId: app.proposalId || linkedProposalId,
        });
      } else {
        closeEditor();
      }
      await reload();
      // #region agent log
      fetch("http://127.0.0.1:7457/ingest/e845c40a-0f0d-41d9-883a-67cbc157bfa2", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6113cc" },
        body: JSON.stringify({
          sessionId: "6113cc",
          location: "Ethics.jsx:save",
          message: "ethics saved",
          data: { submit, linkedProposalId: !!linkedProposalId, status: app?.status },
          timestamp: Date.now(),
          hypothesisId: "ethics-fix",
          runId: "post-fix",
        }),
      }).catch(() => {});
      // #endregion
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to save");
    }
  }

  async function decide(a, decision) {
    try {
      const payload = { decision };
      if (decision === "reject") payload.rejectionReason = window.prompt("Rejection reason?") || "";
      else {
        const y = new Date().getFullYear();
        const defaultAcademic = `${y}/${y + 1}`;
        payload.academicYear =
          window.prompt("Academic year (shown at top of certificate):", defaultAcademic) || defaultAcademic;
        payload.year = window.prompt("Year (shown on certificate):", String(y)) || String(y);
        payload.serialNumber = window.prompt("Serial number for REC record (optional):") || undefined;
      }
      await ethicsApi.directorDecision(accessToken, a.id, payload);
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Decision failed");
    }
  }

  async function downloadCert(a) {
    try {
      const blob = await ethicsApi.downloadCertificate(accessToken, a.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ethics-certificate-${a.approval?.certificateId || a.id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.message || "Failed to download certificate");
    }
  }

  return (
    <div>
      <PageHeader
        title="Research Ethical Clearance"
        subtitle={
          proposalIdFromUrl
            ? "Complete this ethics form for your proposal — then submit to the Director before submitting the proposal."
            : "Researcher applies → Director (REC chair) reviews & signs the ethics certificate."
        }
        stats={stats}
        actions={
          isResearcher ? (
            <button type="button" className="btn primary" onClick={openNew}>
              📝 New ethics application
            </button>
          ) : null
        }
      />

      {loading ? <p className="muted">Loading…</p> : null}
      {error ? <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginTop: 8 }}>{error}</div> : null}

      {proposalIdFromUrl ? (
        <div className="card" style={{ marginTop: 12, borderColor: "rgba(56,189,248,0.35)" }}>
          <div style={{ fontWeight: 700 }}>Ethics linked to proposal</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Buuxi foomkan, kadib ku noqo proposal-ka si aad u gudbiso proposal + ethics hal mar.
          </div>
          <Link className="btn primary" style={{ marginTop: 10, display: "inline-block" }} to={`/proposals/${proposalIdFromUrl}`}>
            ← Back to proposal
          </Link>
        </div>
      ) : null}

      {isDirector && directorQueue.length ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>REC review queue ({directorQueue.length})</div>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {directorQueue.map((a) => (
              <div key={a.id} className="card" style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{a.projectTitle || "(no title)"}</div>
                  <div className="muted">
                    {a.principal?.firstName} {a.principal?.lastName} • {a.projectLevel || "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={() => openEdit(a)}>View</button>
                  <button className="btn primary" onClick={() => decide(a, "approve")}>Approve & issue certificate</button>
                  <button className="btn" onClick={() => decide(a, "reject")}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800 }}>Applications</div>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {applications.map((a) => (
            <div key={a.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{a.projectTitle || "(untitled)"}</div>
                  <div className="muted">
                    {a.principal?.firstName} {a.principal?.lastName} • {a.projectLevel || "—"}
                    {a.approval?.certificateId ? ` • cert: ${a.approval.certificateId}` : ""}
                  </div>
                  {a.approval?.rejectionReason ? (
                    <div className="muted" style={{ color: "#1d4ed8" }}>{a.approval.rejectionReason}</div>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Badge status={a.status} />
                  {(isResearcher && ["draft", "rejected"].includes(a.status)) || isDirector ? (
                    <button className="btn" onClick={() => openEdit(a)}>
                      {isResearcher && a.status !== "approved" ? "Edit" : "View"}
                    </button>
                  ) : null}
                  {a.status === "approved" ? (
                    <button className="btn primary" onClick={() => downloadCert(a)}>📄 Download certificate</button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {applications.length === 0 ? <div className="muted">No applications yet.</div> : null}
        </div>
      </div>

      {editing ? (
        <EthicsEditor
          editing={editing}
          setEditing={setEditing}
          onSave={() => save(false)}
          onSubmit={() => save(true)}
          onClose={closeEditor}
          readOnly={!isResearcher || editing.status === "approved" || editing.status === "submitted"}
          canSubmit={isResearcher && !editing.proposalId && !proposalIdFromUrl}
          linkedToProposal={Boolean(editing.proposalId || proposalIdFromUrl)}
          formComplete={isEthicsFormComplete(editing.form)}
          approval={editing.approval}
          showCertificateMeta={editing.status === "approved"}
        />
      ) : null}
    </div>
  );
}

function EthicsEditor({ editing, setEditing, onSave, onSubmit, onClose, readOnly, canSubmit, linkedToProposal, formComplete, approval, showCertificateMeta }) {
  const { form } = editing;
  const set = (path, value) => {
    setEditing((s) => {
      const next = { ...s, form: { ...s.form } };
      const keys = path.split(".");
      let cur = next.form;
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...(cur[keys[i]] || {}) };
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const toggleInArray = (path, value) => {
    const arr = path.split(".").reduce((acc, k) => acc?.[k], form) || [];
    set(path, arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  return (
    <div className="card" style={{ marginTop: 16, border: "1px solid rgba(56,189,248,0.3)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        <button className="btn" onClick={onClose}>Close</button>
      </div>

      <EthicsBrandingHeader approval={approval} showCertificateMeta={showCertificateMeta} />

      {linkedToProposal ? (
        <div className="muted" style={{ marginBottom: 12, fontSize: 13, padding: "8px 10px", background: "rgba(14,165,233,0.08)", borderRadius: 8 }}>
          Foomkan waa la xiriiriyay proposal. Kaydi draft halkan; gudbinta Director-ka waxay ka dhacdaa bogga proposal (hal badhan).
        </div>
      ) : null}

      <div style={{ marginBottom: 12, fontSize: 13 }}>
        Required fields: <strong>{formComplete ? "Complete ✓" : "Incomplete — fill title, PI name, level, aims, design, signature"}</strong>
      </div>

      <Section title="Section I — Applicant details">
        <PersonFields label="Principal Researcher" person={form.principal} onChange={(field, v) => set(`principal.${field}`, v)} readOnly={readOnly} />
        <PersonFields label="Co-researcher / Supervisor" person={form.coResearcher} onChange={(field, v) => set(`coResearcher.${field}`, v)} readOnly={readOnly} />
        <div className="field">
          <label>Other co-investigators (one per line, up to 6)</label>
          <textarea
            rows={3}
            disabled={readOnly}
            value={(form.otherInvestigators || []).join("\n")}
            onChange={(e) => set("otherInvestigators", e.target.value.split("\n").filter(Boolean).slice(0, 6))}
          />
        </div>
      </Section>

      <Section title="Section II — Project details">
        <div className="field">
          <label>1. Title of the project</label>
          <input disabled={readOnly} value={form.projectTitle} onChange={(e) => set("projectTitle", e.target.value)} />
        </div>
        <div className="row">
          <div className="field">
            <label>2. Project level</label>
            <select disabled={readOnly} value={form.projectLevel} onChange={(e) => set("projectLevel", e.target.value)}>
              <option value="">—</option>
              <option value="undergraduate">Undergraduate</option>
              <option value="pgd">PGD</option>
              <option value="master">Master</option>
            </select>
          </div>
          <div className="field">
            <label>Start date</label>
            <input type="date" disabled={readOnly} value={form.startDate || ""} onChange={(e) => set("startDate", e.target.value)} />
          </div>
          <div className="field">
            <label>End date</label>
            <input type="date" disabled={readOnly} value={form.endDate || ""} onChange={(e) => set("endDate", e.target.value)} />
          </div>
        </div>
        <Textarea label="4. Background & brief review of literature" value={form.backgroundLiterature} onChange={(v) => set("backgroundLiterature", v)} readOnly={readOnly} />
        <Textarea label="4.1 Aims & objectives (max 250 words)" value={form.aimsObjectives} onChange={(v) => set("aimsObjectives", v)} readOnly={readOnly} />
        <Textarea label="4.2 Rationale — why this research is important" value={form.rationale} onChange={(v) => set("rationale", v)} readOnly={readOnly} />
        <Textarea label="5. Design" value={form.design} onChange={(v) => set("design", v)} readOnly={readOnly} />

        <div className="field">
          <label>6.1 Subjects / participants</label>
          <CheckGroup options={SUBJECT_OPTS} values={form.subjectTypes} onToggle={(v) => toggleInArray("subjectTypes", v)} readOnly={readOnly} />
          <input
            disabled={readOnly}
            placeholder="Specify"
            value={form.subjectTypesSpecify}
            onChange={(e) => set("subjectTypesSpecify", e.target.value)}
          />
        </div>
        <Textarea label="6.2a Inclusion criteria" value={form.inclusionCriteria} onChange={(v) => set("inclusionCriteria", v)} readOnly={readOnly} />
        <Textarea label="6.2b Exclusion criteria" value={form.exclusionCriteria} onChange={(v) => set("exclusionCriteria", v)} readOnly={readOnly} />

        <div className="row">
          <div className="field">
            <label>7.1 Risk level</label>
            <select disabled={readOnly} value={form.risk.level} onChange={(e) => set("risk.level", e.target.value)}>
              <option value="">—</option>
              <option value="no_risk">No risk</option>
              <option value="minimal">Minimal risk</option>
              <option value="great">Great risk</option>
            </select>
          </div>
          <div className="field">
            <label>Risk description</label>
            <input disabled={readOnly} value={form.risk.description} onChange={(e) => set("risk.description", e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>7.2 Risk precautions?</label>
            <select disabled={readOnly} value={form.riskPrecautions.has ? "yes" : "no"} onChange={(e) => set("riskPrecautions.has", e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className="field">
            <label>Specify precautions</label>
            <input disabled={readOnly} value={form.riskPrecautions.description} onChange={(e) => set("riskPrecautions.description", e.target.value)} />
          </div>
        </div>

        <Textarea label="8. Settings" value={form.settings} onChange={(v) => set("settings", v)} readOnly={readOnly} />

        <div className="field">
          <label>9. Data collection instruments</label>
          <CheckGroup options={INSTRUMENT_OPTS} values={form.instruments} onToggle={(v) => toggleInArray("instruments", v)} readOnly={readOnly} />
          <input
            disabled={readOnly}
            placeholder="If other, specify"
            value={form.instrumentsOther}
            onChange={(e) => set("instrumentsOther", e.target.value)}
          />
        </div>

        <div className="row">
          <div className="field">
            <label>10. Data collection date</label>
            <input disabled={readOnly} value={form.dataCollectionDate} onChange={(e) => set("dataCollectionDate", e.target.value)} />
          </div>
          <div className="field">
            <label>11. Sample size determination</label>
            <input disabled={readOnly} value={form.sampleSize} onChange={(e) => set("sampleSize", e.target.value)} />
          </div>
        </div>

        <Textarea label="12.1 Data confidentiality (storage / access)" value={form.dataHandling.confidentiality} onChange={(v) => set("dataHandling.confidentiality", v)} readOnly={readOnly} />
        <Textarea label="12.2 Record retention" value={form.dataHandling.retention} onChange={(v) => set("dataHandling.retention", v)} readOnly={readOnly} />
        <div className="field">
          <label>13. Funding source</label>
          <input disabled={readOnly} value={form.fundingSource} onChange={(e) => set("fundingSource", e.target.value)} />
        </div>
      </Section>

      <Section title="Section III — Consent, data safety, privacy, conflict of interest">
        <div className="row">
          <div className="field">
            <label>1. Consent form?</label>
            <select disabled={readOnly} value={form.consent.hasForm ? "yes" : "no"} onChange={(e) => set("consent.hasForm", e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className="field">
            <label>2. Language of consent</label>
            <select disabled={readOnly} value={form.consent.language} onChange={(e) => set("consent.language", e.target.value)}>
              <option value="">—</option>
              <option value="somali">Somali</option>
              <option value="english">English</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="field">
            <label>If other, specify</label>
            <input disabled={readOnly} value={form.consent.languageOther} onChange={(e) => set("consent.languageOther", e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>3. Interpreter available if required?</label>
          <select disabled={readOnly} value={form.consent.interpreter ? "yes" : "no"} onChange={(e) => set("consent.interpreter", e.target.value === "yes")}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
        <div className="field">
          <label>4. Consent includes the following items</label>
          <CheckGroup
            options={CONSENT_ITEMS.map((v) => ({ value: v, label: v.replace(/_/g, " ") }))}
            values={form.consent.items}
            onToggle={(v) => toggleInArray("consent.items", v)}
            readOnly={readOnly}
          />
        </div>
        <div className="field">
          <label>5. If participant cannot consent, consent will be sought from</label>
          <input disabled={readOnly} value={form.consent.seekingFrom} onChange={(e) => set("consent.seekingFrom", e.target.value)} />
        </div>

        <Textarea label="2a. Data handling & storage to ensure confidentiality" value={form.dataSafety.handling} onChange={(v) => set("dataSafety.handling", v)} readOnly={readOnly} />
        <Textarea label="2b. What happens to raw data after study?" value={form.dataSafety.rawDataPost} onChange={(v) => set("dataSafety.rawDataPost", v)} readOnly={readOnly} />
        <Textarea label="2c. Retention period & responsibility" value={form.dataSafety.retentionDetails} onChange={(v) => set("dataSafety.retentionDetails", v)} readOnly={readOnly} />
        <Textarea label="2d. Who can access raw data" value={form.dataSafety.accessRights} onChange={(v) => set("dataSafety.accessRights", v)} readOnly={readOnly} />

        <div className="row">
          <div className="field">
            <label>3a. Will you share data outside the research group?</label>
            <select disabled={readOnly} value={form.privacy.sharesData ? "yes" : "no"} onChange={(e) => set("privacy.sharesData", e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className="field">
            <label>With whom & under what circumstances?</label>
            <input disabled={readOnly} value={form.privacy.sharesDataWith} onChange={(e) => set("privacy.sharesDataWith", e.target.value)} />
          </div>
        </div>
        <Textarea label="3b. How will subjects be informed of data sharing?" value={form.privacy.sharingInform} onChange={(v) => set("privacy.sharingInform", v)} readOnly={readOnly} />
        <div className="row">
          <div className="field">
            <label>3c. Are participants identifiable?</label>
            <select disabled={readOnly} value={form.privacy.identifiable ? "yes" : "no"} onChange={(e) => set("privacy.identifiable", e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className="field">
            <label>If yes, protection measures</label>
            <input disabled={readOnly} value={form.privacy.identifiableProtection} onChange={(e) => set("privacy.identifiableProtection", e.target.value)} />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>4a. Conducted in collaboration with another organisation?</label>
            <select disabled={readOnly} value={form.conflictOfInterest.collaborationHas ? "yes" : "no"} onChange={(e) => set("conflictOfInterest.collaborationHas", e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className="field">
            <label>If yes, specify</label>
            <input disabled={readOnly} value={form.conflictOfInterest.collaborationWith} onChange={(e) => set("conflictOfInterest.collaborationWith", e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>4b. Financial conflict of interest?</label>
            <select disabled={readOnly} value={form.conflictOfInterest.financialHas ? "yes" : "no"} onChange={(e) => set("conflictOfInterest.financialHas", e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className="field">
            <label>Briefly explain</label>
            <input disabled={readOnly} value={form.conflictOfInterest.financialDescription} onChange={(e) => set("conflictOfInterest.financialDescription", e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>4c. Reviewed by another committee?</label>
            <select disabled={readOnly} value={form.conflictOfInterest.reviewedHas ? "yes" : "no"} onChange={(e) => set("conflictOfInterest.reviewedHas", e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className="field">
            <label>Reviewer & resolution plan</label>
            <input disabled={readOnly} value={form.conflictOfInterest.reviewedBy} onChange={(e) => set("conflictOfInterest.reviewedBy", e.target.value)} />
          </div>
        </div>
      </Section>

      <Section title="Section IV — Declaration">
        <p className="muted">
          By submitting, the Principal Investigator certifies they have read and filled this application, will conduct the
          study per the Belmont Report, Helsinki Declaration and Islamic Shariah law, and accepts the obligations listed
          in items (a)–(i) of the official form.
        </p>
        <div className="field">
          <label>Signature (Principal Investigator's full name)</label>
          <input
            disabled={readOnly}
            value={form.applicantSignature?.name || ""}
            onChange={(e) => set("applicantSignature.name", e.target.value)}
            placeholder="Type your full name to sign"
          />
        </div>
      </Section>

      {!readOnly ? (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={onSave}>💾 Save draft</button>
          {canSubmit ? (
            <button type="button" className="btn primary" onClick={onSubmit} disabled={!formComplete}>
              📤 Submit to REC
            </button>
          ) : null}
        </div>
      ) : readOnly && editing.status === "submitted" ? (
        <div className="muted" style={{ marginTop: 12 }}>⏳ Submitted — awaiting Director review.</div>
      ) : readOnly && editing.status === "rejected" ? (
        <div className="muted" style={{ marginTop: 12 }}>Rejected — update the form and resubmit when allowed.</div>
      ) : null}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(56,189,248,0.18)" }}>
      <div style={{ fontWeight: 800, color: "#7dd3fc", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function PersonFields({ label, person, onChange, readOnly }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div className="row">
        <div className="field">
          <label>Last name</label>
          <input disabled={readOnly} value={person.lastName} onChange={(e) => onChange("lastName", e.target.value)} />
        </div>
        <div className="field">
          <label>First name</label>
          <input disabled={readOnly} value={person.firstName} onChange={(e) => onChange("firstName", e.target.value)} />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>Title / Position</label>
          <input disabled={readOnly} value={person.title} onChange={(e) => onChange("title", e.target.value)} />
        </div>
        <div className="field">
          <label>Qualification</label>
          <input disabled={readOnly} value={person.qualification} onChange={(e) => onChange("qualification", e.target.value)} />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>Faculty</label>
          <input disabled={readOnly} value={person.faculty} onChange={(e) => onChange("faculty", e.target.value)} />
        </div>
        <div className="field">
          <label>Department</label>
          <input disabled={readOnly} value={person.department} onChange={(e) => onChange("department", e.target.value)} />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>Phone</label>
          <input disabled={readOnly} value={person.phone} onChange={(e) => onChange("phone", e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input disabled={readOnly} value={person.email} onChange={(e) => onChange("email", e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function Textarea({ label, value, onChange, readOnly }) {
  return (
    <div className="field">
      <label>{label}</label>
      <textarea rows={3} disabled={readOnly} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function CheckGroup({ options, values = [], onToggle, readOnly }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
      {options.map((o) => (
        <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            disabled={readOnly}
            checked={values.includes(o.value)}
            onChange={() => onToggle(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
