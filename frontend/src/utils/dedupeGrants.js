const GRANT_STATUS_RANK = {
  active: 70,
  approved: 60,
  pending_finance: 50,
  submitted: 40,
  closed: 30,
  draft: 20,
  rejected: 10,
};

export function grantRefId(value) {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
}

export function pickPreferredGrant(a, b) {
  if (!a) return b;
  if (!b) return a;
  const ra = GRANT_STATUS_RANK[a.status] || 0;
  const rb = GRANT_STATUS_RANK[b.status] || 0;
  if (ra !== rb) return ra >= rb ? a : b;
  const aa = Number(a.amountAwarded || 0);
  const ab = Number(b.amountAwarded || 0);
  if (aa !== ab) return aa >= ab ? a : b;
  const ca = new Date(a.createdAt || 0).getTime();
  const cb = new Date(b.createdAt || 0).getTime();
  if (ca !== cb) return ca <= cb ? a : b;
  return grantRefId(a.id || a._id) <= grantRefId(b.id || b._id) ? a : b;
}

export function grantApplicationKey(grant) {
  const researcherId = grantRefId(grant?.researcherId);
  const callId = grantRefId(grant?.callId);
  const proposalId = grantRefId(grant?.proposalId);
  if (researcherId && callId && proposalId) return `p:${researcherId}|${callId}|${proposalId}`;
  if (researcherId && callId) return `c:${researcherId}|${callId}`;
  return `id:${grantRefId(grant?.id || grant?._id)}`;
}

export function dedupeGrants(grants = []) {
  const byKey = new Map();
  for (const grant of grants) {
    if (!grant) continue;
    const key = grantApplicationKey(grant);
    byKey.set(key, pickPreferredGrant(byKey.get(key), grant));
  }
  const entries = [...byKey.entries()];
  for (const [key, grant] of entries) {
    if (!key.startsWith("c:")) continue;
    const prefix = key.slice(2);
    const withProposal = entries.find(([otherKey]) => otherKey.startsWith(`p:${prefix}|`));
    if (!withProposal) continue;
    byKey.set(withProposal[0], pickPreferredGrant(withProposal[1], grant));
    byKey.delete(key);
  }
  return [...byKey.values()];
}

/** One row per funding-call application (proposal + grant are the same application). */
export function mergeFundingApplications(grants = [], proposals = []) {
  const uniqueGrants = dedupeGrants(grants);
  const grantByProposal = new Map();
  const grantByCallResearcher = new Map();
  for (const grant of uniqueGrants) {
    const proposalId = grantRefId(grant.proposalId);
    const researcherId = grantRefId(grant.researcherId);
    const callId = grantRefId(grant.callId);
    if (proposalId) grantByProposal.set(proposalId, grant);
    if (researcherId && callId) {
      const cr = `${researcherId}|${callId}`;
      grantByCallResearcher.set(cr, pickPreferredGrant(grantByCallResearcher.get(cr), grant));
    }
  }

  const usedGrantIds = new Set();
  const rows = [];
  for (const proposal of proposals) {
    const proposalId = grantRefId(proposal.id || proposal._id);
    const grant =
      grantByProposal.get(proposalId) ||
      grantByCallResearcher.get(`${grantRefId(proposal.researcherId)}|${grantRefId(proposal.fundingCallId)}`);
    if (grant) usedGrantIds.add(grantRefId(grant.id || grant._id));
    rows.push({
      key: `p-${proposalId}`,
      proposal,
      grant: grant || null,
    });
  }
  for (const grant of uniqueGrants) {
    const grantId = grantRefId(grant.id || grant._id);
    if (usedGrantIds.has(grantId)) continue;
    rows.push({ key: `g-${grantId}`, proposal: null, grant });
  }
  return rows;
}
