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

export async function createProposal(accessToken, payload) {
  const form = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    form.append(k, v);
  });

  const { data } = await api.post("/api/proposals", form, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function updateProposal(accessToken, id, payload) {
  const form = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    form.append(k, v);
  });

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

