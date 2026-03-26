const express = require("express");
const authService = require("../services/authService");
const googleAuthService = require("../services/googleAuthService");
const { authRequired } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { email, username, password } = req.body || {};
    const result = await authService.login(email || username, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message || "Login failed" });
  }
});

router.post("/microsoft", async (req, res) => {
  try {
    const { idToken } = req.body || {};
    const result = await authService.loginWithMicrosoft(idToken);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message || "Microsoft login failed" });
  }
});

router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body || {};
    const profile = await googleAuthService.verifyGoogleIdToken(idToken);
    const result = await authService.loginWithGoogle(profile);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message || "Google login failed" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, username, currentPassword, newPassword } = req.body || {};
    const user = await authService.resetPasswordWithCurrent(email || username, currentPassword, newPassword);
    res.json({ ok: true, user });
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to reset password" });
  }
});

router.get("/me", authRequired, (req, res) => {
  res.json({
    username: req.user.username,
    email: req.user.email || req.user.username,
    role: req.user.role,
    fullAccess: Boolean(req.user.fullAccess),
    allowedCountries: req.user.allowedCountries || [],
    allowedAdops: req.user.allowedAdops || [],
    allowedTabs: req.user.allowedTabs || ["overview", "management"]
  });
});

module.exports = router;
