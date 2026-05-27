const mongoose = require("mongoose");
const { FACULTIES, matchFacultyByName } = require("../utils/facultyMatcher");

async function migrateDepartmentFaculties() {
  const col = mongoose.connection.collection("departments");
  const cursor = col.find({});
  let updated = 0;

  for await (const doc of cursor) {
    const currentFaculty = (doc.faculty || "").trim();
    if (currentFaculty && FACULTIES.includes(currentFaculty)) continue;

    const inferred = matchFacultyByName(doc.name);
    if (inferred && inferred !== currentFaculty) {
      await col.updateOne({ _id: doc._id }, { $set: { faculty: inferred } });
      updated += 1;
    }
  }

  if (updated > 0) {
    // eslint-disable-next-line no-console
    console.log(`Reassigned faculty for ${updated} department(s) by name match`);
  }
}

module.exports = { migrateDepartmentFaculties };
