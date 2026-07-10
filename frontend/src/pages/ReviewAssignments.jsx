import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as proposalApi from "../services/proposalApi";
import { PageHeader } from "../components/PageHeader";

export function ReviewAssignmentsPage() {
  const { accessToken } = useAuth();
  const [assignments, setAssignments] = useState([]);

  const load = useCallback(async () => {
    const res = await proposalApi.listMyReviewAssignments(accessToken);
    setAssignments(res.assignments || []);
  }, [accessToken]);

  const { loading, error } = useModuleLoad(accessToken, load, []);

  return (
    <div className="pageStack">
      <PageHeader title="My review assignments" subtitle="Peer review portal (Phase 3)" />
      {error ? <div className="bannerErr">{error}</div> : null}
      {loading ? <p>Loading...</p> : null}
      <div className="cardList">
        {assignments.map((a) => (
          <article key={a.id} className="card panel">
            <h3 style={{ margin: 0 }}>{a.title}</h3>
            <p className="muted">{a.department} · Stage: {a.currentReviewStage}</p>
            <p>{a.peerReviewSubmitted ? "Peer review submitted" : "Peer review pending"}</p>
            <Link to={`/proposals/${a.id}/review`}>Open review</Link>
          </article>
        ))}
        {!loading && assignments.length === 0 ? <p className="muted">No assignments.</p> : null}
      </div>
    </div>
  );
}
