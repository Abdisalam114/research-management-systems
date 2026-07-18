import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function sameId(a, b) {
  return String(a?._id || a?.id || a || "") === String(b?._id || b?.id || b || "");
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
  const [form, setForm] = useState({ donorRef: "", currency: "USD" });
  const [budgetRows, setBudgetRows] = useState(defaultBudgetRows);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const budgetInitRef = useRef(false);

  const syncProposalsForCall = useCallback(
    async (c) => {
      const propRes = await proposalApi.listProposals(accessToken);
      const mine = (propRes.proposals || []).filter(
        (p) =>
          sameId(p.researcherId, user?.id) &&
          sameId(p.fundingCallId, c.id) &&
          (p.proposalKind === "grant_fund_call" || Boolean(p.fundingCallId))
      );
      setProposals(mine);
      setSelectedProposalId((prev) => {
        if (prev && mine.some((p) => sameId(p.id, prev))) return prev;
        return mine[0]?.id || "";
      });
      return mine;
    },
    [accessToken, user?.id]
  );

  const load = useCallback(async () => {
    if (!callId) return;
    const callRes = await fundingCallApi.getFundingCall(accessToken, callId);
    const c = callRes.call;
    setCall(c);
    setForm({
      donorRef: c.donorRef || "",
      currency: c.currency || "USD",
    });
    if (!budgetInitRef.current) {
      setBudgetRows(defaultBudgetRows().map((r) => ({ ...r, currency: c.currency || "USD" })));
      budgetInitRef.current = true;
    }
    const reqs = parseRequirements(c.requiredDocuments);
    setRequirementChecklist((prev) => {
      if (prev.length && prev.every((item) => reqs.includes(item.label))) return prev;
      return reqs.map((label) => {
        const old = prev.find((x) => x.label === label);
        return { label, met: Boolean(old?.met), note: old?.note || "" };
      });
    });
    await syncProposalsForCall(c);
  }, [accessToken, callId, syncProposalsForCall]);

  const { loading, error, setError } = useModuleLoad(accessToken, load, [callId]);

  useEffect(() => {
    if (!loading && !callId) setError("Funding call is required. Open an open call from Funding Calls.");
  }, [loading, callId, setError]);

  // Refresh proposal list when entering step 2 (after creating a new proposal).
  useEffect(() => {
    if (step !== 2 || !call) return;
    syncProposalsForCall(call).catch(() => {});
  }, [step, call, syncProposalsForCall]);

  const selectedProposal = useMemo(
    () => proposals.find((p) => sameId(p.id, selectedProposalId)),
    [proposals, selectedProposalId]
  );

  const canSubmitGrant = selectedProposal?.status === "approved";
  // Grant application title = funding call title (automatic). Proposal title stays on the proposal.
  const autoTitle = String(call?.title || "").trim();
  const proposalTitle = String(selectedProposal?.title || "").trim();
  const applicantName =
    selectedProposal?.researcherName || user?.fullName || user?.email || "Current researcher";

  async function handleCreateGrant() {
    if (!call || !selectedProposalId) {
      setError("Select a research proposal before saving the grant application.");
      setStep(2);
      return;
    }
    if (!autoTitle) {
      setError("This funding call has no title. Ask Research Office / donor to set the call title.");
      return;
    }
    if (!proposalTitle) {
      setError("Proposal research title is missing — open the proposal and set it first.");
      setStep(2);
      return;
    }
    const unmet = requirementChecklist.filter((r) => !r.met);
    if (unmet.length) {
      setError(`Complete all funding call requirements (${unmet.length} remaining).`);
      setStep(3);
      return;
    }
    const currency = form.currency || call.currency || "USD";
    const lines = budgetRows
      .filter((r) => r.category || r.description || Number(r.amount) > 0)
      .map((r) => ({
        category: r.category,
        description: r.description,
        amount: Number(r.amount) || 0,
        currency: r.currency || currency,
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
        // Backend also forces proposal.title — send it for clarity.
        title: autoTitle,
        callId: call.id,
        proposalId: selectedProposalId,
        donorRef: form.donorRef || call.donorRef || "",
        currency,
        amountRequested: total,
        budgetBreakdown: lines,
        requirementChecklist,
      });
      // #region agent log
      fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
        body: JSON.stringify({
          sessionId: "f558f7",
          runId: "visibility",
          hypothesisId: "A",
          location: "GrantApplyPage.jsx:create",
          message: "grant draft saved — check callId for Grants list visibility",
          data: {
            grantId: res.grant?.id || null,
            callIdSent: call?.id || null,
            callIdOnGrant: res.grant?.callId || null,
            status: res.grant?.status || null,
            title: res.grant?.title || null,
            navigateTo: res.grant?.id ? `/grants/${res.grant.id}` : "/grants",
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      const grantId = res.grant?.id;
      if (!grantId) {
        setError("Grant saved but id missing — open Grants list.");
        navigate("/grants", { replace: true });
        return;
      }
      setMessage("Grant application saved as draft. Find it under Grants or Funding Calls.");
      navigate(`/grants/${grantId}`, { replace: true });
    } catch (e) {
      // #region agent log
      fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
        body: JSON.stringify({
          sessionId: "f558f7",
          runId: "visibility",
          hypothesisId: "D",
          location: "GrantApplyPage.jsx:createError",
          message: "grant create failed",
          data: { err: e?.response?.data?.message || String(e?.message || e) },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
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

          <div
            className="card"
            style={{
              marginTop: 12,
              padding: 12,
              borderColor: autoTitle ? "rgba(56,189,248,0.35)" : "rgba(248,113,113,0.45)",
              background: autoTitle ? "rgba(14,165,233,0.08)" : "rgba(248,113,113,0.08)",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Auto-filled (read-only)</div>
            <div className="muted" style={{ fontSize: 13, display: "grid", gap: 6 }}>
              <div>
                Grant / funding call title:{" "}
                <strong style={{ color: "inherit" }}>{autoTitle || "— funding call has no title —"}</strong>
              </div>
              <div>
                Research proposal:{" "}
                <strong style={{ color: "inherit" }}>{proposalTitle || "— missing —"}</strong>
              </div>
              <div>
                Researcher / applicant: <strong style={{ color: "inherit" }}>{applicantName}</strong>
                {user?.department ? ` · ${user.department}` : ""}
              </div>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              Grant title is taken from the funding call. Researcher is your login. Proposal keeps its own research title.
            </p>
            {!proposalTitle && selectedProposalId ? (
              <Link className="btn" style={{ marginTop: 10 }} to={`/proposals/${selectedProposalId}/edit`}>
                Open proposal — set research title
              </Link>
            ) : null}
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Currency</label>
              <input
                value={form.currency || "USD"}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value || "USD" }))}
              />
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
