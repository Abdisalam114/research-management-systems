import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { api } from "../services/api";
import * as publicationApi from "../services/publicationApi";
import * as departmentApi from "../services/departmentApi";
import { FacultyDepartmentSelect } from "../components/FacultyDepartmentSelect";
import { matchFacultyByName } from "../constants/faculties";

export function ProfilePage() {
  const { user, accessToken, loadMe } = useAuth();
  const { programTier } = useProgramTier();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [department, setDepartment] = useState(user?.department || "");
  const [deptPick, setDeptPick] = useState({
    faculty: matchFacultyByName(user?.department),
    department: user?.department || "",
    departmentId: "",
  });
  const [departments, setDepartments] = useState([]);
  const [rank, setRank] = useState(user?.rank || "");
  const [researchInterests, setResearchInterests] = useState(user?.researchInterests || "");
  const [publications, setPublications] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken || user?.role !== "researcher") return;
    departmentApi.listDepartments(accessToken).then((res) => {
      setDepartments(res.departments || []);
    }).catch(() => {});
  }, [accessToken, programTier, user?.role]);

  useEffect(() => {
    if (!accessToken || user?.role !== "researcher") {
      setPublications([]);
      return;
    }
    publicationApi
      .listPublications(accessToken, { mine: "1" })
      .then((r) => setPublications(r.publications || []))
      .catch(() => {});
  }, [accessToken, programTier, user?.role]);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Profile</h2>
      <div className="card">
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

        <div className="row">
          <div className="field">
            <label>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="field">
            <label>Department</label>
            {user?.role === "researcher" ? (
              <div className="row" style={{ marginTop: 0 }}>
                <FacultyDepartmentSelect
                  departments={departments}
                  lockFaculty
                  value={{
                    ...deptPick,
                    faculty: matchFacultyByName(user?.department) || deptPick.faculty,
                  }}
                  onChange={(next) => {
                    const homeFaculty = matchFacultyByName(user?.department);
                    if (homeFaculty && next.faculty && next.faculty !== homeFaculty) return;
                    setDeptPick({ ...next, faculty: homeFaculty || next.faculty });
                    setDepartment(next.department || "");
                  }}
                />
              </div>
            ) : (
              <input value={department} onChange={(e) => setDepartment(e.target.value)} />
            )}
          </div>
        </div>
        <div className="field">
          <label>Rank</label>
          <input value={rank} onChange={(e) => setRank(e.target.value)} />
        </div>
        <div className="field">
          <label>Research interests</label>
          <input value={researchInterests} onChange={(e) => setResearchInterests(e.target.value)} />
        </div>

        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            setError("");
            try {
              await api.put(
                "/api/users/me",
                { fullName, department, rank, researchInterests },
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              await loadMe(accessToken);
              setMessage("Profile updated.");
            } catch (e) {
              setError(e?.response?.data?.message || "Update failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving..." : "Save"}
        </button>
      </div>

      {user?.role === "researcher" ? (
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>My publications</div>
        {publications.length === 0 ? (
          <p className="muted">No publications yet.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {publications.map((p) => (
              <li key={p.id} style={{ marginBottom: 6 }}>
                {p.title} <span className="muted">({p.type}, {p.year}, {p.status})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      ) : null}
    </div>
  );
}

