import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as ethicsApi from "../services/ethicsApi";
import * as proposalApi from "../services/proposalApi";
import { PageHeader } from "../components/PageHeader";
import { EthicsBrandingHeader } from "../components/EthicsBrandingHeader";
import { EthicsApplicationForm } from "../components/EthicsApplicationForm";
import { EthicsDirectorDecisionModal } from "../components/EthicsDirectorDecisionModal";
import { AppButton } from "../components/AppButton";
import { SubmitValidationAlert } from "../components/SubmitValidationAlert";
import { isEthicsFormComplete } from "../utils/ethicsForm";
import { ethicsApplicationToForm, emptyEthicsForm } from "../utils/ethicsFormState";
import { buildStatusFilterStats, filterByStatKey, statFilterLabel } from "../utils/pageHeaderFilters";

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

const emptyForm = emptyEthicsForm;
const toForm = ethicsApplicationToForm;

export function EthicsPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const proposalIdFromUrl = searchParams.get("proposalId");
  const isResearcher = user?.role === "researcher";
  const isDirector = user?.role === "research_director";
  const isStaff = ["research_director", "faculty_coordinator"].includes(user?.role);

  const [applications, setApplications] = useState([]);
  const [editing, setEditing] = useState(null); // {id, form, status, proposalId?}
  const [validationIssues, setValidationIssues] = useState([]);
  const [infoMsg, setInfoMsg] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [decisionModal, setDecisionModal] = useState(null); // { app, mode: approve|reject }
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [pendingEditorScroll, setPendingEditorScroll] = useState(false);
  const [statusFilter, setStatusFilter] = useUrlStatFilter("all");
  const proposalLoadedRef = useRef(false);
  const editorRef = useRef(null);
  const autoOpenedRef = useRef(false);
  const applicationIdFromUrl = searchParams.get("applicationId");
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
      { label: "Total", value: applications.length, filterKey: "all" },
      { label: "Draft", value: by("draft"), filterKey: "draft" },
      { label: "Submitted", value: by("submitted"), filterKey: "submitted", accent: "#38bdf8" },
      { label: "Approved", value: by("approved"), filterKey: "approved", accent: "#1d4ed8" },
      { label: "Rejected", value: by("rejected"), filterKey: "rejected" },
    ];
  }, [applications]);

  const filteredApplications = useMemo(
    () => filterByStatKey(applications, statusFilter),
    [applications, statusFilter]
  );

  const directorQueue = applications.filter((a) => a.status === "submitted");
  const showDirectorQueue =
    isDirector && directorQueue.length > 0 && (statusFilter === "all" || statusFilter === "submitted");

  function openNew() {
    setValidationIssues([]);
    setInfoMsg("");
    setError("");
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
    setValidationIssues([]);
    setInfoMsg("");
    setError("");
    setEditing({
      id: a.id,
      form: toForm(a),
      approval: a.approval,
      status: a.status,
      proposalId: a.proposalId,
    });
  }

  function scrollToEditor() {
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /** Director/staff: View → proposal review if linked, otherwise scroll to form below. */
  function openViewApplication(a) {
    // #region agent log
    fetch("http://127.0.0.1:7457/ingest/e845c40a-0f0d-41d9-883a-67cbc157bfa2", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6113cc" },
      body: JSON.stringify({
        sessionId: "6113cc",
        location: "Ethics.jsx:openViewApplication",
        message: "director/staff view ethics",
        data: {
          appId: a.id,
          proposalId: a.proposalId || null,
          status: a.status,
          isDirector,
          willNavigateToProposal: Boolean(isDirector && a.proposalId),
        },
        timestamp: Date.now(),
        hypothesisId: "H-director-eeg-nav",
        runId: "director-eeg",
      }),
    }).catch(() => {});
    // #endregion

    if (isDirector && a.proposalId) {
      navigate(`/proposals/${a.proposalId}/review`);
      return;
    }
    openEdit(a);
    setPendingEditorScroll(true);
  }

  function closeEditor() {
    setEditing(null);
    setValidationIssues([]);
  }

  async function save(submit = false) {
    if (!editing) return;
    setSaveBusy(true);
    try {
      setError("");
      setValidationIssues([]);
      setInfoMsg("");
      const linkedProposalId = editing.proposalId || proposalIdFromUrl;

      if (submit) {
        const missing = getEthicsMissingFields(editing.form);
        if (missing.length) {
          setValidationIssues(missing);
          document.getElementById("ethics-validation-errors")?.scrollIntoView({ behavior: "smooth" });
          return;
        }
        if (linkedProposalId) {
          await save(false);
          navigate(`/proposals/${linkedProposalId}/edit`);
          setInfoMsg("Form saved. On the proposal page, click «Submit to Director».");
          return;
        }
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
      if (!submit) {
        setInfoMsg(linkedProposalId ? "Draft saved." : "Draft saved.");
      } else {
        setInfoMsg("Submitted to REC — await the Director's response.");
        closeEditor();
      }
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
    } finally {
      setSaveBusy(false);
    }
  }

  function openDecideModal(a, mode) {
    setDecisionModal({ app: a, mode });
  }

  async function confirmDirectorDecision(payload) {
    if (!decisionModal?.app) return;
    setDecisionBusy(true);
    setError("");
    try {
      await ethicsApi.directorDecision(accessToken, decisionModal.app.id, payload);
      setDecisionModal(null);
      await reload();
      if (editing?.id === decisionModal.app.id) {
        const res = await ethicsApi.getEthicsApplication(accessToken, editing.id);
        if (res.application) {
          setEditing({
            id: res.application.id,
            form: toForm(res.application),
            approval: res.application.approval,
            status: res.application.status,
            proposalId: res.application.proposalId,
          });
        }
      }
      setInfoMsg(payload.decision === "approve" ? "Approved — certificate is ready." : "Rejected.");
    } catch (e) {
      setError(e?.response?.data?.message || "Decision failed");
    } finally {
      setDecisionBusy(false);
    }
  }

  async function downloadCert(a) {
    try {
      const blob = await ethicsApi.downloadCertificate(accessToken, a.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `JUREC-certificate-${a.approval?.refNumber || a.approval?.certificateNumber || a.id}.pdf`.replace(
        /[^\w.-]+/g,
        "-"
      );
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.message || "Failed to download certificate");
    }
  }

  useEffect(() => {
    if (!pendingEditorScroll || !editing) return;
    setPendingEditorScroll(false);
    scrollToEditor();
  }, [pendingEditorScroll, editing]);

  useEffect(() => {
    if (!applicationIdFromUrl || !applications.length || autoOpenedRef.current) return;
    const app = applications.find((a) => String(a.id) === String(applicationIdFromUrl));
    if (!app) return;
    autoOpenedRef.current = true;
    openViewApplication(app);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationIdFromUrl, applications]);

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
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          isResearcher ? (
            <AppButton variant="primary" onClick={openNew}>
              📝 New ethics application
            </AppButton>
          ) : null
        }
      />

      {loading ? <p className="muted">Loading…</p> : null}
      {error ? <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginTop: 8 }}>{error}</div> : null}
      {infoMsg ? (
        <div className="card" style={{ marginTop: 8, borderColor: "rgba(34,197,94,0.45)", background: "rgba(34,197,94,0.08)" }}>
          {infoMsg}
        </div>
      ) : null}

      <SubmitValidationAlert issues={validationIssues} id="ethics-validation-errors" />

      {statusFilter !== "all" ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Showing: <strong>{statFilterLabel(stats, statusFilter)}</strong> ({filteredApplications.length})
        </p>
      ) : null}

      {proposalIdFromUrl ? (
        <div className="card" style={{ marginTop: 12, borderColor: "rgba(56,189,248,0.35)" }}>
          <div style={{ fontWeight: 700 }}>Ethics — linked proposal</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Save a draft here. Submitting to the Director happens on the proposal page (one button).
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <Link className="btn primary" to={`/proposals/${proposalIdFromUrl}/edit`}>
              Edit & submit proposal
            </Link>
            <Link className="btn" to={`/proposals/${proposalIdFromUrl}`}>
              View proposal
            </Link>
          </div>
        </div>
      ) : null}

      {showDirectorQueue ? (
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
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <AppButton onClick={() => openViewApplication(a)}>View</AppButton>
                  <AppButton variant="primary" onClick={() => openDecideModal(a, "approve")}>
                    Approve & certificate
                  </AppButton>
                  <AppButton onClick={() => openDecideModal(a, "reject")}>Reject</AppButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800 }}>Applications</div>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {filteredApplications.map((a) => (
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
                  {(isResearcher && ["draft", "rejected"].includes(a.status)) || isStaff ? (
                    <AppButton onClick={() => (isStaff && !isResearcher ? openViewApplication(a) : openEdit(a))}>
                      {isResearcher && a.status !== "approved" ? "Edit" : "View"}
                    </AppButton>
                  ) : null}
                  {isDirector && a.status === "submitted" ? (
                    <>
                      <AppButton variant="primary" onClick={() => openDecideModal(a, "approve")}>
                        Approve
                      </AppButton>
                      <AppButton onClick={() => openDecideModal(a, "reject")}>Reject</AppButton>
                    </>
                  ) : null}
                  {a.proposalId && isResearcher ? (
                    <Link className="btn" to={`/proposals/${a.proposalId}/edit`}>
                      Proposal
                    </Link>
                  ) : null}
                  {a.status === "approved" ? (
                    <AppButton variant="primary" onClick={() => downloadCert(a)}>
                      📄 Download certificate
                    </AppButton>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {filteredApplications.length === 0 ? (
            <div className="muted">
              {applications.length === 0 ? "No applications yet." : "No applications match this filter."}
            </div>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div id="ethics-editor-panel" ref={editorRef}>
        <EthicsEditor
          editing={editing}
          setEditing={setEditing}
          onSave={() => save(false)}
          onSubmit={() => save(true)}
          onClose={closeEditor}
          readOnly={
            isResearcher
              ? ["approved", "submitted"].includes(editing.status)
              : true
          }
          isDirector={isDirector}
          onDirectorApprove={() =>
            setDecisionModal({
              app: { id: editing.id, projectTitle: editing.form?.projectTitle },
              mode: "approve",
            })
          }
          onDirectorReject={() =>
            setDecisionModal({
              app: { id: editing.id, projectTitle: editing.form?.projectTitle },
              mode: "reject",
            })
          }
          decisionBusy={decisionBusy}
          saveBusy={saveBusy}
          canSubmit={isResearcher && !editing.proposalId && !proposalIdFromUrl}
          linkedToProposal={Boolean(editing.proposalId || proposalIdFromUrl)}
          linkedProposalId={editing.proposalId || proposalIdFromUrl}
          formComplete={isEthicsFormComplete(editing.form)}
          validationIssues={validationIssues}
          approval={editing.approval}
          showCertificateMeta={editing.status === "approved"}
        />
        </div>
      ) : null}

      <EthicsDirectorDecisionModal
        open={Boolean(decisionModal)}
        mode={decisionModal?.mode}
        applicationId={decisionModal?.app?.id}
        accessToken={accessToken}
        applicationTitle={decisionModal?.app?.projectTitle}
        busy={decisionBusy}
        onClose={() => !decisionBusy && setDecisionModal(null)}
        onConfirm={confirmDirectorDecision}
      />
    </div>
  );
}

function EthicsEditor({
  editing,
  setEditing,
  onSave,
  onSubmit,
  onClose,
  readOnly,
  isDirector,
  onDirectorApprove,
  onDirectorReject,
  decisionBusy,
  saveBusy,
  canSubmit,
  linkedToProposal,
  linkedProposalId,
  formComplete,
  validationIssues,
  approval,
  showCertificateMeta,
}) {
  const { form } = editing;
  const showDirectorActions = isDirector && editing.status === "submitted";

  return (
    <div className="card" style={{ marginTop: 16, border: "1px solid rgba(56,189,248,0.3)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        <AppButton onClick={onClose}>Close</AppButton>
      </div>

      <EthicsBrandingHeader approval={approval} showCertificateMeta={showCertificateMeta} status={editing.status} />

      <EthicsApplicationForm
        form={form}
        setForm={(updater) =>
          setEditing((s) => ({
            ...s,
            form: typeof updater === "function" ? updater(s.form) : updater,
          }))
        }
        readOnly={readOnly || showDirectorActions}
        formComplete={formComplete}
        embeddedInProposal={linkedToProposal}
      />

      {showDirectorActions ? (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <AppButton variant="primary" loading={decisionBusy} onClick={onDirectorApprove}>
            Approve & certificate
          </AppButton>
          <AppButton loading={decisionBusy} onClick={onDirectorReject}>
            Reject
          </AppButton>
        </div>
      ) : !readOnly ? (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <AppButton loading={saveBusy} onClick={() => {
            // #region agent log
            fetch("http://127.0.0.1:7457/ingest/e845c40a-0f0d-41d9-883a-67cbc157bfa2", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6113cc" },
              body: JSON.stringify({
                sessionId: "6113cc",
                location: "Ethics.jsx:KaydiDraft",
                message: "ethics save draft clicked",
                data: { hasId: Boolean(editing.id), linked: Boolean(linkedToProposal) },
                timestamp: Date.now(),
                hypothesisId: "H-btn-click",
                runId: "buttons-fix",
              }),
            }).catch(() => {});
            // #endregion
            onSave();
          }}>
            💾 Save draft
          </AppButton>
          {canSubmit ? (
            <AppButton variant="primary" loading={saveBusy} onClick={onSubmit}>
              📤 Submit to REC
            </AppButton>
          ) : linkedToProposal && linkedProposalId ? (
            <Link className="btn primary" to={`/proposals/${linkedProposalId}/edit`}>
              Submit proposal + ethics →
            </Link>
          ) : null}
          {!formComplete && validationIssues?.length ? (
            <span className="muted" style={{ fontSize: 13 }}>Complete the highlighted fields above.</span>
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
