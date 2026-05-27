const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const path = require("path");
const { errorHandler } = require("./middleware/errorHandler");
const { authRoutes } = require("./routes/authRoutes");
const { userRoutes } = require("./routes/userRoutes");
const { proposalRoutes } = require("./routes/proposalRoutes");
const { projectRoutes } = require("./routes/projectRoutes");
const { grantRoutes } = require("./routes/grantRoutes");
const { budgetRoutes } = require("./routes/budgetRoutes");
const { publicationRoutes } = require("./routes/publicationRoutes");
const { repositoryRoutes } = require("./routes/repositoryRoutes");
const { researchGroupRoutes } = require("./routes/researchGroupRoutes");
const { notificationRoutes } = require("./routes/notificationRoutes");
const { conversationRoutes } = require("./routes/conversationRoutes");
const { departmentRoutes } = require("./routes/departmentRoutes");
const { analyticsRoutes } = require("./routes/analyticsRoutes");
const { policyRoutes } = require("./routes/policyRoutes");
const { paymentRoutes } = require("./routes/paymentRoutes");
const { purchaseOrderRoutes } = require("./routes/purchaseOrderRoutes");
const { ethicsRoutes } = require("./routes/ethicsRoutes");
const { thesisGroupRoutes } = require("./routes/thesisGroupRoutes");

function createApp() {
  const app = express();

  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN?.split(",").map((s) => s.trim()) || true,
      credentials: true,
    })
  );

  if (process.env.NODE_ENV !== "production") {
    app.use(morgan("dev"));
  }

  app.get("/api/health", (req, res) => {
    res.json({ ok: true, service: "just-rms-backend" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/proposals", proposalRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/grants", grantRoutes);
  app.use("/api/budgets", budgetRoutes);
  app.use("/api/publications", publicationRoutes);
  app.use("/api/repository", repositoryRoutes);
  app.use("/api/groups", researchGroupRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/departments", departmentRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/policies", policyRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/procurement", purchaseOrderRoutes);
  app.use("/api/ethics", ethicsRoutes);
  app.use("/api/thesis-groups", thesisGroupRoutes);

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
