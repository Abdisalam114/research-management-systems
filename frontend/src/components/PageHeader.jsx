import { BackButton } from "./BackButton";
import "./pageHeader.css";

export function PageHeader({ title, subtitle, stats, actions, showBack = false }) {
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
          {stats.map((s, i) => (
            <div key={i} className="pageHeaderStat" style={s.accent ? { borderColor: s.accent } : null}>
              <div className="pageHeaderStatLabel">{s.label}</div>
              <div className="pageHeaderStatValue" style={s.accent ? { color: s.accent } : null}>
                {s.value}
              </div>
              {s.sub ? <div className="pageHeaderStatSub">{s.sub}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
