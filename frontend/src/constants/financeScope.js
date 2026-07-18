/** Routes and menu items finance_officer may use — nothing else. */
export const FINANCE_MENU_PATHS = [
  "/dashboard",
  "/finance/grant-approvals",
  "/funding-calls",
  "/grants",
  "/budgets",
  "/finance-reports",
  "/donor-reports",
  "/notifications",
  "/profile",
];

/** Map legacy / general paths to finance-scoped pages (no proposal/project menus). */
export function financeRedirectPath(pathname) {
  if (!pathname) return null;
  // Proposals & projects are out of finance UI — send to grant funding approval
  if (pathname === "/proposals" || pathname === "/proposals/" || pathname.startsWith("/proposals/")) {
    return "/finance/grant-approvals";
  }
  if (pathname === "/projects" || pathname === "/projects/" || pathname.startsWith("/projects/")) {
    return "/finance/grant-approvals";
  }
  if (pathname.startsWith("/finance/reviews") || pathname.startsWith("/finance/closures")) {
    return "/finance/grant-approvals";
  }
  return null;
}

export function isFinanceOnlyPath(pathname) {
  if (!pathname) return false;
  if (financeRedirectPath(pathname)) return true; // allowed then remapped
  if (pathname.startsWith("/payments/")) return true;
  if (pathname.startsWith("/finance/grant-approvals")) return true;
  if (pathname.startsWith("/grants/")) return true;
  return FINANCE_MENU_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
