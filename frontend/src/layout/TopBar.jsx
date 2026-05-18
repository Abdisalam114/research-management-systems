import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import logo from "../assets/jamhuriya-logo.png";

export function TopBar({ title = "Dashboard" }) {
  const { user } = useAuth();

  return (
    <header className="topBar">
      <div className="topBarLeft">
        <img src={logo} alt="Jamhuriya University" className="topBarLogo" />
        <div>
          <div className="topBarBrand">JAMHURIYA RESEARCH PORTAL</div>
          <div className="topBarPage">{title}</div>
        </div>
      </div>

      <div className="topBarActions">
        <Link className="topBarIconBtn" to="/messages" title="Messages">
          💬
        </Link>
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
