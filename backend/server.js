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
const cachedBigQueryService = require("./services/cachedBigQueryService");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  const cacheHealth = cachedBigQueryService.healthCheck();
  res.json({
    status: "Server is running",
    dataSource: (process.env.DATA_SOURCE || "google_sheets").toLowerCase(),
    bigQueryScheduler: bigQueryScheduler.getSchedulerStatus(),
    semanticCache: cacheHealth
  });
});

// Cache management endpoints (admin only)
app.get("/api/cache/stats", authRequired, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  res.json(cachedBigQueryService.getCacheStats());
});

app.post("/api/cache/refresh", authRequired, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  try {
    await cachedBigQueryService.refreshCache();
    res.json({ success: true, message: "Cache refresh started in background" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/cache/clear", authRequired, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  cachedBigQueryService.clearCache();
  res.json({ success: true, message: "Cache cleared" });
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

  authService.ensureDefaultAdmin().then(async () => {
    const schedulerInfo = bigQueryScheduler.startBigQueryScheduler();
    console.log(`BigQuery scheduler: ${schedulerInfo.enabled ? `enabled (${schedulerInfo.cron})` : `disabled (${schedulerInfo.reason})`}`);
    
    // Initialize semantic cache in background
    console.log("Initializing semantic cache...");
    cachedBigQueryService.initialize().then(() => {
      console.log("✅ Semantic cache ready - dashboard will be fast!");
    }).catch((error) => {
      console.error("⚠️  Semantic cache initialization failed:", error.message);
      console.log("Dashboard will work but may be slower");
    });
  }).catch((error) => {
    console.error("Failed to initialize auth:", error.message);
  });
});
