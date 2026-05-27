const ROOT_PATHS = new Set(["/dashboard", "/"]);

const MODULE_ROOTS = new Set([
  "/pending-users",
  "/departments",
  "/policies",
  "/ethics",
  "/proposals",
  "/projects",
  "/grants",
  "/budgets",
  "/publications",
  "/repository",
  "/groups",
  "/thesis",
  "/messages",
  "/notifications",
  "/profile",
  "/faculty-dashboard",
]);

function isMongoId(segment) {
  return /^[a-f0-9]{24}$/i.test(segment);
}

/** Parent route when browser history is empty (direct link / refresh). */
export function resolveParentRoute(pathname) {
  if (!pathname || ROOT_PATHS.has(pathname)) return null;

  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return null;

  const last = segments[segments.length - 1];

  if (last === "review" || last === "progress") {
    return `/${segments.slice(0, -1).join("/")}`;
  }

  if (last === "new" || isMongoId(last)) {
    return `/${segments.slice(0, -1).join("/")}`;
  }

  const path = `/${segments.join("/")}`;
  if (MODULE_ROOTS.has(path)) return "/dashboard";

  return "/dashboard";
}

export function shouldShowBack(pathname, search = "") {
  if (ROOT_PATHS.has(pathname)) return false;
  if (pathname === "/messages" && search) return true;
  return resolveParentRoute(pathname) !== null || pathname !== "/dashboard";
}

export function getPageTitle(pathname) {
  const exact = {
    "/dashboard": "Dashboard & Analytics",
    "/pending-users": "Director — Users",
    "/departments": "Faculties & Departments",
    "/policies": "Research Policies",
    "/ethics": "Research Ethical Clearance",
    "/proposals": "Proposals",
    "/projects": "Projects",
    "/grants": "Grants & Funding",
    "/budgets": "Finance & Budget",
    "/publications": "Publications",
    "/repository": "Repository",
    "/groups": "Groups",
    "/thesis": "Thesis",
    "/messages": "Messages",
    "/notifications": "Notifications",
    "/profile": "Profile",
    "/faculty-dashboard": "Faculty Dashboard",
  };
  if (exact[pathname]) return exact[pathname];

  if (pathname.startsWith("/proposals/") && pathname.endsWith("/review")) return "Proposal Review";
  if (pathname.startsWith("/proposals/") && pathname.endsWith("/new")) return "New Proposal";
  if (pathname.startsWith("/proposals/")) return "Proposal Details";

  if (pathname.startsWith("/projects/") && pathname.endsWith("/progress")) return "Project Progress";
  if (pathname.startsWith("/projects/")) return "Project Details";

  return "Dashboard";
}
