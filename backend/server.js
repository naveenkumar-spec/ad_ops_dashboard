require('dotenv').config();
const { ensureServiceAccountFile } = require("./bootstrapServiceAccount");
ensureServiceAccountFile();

const express = require("express");
const cors = require("cors");

const authService = require("./services/authService");
const { authRequired } = require("./middleware/authMiddleware");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const overviewRoutes = require("./routes/overview");
const managementRoutes = require("./routes/management");
const aiRoutes = require("./routes/ai");
const bigQueryScheduler = require("./services/bigQueryScheduler");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "Server is running",
    dataSource: (process.env.DATA_SOURCE || "google_sheets").toLowerCase(),
    bigQueryScheduler: bigQueryScheduler.getSchedulerStatus()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api", authRequired);
app.use("/api/admin", adminRoutes);

function tabGuard(tab) {
  return (req, res, next) => {
    if (!req.user || req.user.role === "admin") return next();
    const allowed = Array.isArray(req.user.allowedTabs) ? req.user.allowedTabs : ["overview"]; // Default to overview only
    if (!allowed.includes(tab)) return res.status(403).json({ error: "Access denied for this dashboard" });
    return next();
  };
}

app.use("/api/overview", tabGuard("overview"), overviewRoutes);
app.use("/api/management", tabGuard("management"), managementRoutes);
app.use("/api/ai", aiRoutes);

const PORT = process.env.PORT || 5000;

// Bind the port immediately so Render's health check passes, then init in background
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("CORS enabled for all origins");
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Data source: ${(process.env.DATA_SOURCE || "google_sheets").toLowerCase()}`);

  authService.ensureDefaultAdmin().then(() => {
    const schedulerInfo = bigQueryScheduler.startBigQueryScheduler();
    console.log(`BigQuery scheduler: ${schedulerInfo.enabled ? `enabled (${schedulerInfo.cron})` : `disabled (${schedulerInfo.reason})`}`);
  }).catch((error) => {
    console.error("Failed to initialize auth:", error.message);
  });
});
