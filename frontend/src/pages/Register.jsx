import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as authApi from "../services/authApi";
import "./auth.css";
import logo from "../assets/jamhuriya-logo.png";

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "researcher",
    department: "",
    rank: "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="authBg">
      <div className="authCard">
        <div className="authHeader">
          <div className="authLogo" aria-hidden="true">
            <img src={logo} alt="" style={{ width: 44, height: 44, objectFit: "contain" }} />
          </div>
          <h2 className="authTitle">Request Access</h2>
          <p className="authSub muted">New accounts start as pending approval</p>
        </div>

        {message ? (
          <div className="card" style={{ borderColor: "rgba(45, 212, 191, 0.35)", marginBottom: 12 }}>
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)", marginBottom: 12 }}>
            {error}
          </div>
        ) : null}

        <div className="row authForm">
          <div className="field">
            <label>Full name</label>
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@just.edu" />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>Department</label>
            <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          <div className="field">
            <label>Rank</label>
            <input value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} placeholder="Lecturer, Assistant Prof..." />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="researcher">Researcher</option>
              <option value="faculty_coordinator">Faculty Coordinator</option>
              <option value="finance_officer">Finance Officer</option>
            </select>
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
        </div>

        <button
          className="authBtn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            setMessage("");
            try {
              await authApi.register(form);
              setMessage("Registered. Your account is pending approval by the Research Director.");
              setTimeout(() => navigate("/login"), 800);
            } catch (e) {
              setError(e?.response?.data?.message || "Registration failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Creating account..." : "Register"}
        </button>

        <div className="authFooter muted">
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
}

