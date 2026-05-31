import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import "./auth.css";
import logo from "../assets/jamhuriya-logo.png";

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("director@rms.edu");
  const [password, setPassword] = useState("Director2024!");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = useMemo(() => location.state?.from?.pathname || "/dashboard", [location.state]);

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
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="director@rms.edu" autoComplete="email" />
          </div>
          <div className="field">
            <label>Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" />
          </div>

          <button
            type="button"
            className="authBtn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await signIn(email, password);
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

