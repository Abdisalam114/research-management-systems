import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as proposalApi from "../services/proposalApi";
import { PageHeader } from "../components/PageHeader";

export function ReviewAssignmentsPage() {
  const { accessToken, user } = useAuth();
  const location = useLocation();
  const [assignments, setAssignments] = useState([]);

  const load = useCallback(async () => {
    const res = await proposalApi.listMyReviewAssignments(accessToken);
    const list = res.assignments || [];
    setAssignments(list);
    // #region agent log
    fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
      body: JSON.stringify({
        sessionId: "f558f7",
        runId: "peer-assign",
        hypothesisId: "PA3",
        location: "ReviewAssignments.jsx:load",
        message: "assignments loaded in UI",
        data: { role: user?.role, count: list.length, pending: list.filter((a) => !a.peerReviewSubmitted).length },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [accessToken, user?.role]);

  const { loading, error, reload } = useModuleLoad(accessToken, load, [location.pathname]);

  useEffect(() => {
    function onFocus() {
      if (accessToken) reload();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [accessToken, reload]);

  const pending = assignments.filter((a) => !a.peerReviewSubmitted);

  return (
    <div className="pageStack">
      <PageHeader
        title="Peer Reviews"
        subtitle={
          user?.role === "leadership"
            ? "Proposals the Research Director assigned to you — submit score (1–5) and comments."
            : "Proposals you are assigned to peer-review."
        }
        stats={[
          { label: "Assigned", value: assignments.length, filterKey: "all" },
          { label: "Pending review", value: pending.length, filterKey: "pending", accent: "#fbbf24" },
          { label: "Submitted", value: assignments.length - pending.length, filterKey: "done", accent: "#22c55e" },
        ]}
      />
      {error ? <div className="bannerErr">{error}</div> : null}
      {loading ? <p>Loading...</p> : null}
      <div className="cardList">
        {assignments.map((a) => (
          <article key={a.id} className="card panel">
            <h3 style={{ margin: 0 }}>{a.title}</h3>
            <p className="muted">
              {a.department} · Status: {a.status} · Stage: {a.currentReviewStage}
            </p>
            <p style={{ fontWeight: 600, color: a.peerReviewSubmitted ? "#22c55e" : "#fbbf24" }}>
              {a.peerReviewSubmitted ? "✓ Peer review submitted" : "⏳ Peer review pending — action required"}
            </p>
            <Link className="btn primary" to={`/proposals/${a.id}/review`} style={{ marginTop: 8, display: "inline-block" }}>
              {a.peerReviewSubmitted ? "View review" : "Open & submit review"}
            </Link>
          </article>
        ))}
        {!loading && assignments.length === 0 ? (
          <div className="card" style={{ padding: 20, textAlign: "center" }}>
            <div style={{ fontWeight: 800 }}>No peer review assignments</div>
            <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
              {user?.role === "leadership"
                ? "When the Research Director assigns you on a proposal, it will appear here. Use the same portal tier (Undergraduate / Postgraduate) as the proposal."
                : "You will see proposals here only after the Research Director assigns you as a reviewer."}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
