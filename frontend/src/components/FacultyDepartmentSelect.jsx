import { useMemo } from "react";
import { FACULTIES, matchFacultyByName } from "../constants/faculties";

function facultyKeyForDepartment(d) {
  if (d?.faculty && FACULTIES.some((f) => f.value === d.faculty)) return d.faculty;
  return matchFacultyByName(d?.name || d?.faculty || "");
}

/**
 * Faculty → department picker (uses Departments API list).
 * value: { faculty, department, departmentId? }
 */
export function FacultyDepartmentSelect({
  departments = [],
  value = {},
  onChange,
  disabled = false,
  required = true,
}) {
  const departmentsByFaculty = useMemo(() => {
    const map = {};
    FACULTIES.forEach((f) => {
      map[f.value] = [];
    });
    departments.forEach((d) => {
      const key = facultyKeyForDepartment(d);
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    });
    return map;
  }, [departments]);

  const faculty =
    value.faculty && FACULTIES.some((f) => f.value === value.faculty)
      ? value.faculty
      : matchFacultyByName(value.department) || FACULTIES[0]?.value || "";
  const deptOptions = departmentsByFaculty[faculty] || [];

  function onFacultyChange(nextFaculty) {
    onChange({ faculty: nextFaculty, department: "", departmentId: "" });
  }

  function onDepartmentChange(departmentId) {
    const dept = deptOptions.find((d) => String(d.id) === String(departmentId));
    onChange({
      faculty,
      department: dept?.name || "",
      departmentId: dept?.id || "",
    });
  }

  return (
    <>
      <div className="field">
        <label>Faculty *</label>
        <select value={faculty} disabled={disabled} onChange={(e) => onFacultyChange(e.target.value)} required={required}>
          {FACULTIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.icon} {f.value}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Department *</label>
        <select
          value={value.departmentId || deptOptions.find((d) => d.name === value.department)?.id || ""}
          disabled={disabled || !deptOptions.length}
          onChange={(e) => onDepartmentChange(e.target.value)}
          required={required}
        >
          <option value="">{deptOptions.length ? "— Select department —" : "No departments — add on Faculties page"}</option>
          {deptOptions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
