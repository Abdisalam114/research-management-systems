import { api } from "./api";

function auth(t) { return { headers: { Authorization: `Bearer ${t}` } }; }

export async function listPayments(t) {
  const { data } = await api.get("/api/payments", auth(t));
  return data;
}

export async function getPayment(t, id) {
  const { data } = await api.get(`/api/payments/${id}`, auth(t));
  return data;
}

export async function createPayment(t, body) {
  const { data } = await api.post("/api/payments", body, auth(t));
  return data;
}

export async function directorDecision(t, id, body) {
  const { data } = await api.post(`/api/payments/${id}/director-decision`, body, auth(t));
  return data;
}

export async function financePay(t, id, body) {
  const { data } = await api.post(`/api/payments/${id}/pay`, body, auth(t));
  return data;
}

export async function financeReject(t, id, body) {
  const { data } = await api.post(`/api/payments/${id}/reject`, body, auth(t));
  return data;
}
