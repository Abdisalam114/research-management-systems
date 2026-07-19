/** Modules that should carry project context from Project → Open. */
const PROJECT_SCOPED_PREFIXES = [
  "/publications",
  "/repository",
  "/budgets",
  "/grants",
  "/funding-calls",
];

/**
 * Ensure a workflow/module link keeps the current project (and proposal) context
 * so users do not re-select or re-type the project title.
 */
export function withProjectContext(link, { projectId, proposalId } = {}) {
  if (!link || typeof link !== "string") return link;
  if (!projectId && !proposalId) return link;

  const hashIdx = link.indexOf("#");
  const hash = hashIdx >= 0 ? link.slice(hashIdx) : "";
  const withoutHash = hashIdx >= 0 ? link.slice(0, hashIdx) : link;
  const qIdx = withoutHash.indexOf("?");
  const pathname = qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash;
  const params = new URLSearchParams(qIdx >= 0 ? withoutHash.slice(qIdx + 1) : "");

  const needsProject = PROJECT_SCOPED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (projectId && needsProject && !params.get("projectId")) {
    params.set("projectId", String(projectId));
  }

  if (proposalId && (pathname === "/ethics" || pathname.startsWith("/ethics/"))) {
    if (!params.get("proposalId")) params.set("proposalId", String(proposalId));
  }

  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ""}${hash}`;
}
