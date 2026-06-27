/**
 * Verify OAI-PMH repository endpoints.
 * Usage: node scripts/verify-oai.cjs
 */
const BASE = "http://127.0.0.1:5000";

async function fetchOai(path) {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  return { status: res.status, text };
}

function hasTag(xml, tag) {
  return xml.includes(`<${tag}`) || xml.includes(`<${tag}>`);
}

async function main() {
  const tests = [];

  const identify = await fetchOai("/api/repository/oai?verb=Identify");
  tests.push({
    name: "Identify",
    ok: identify.status === 200 && hasTag(identify.text, "Identify") && identify.text.includes("Jamhuriya University"),
  });

  const formats = await fetchOai("/api/repository/oai?verb=ListMetadataFormats");
  tests.push({
    name: "ListMetadataFormats",
    ok: formats.status === 200 && formats.text.includes("oai_dc"),
  });

  const sets = await fetchOai("/api/repository/oai?verb=ListSets");
  tests.push({
    name: "ListSets",
    ok: sets.status === 200 && sets.text.includes("repo:institution") && sets.text.includes("publications:validated"),
  });

  const listRecords = await fetchOai("/api/repository/oai?verb=ListRecords&metadataPrefix=oai_dc");
  const recordCount = (listRecords.text.match(/<record>/g) || []).length;
  tests.push({
    name: "ListRecords",
    ok: listRecords.status === 200 && hasTag(listRecords.text, "ListRecords") && recordCount > 0,
    recordCount,
  });

  const exportAlias = await fetchOai("/api/repository/oai/export");
  tests.push({
    name: "Legacy /oai/export",
    ok: exportAlias.status === 200 && hasTag(exportAlias.text, "ListRecords"),
  });

  const idMatch = listRecords.text.match(/<identifier>(oai:just-rms:[^<]+)<\/identifier>/);
  if (idMatch) {
    const id = idMatch[1];
    const getRecord = await fetchOai(
      `/api/repository/oai?verb=GetRecord&metadataPrefix=oai_dc&identifier=${encodeURIComponent(id)}`
    );
    tests.push({
      name: "GetRecord",
      ok: getRecord.status === 200 && getRecord.text.includes(id) && hasTag(getRecord.text, "GetRecord"),
      sampleId: id,
    });
  }

  const badVerb = await fetchOai("/api/repository/oai?verb=NotARealVerb");
  tests.push({
    name: "badVerb error",
    ok: badVerb.status === 400 && badVerb.text.includes('code="badVerb"'),
  });

  const allPassed = tests.every((t) => t.ok);
  console.log(JSON.stringify({ allPassed, tests }, null, 2));
  if (!allPassed) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
