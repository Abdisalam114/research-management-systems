import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import "./auth.css";
import logo from "../assets/jamhuriya-logo.png";

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
              try {
                const res = await signIn(email, password);
                if (res.user?.role === "research_director") {
                  clearProgramTier();
                  navigate("/program-tier", { replace: true });
                  return;
                }
                navigate(redirectTo, { replace: true });
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
        </div>
      </div>
    </div>
  );
}
