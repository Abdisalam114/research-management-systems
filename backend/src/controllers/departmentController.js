const { Department } = require("../models/Department");
const { AppError } = require("../utils/AppError");

function sanitizeDepartment(d) {
  return {
    id: d._id,
    name: d.name,
    code: d.code,
    faculty: d.faculty,
    programTier: d.programTier,
    createdBy: d.createdBy,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

async function listDepartments(req, res) {
  const departments = await Department.find(req.tierWhere({})).sort({ name: 1 });
  res.json({ departments: departments.map(sanitizeDepartment) });
}

async function createDepartment(req, res) {
  const { name, code, faculty } = req.body || {};
  if (!name || !code) throw new AppError("name and code are required", 400);

  const department = await Department.create(req.tierAssign({
    name: String(name).trim(),
    code: String(code).trim().toUpperCase(),
    faculty: faculty ? String(faculty).trim() : "",
    createdBy: req.user.id,
  }));

  res.status(201).json({ department: sanitizeDepartment(department) });
}

async function updateDepartment(req, res) {
  const { id } = req.params;
  const department = await Department.findOne(req.tierWhere({ _id: id }));
  if (!department) throw new AppError("Department not found", 404);

  const { name, code, faculty } = req.body || {};
  if (name !== undefined) department.name = String(name).trim();
  if (code !== undefined) department.code = String(code).trim().toUpperCase();
  if (faculty !== undefined) department.faculty = String(faculty).trim();

  await department.save();
  res.json({ department: sanitizeDepartment(department) });
}

async function deleteDepartment(req, res) {
  const { id } = req.params;
  const department = await Department.findOne(req.tierWhere({ _id: id }));
  if (!department) throw new AppError("Department not found", 404);

  await Department.deleteOne({ _id: department._id });
  res.json({ message: "Department deleted" });
}

module.exports = { listDepartments, createDepartment, updateDepartment, deleteDepartment };
