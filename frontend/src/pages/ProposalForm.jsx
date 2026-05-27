import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as proposalApi from "../services/proposalApi";

export function ProposalFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [form, setForm] = useState({
    title: "",
    abstract: "",
    department: "",
    researchArea: "",
    document: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const heading = useMemo(() => (isEdit ? "Edit Proposal" : "New Proposal (Draft)"), [isEdit]);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{heading}</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        After saving, complete the ethics form, then use one button to submit proposal + ethics to the Director.
      </p>
      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)" }}>{error}</div> : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="field">
          <label>Abstract</label>
          <input value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} />
        </div>
        <div className="row">
          <div className="field">
            <label>Department</label>
            <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          <div className="field">
            <label>Research Area</label>
            <input value={form.researchArea} onChange={(e) => setForm({ ...form, researchArea: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Document (optional) (PDF/DOC/DOCX)</label>
          <input
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setForm({ ...form, document: e.target.files?.[0] || null })}
          />
        </div>

        <button
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const res = await proposalApi.createProposal(accessToken, form);
              navigate(`/proposals/${res.proposal.id}`, { replace: true });
            } catch (e) {
              setError(e?.response?.data?.message || "Save failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving..." : "Save draft"}
        </button>
      </div>
    </div>
  );
}

