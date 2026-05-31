/** Display missing fields when submit is attempted. */
export function SubmitValidationAlert({ issues, id = "validation-errors" }) {
  if (!issues?.length) return null;

  const proposalItems = issues.filter((i) => i.section === "proposal");
  const ethicsItems = issues.filter((i) => i.section === "ethics");

  return (
    <div
      id={id}
      className="card"
      role="alert"
      style={{
        marginTop: 12,
        borderColor: "rgba(248, 113, 113, 0.65)",
        background: "rgba(248, 113, 113, 0.08)",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 8, color: "#fecaca" }}>
        Cannot submit — the form is not complete
      </div>
      <p className="muted" style={{ marginTop: 0, marginBottom: 10, fontSize: 13 }}>
        Complete the following before trying again:
      </p>

      {proposalItems.length > 0 ? (
        <div style={{ marginBottom: proposalItems.length && ethicsItems.length ? 10 : 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Proposal</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {proposalItems.map((item) => (
              <li key={item.field}>{item.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {ethicsItems.length > 0 ? (
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Ethics form</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {ethicsItems.map((item) => (
              <li key={item.field}>{item.label}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function SubmitSuccessAlert({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div
      className="card"
      role="status"
      style={{
        marginTop: 12,
        borderColor: "rgba(34, 197, 94, 0.55)",
        background: "rgba(34, 197, 94, 0.1)",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6, color: "#86efac" }}>✓ Submitted</div>
      <p style={{ margin: 0, fontSize: 14 }}>{message}</p>
      {onDismiss ? (
        <button type="button" className="btn" style={{ marginTop: 10 }} onClick={onDismiss}>
          Close
        </button>
      ) : null}
    </div>
  );
}
