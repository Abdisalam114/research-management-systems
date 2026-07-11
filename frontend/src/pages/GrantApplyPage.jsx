import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as fundingCallApi from "../services/fundingCallApi";
import * as proposalApi from "../services/proposalApi";
import * as grantApi from "../services/grantApi";
import { PageHeader } from "../components/PageHeader";
import { GrantBudgetLines, defaultBudgetRows, budgetRowsTotal } from "../components/GrantBudgetLines";
import "./grantApply.css";
import "./fundingCalls.css";

const STEPS = [
  { id: 1, label: "Call overview" },
  { id: 2, label: "Research proposal" },
  { id: 3, label: "Call requirements" },
  { id: 4, label: "Budget & submit" },
];

function parseRequirements(text) {
  if (!text) return [];
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-*]+/, "").trim())
    .filter(Boolean);
}

function proposalStatusLabel(status) {
  const map = {
    draft: "Draft",
    submitted: "Submitted",
    under_review: "Under review",
    approved: "Approved",
    rejected: "Rejected",
    revision_requested: "Revision requested",
  };
  return map[status] || status;
}

export function GrantApplyPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const callId = searchParams.get("callId") || "";

  const [call, setCall] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [step, setStep] = useState(1);
  const [selectedProposalId, setSelectedProposalId] = useState("");
  const [requirementChecklist, setRequirementChecklist] = useState([]);
  const [form, setForm] = useState({ title: "", donorRef: "", currency: "USD" });
  const [budgetRows, setBudgetRows] = useState(defaultBudgetRows);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!callId) return;
    const [callRes, propRes] = await Promise.all([
      fundingCallApi.getFundingCall(accessToken, callId),
      proposalApi.listProposals(accessToken),
    ]);
    const c = callRes.call;
    setCall(c);
    setForm((f) => ({
      ...f,
      title: f.title || c.title,
      donorRef: c.donorRef || "",
      currency: c.currency || "USD",
    }));
    setBudgetRows(defaultBudgetRows().map((r) => ({ ...r, currency: c.currency || "USD" })));
    const reqs = parseRequirements(c.requiredDocuments);
    setRequirementChecklist(reqs.map((label) => ({ label, met: false, note: "" })));
    const mine = (propRes.proposals || []).filter(
      (p) =>
        String(p.researcherId) === String(user?.id) &&
        String(p.fundingCallId || "") === String(c.id) &&
        (p.proposalKind === "grant_fund_call" || Boolean(p.fundingCallId))
    );
    setProposals(mine);
    const linked = mine.find((p) => String(p.fundingCallId) === String(c.id));
    if (linked) setSelectedProposalId(linked.id);
  }, [accessToken, callId, user?.id]);

  const { loading, error, setError } = useModuleLoad(accessToken, load, [callId]);

  useEffect(() => {
    if (!loading && !callId) setError("Funding call is required. Open an open call from Funding Calls.");
  }, [loading, callId, setError]);

  const selectedProposal = useMemo(
    () => proposals.find((p) => String(p.id) === String(selectedProposalId)),
    [proposals, selectedProposalId]
  );

  const canSubmitGrant = selectedProposal?.status === "approved";

  async function handleCreateGrant() {
    if (!call || !selectedProposalId) {
      setError("Select a research proposal before saving the grant application.");
      return;
    }
    const unmet = requirementChecklist.filter((r) => !r.met);
    if (unmet.length) {
      setError(`Complete all funding call requirements (${unmet.length} remaining).`);
      setStep(3);
      return;
    }
    const lines = budgetRows
      .filter((r) => r.category || r.description || Number(r.amount) > 0)
      .map((r) => ({
        category: r.category,
        description: r.description,
        amount: Number(r.amount) || 0,
        currency: r.currency || form.currency || "USD",
      }));
    const total = budgetRowsTotal(budgetRows);
    if (total <= 0) {
      setError("Add at least one budget line with an amount.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await grantApi.createGrant(accessToken, {
        title: form.title.trim(),
        callId: call.id,
        proposalId: selectedProposalId,
        donorRef: form.donorRef,
        currency: form.currency,
        amountRequested: total,
        budgetBreakdown: lines,
        requirementChecklist,
      });
      setMessage("Grant application saved as draft.");
      navigate(`/grants/${res.grant?.id || ""}`, { replace: true });
    } catch (e) {
      setError(e?.response?.data?.message || "Could not save grant application.");
    } finally {
      setBusy(false);
    }
  }

  if (!callId) {
    return (
      <div className="grantApplyPage">
        <PageHeader title="Apply to funding call" subtitle="Select an open call from Funding Calls first." />
        <Link className="btn primary" to="/funding-calls">Go to Funding Calls</Link>
      </div>
    );
  }

  return (
    <div className="grantApplyPage">
      <PageHeader
        title="Apply to funding call"
        subtitle="Follow the research proposal workflow and meet all call requirements before grant submission."
        actions={<Link className="btn" to="/funding-calls">← Funding Calls</Link>}
      />

      <div className="grantApplySteps" aria-label="Application steps">
        {STEPS.map((s) => (
          <span
            key={s.id}
            className={[
              "grantApplyStep",
              step === s.id ? "grantApplyStepActive" : "",
              step > s.id ? "grantApplyStepDone" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {s.id}. {s.label}
          </span>
        ))}
      </div>

      {message ? <div className="fundingCallsBanner fundingCallsBannerOk">{message}</div> : null}
      {error ? <div className="fundingCallsBanner fundingCallsBannerErr">{error}</div> : null}
      {loading ? <p className="muted">Loading call…</p> : null}

      {call && step === 1 ? (
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 16 }}>{call.title}</div>
          <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
            {call.fundingSource} · {call.callType === "external" ? "External grant" : "Internal seed grant"}
            {call.deadline ? ` · Deadline ${new Date(call.deadline).toLocaleDateString()}` : ""}
          </p>
          {call.description ? <p style={{ marginTop: 12, lineHeight: 1.55 }}>{call.description}</p> : null}

          <div style={{ marginTop: 16, padding: 14, borderRadius: 12, border: "1px solid rgba(56,189,248,0.25)", background: "rgba(14,165,233,0.08)" }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Application path (proposal workflow)</div>
            <ol className="grantApplyWorkflow">
              <li>Create or select your <strong>research proposal</strong> (title, abstract, ethics if required).</li>
              <li>Submit proposal → coordinator review → director approval.</li>
              <li>Confirm every <strong>required document</strong> listed on this funding call.</li>
              <li>Complete grant <strong>budget</strong> and save draft; submit grant only after proposal is <strong>approved</strong>.</li>
            </ol>
          </div>

          {parseRequirements(call.requiredDocuments).length ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Required documents (preview)</div>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
                {parseRequirements(call.requiredDocuments).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="fundingCallFormActions">
            <button type="button" className="btn primary" onClick={() => setStep(2)}>
              Continue — link proposal
            </button>
          </div>
        </div>
      ) : null}

      {call && step === 2 ? (
        <div className="card">
          <div style={{ fontWeight: 800 }}>Step 2 — Research proposal</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Grant applications must be tied to a proposal. You can use an existing proposal or start a new one for this call.
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {proposals.map((p) => (
              <button
                key={p.id}
                type="button"
                className={[
                  "grantApplyProposalCard",
                  String(selectedProposalId) === String(p.id) ? "grantApplyProposalCardSelected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setSelectedProposalId(p.id)}
              >
                <div style={{ fontWeight: 800 }}>{p.title}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Status: <strong>{proposalStatusLabel(p.status)}</strong>
                  {p.ethicsStatus ? ` · Ethics: ${p.ethicsStatus}` : ""}
                  {p.fundingCallId && String(p.fundingCallId) === String(call.id) ? " · Linked to this call" : ""}
                </div>
                {p.status !== "approved" ? (
                  <div style={{ fontSize: 12, marginTop: 6, color: "#fcd34d" }}>
                    Complete proposal workflow before final grant submission.
                  </div>
                ) : null}
              </button>
            ))}
            {proposals.length === 0 ? (
              <p className="muted">
                No grant proposals for this call yet. Create one here only — voluntary proposals from Proposals menu cannot be used.
              </p>
            ) : null}
          </div>

          <div className="fundingCallFormActions">
            <Link className="btn primary" to={`/proposals/new?callId=${call.id}`}>
              + New Grant Fund Call proposal
            </Link>
            {selectedProposalId ? (
              <Link className="btn" to={`/proposals/${selectedProposalId}/edit`}>
                Open proposal workflow
              </Link>
            ) : null}
            <button type="button" className="btn" onClick={() => setStep(1)}>Back</button>
            <button
              type="button"
              className="btn primary"
              disabled={!selectedProposalId}
              onClick={() => setStep(3)}
            >
              Continue — requirements
            </button>
          </div>
        </div>
      ) : null}

      {call && step === 3 ? (
        <div className="card">
          <div style={{ fontWeight: 800 }}>Step 3 — Funding call requirements</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Confirm each item required by the Research Office for this call. Grant submission is blocked until all are checked.
          </p>

          {requirementChecklist.length === 0 ? (
            <p className="muted" style={{ marginTop: 12 }}>No specific document list on this call — you may continue.</p>
          ) : (
            <div className="grantApplyReqList">
              {requirementChecklist.map((item, idx) => (
                <label key={item.label} className="grantApplyReqItem">
                  <input
                    type="checkbox"
                    checked={item.met}
                    onChange={(e) => {
                      const next = [...requirementChecklist];
                      next[idx] = { ...next[idx], met: e.target.checked };
                      setRequirementChecklist(next);
                    }}
                  />
                  <span>
                    <div style={{ fontWeight: 700 }}>{item.label}</div>
                    <input
                      type="text"
                      placeholder="Optional note (file name, reference)"
                      value={item.note}
                      onChange={(e) => {
                        const next = [...requirementChecklist];
                        next[idx] = { ...next[idx], note: e.target.value };
                        setRequirementChecklist(next);
                      }}
                      style={{ marginTop: 6, width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid var(--rms-border)", background: "rgba(0,0,0,0.2)", color: "inherit" }}
                    />
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="fundingCallFormActions">
            <button type="button" className="btn" onClick={() => setStep(2)}>Back</button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                const unmet = requirementChecklist.filter((r) => !r.met);
                if (unmet.length) {
                  setError(`Check all requirements (${unmet.length} remaining).`);
                  return;
                }
                setError("");
                setStep(4);
              }}
            >
              Continue — budget
            </button>
          </div>
        </div>
      ) : null}

      {call && step === 4 ? (
        <div className="card">
          <div style={{ fontWeight: 800 }}>Step 4 — Budget & save draft</div>
          {selectedProposal ? (
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              Proposal: <strong>{selectedProposal.title}</strong> ({proposalStatusLabel(selectedProposal.status)})
              {!canSubmitGrant ? (
                <span style={{ color: "#fcd34d" }}> — approve proposal before submitting grant to director.</span>
              ) : (
                <span style={{ color: "#86efac" }}> — ready for grant submission after save.</span>
              )}
            </p>
          ) : null}

          <div className="row" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Application title</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="field">
              <label>Currency</label>
              <input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
            </div>
          </div>

          <GrantBudgetLines budgetRows={budgetRows} setBudgetRows={setBudgetRows} currency={form.currency} />

          <div className="fundingCallFormActions">
            <button type="button" className="btn" onClick={() => setStep(3)}>Back</button>
            <button type="button" className="btn primary" disabled={busy} onClick={handleCreateGrant}>
              {busy ? "Saving…" : "Save grant draft"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
