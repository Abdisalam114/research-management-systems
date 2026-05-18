const fs = require("fs");
const p = "C:/Users/Abdis/just-rms-mvp/frontend/src/pages/ProposalReview.jsx";
let s = fs.readFileSync(p, "utf8");

const d = "div";
const needle = `          Status: {proposal.status} • v{proposal.version}
        </${d}>`;

const insert = `          Status: {proposal.status} • v{proposal.version}
          {proposal.requiresEthics ? \` • Ethics: \${proposal.ethicsStatus}\` : ""}
        </${d}>

        {(isCoordinator || isDirector) && proposal.requiresEthics ? (
          <motion className="card" style={{ marginTop: 12 }}>
            <motion style={{ fontWeight: 700 }}>Ethics approval</motion>
            <motion className="field">
              <label>Ethics decision</label>
              <select value={ethicsDecision} onChange={(e) => setEthicsDecision(e.target.value)}>
                <option value="approved">Approve ethics</option>
                <option value="revision_requested">Request ethics revision</option>
                <option value="rejected">Reject ethics</option>
              </select>
            </motion>
            <button
              className="btn"
              type="button"
              disabled={busy || !comment.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await proposalApi.ethicsDecision(accessToken, id, ethicsDecision, comment.trim());
                  await load();
                } catch (e) {
                  setError(e?.response?.data?.message || "Ethics action failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save ethics decision
            </button>
          </motion>
        ) : null}

        {isDirector ? (
          <motion className="card" style={{ marginTop: 12 }}>
            <motion style={{ fontWeight: 700 }}>Assign reviewers</motion>
            <motion className="field">
              <label>Reviewer user IDs (comma-separated)</label>
              <input value={reviewerIds} onChange={(e) => setReviewerIds(e.target.value)} />
            </motion>
            <button
              className="btn"
              type="button"
              disabled={busy}
              onClick={async () => {
                const ids = reviewerIds.split(",").map((x) => x.trim()).filter(Boolean);
                if (!ids.length) return;
                setBusy(true);
                try {
                  await proposalApi.assignReviewers(accessToken, id, ids);
                  await load();
                } catch (e) {
                  setError(e?.response?.data?.message || "Assign failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Assign reviewers
            </button>
          </motion>
        ) : null}
`;

let out = insert.replace(/\bmotion\b/g, "div");
const needleDiv = needle.replace(/\bmotion\b/g, "div");
if (!s.includes(needleDiv)) {
  console.error("needle not found");
  process.exit(1);
}
s = s.replace(needleDiv, out);
fs.writeFileSync(p, s);
console.log("ok");
