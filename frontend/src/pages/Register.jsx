import { Link } from "react-router-dom";
import "./auth.css";
import logo from "../assets/jamhuriya-logo.png";

export function RegisterPage() {
  return (
    <div className="authBg">
      <div className="authCard">
        <div className="authHeader">
          <div className="authLogo" aria-hidden="true">
            <img src={logo} alt="" style={{ width: 44, height: 44, objectFit: "contain" }} />
          </div>
          <h2 className="authTitle">Account creation</h2>
          <p className="authSub muted">Public registration is disabled</p>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          New accounts are created by the <strong>Research Director</strong> only. If you need access,
          contact the director&apos;s office with your name, email, department, and role.
        </div>

        <Link className="authBtn" to="/login" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
          Back to login
        </Link>
      </div>
    </div>
  );
}
