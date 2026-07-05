import { Link } from "react-router-dom";
import { useEffect } from "react";
import { modulesForRole, countForModule } from "../constants/systemModules";

export function SystemModulesGrid({ role, metrics, overview, title = "System modules overview" }) {
  const items = modulesForRole(role);

  useEffect(() => {
    if (!items.length) return;
    const counts = Object.fromEntries(items.map((mod) => [mod.key, countForModule(mod.key, metrics, overview)]));
}, [role, metrics, overview, items.length]);

  if (!items.length) return null;

  return (
    <div style={{ marginTop: 0 }}>
      <div className="dashboardSectionTitle">{title}</div>
      <div className="overviewGrid">
        {items.map((mod) => {
          const value = countForModule(mod.key, metrics, overview);
          return (
            <Link
              key={mod.key}
              to={mod.to}
              className="overviewTile"
              style={{ textDecoration: "none" }}
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
