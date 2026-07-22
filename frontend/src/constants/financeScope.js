/** Routes and menu items finance_officer may use — nothing else. */
export const FINANCE_MENU_PATHS = [
  "/dashboard",
  "/finance/reviews",
  "/finance/grant-approvals",
  "/finance/closures",
  "/funding-calls",
  "/grants",
  "/budgets",
  "/finance-reports",
  "/donor-reports",
  "/policies",
  "/notifications",
  "/profile",
];

/** Map legacy / general paths to finance-scoped pages. */
export function financeRedirectPath(pathname) {
  if (!pathname) return null;
  // General proposals list → finance proposal review queue (stage 4)
  if (pathname === "/proposals" || pathname === "/proposals/") {
    return "/finance/reviews";
  }
  // Proposal detail/review deep links → finance review detail when possible
  const proposalReview = pathname.match(/^\/proposals\/([^/]+)(?:\/review)?\/?$/);
  if (proposalReview) {
    return `/finance/reviews/${proposalReview[1]}`;
  }
  // General projects → finance closure queue (not grant approvals)
  if (pathname === "/projects" || pathname === "/projects/") {
    return "/finance/closures";
  }
  const projectId = pathname.match(/^\/projects\/([^/]+)\/?$/);
  if (projectId) return `/finance/closures/${projectId[1]}`;
  // Keep /finance/reviews, /finance/closures, /finance/grant-approvals as-is
  return null;
}

export function isFinanceOnlyPath(pathname) {
  if (!pathname) return false;
  if (financeRedirectPath(pathname)) return true; // allowed then remapped
  if (pathname.startsWith("/payments/")) return true;
  if (pathname.startsWith("/finance/grant-approvals")) return true;
  if (pathname.startsWith("/finance/closures")) return true;
  if (pathname.startsWith("/grants/")) return true;
  return FINANCE_MENU_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
