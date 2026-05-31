import { useLocation, useNavigate } from "react-router-dom";
import "../pages/groups.css";

export function GroupsModuleNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onResearch = pathname === "/groups" || pathname.startsWith("/groups/");
  const onThesis = pathname === "/thesis" || pathname.startsWith("/thesis");

  return (
    <div className="groupsModuleNav" role="tablist" aria-label="Group modules">
      <button
        type="button"
        role="tab"
        aria-selected={onResearch}
        className={onResearch ? "btn groupsModuleNavActive" : "btn"}
        onClick={() => navigate("/groups")}
      >
        🧑‍🤝‍🧑 Research groups
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={onThesis}
        className={onThesis ? "btn groupsModuleNavActive" : "btn"}
        onClick={() => navigate("/thesis")}
      >
        🎓 Thesis groups
      </button>
    </div>
  );
}
