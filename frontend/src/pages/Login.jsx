import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import "./auth.css";
import logo from "../assets/jamhuriya-logo.png";

const SEED_ACCOUNTS = [
  { email: "director@rms.edu", password: "Director2024!", role: "Director" },
  { email: "coordinator@rms.edu", password: "Coordinator2024!", role: "Coordinator" },
  { email: "finance@rms.edu", password: "Finance2024!", role: "Finance" },
  { email: "ethics@rms.edu", password: "Ethics2024!", role: "Ethics" },
  { email: "asha@rms.edu", password: "Researcher2024!", role: "Researcher (UG)" },
  { email: "mahad@rms.edu", password: "Researcher2024!", role: "Researcher (PG)" },
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

          <details className="seedAccountsPanel" style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Institutional test accounts (after npm run seed)</summary>
            <p className="muted" style={{ fontSize: 13, margin: "8px 0" }}>
              Old accounts like <code>sahra@rms.edu</code> were removed. Use the accounts below.
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {SEED_ACCOUNTS.map((a) => (
                <li key={a.email} style={{ marginBottom: 6 }}>
                  <button
                    type="button"
                    className="linkBtn"
                    style={{ background: "none", border: "none", padding: 0, color: "inherit", cursor: "pointer", textDecoration: "underline" }}
                    onClick={() => {
                      setEmail(a.email);
                      setPassword(a.password);
                      setError("");
                    }}
                  >
                    {a.role}
                  </button>
                  {" — "}
                  <code>{a.email}</code> / <code>{a.password}</code>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
