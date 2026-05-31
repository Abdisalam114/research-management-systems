import { Link } from "react-router-dom";
import { BackButton } from "./BackButton";
import "./pageHeader.css";

export function PageHeader({
  title,
  subtitle,
  stats,
  actions,
  showBack = false,
  activeFilter = "all",
  onFilterChange,
}) {
  const filterable = Boolean(onFilterChange);

  return (
    <div className="pageHeader">
      <div className="pageHeaderTop">
        <div className="pageHeaderTitleBox">
          {showBack ? (
            <div style={{ marginBottom: 6 }}>
              <BackButton className="topBarBackBtn" />
            </div>
          ) : null}
          <h2 className="pageHeaderTitle">{title}</h2>
          {subtitle ? <div className="pageHeaderSubtitle">{subtitle}</div> : null}
        </div>
        {actions ? <div className="pageHeaderActions">{actions}</div> : null}
      </div>
      {Array.isArray(stats) && stats.length ? (
        <div className="pageHeaderStats">
          {stats.map((s, i) => {
            const key = s.filterKey ?? (s.label === "Total" ? "all" : s.label.toLowerCase());
            const isActive = filterable && !s.navTo && activeFilter === key;
            const interactiveFilter = filterable && s.filterKey !== undefined && !s.navTo;
            const interactiveNav = Boolean(s.navTo);
            const interactive = interactiveFilter || interactiveNav;
            const Tag = interactiveFilter ? "button" : interactiveNav ? Link : "div";
            const tagProps = interactiveFilter
              ? {
                  type: "button",
                  onClick: () => {
                    onFilterChange(activeFilter === key && key !== "all" ? "all" : key);
                  },
                  "aria-pressed": isActive,
                }
              : interactiveNav
                ? { to: s.navTo, style: { textDecoration: "none", color: "inherit" } }
                : {};

            return (
              <Tag
                key={s.filterKey || s.navTo || i}
                {...tagProps}
                className={[
                  "pageHeaderStat",
                  interactive ? "pageHeaderStatBtn" : "",
                  isActive ? "pageHeaderStatActive" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={s.accent && !isActive ? { borderColor: s.accent } : undefined}
              >
                <div className="pageHeaderStatLabel">{s.label}</div>
                <div
                  className="pageHeaderStatValue"
                  style={s.accent && !isActive ? { color: s.accent } : undefined}
                >
                  {s.value}
                </div>
                {s.sub ? <div className="pageHeaderStatSub">{s.sub}</div> : null}
              </Tag>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
