const OAI_DC_PREFIX = "oai_dc";
const PAGE_SIZE = 100;

const OAI_REPOSITORY_NAME =
  process.env.OAI_REPOSITORY_NAME || "Jamhuriya University Research Repository";
const OAI_ADMIN_EMAIL = process.env.OAI_ADMIN_EMAIL || "repository@rms.edu";
const IDENTIFIER_PREFIX = "oai:just-rms";

function xmlEscape(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getPublicBaseUrl(req) {
  const configured = process.env.REPOSITORY_PUBLIC_URL;
  if (configured) return configured.replace(/\/$/, "");
  const forwardedHost = req.get("x-forwarded-host");
  const forwardedProto = req.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto || req.protocol}://${forwardedHost}`;
  }
  return `${req.protocol}://${req.get("host")}`;
}

function getOaiEndpoint(req) {
  return `${getPublicBaseUrl(req)}/api/repository/oai`;
}

function toIsoDatestamp(value) {
  if (!value) return new Date(0).toISOString();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

function buildRequestAttrs(params) {
  return Object.entries(params)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => ` ${k}="${xmlEscape(v)}"`)
    .join("");
}

function wrapOaiResponse(req, body, requestParams = {}) {
  const endpoint = getOaiEndpoint(req);
  const attrs = buildRequestAttrs(requestParams);
  return `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request${attrs}>${xmlEscape(endpoint)}</request>
  ${body}
</OAI-PMH>`;
}

function oaiError(req, code, message, requestParams = {}) {
  const body = `<error code="${xmlEscape(code)}">${xmlEscape(message)}</error>`;
  return wrapOaiResponse(req, body, requestParams);
}

function encodeResumptionToken(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeResumptionToken(token) {
  try {
    return JSON.parse(Buffer.from(String(token), "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function recordMetadataXml(record, fileBaseUrl) {
  const subjects = (record.tags || []).map((t) => `<dc:subject>${xmlEscape(t)}</dc:subject>`).join("");
  const fileUrl = record.filePath ? `${fileBaseUrl}${record.filePath}` : record.url || "";
  return `<oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"
             xmlns:dc="http://purl.org/dc/elements/1.1/"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">
        <dc:title>${xmlEscape(record.title)}</dc:title>
        <dc:type>${xmlEscape(record.type)}</dc:type>
        <dc:description>${xmlEscape(record.description || "")}</dc:description>
        ${subjects}
        ${fileUrl ? `<dc:identifier>${xmlEscape(fileUrl)}</dc:identifier>` : ""}
        <dc:identifier>${xmlEscape(record.identifier)}</dc:identifier>
        <dc:publisher>Jamhuriya University RMS</dc:publisher>
        <dc:date>${xmlEscape(toIsoDatestamp(record.datestamp).slice(0, 10))}</dc:date>
      </oai_dc:dc>`;
}

function recordHeaderXml(record) {
  return `<header>
      <identifier>${xmlEscape(record.identifier)}</identifier>
      <datestamp>${toIsoDatestamp(record.datestamp)}</datestamp>
      ${record.setSpec ? `<setSpec>${xmlEscape(record.setSpec)}</setSpec>` : ""}
    </header>`;
}

function recordXml(record, fileBaseUrl, includeMetadata = true) {
  const header = recordHeaderXml(record);
  if (!includeMetadata) {
    return `<record>${header}</record>`;
  }
  return `<record>
    ${header}
    <metadata>
      ${recordMetadataXml(record, fileBaseUrl)}
    </metadata>
  </record>`;
}

function paginateRecords(records, offset, pageSize = PAGE_SIZE) {
  const slice = records.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  const resumptionToken = nextOffset < records.length ? nextOffset : null;
  return { slice, resumptionToken, completeListSize: records.length };
}

module.exports = {
  OAI_DC_PREFIX,
  PAGE_SIZE,
  OAI_REPOSITORY_NAME,
  OAI_ADMIN_EMAIL,
  IDENTIFIER_PREFIX,
  xmlEscape,
  getPublicBaseUrl,
  getOaiEndpoint,
  toIsoDatestamp,
  wrapOaiResponse,
  oaiError,
  encodeResumptionToken,
  decodeResumptionToken,
  recordXml,
  paginateRecords,
};
