import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { BackButton } from "../components/BackButton";
import logo from "../assets/jamhuriya-logo.png";

export function TopBar({ title = "Dashboard" }) {
  const { user } = useAuth();
  const canSeeMessages = user?.role !== "finance_officer";

  return (
    <header className="topBar">
      <div className="topBarLeft">
        <BackButton />
        <img src={logo} alt="Jamhuriya University" className="topBarLogo" />
        <div>
          <div className="topBarBrand">JAMHURIYA RESEARCH PORTAL</div>
          <div className="topBarPage">{title}</div>
        </div>
      </div>

      <div className="topBarActions">
        {canSeeMessages ? (
          <Link className="topBarIconBtn" to="/messages" title="Messages">
            💬
          </Link>
        ) : null}
        <Link className="topBarIconBtn topBarBell" to="/notifications" title="Notifications">
          🔔
          <span className="topBarDot" />
        </Link>
        <Link className="topBarAvatar" to="/profile" title={user?.fullName}>
          {(user?.fullName || "U").slice(0, 1).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}
