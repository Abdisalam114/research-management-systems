export function MetricProvenanceBar({ data }) {
  if (!data?.generatedAt) return null;

  const when = new Date(data.generatedAt).toLocaleString();
  const preview = data.preview || {};

  return (
    <div className="metricProvenance">
      <strong>Verified data</strong> — counts are from the live database ({when}). Preview lists below: Active
      Projects{" "}
      {preview.activeProjects ? `${preview.activeProjects.shown}/${preview.activeProjects.total}` : "—"}, Groups{" "}
      {preview.groups ? `${preview.groups.shown}/${preview.groups.total}` : "—"}, Publications{" "}
      {preview.publications ? `${preview.publications.shown}/${preview.publications.total}` : "—"}. Funding awarded =
      same filter as the Grants page (<code>awarded</code>).
    </div>
  );
}
