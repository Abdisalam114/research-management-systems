export function MetricProvenanceBar({ data }) {
  if (!data?.generatedAt) return null;

  const when = new Date(data.generatedAt).toLocaleString();
  const samples = data.samples || {};

  return (
    <div className="metricProvenance">
      <strong>Verified data</strong> — counts are from the live database ({when}). Sample list below: Active
      Projects{" "}
      {samples.activeProjects ? `${samples.activeProjects.shown}/${samples.activeProjects.total}` : "—"}, Groups{" "}
      {samples.groups ? `${samples.groups.shown}/${samples.groups.total}` : "—"}, Publications{" "}
      {samples.publications ? `${samples.publications.shown}/${samples.publications.total}` : "—"}. Funding awarded =
      same filter as the Grants page (<code>awarded</code>).
    </div>
  );
}
