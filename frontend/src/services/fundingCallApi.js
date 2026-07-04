import { api } from "./api";

export async function listFundingCalls(accessToken, params = {}) {
  const res = await api.get("/api/funding-calls", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params,
  });
  return res.data;
}

export async function getFundingCall(accessToken, id) {
  const res = await api.get(`/api/funding-calls/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function createFundingCall(accessToken, payload) {
  const res = await api.post("/api/funding-calls", payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function updateFundingCall(accessToken, id, payload) {
  const res = await api.put(`/api/funding-calls/${id}`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function publishFundingCall(accessToken, id) {
  const res = await api.post(`/api/funding-calls/${id}/publish`, null, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function closeFundingCall(accessToken, id) {
  const res = await api.post(`/api/funding-calls/${id}/close`, null, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}
