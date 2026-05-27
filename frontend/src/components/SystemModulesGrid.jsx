import { Link } from "react-router-dom";
import { useEffect } from "react";
import { modulesForRole, countForModule } from "../constants/systemModules";

export function SystemModulesGrid({ role, metrics, overview, title = "System modules overview" }) {
  const items = modulesForRole(role);

  useEffect(() => {
    if (!items.length) return;
    const counts = Object.fromEntries(items.map((mod) => [mod.key, countForModule(mod.key, metrics, overview)]));
    // #region agent log
    fetch("http://127.0.0.1:7457/ingest/e845c40a-0f0d-41d9-883a-67cbc157bfa2", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6113cc" },
      body: JSON.stringify({
        sessionId: "6113cc",
        location: "SystemModulesGrid.jsx:render",
        message: "dashboard modules rendered",
        data: { role, moduleCount: items.length, counts, hasModules: Boolean(metrics?.modules || overview?.modules) },
        timestamp: Date.now(),
        hypothesisId: "B-C",
        runId: "post-fix",
      }),
    }).catch(() => {});
    // #endregion
  }, [role, metrics, overview, items.length]);

  if (!items.length) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 15 }}>{title}</div>
      <div className="overviewGrid">
        {items.map((mod) => {
          const value = countForModule(mod.key, metrics, overview);
          return (
            <Link
              key={mod.key}
              to={mod.to}
              className="overviewTile"
              style={{ textDecoration: "none", borderColor: "rgba(56,189,248,0.2)" }}
            >
              <div className="label">
                {mod.icon} {mod.label}
              </div>
              <div className="value">{value}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
