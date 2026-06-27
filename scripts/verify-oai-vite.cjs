/**
 * Verify OAI works via Vite dev proxy (5173) and direct backend (5000).
 * Usage: node scripts/verify-oai-vite.cjs
 */
const VITE = "http://localhost:5173";
const API = "http://127.0.0.1:5000";
const PATH = "/api/repository/oai?verb=ListRecords&metadataPrefix=oai_dc";

async function probe(label, url) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    const ok = res.status === 200 && text.includes("<ListRecords>") && text.startsWith("<?xml");
    return { label, ok, status: res.status, contentType: res.headers.get("content-type"), preview: text.slice(0, 80) };
  } catch (e) {
    return { label, ok: false, error: e.message };
  }
}

async function main() {
  const results = await Promise.all([probe("vite-5173", `${VITE}${PATH}`), probe("backend-5000", `${API}${PATH}`)]);
  const allPassed = results.every((r) => r.ok);
  console.log(JSON.stringify({ allPassed, results }, null, 2));
  if (!allPassed) process.exit(1);
}

main();
