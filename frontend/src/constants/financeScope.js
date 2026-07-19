/** Routes and menu items finance_officer may use — nothing else. */
export const FINANCE_MENU_PATHS = [
  "/dashboard",
  "/finance/grant-approvals",
  "/finance/closures",
  "/funding-calls",
  "/grants",
  "/budgets",
  "/finance-reports",
  "/donor-reports",
  "/notifications",
  "/profile",
];

/** Map legacy / general paths to finance-scoped pages. */
export function financeRedirectPath(pathname) {
  if (!pathname) return null;
  // Proposals stay out of finance — funding approvals instead
  if (pathname === "/proposals" || pathname === "/proposals/" || pathname.startsWith("/proposals/")) {
    return "/finance/grant-approvals";
  }
  // General projects → finance closure queue (not grant approvals)
  if (pathname === "/projects" || pathname === "/projects/") {
    return "/finance/closures";
  }
  const projectId = pathname.match(/^\/projects\/([^/]+)\/?$/);
  if (projectId) return `/finance/closures/${projectId[1]}`;
  // Do NOT remap /finance/closures or /finance/grant-approvals
  if (pathname.startsWith("/finance/reviews")) {
    return "/finance/grant-approvals";
  }
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
