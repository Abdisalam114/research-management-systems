import { Link } from "react-router-dom";

function projectPiName(p) {
  if (!p) return "—";
  if (typeof p.principalInvestigator === "string" && p.principalInvestigator.trim()) return p.principalInvestigator;
  if (p.principalInvestigator?.fullName) return p.principalInvestigator.fullName;
  if (p.principalInvestigatorName) return p.principalInvestigatorName;
  if (p.pi) return p.pi;
  return "—";
}

export function ActiveProjectsPanel({ projects, totalActive, title = "Active Projects", showPi = true, previewMeta }) {
  const list = projects || [];
  const countLabel = totalActive != null ? totalActive : list.length;
  const showingHint =
    previewMeta && previewMeta.total > previewMeta.shown
      ? `Showing ${previewMeta.shown} / ${previewMeta.total}`
      : null;

  return (
    <div className="dashCard dashSpan8 dashActiveProjectsPanel">
      <div className="dashActiveProjectsPanelHeader">
        <div>
          <div className="dashCardTitle" style={{ marginBottom: 0 }}>
            {title} ({countLabel})
          </div>
          {showingHint ? <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{showingHint}</div> : null}
        </div>
        <Link className="btn btnSm" to="/projects?filter=active">
          View all
        </Link>
      </div>
      <div className="dashActiveProjectsPanelBody">
        <table className="dashTable dashActiveProjectsTable">
          <thead>
            <tr>
              <th className="dashColId">ID</th>
              <th className="dashColTitle">Title</th>
              {showPi ? <th className="dashColPi">Principal Investigator</th> : null}
              <th className="dashColProgress">Progress</th>
              <th className="dashColStatus">Workflow / Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const piName = projectPiName(p);
              return (
              <tr key={p.projectId || p.id + p.title}>
                <td className="dashColId">{p.id}</td>
                <td className="dashColTitle" title={p.title}>
                  {p.projectId ? (
                    <Link to={`/projects/${p.projectId}#workflow`} className="dashProjectLink">
                      {p.title}
                    </Link>
                  ) : (
                    p.title
                  )}
                </td>
                {showPi ? (
                  <td className="dashColPi" title={piName}>
                    {piName}
                  </td>
                ) : null}
                <td className="dashColProgress">
                  <div className="dashProgressCell dashProgressCellCompact">
                    <div className="progressBar">
                      <span style={{ width: `${p.progressPercent ?? 0}%` }} />
                    </div>
                    <span className="dashProgressPercent">{p.progressPercent ?? 0}%</span>
                  </div>
                </td>
                <td className="dashColStatus">
                  {p.currentStepLabel || p.workflow?.currentStepLabel ? (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#0369a1" }}>
                        {p.currentStepLabel || p.workflow?.currentStepLabel}
                      </div>
                      <div className="muted" style={{ fontSize: 11 }}>{p.status}</div>
                    </div>
                  ) : (
                    p.status
                  )}
                </td>
              </tr>
            );})}
            {list.length === 0 ? (
              <tr>
                <td colSpan={showPi ? 5 : 4} className="muted">
                  No active projects at this time.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
