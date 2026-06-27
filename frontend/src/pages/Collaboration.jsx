import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const TILES = [
  {
    to: "/groups",
    icon: "🧑‍🤝‍🧑",
    title: "Research groups",
    desc: "Create research groups, add members, and open group chat.",
    roles: ["research_director", "faculty_coordinator", "researcher"],
  },
  {
    to: "/messages",
    icon: "💬",
    title: "Messaging",
    desc: "Message any active user — each message creates a notification for the recipient.",
    roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher"],
  },
  {
    to: "/notifications",
    icon: "🔔",
    title: "Notifications",
    desc: "Your personal notifications: grants, ethics, messages, and more.",
    roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher"],
  },
  {
    to: "/groups",
    icon: "🏛️",
    title: "Inter-faculty collaboration",
    desc: "Cross-faculty groups — collaboration and chat across departments.",
    roles: ["research_director", "faculty_coordinator", "researcher"],
  },
];

export function CollaborationPage() {
  const { user } = useAuth();
  const items = TILES.filter((t) => t.roles.includes(user?.role));

  return (
    <div className="dashboardPage collaborationPage">
      <header className="dashPageHeader">
        <h1 className="dashPageTitle">Collaboration & Communication</h1>
        <p className="dashPageSub">
          Inter-faculty collaboration, research groups, messaging, and personal notifications — everyone gets their
          own chat and notifications.
        </p>
      </header>

      <div className="overviewGrid">
        {items.map((t) => (
          <Link key={t.title} to={t.to} className="overviewTile" style={{ textDecoration: "none" }}>
            <div className="label">
              {t.icon} {t.title}
            </div>
            <div className="collabTileDesc">
              {t.desc}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
