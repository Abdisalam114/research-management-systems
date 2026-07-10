const COMPLIANCE_TYPES = [
  { value: "data_protection", label: "Data protection checklist" },
  { value: "environmental", label: "Environmental compliance" },
  { value: "institutional", label: "Institutional checklist" },
  { value: "other", label: "Other compliance" },
];

const SUPPORTING_TYPES = [
  { value: "cv", label: "CV / resume" },
  { value: "letter", label: "Letter of support" },
  { value: "mou", label: "MoU / partnership" },
  { value: "other", label: "Other supporting doc" },
];

export function ProposalApplicationExtras({
  readOnly,
  complianceDocs,
  setComplianceDocs,
  supportingDocs,
  setSupportingDocs,
}) {
  return (
    <>
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Compliance documents</div>
        {complianceDocs.map((doc, idx) => (
          <div key={idx} className="row" style={{ marginBottom: 8 }}>
            <div className="field">
              <label>Type</label>
              <select disabled={readOnly} value={doc.docType} onChange={(e) => {
                const next = [...complianceDocs];
                next[idx] = { ...next[idx], docType: e.target.value };
                setComplianceDocs(next);
              }}>
                {COMPLIANCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>File</label>
              {doc.existingPath && !doc.file ? (
                <a href={doc.existingPath} target="_blank" rel="noreferrer">View uploaded file</a>
              ) : null}
              {!readOnly ? (
                <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => {
                  const next = [...complianceDocs];
                  next[idx] = { ...next[idx], file: e.target.files?.[0] || null };
                  setComplianceDocs(next);
                }} />
              ) : null}
            </div>
          </div>
        ))}
        {!readOnly ? (
          <button type="button" className="btn" onClick={() => setComplianceDocs([...complianceDocs, { docType: "data_protection", label: "", file: null }])}>+ Compliance doc</button>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Supporting documents</div>
        {supportingDocs.map((doc, idx) => (
          <div key={idx} className="row" style={{ marginBottom: 8 }}>
            <div className="field">
              <label>Type</label>
              <select disabled={readOnly} value={doc.docType} onChange={(e) => {
                const next = [...supportingDocs];
                next[idx] = { ...next[idx], docType: e.target.value };
                setSupportingDocs(next);
              }}>
                {SUPPORTING_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>File</label>
              {doc.existingPath && !doc.file ? (
                <a href={doc.existingPath} target="_blank" rel="noreferrer">View uploaded file</a>
              ) : null}
              {!readOnly ? (
                <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => {
                  const next = [...supportingDocs];
                  next[idx] = { ...next[idx], file: e.target.files?.[0] || null };
                  setSupportingDocs(next);
                }} />
              ) : null}
            </div>
          </div>
        ))}
        {!readOnly ? (
          <button type="button" className="btn" onClick={() => setSupportingDocs([...supportingDocs, { docType: "cv", label: "", file: null }])}>+ Supporting doc</button>
        ) : null}
      </div>
    </>
  );
}

export { COMPLIANCE_TYPES, SUPPORTING_TYPES };
