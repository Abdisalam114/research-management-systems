import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as proposalApi from "../services/proposalApi";
import { EthicsApplicationForm } from "../components/EthicsApplicationForm";
import { EthicsBrandingHeader } from "../components/EthicsBrandingHeader";
import { AppButton } from "../components/AppButton";
import { SubmitValidationAlert } from "../components/SubmitValidationAlert";
import {
  buildEthicsFromProposalAndUser,
  ethicsApplicationToForm,
  prepareEthicsPayload,
  syncEthicsFromProposal,
} from "../utils/ethicsFormState";
import { isEthicsFormComplete } from "../utils/ethicsForm";
import { useProgramTier } from "../hooks/useProgramTier";
import { ProposalApplicationExtras, defaultBudgetRows } from "../components/ProposalApplicationExtras";
import {
  collectSubmitValidationIssues,
  SUBMIT_SUCCESS_MESSAGE,
} from "../utils/proposalSubmitValidation";

export function ProposalFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const { programTier } = useProgramTier();

  const [proposal, setProposal] = useState({
    title: "",
    abstract: "",
    department: user?.department || "",
    researchArea: "",
    document: null,
    requiresEthics: true,
  });
  const [ethicsForm, setEthicsForm] = useState(() => buildEthicsFromProposalAndUser({}, user, programTier));
  const [loaded, setLoaded] = useState(!isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [validationIssues, setValidationIssues] = useState([]);
  const [draftSaved, setDraftSaved] = useState(false);
  const [savedId, setSavedId] = useState(id || null);
  const [status, setStatus] = useState("draft");
  const [budgetRows, setBudgetRows] = useState(defaultBudgetRows);
  const [complianceDocs, setComplianceDocs] = useState([]);
  const [supportingDocs, setSupportingDocs] = useState([]);

  const formComplete = useMemo(() => isEthicsFormComplete(ethicsForm), [ethicsForm]);
  const readOnly = !["draft", "revision_requested"].includes(status);

  const heading = useMemo(
    () => (isEdit ? "Edit Proposal + Ethics" : "New Proposal + Ethics Form"),
    [isEdit]
  );

  useEffect(() => {
    if (!isEdit || !accessToken || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ proposal: p }, ethicsRes] = await Promise.all([
          proposalApi.getProposal(accessToken, id),
          proposalApi.getProposalEthicsApplication(accessToken, id),
        ]);
        if (cancelled) return;
        setProposal({
          title: p.title || "",
          abstract: p.abstract || "",
          department: p.department || "",
          researchArea: p.researchArea || "",
          document: null,
          requiresEthics: p.requiresEthics !== false,
        });
        setEthicsForm(
          ethicsRes.application
            ? ethicsApplicationToForm(ethicsRes.application)
            : buildEthicsFromProposalAndUser(p, user, programTier)
        );
        setSavedId(p.id);
        setStatus(p.status);
        if (p.budgetBreakdown?.length) {
          setBudgetRows(p.budgetBreakdown.map((r) => ({
            category: r.category || "",
            description: r.description || "",
            amount: r.amount ?? "",
            currency: r.currency || "USD",
          })));
        }
        setComplianceDocs((p.complianceDocuments || []).map((d) => ({
          docType: d.docType || "data_protection",
          label: d.label || "",
          file: null,
          existingPath: d.filePath,
        })));
        setSupportingDocs((p.supportingDocuments || []).map((d) => ({
          docType: d.docType || "other",
          label: d.label || "",
          file: null,
          existingPath: d.filePath,
        })));
        setLoaded(true);
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || "Load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, accessToken, id, user, programTier]);

  const syncFromProposal = useCallback(() => {
    setEthicsForm((prev) => syncEthicsFromProposal(prev, proposal, user, programTier));
  }, [proposal, user, programTier]);

  useEffect(() => {
    if (!loaded && isEdit) return;
    syncFromProposal();
  }, [proposal.title, proposal.abstract, proposal.department, loaded, isEdit, syncFromProposal]);

  const buildPayload = useCallback(() => {
    const base = {
      title: proposal.title,
      abstract: proposal.abstract,
      department: proposal.department,
      researchArea: proposal.researchArea,
      requiresEthics: proposal.requiresEthics,
      budgetBreakdown: budgetRows
        .filter((r) => r.category || r.description || Number(r.amount) > 0)
        .map((r) => ({
          category: r.category,
          description: r.description,
          amount: Number(r.amount) || 0,
          currency: r.currency || "USD",
        })),
      complianceMeta: complianceDocs.map((d) => ({
        docType: d.docType,
        label: d.label || d.docType,
        filePath: d.existingPath || null,
      })),
      supportingMeta: supportingDocs.map((d) => ({
        docType: d.docType,
        label: d.label || d.docType,
        filePath: d.existingPath || null,
      })),
      complianceFiles: complianceDocs.map((d) => d.file).filter(Boolean),
      supportingFiles: supportingDocs.map((d) => d.file).filter(Boolean),
    };
    if (proposal.document instanceof File) base.document = proposal.document;
    if (proposal.requiresEthics) {
      base.ethics = prepareEthicsPayload(ethicsForm);
    }
    return base;
  }, [proposal, ethicsForm, budgetRows, complianceDocs, supportingDocs]);

  const saveDraft = async () => {
    setBusy(true);
    setError("");
    setValidationIssues([]);
    try {
      const payload = buildPayload();
      let res;
      if (savedId) {
        res = await proposalApi.updateProposal(accessToken, savedId, payload);
      } else {
        res = await proposalApi.createProposal(accessToken, payload);
        const newId = res.proposal.id;
        setSavedId(newId);
        if (!isEdit) {
          navigate(`/proposals/${newId}/edit`, { replace: true });
        }
      }
      setStatus(res.proposal.status);
      setDraftSaved(true);
return res.proposal;
    } catch (e) {
      setError(e?.response?.data?.message || "Save failed");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const submitToDirector = async () => {
    setValidationIssues([]);
    setError("");
    setDraftSaved(false);

    const issues = collectSubmitValidationIssues(proposal, ethicsForm, proposal.requiresEthics);
    if (issues.length > 0) {
      setValidationIssues(issues);
requestAnimationFrame(() => {
        document.getElementById("validation-errors")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    const p = await saveDraft();
    if (!p) return;
    const pid = p.id || savedId;
    if (!pid) return;

    setBusy(true);
    setError("");
    try {
      await proposalApi.submitProposal(accessToken, pid);
      navigate(`/proposals/${pid}?submitted=1`, {
        replace: true,
        state: { submitSuccess: true, message: SUBMIT_SUCCESS_MESSAGE },
      });
    } catch (e) {
      const msg = e?.response?.data?.message || "Submission failed";
      setError(msg);
      if (/ethics|complete|signature|design|aims/i.test(msg)) {
        setValidationIssues(collectSubmitValidationIssues(proposal, ethicsForm, proposal.requiresEthics));
      }
    } finally {
      setBusy(false);
    }
  };

  if (isEdit && !loaded) {
    return (
      <div>
        <h2 style={{ marginTop: 0 }}>{heading}</h2>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{heading}</h2>
      <p className="muted" style={{ marginTop: 0, maxWidth: 720 }}>
        One page: complete the proposal and ethics form. Your name, email, title, abstract, and department are filled in automatically.
        When ready, one button submits both to the Director.
      </p>

      <SubmitValidationAlert issues={validationIssues} />

      {draftSaved && !validationIssues.length ? (
        <div
          className="card"
          style={{
            marginTop: 12,
            borderColor: "rgba(56, 189, 248, 0.45)",
            background: "rgba(56, 189, 248, 0.08)",
            fontSize: 14,
          }}
        >
          ✓ Draft saved. When ready, click <strong>Submit to Director</strong>.
        </div>
      ) : null}

      {error ? (
        <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)", marginTop: 12 }}>
          {error}
        </div>
      ) : null}

      {savedId ? (
        <p className="muted" style={{ fontSize: 13 }}>
          <Link to={`/proposals/${savedId}`}>← View proposal</Link>
        </p>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>1. Proposal</div>
        <div className="field">
          <label>Title *</label>
          <input
            disabled={readOnly}
            value={proposal.title}
            onChange={(e) => setProposal({ ...proposal, title: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Abstract *</label>
          <textarea
            rows={3}
            disabled={readOnly}
            value={proposal.abstract}
            onChange={(e) => setProposal({ ...proposal, abstract: e.target.value })}
          />
        </div>
        <div className="row">
          <div className="field">
            <label>Department *</label>
            <input
              disabled={readOnly}
              value={proposal.department}
              onChange={(e) => setProposal({ ...proposal, department: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Research area *</label>
            <input
              disabled={readOnly}
              value={proposal.researchArea}
              onChange={(e) => setProposal({ ...proposal, researchArea: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label>Document (PDF/DOC — optional)</label>
          <input
            type="file"
            disabled={readOnly}
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setProposal({ ...proposal, document: e.target.files?.[0] || null })}
          />
        </div>
      </div>

      <ProposalApplicationExtras
        readOnly={readOnly}
        budgetRows={budgetRows}
        setBudgetRows={setBudgetRows}
        complianceDocs={complianceDocs}
        setComplianceDocs={setComplianceDocs}
        supportingDocs={supportingDocs}
        setSupportingDocs={setSupportingDocs}
      />

      {proposal.requiresEthics ? (
        <div className="card" style={{ marginTop: 16, border: "1px solid rgba(56,189,248,0.3)" }}>
          <EthicsBrandingHeader />
          <div style={{ fontWeight: 800, marginBottom: 8 }}>2. Ethics Form (REC)</div>
          <EthicsApplicationForm
            form={ethicsForm}
            setForm={setEthicsForm}
            readOnly={readOnly}
            formComplete={formComplete}
            embeddedInProposal
            autoFillHint={!readOnly}
          />
        </div>
      ) : null}

      {!readOnly ? (
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <AppButton disabled={busy} loading={busy} onClick={saveDraft}>
            💾 Save draft
          </AppButton>
          <AppButton variant="primary" disabled={busy} loading={busy} onClick={submitToDirector}>
            📤 Submit to Director (Proposal + Ethics)
          </AppButton>
          {!formComplete ? (
            <span className="muted" style={{ fontSize: 13, alignSelf: "center" }}>
              If you submit with missing fields, you will see a list of what to complete.
            </span>
          ) : null}
        </div>
      ) : (
        <div className="muted" style={{ marginTop: 16 }}>
          This proposal cannot be edited in its current status ({status}).
        </div>
      )}
    </div>
  );
}
