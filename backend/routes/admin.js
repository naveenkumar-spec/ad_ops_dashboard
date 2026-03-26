const express = require("express");
const authService = require("../services/authService");
const bigQueryReadService = require("../services/bigQueryReadService");
const { requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireRole("admin"));

router.get("/users", (_req, res) => {
  try {
    res.json(authService.listUsers());
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch users" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const created = await authService.upsertAccessUser(req.body || {});
    res.json(created);
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to create user" });
  }
});

router.put("/users/:email", async (req, res) => {
  try {
    const updated = await authService.updateUser(req.params.email, req.body || {});
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to update user" });
  }
});

router.delete("/users/:email", (req, res) => {
  try {
    const ok = authService.deleteUser(req.params.email);
    if (!ok) return res.status(404).json({ error: "User not found" });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to delete user" });
  }
});

router.get("/options", async (_req, res) => {
  try {
    const options = await bigQueryReadService.getAdminOptions();
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch admin options" });
  }
});

module.exports = router;
