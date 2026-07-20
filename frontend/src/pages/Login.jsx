import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import "./auth.css";
import logo from "../assets/jamhuriya-logo.png";

/** All institutional demo accounts (matches backend seedData — 15 users). */
const SEED_ACCOUNT_GROUPS = [
  {
    title: "Shared (both portals)",
    accounts: [
      { email: "director@rms.edu", password: "Director2024!", role: "Research Director" },
    ],
  },
  {
    title: "Undergraduate",
    accounts: [
      { email: "coordinator@rms.edu", password: "Coordinator2024!", role: "Faculty Coordinator" },
      { email: "finance@rms.edu", password: "Finance2024!", role: "Finance Officer" },
      { email: "procurement@rms.edu", password: "Procurement2024!", role: "Procurement Officer" },
      { email: "hr@rms.edu", password: "Hr2024!", role: "HR Officer" },
      { email: "leadership@rms.edu", password: "Leadership2024!", role: "University Leadership" },
      { email: "donor@rms.edu", password: "Donor2024!", role: "Donor / Agency" },
      { email: "asha@rms.edu", password: "Researcher2024!", role: "Researcher / PI" },
    ],
  },
  {
    title: "Postgraduate",
    accounts: [
      { email: "coordinator.pg@rms.edu", password: "Coordinator2024!", role: "Faculty Coordinator" },
      { email: "finance.pg@rms.edu", password: "Finance2024!", role: "Finance Officer" },
      { email: "procurement.pg@rms.edu", password: "Procurement2024!", role: "Procurement Officer" },
      { email: "hr.pg@rms.edu", password: "Hr2024!", role: "HR Officer" },
      { email: "leadership.pg@rms.edu", password: "Leadership2024!", role: "University Leadership" },
      { email: "donor.pg@rms.edu", password: "Donor2024!", role: "Donor / Agency" },
      { email: "mahad@rms.edu", password: "Researcher2024!", role: "Researcher / PI" },
    ],
  },
];

export function LoginPage() {
  const { signIn } = useAuth();
  const { clearProgramTier } = useProgramTier();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = useMemo(() => {
    if (location.state?.from?.pathname && location.state.from.pathname !== "/program-tier") {
      return location.state.from.pathname;
    }
    return "/dashboard";
  }, [location.state]);

  function fillAccount(a) {
    setEmail(a.email);
    setPassword(a.password);
    setError("");
  }

  return (
    <div className="authBg">
      <div className="authCard">
        <div className="authHeader">
          <div className="authLogo" aria-hidden="true">
            <img src={logo} alt="" style={{ width: 44, height: 44, objectFit: "contain" }} />
          </div>
          <h2 className="authTitle">Jamhuriya Research Portal</h2>
          <p className="authSub muted">Sign in to manage your research</p>
        </div>

        {error ? (
          <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)", marginBottom: 12 }}>
            {error}
          </div>
        ) : null}

        <div className="authForm">
          <div className="field">
            <label>Email Address</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@university.edu"
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </div>

          <button
            type="button"
            className="authBtn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              const trimmedEmail = email.trim();
              const trimmedPassword = password;
              try {
                const res = await signIn(trimmedEmail, trimmedPassword);
                if (res.user?.role === "research_director") {
                  clearProgramTier();
                  navigate("/program-tier", { replace: true });
                  return;
                }
                const roleHome = {
                  procurement_officer: "/budgets",
                  hr_officer: "/projects",
                  leadership: "/grants",
                  donor_agency: "/donor-reports",
                };
                navigate(roleHome[res.user?.role] || redirectTo, { replace: true });
              } catch (e) {
                setError(e?.response?.data?.message || "Login failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Signing in..." : "Sign In"}
          </button>

          <p className="authFooter muted" style={{ marginTop: 14, marginBottom: 0 }}>
            Need an account? Contact the Research Director — only they can create users.
          </p>

          <details className="seedAccountsPanel" style={{ marginTop: 16 }} open>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              All demo accounts (15) — click to fill
            </summary>
            <p className="muted" style={{ fontSize: 13, margin: "8px 0" }}>
              Ethics Committee &amp; Peer Reviewer roles were removed. Peer review is done by{" "}
              <strong>University Leadership</strong>.
            </p>
            {SEED_ACCOUNT_GROUPS.map((group) => (
              <div key={group.title} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{group.title}</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {group.accounts.map((a) => (
                    <li key={a.email} style={{ marginBottom: 6 }}>
                      <button
                        type="button"
                        className="linkBtn"
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          color: "inherit",
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                        onClick={() => fillAccount(a)}
                      >
                        {a.role}
                      </button>
                      {" — "}
                      <code>{a.email}</code> / <code>{a.password}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </details>
        </div>
      </div>
    </div>
  );
}
