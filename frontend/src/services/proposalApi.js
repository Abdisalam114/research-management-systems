import { api } from "./api";

export async function listProposals(accessToken) {
  const { data } = await api.get("/api/proposals", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function getProposal(accessToken, id) {
  const { data } = await api.get(`/api/proposals/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function getProposalEthicsApplication(accessToken, proposalId) {
  const { data } = await api.get(`/api/proposals/${proposalId}/ethics-application`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

function appendProposalFields(form, payload) {
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (k === "ethics") {
      form.append("ethics", JSON.stringify(v));
      return;
    }
    if (k === "budgetBreakdown" || k === "complianceMeta" || k === "supportingMeta") {
      form.append(k, JSON.stringify(v));
      return;
    }
    if (k === "complianceFiles" || k === "supportingFiles") {
      if (Array.isArray(v)) v.forEach((file) => { if (file) form.append(k, file); });
      return;
    }
    if (k === "document" && v instanceof File) {
      form.append("document", v);
      return;
    }
    if (typeof v === "object") return;
    form.append(k, v);
  });
}

export async function createProposal(accessToken, payload) {
  const form = new FormData();
  appendProposalFields(form, payload);

  const { data } = await api.post("/api/proposals", form, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function updateProposal(accessToken, id, payload) {
  const form = new FormData();
  appendProposalFields(form, payload);

  const { data } = await api.put(`/api/proposals/${id}`, form, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function submitProposal(accessToken, id) {
  const { data } = await api.post(
    `/api/proposals/${id}/submit`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}

export async function coordinatorReview(accessToken, id, action, comment) {
  const { data } = await api.post(
    `/api/proposals/${id}/review`,
    { action, comment },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}

export async function directorDecision(accessToken, id, decision, comment) {
  const { data } = await api.post(
    `/api/proposals/${id}/director-decision`,
    { decision, comment },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}

export async function listProposalsAll(accessToken) {
  const { data } = await api.get("/api/proposals", {
    params: { scope: "all" },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

/** Proposals linked to funding calls (includes approved — for Funding Calls visibility). */
export async function listGrantFundCallProposals(accessToken) {
  const { data } = await api.get("/api/proposals", {
    params: { grantFundCall: "1" },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function ethicsDecision(accessToken, id, decision, comment) {
  const { data } = await api.post(
    `/api/proposals/${id}/ethics-decision`,
    { decision, comment },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}

export async function assignReviewers(accessToken, id, reviewerIds) {
  const { data } = await api.post(
    `/api/proposals/${id}/assign-reviewers`,
    { reviewerIds },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}

export async function listMyReviewAssignments(accessToken) {
  const { data } = await api.get("/api/proposals/my-review-assignments", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function adminScreening(accessToken, id, decision, comment) {
  const { data } = await api.post(
    `/api/proposals/${id}/admin-screening`,
    { decision, comment },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}

export async function submitPeerReview(accessToken, id, score, comment) {
  const { data } = await api.post(
    `/api/proposals/${id}/peer-review`,
    { score, comment },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}

export async function completePeerReview(accessToken, id) {
  const { data } = await api.post(
    `/api/proposals/${id}/complete-peer-review`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}

export async function committeeReview(accessToken, id, decision, comment) {
  const { data } = await api.post(
    `/api/proposals/${id}/committee-review`,
    { decision, comment },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}

export async function financeProposalReview(accessToken, id, decision, comment) {
  const { data } = await api.post(
    `/api/proposals/${id}/finance-review`,
    { decision, comment },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}

