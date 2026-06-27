const { AppError } = require("../utils/AppError");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
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
