import { useEffect, useMemo } from "react";
import {
  SUBJECT_OPTS,
  INSTRUMENT_OPTS,
  CONSENT_ITEMS,
  PROJECT_LEVEL_OPTS,
  normalizeProjectLevel,
} from "../constants/ethicsFormOptions";
import { FACULTIES, DEFAULT_FACULTY, matchFacultyByName } from "../constants/faculties";
import { getEthicsMissingFields } from "../utils/proposalSubmitValidation";
import { scrollElementIntoAppView } from "../utils/scrollContainer";
import "./ethicsLevelPicker.css";

function facultyKeyForDepartment(d) {
  if (d?.faculty && FACULTIES.some((f) => f.value === d.faculty)) return d.faculty;
  const inferred = matchFacultyByName(d?.name || d?.faculty || "");
  if (inferred && FACULTIES.some((f) => f.value === inferred)) return inferred;
  return DEFAULT_FACULTY;
}

const REQUIRED_FIELD_IDS = {
  projectTitle: "ethics-req-projectTitle",
  "principal.firstName": "ethics-req-pi-firstName",
  "principal.lastName": "ethics-req-pi-lastName",
  projectLevel: "ethics-req-projectLevel",
  aimsObjectives: "ethics-req-aimsObjectives",
  design: "ethics-req-design",
  "applicantSignature.name": "ethics-req-signature",
};

function scrollToEthicsField(fieldKey) {
  const id = REQUIRED_FIELD_IDS[fieldKey];
  if (!id) return;
  const el = document.getElementById(id);
  scrollElementIntoAppView(el, { behavior: "smooth", block: "center", offset: 88 });
  el?.focus?.();
}

function patchForm(prev, path, value) {
  const next = { ...prev };
  const keys = path.split(".");
  let cur = next;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = { ...(cur[keys[i]] || {}) };
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return next;
}

/**
 * Full REC ethics application fields. Used on proposal page and ethics module.
 * @param {boolean} hideFundingFields — voluntary proposals: no funding / money fields
 */
export function EthicsApplicationForm({
  form,
  setForm,
  readOnly = false,
  formComplete = false,
  embeddedInProposal = false,
  autoFillHint = false,
  hideFundingFields = false,
  departments = [],
}) {
  const set = (path, value) => setForm((prev) => patchForm(prev, path, value));
  const departmentsByFaculty = useMemo(() => {
    const map = {};
    FACULTIES.forEach((f) => {
      map[f.value] = [];
    });
    departments.forEach((d) => {
      const key = facultyKeyForDepartment(d);
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }
    return map;
  }, [departments]);
  const missing = getEthicsMissingFields(form);
  const consentOptions = hideFundingFields
    ? CONSENT_ITEMS.filter((v) => v !== "compensation" && v !== "cost_reimbursement").map((v) => ({
        value: v,
        label: v.replace(/_/g, " "),
      }))
    : CONSENT_ITEMS.map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

  useEffect(() => {
}, [missing.length, formComplete, embeddedInProposal]);

  const toggleInArray = (path, value) => {
    const raw = path.split(".").reduce((acc, k) => acc?.[k], form);
    const arr = Array.isArray(raw) ? raw : [];
    set(path, arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  if (!form) return null;

  return (
    <>
      {autoFillHint ? (
        <div
          className="muted"
          style={{
            marginBottom: 12,
            fontSize: 13,
            padding: "10px 12px",
            background: "rgba(34,197,94,0.1)",
            borderRadius: 8,
            border: "1px solid rgba(34,197,94,0.25)",
          }}
        >
          Proposal fields (title, abstract, department) and your profile auto-fill this form.
          If you change the proposal, save a draft so your changes are kept.
        </div>
      ) : null}

      {embeddedInProposal ? (
        <div
          className="muted"
          style={{
            marginBottom: 12,
            fontSize: 13,
            padding: "8px 10px",
            background: "rgba(14,165,233,0.08)",
            borderRadius: 8,
          }}
        >
          This ethics form is on the same page as your proposal. One button submits both to the Director.
        </div>
      ) : null}

      <div style={{ marginBottom: 12, fontSize: 13 }}>
        Required fields:{" "}
        <strong>{formComplete ? "Complete ✓" : "Incomplete"}</strong>
        {!formComplete ? (
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontWeight: 400 }}>
            {missing.map((item) => (
              <li key={item.field}>
                <button
                  type="button"
                  className="btn linkish"
                  style={{ padding: 0, fontSize: "inherit", textAlign: "left" }}
                  onClick={() => scrollToEthicsField(item.field)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <Section title="Required fields — complete before submit" highlight>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Fill every field below. These are checked before you can submit to the Director.
        </p>
        <div className="field">
          <label htmlFor="ethics-req-projectTitle">Project title (ethics form) *</label>
          <input
            id="ethics-req-projectTitle"
            disabled={readOnly}
            value={form.projectTitle}
            onChange={(e) => set("projectTitle", e.target.value)}
          />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="ethics-req-pi-firstName">PI first name (Principal Investigator) *</label>
            <input
              id="ethics-req-pi-firstName"
              disabled={readOnly}
              value={form.principal?.firstName || ""}
              onChange={(e) => set("principal.firstName", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ethics-req-pi-lastName">PI last name *</label>
            <input
              id="ethics-req-pi-lastName"
              disabled={readOnly}
              value={form.principal?.lastName || ""}
              onChange={(e) => set("principal.lastName", e.target.value)}
            />
          </div>
        </div>
        <div className="field" id="ethics-req-projectLevel">
          <label>Project level *</label>
          <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
            Choose one: Undergraduate (Bachelor) or Postgraduate (Master).
          </p>
          <div className="ethicsLevelPicker" role="radiogroup" aria-label="Project level">
            {PROJECT_LEVEL_OPTS.map((opt) => {
              const selected = normalizeProjectLevel(form.projectLevel) === opt.value;
              return (
                <label
                  key={opt.value}
                  className={[
                    "ethicsLevelCard",
                    selected ? "ethicsLevelCardSelected" : "",
                    readOnly ? "ethicsLevelCardDisabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <input
                    type="radio"
                    name="ethics-project-level"
                    value={opt.value}
                    checked={selected}
                    disabled={readOnly}
                    onChange={() => set("projectLevel", opt.value)}
                  />
                  <span className="ethicsLevelIcon" aria-hidden="true">
                    {opt.icon}
                  </span>
                  <span className="ethicsLevelBody">
                    <span className="ethicsLevelBadge">{opt.short}</span>
                    <div className="ethicsLevelTitle">{opt.label}</div>
                    <div className="ethicsLevelDesc">{opt.description}</div>
                  </span>
                  <span className="ethicsLevelCheck" aria-hidden="true">
                    ✓
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <Textarea
          id="ethics-req-aimsObjectives"
          label="Aims & objectives *"
          value={form.aimsObjectives}
          onChange={(v) => set("aimsObjectives", v)}
          readOnly={readOnly}
        />
        <Textarea
          id="ethics-req-design"
          label="Design (research methodology) *"
          value={form.design}
          onChange={(v) => set("design", v)}
          readOnly={readOnly}
        />
        <div className="field">
          <label htmlFor="ethics-req-signature">Signature (your full name) *</label>
          <input
            id="ethics-req-signature"
            disabled={readOnly}
            value={form.applicantSignature?.name || ""}
            onChange={(e) => set("applicantSignature.name", e.target.value)}
            placeholder="Enter your full name"
          />
        </div>
      </Section>

      <Section title="Part I — Applicant information">
        <PersonFields
          label="Principal Investigator (PI) — additional details"
          person={form.principal}
          onChange={(field, v) => set(`principal.${field}`, v)}
          readOnly={readOnly}
          hideNameFields={!readOnly}
          departmentsByFaculty={departmentsByFaculty}
        />
        <PersonFields
          label="Co-researcher / Supervisor"
          person={form.coResearcher}
          onChange={(field, v) => set(`coResearcher.${field}`, v)}
          readOnly={readOnly}
          departmentsByFaculty={departmentsByFaculty}
        />
        <div className="field">
          <label>Other investigators (one per line, up to 6)</label>
          <textarea
            rows={3}
            disabled={readOnly}
            value={(form.otherInvestigators || []).join("\n")}
            onChange={(e) => set("otherInvestigators", e.target.value.split("\n").filter(Boolean).slice(0, 6))}
          />
        </div>
      </Section>

      <Section title="Part II — Project details">
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Required title, level, aims, and design are entered in the section above. Complete the remaining REC fields below.
          Project start/end dates are set automatically when your proposal is approved and the research project is created.
        </p>
        <Textarea
          label="4. Background & literature review"
          value={form.backgroundLiterature}
          onChange={(v) => set("backgroundLiterature", v)}
          readOnly={readOnly}
        />
        <Textarea label="4.2 Rationale for the research" value={form.rationale} onChange={(v) => set("rationale", v)} readOnly={readOnly} />

        <div className="field">
          <label>6.1 Type of participants</label>
          <CheckGroup options={SUBJECT_OPTS} values={form.subjectTypes} onToggle={(v) => toggleInArray("subjectTypes", v)} readOnly={readOnly} />
          <input
            disabled={readOnly}
            placeholder="Specify if other"
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
            <label>7.2 Precautionary measures?</label>
            <select
              disabled={readOnly}
              value={form.riskPrecautions.has ? "yes" : "no"}
              onChange={(e) => set("riskPrecautions.has", e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className="field">
            <label>Details</label>
            <input disabled={readOnly} value={form.riskPrecautions.description} onChange={(e) => set("riskPrecautions.description", e.target.value)} />
          </div>
        </div>

        <Textarea label="8. Research settings" value={form.settings} onChange={(v) => set("settings", v)} readOnly={readOnly} />

        <div className="field">
          <label>9. Data collection instruments</label>
          <CheckGroup options={INSTRUMENT_OPTS} values={form.instruments} onToggle={(v) => toggleInArray("instruments", v)} readOnly={readOnly} />
          <input
            disabled={readOnly}
            placeholder="Other, specify"
            value={form.instrumentsOther}
            onChange={(e) => set("instrumentsOther", e.target.value)}
          />
        </div>

        <div className="row">
          <div className="field">
            <label>10. Data collection dates</label>
            <input disabled={readOnly} value={form.dataCollectionDate} onChange={(e) => set("dataCollectionDate", e.target.value)} />
          </div>
          <div className="field">
            <label>11. Sample size</label>
            <input disabled={readOnly} value={form.sampleSize} onChange={(e) => set("sampleSize", e.target.value)} />
          </div>
        </div>

        <Textarea
          label="12.1 Data confidentiality"
          value={form.dataHandling.confidentiality}
          onChange={(v) => set("dataHandling.confidentiality", v)}
          readOnly={readOnly}
        />
        <Textarea
          label="12.2 Record retention"
          value={form.dataHandling.retention}
          onChange={(v) => set("dataHandling.retention", v)}
          readOnly={readOnly}
        />
        {hideFundingFields ? null : (
          <div className="field">
            <label>13. Funding sources</label>
            <input disabled={readOnly} value={form.fundingSource} onChange={(e) => set("fundingSource", e.target.value)} />
          </div>
        )}
      </Section>

      <Section title="Part III — Consent, safety & data">
        <div className="row">
          <div className="field">
            <label>1. Consent form?</label>
            <select disabled={readOnly} value={form.consent.hasForm ? "yes" : "no"} onChange={(e) => set("consent.hasForm", e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className="field">
            <label>2. Consent language</label>
            <select disabled={readOnly} value={form.consent.language} onChange={(e) => set("consent.language", e.target.value)}>
              <option value="">—</option>
              <option value="somali">Somali</option>
              <option value="english">English</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="field">
            <label>Other</label>
            <input disabled={readOnly} value={form.consent.languageOther} onChange={(e) => set("consent.languageOther", e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>3. Interpreter available?</label>
          <select disabled={readOnly} value={form.consent.interpreter ? "yes" : "no"} onChange={(e) => set("consent.interpreter", e.target.value === "yes")}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
        <div className="field">
          <label>4. Consent includes</label>
          <CheckGroup
            options={consentOptions}
            values={form.consent.items}
            onToggle={(v) => toggleInArray("consent.items", v)}
            readOnly={readOnly}
          />
        </div>
        <div className="field">
          <label>5. If participant cannot consent, consent will be sought from</label>
          <input disabled={readOnly} value={form.consent.seekingFrom} onChange={(e) => set("consent.seekingFrom", e.target.value)} />
        </div>

        <Textarea label="2a. Data storage" value={form.dataSafety.handling} onChange={(v) => set("dataSafety.handling", v)} readOnly={readOnly} />
        <Textarea label="2b. Raw data after completion" value={form.dataSafety.rawDataPost} onChange={(v) => set("dataSafety.rawDataPost", v)} readOnly={readOnly} />
        <Textarea label="2c. Retention period" value={form.dataSafety.retentionDetails} onChange={(v) => set("dataSafety.retentionDetails", v)} readOnly={readOnly} />
        <Textarea label="2d. Who may access the data" value={form.dataSafety.accessRights} onChange={(v) => set("dataSafety.accessRights", v)} readOnly={readOnly} />

        <div className="row">
          <div className="field">
            <label>3a. Data shared outside the team?</label>
            <select disabled={readOnly} value={form.privacy.sharesData ? "yes" : "no"} onChange={(e) => set("privacy.sharesData", e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className="field">
            <label>Who & circumstances</label>
            <input disabled={readOnly} value={form.privacy.sharesDataWith} onChange={(e) => set("privacy.sharesDataWith", e.target.value)} />
          </div>
        </div>
        <Textarea label="3b. How participants will be informed" value={form.privacy.sharingInform} onChange={(v) => set("privacy.sharingInform", v)} readOnly={readOnly} />
        <div className="row">
          <div className="field">
            <label>3c. Participants identifiable?</label>
            <select disabled={readOnly} value={form.privacy.identifiable ? "yes" : "no"} onChange={(e) => set("privacy.identifiable", e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className="field">
            <label>Protection measures</label>
            <input disabled={readOnly} value={form.privacy.identifiableProtection} onChange={(e) => set("privacy.identifiableProtection", e.target.value)} />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>4a. Collaboration with another institution?</label>
            <select
              disabled={readOnly}
              value={form.conflictOfInterest.collaborationHas ? "yes" : "no"}
              onChange={(e) => set("conflictOfInterest.collaborationHas", e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className="field">
            <label>Details</label>
            <input disabled={readOnly} value={form.conflictOfInterest.collaborationWith} onChange={(e) => set("conflictOfInterest.collaborationWith", e.target.value)} />
          </div>
        </div>
        {hideFundingFields ? null : (
          <div className="row">
            <div className="field">
              <label>4b. Financial conflict?</label>
              <select
                disabled={readOnly}
                value={form.conflictOfInterest.financialHas ? "yes" : "no"}
                onChange={(e) => set("conflictOfInterest.financialHas", e.target.value === "yes")}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
            <div className="field">
              <label>Description</label>
              <input disabled={readOnly} value={form.conflictOfInterest.financialDescription} onChange={(e) => set("conflictOfInterest.financialDescription", e.target.value)} />
            </div>
          </div>
        )}
        <div className="row">
          <div className="field">
            <label>4c. Reviewed by another committee?</label>
            <select
              disabled={readOnly}
              value={form.conflictOfInterest.reviewedHas ? "yes" : "no"}
              onChange={(e) => set("conflictOfInterest.reviewedHas", e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className="field">
            <label>Committee & plan</label>
            <input disabled={readOnly} value={form.conflictOfInterest.reviewedBy} onChange={(e) => set("conflictOfInterest.reviewedBy", e.target.value)} />
          </div>
        </div>
      </Section>

      <Section title="Part IV — Declaration">
        <p className="muted">
          By submitting, you confirm that you have completed this form and that the research will follow the Belmont Report,
          Helsinki Declaration, and applicable ethical guidelines.
        </p>
        {readOnly && form.applicantSignature?.name ? (
          <div className="field">
            <label>Signature (your full name)</label>
            <div>{form.applicantSignature.name}</div>
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>
            Your signature is entered in the Required fields section above.
          </p>
        )}
      </Section>
    </>
  );
}

function Section({ title, children, highlight = false }) {
  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: "1px solid rgba(56,189,248,0.18)",
        ...(highlight
          ? {
              padding: "14px 14px 4px",
              borderRadius: 10,
              border: "1px solid rgba(34,197,94,0.35)",
              background: "rgba(34,197,94,0.06)",
            }
          : {}),
      }}
    >
      <div style={{ fontWeight: 800, color: highlight ? "#16a34a" : "#7dd3fc", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function PersonFields({ label, person, onChange, readOnly, hideNameFields = false, departmentsByFaculty = {} }) {
  const facultyValue =
    person.faculty && FACULTIES.some((f) => f.value === person.faculty)
      ? person.faculty
      : matchFacultyByName(person.department) || DEFAULT_FACULTY;
  const deptOptions = departmentsByFaculty[facultyValue] || [];

  function onFacultyChange(faculty) {
    onChange("faculty", faculty);
    onChange("department", "");
  }

  function onDepartmentChange(departmentName) {
    onChange("department", departmentName);
    const dept = deptOptions.find((d) => d.name === departmentName);
    if (dept?.faculty && FACULTIES.some((f) => f.value === dept.faculty)) {
      onChange("faculty", dept.faculty);
    }
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {!hideNameFields ? (
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
      ) : null}
      <div className="row">
        <div className="field">
          <label>Title / position</label>
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
          <select disabled={readOnly} value={facultyValue} onChange={(e) => onFacultyChange(e.target.value)}>
            {FACULTIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.value}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Department</label>
          {deptOptions.length ? (
            <select
              disabled={readOnly}
              value={person.department || ""}
              onChange={(e) => onDepartmentChange(e.target.value)}
            >
              <option value="">— Select department —</option>
              {deptOptions.map((d) => (
                <option key={d.id || d.name} value={d.name}>
                  {d.name}
                  {d.code ? ` (${d.code})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              disabled={readOnly}
              value={person.department || ""}
              onChange={(e) => onChange("department", e.target.value)}
              placeholder="Select faculty first or type department"
            />
          )}
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

function Textarea({ label, value, onChange, readOnly, id }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={3} disabled={readOnly} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function CheckGroup({ options, values, onToggle, readOnly }) {
  const list = Array.isArray(values) ? values : [];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
      {options.map((o) => (
        <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" disabled={readOnly} checked={list.includes(o.value)} onChange={() => onToggle(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}
