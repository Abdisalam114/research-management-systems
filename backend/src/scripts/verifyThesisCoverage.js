/**
 * Smoke-check: KPI dashboard API returns operational metrics.
 * (Spec coverage / thesis-ready messaging was removed from the product UI.)
 */
require("dotenv").config();
const { connectDB } = require("../config/db");

async function login(email, password) {
  const res = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "login failed");
  return data;
}

async function main() {
  await connectDB(process.env.MONGO_URI || process.env.MONGODB_URI);
  const email = process.env.SEED_DIRECTOR_EMAIL || "director@rms.edu";
  const password = process.env.SEED_DIRECTOR_PASSWORD || "Director2024!";
  const { accessToken } = await login(email, password);

  const res = await fetch("http://localhost:5000/api/analytics/kpi-dashboard", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const kpi = await res.json();
  if (!res.ok) throw new Error(kpi.message || "KPI request failed");
  if (!kpi.kpis) throw new Error("KPI payload missing kpis");

  console.log("KPI dashboard OK");
  console.log(`Active projects: ${kpi.kpis.activeProjects ?? 0}`);
  console.log(`Validated publications: ${kpi.kpis.publicationsValidated ?? 0}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
