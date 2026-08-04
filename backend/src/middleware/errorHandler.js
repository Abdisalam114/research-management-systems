const { AppError } = require("../utils/AppError");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err?.code === 11000 || err?.name === "MongoServerError" && err?.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || "field";
    return res.status(409).json({
      message: field === "email" ? "Email already in use" : "Duplicate value — record already exists",
    });
  }

  const statusCode = err instanceof AppError ? err.statusCode : 500;

  const payload = {
    message: err.message || "Server error",
  };

  if (err instanceof AppError && err.code) {
    payload.code = err.code;
  }

  if (process.env.NODE_ENV !== "production") {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
}

module.exports = { errorHandler };
