/**
 * Verify repository PDF/CSV/Excel exports.
 * Usage: node scripts/verify-repository-export.cjs
 */
const BASE = "http://127.0.0.1:5000";

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "director@rms.edu", password: "Director2024!" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Login failed");
  return data.accessToken;
}

async function probe(token, path, expect) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const ct = res.headers.get("content-type") || "";
  const buf = Buffer.from(await res.arrayBuffer());
  const ok = res.status === 200 && ct.includes(expect.type) && buf.length > expect.minBytes;
  return { path, ok, status: res.status, contentType: ct, bytes: buf.length, head: buf.slice(0, 20).toString("utf8") };
}

async function main() {
  const token = await login();
  const results = await Promise.all([
    probe(token, "/api/repository/export/csv", { type: "text/csv", minBytes: 10 }),
    probe(token, "/api/repository/export/excel", { type: "excel", minBytes: 50 }),
    probe(token, "/api/repository/export/pdf", { type: "application/pdf", minBytes: 100 }),
  ]);
  const allPassed = results.every((r) => r.ok);
  console.log(JSON.stringify({ allPassed, results }, null, 2));
  if (!allPassed) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
