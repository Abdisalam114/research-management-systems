const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");

/** Reject non-ObjectId :id params before Mongoose cast errors (e.g. mistyped static paths). */
function requireObjectIdParam(paramName = "id") {
  return (req, res, next) => {
    const raw = req.params?.[paramName];
    if (raw == null || raw === "") {
      return next(new AppError("Invalid id", 400));
    }
    const value = String(raw);
    if (!/^[a-f0-9]{24}$/i.test(value)) {
      return next(new AppError("Invalid id", 400));
    }
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return next(new AppError("Invalid id", 400));
    }
    return next();
  };
}

module.exports = { requireObjectIdParam };
