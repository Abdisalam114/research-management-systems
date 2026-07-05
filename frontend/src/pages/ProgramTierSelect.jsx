import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../context/ProgramTierContext";
import { PROGRAM_TIER_OPTIONS } from "../constants/programTier";
import "./auth.css";
import logo from "../assets/jamhuriya-logo.png";

export function ProgramTierSelectPage() {
  const { user } = useAuth();
  const { selectProgramTier } = useProgramTier();
  const navigate = useNavigate();

  function choose(tier) {
    selectProgramTier(tier);
    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="authBg">
      <div className="authCard" style={{ maxWidth: 720 }}>
        <div className="authHeader">
          <div className="authLogo" aria-hidden="true">
            <img src={logo} alt="" style={{ width: 44, height: 44, objectFit: "contain" }} />
          </div>
          <h2 className="authTitle">Select Program Portal</h2>
          <p className="authSub muted">
            Welcome, {user?.fullName || "Director"}. As Research Director you can switch between both portals.
            Each user account is assigned to <strong>Undergraduate</strong> or <strong>Postgraduate</strong> only — not both.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
            marginTop: 8,
          }}
        >
          {PROGRAM_TIER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="card"
              onClick={() => choose(option.value)}
              style={{
                textAlign: "left",
                cursor: "pointer",
                border: `2px solid ${option.accent}33`,
                background: `linear-gradient(160deg, ${option.accent}12, transparent)`,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }} aria-hidden="true">
                {option.icon}
              </div>
              <div style={{ fontWeight: 800, fontSize: 18, color: option.accent }}>{option.label}</div>
              <p className="muted" style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.45 }}>
                {option.description}
              </p>
              <div style={{ marginTop: 14, fontWeight: 700, fontSize: 13, color: option.accent }}>
                Enter {option.label} portal →
              </div>
            </button>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 16, marginBottom: 0, fontSize: 12, textAlign: "center" }}>
          Portal selection is required each time you sign in. You can switch later from the top bar.
        </p>
      </div>
    </div>
  );
}
