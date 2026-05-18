const mongoose = require("mongoose");

async function connectDB(mongoUri) {
  if (!mongoUri) {
    throw new Error("MONGO_URI is required");
  }

  mongoose.set("strictQuery", true);

  const conn = await mongoose.connect(mongoUri, {
    autoIndex: process.env.NODE_ENV !== "production",
  });

  // eslint-disable-next-line no-console
  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

  return conn;
}

module.exports = { connectDB };
