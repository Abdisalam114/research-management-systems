export function FacultyAnalyticsSection({ data, onDownloadReport, downloading }) {
  if (!data?.facultyAnalytics?.length) return null;

  return (
    <section className="dashAnalyticsSection">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 className="dashSectionTitle" style={{ margin: 0 }}>
          Publications per faculty
        </h2>
        {onDownloadReport ? (
          <button type="button" className="btn primary" disabled={downloading} onClick={onDownloadReport}>
            {downloading ? "Generating PDF…" : "Download annual report (PDF)"}
          </button>
        ) : null}
      </div>
      <p className="muted dashSectionSub">
        Grant success rate: <strong>{data.grantSuccessRate ?? 0}%</strong> — annual report year{" "}
        {data.annualReport?.year ?? new Date().getFullYear()}
      </p>
      <div className="card" style={{ marginTop: 12, overflowX: "auto" }}>
        <table className="dashTable">
          <thead>
            <tr>
              <th>Faculty / Department</th>
              <th>Researchers</th>
              <th>Proposals</th>
              <th>Projects</th>
              <th>Publications</th>
              <th>Citations</th>
            </tr>
          </thead>
          <tbody>
            {data.facultyAnalytics.map((f) => (
              <tr key={f.department}>
                <td>{f.department}</td>
                <td>{f.researchers}</td>
                <td>{f.proposals}</td>
                <td>{f.projects}</td>
                <td>{f.publications}</td>
                <td>{f.citations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
