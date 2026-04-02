const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userStore = require("./userStore");
const entraAuthService = require("./entraAuthService");

const JWT_SECRET = process.env.JWT_SECRET || "replace-me-with-strong-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const ADMIN_LOGIN_EMAIL = (process.env.ADMIN_LOGIN_EMAIL || "admin@silverpush.local").toLowerCase();

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function sanitizeUser(user) {
  return {
    username: user.username,
    email: user.email || user.username,
    displayName: user.displayName || user.email || user.username,
    role: user.role || "user",
    allowedCountries: user.allowedCountries || [],
    allowedAdops: user.allowedAdops || [],
    allowedTabs: user.allowedTabs || ["overview", "management"],
    authProvider: user.authProvider || "local",
    fullAccess: Boolean(user.fullAccess),
    chatbotEnabled: user.chatbotEnabled !== false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

async function hashPassword(password) {
  return bcrypt.hash(String(password), 10);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(String(password || ""), String(hash || ""));
}

function findUserByIdentity(identity) {
  const key = normalizeEmail(identity);
  return userStore.getUsersSync().find((u) => {
    const email = normalizeEmail(u.email || u.username);
    const username = normalizeEmail(u.username);
    return email === key || username === key;
  }) || null;
}

async function ensureDefaultAdmin() {
  // Initialize BigQuery store if enabled
  await userStore.initializeBigQueryStore();
  
  const existing = findUserByIdentity("admin");
  if (existing) {
    if (!existing.email) {
      existing.email = ADMIN_LOGIN_EMAIL;
      existing.updatedAt = new Date().toISOString();
      await userStore.saveUser(existing);
    }
    return;
  }
  const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || "Admin@123";
  const now = new Date().toISOString();
  const admin = {
    id: crypto.randomUUID(),
    username: "admin",
    email: ADMIN_LOGIN_EMAIL,
    displayName: "Admin",
    passwordHash: await hashPassword(defaultPassword),
    role: "admin",
    authProvider: "local",
    fullAccess: true,
    allowedCountries: [],
    allowedAdops: [],
    allowedTabs: ["overview", "management", "admin"],
    chatbotEnabled: true,
    createdAt: now,
    updatedAt: now
  };
  await userStore.saveUser(admin);
  console.log(`[Auth] Default admin created. Login email: ${ADMIN_LOGIN_EMAIL}`);
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email || user.username,
      role: user.role || "user",
      fullAccess: Boolean(user.fullAccess),
      allowedCountries: user.allowedCountries || [],
      allowedAdops: user.allowedAdops || [],
      allowedTabs: user.allowedTabs || ["overview", "management"],
      chatbotEnabled: user.chatbotEnabled !== false
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function login(identity, password) {
  const user = findUserByIdentity(identity);
  if (!user) throw new Error("Invalid email/username or password");
  if (!user.passwordHash) throw new Error("This account uses company email sign-in. Use Microsoft login.");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new Error("Invalid email/username or password");
  return {
    token: signToken(user),
    user: sanitizeUser(user)
  };
}

async function loginWithMicrosoft(idToken) {
  const profile = await entraAuthService.verifyEntraIdToken(idToken);
  return loginWithExternalProfile(profile, "microsoft");
}

async function loginWithExternalProfile(profile, provider) {
  const user = findUserByIdentity(profile.email);
  if (!user) throw new Error("Your email is not allowed for this portal. Contact admin.");

  if (user.authProvider && user.authProvider !== provider && user.role !== "admin") {
    throw new Error(`This account is not configured for ${provider} sign-in`);
  }

  user.authProvider = user.authProvider || provider;
  user.displayName = profile.name || user.displayName;
  user.updatedAt = new Date().toISOString();
  await userStore.saveUser(user);

  return {
    token: signToken(user),
    user: sanitizeUser(user)
  };
}

async function loginWithGoogle(profile) {
  return loginWithExternalProfile(profile, "google");
}

function normalizeTabs(tabs, role = "user") {
  const base = Array.isArray(tabs) && tabs.length ? tabs : ["overview", "management"];
  const unique = Array.from(new Set(base.map((t) => String(t).toLowerCase())));
  if (role !== "admin") return unique.filter((t) => t !== "admin");
  return unique.includes("admin") ? unique : [...unique, "admin"];
}

function normalizeCountries(countries) {
  return Array.isArray(countries)
    ? Array.from(new Set(countries.map((v) => String(v).trim()).filter(Boolean)))
    : [];
}

function normalizeAdops(adops) {
  return Array.isArray(adops)
    ? Array.from(new Set(adops.map((v) => String(v).trim()).filter(Boolean)))
    : [];
}

async function upsertAccessUser(payload) {
  const email = normalizeEmail(payload.email || payload.username);
  if (!email) throw new Error("Email is required");

  const now = new Date().toISOString();
  const role = payload.role === "admin" ? "admin" : "user";
  const fullAccess = Boolean(payload.fullAccess);
  const allowedCountries = fullAccess ? [] : normalizeCountries(payload.allowedCountries);
  const allowedAdops = fullAccess ? [] : normalizeAdops(payload.allowedAdops);
  const allowedTabs = normalizeTabs(payload.allowedTabs, role);
  const chatbotEnabled = payload.chatbotEnabled !== false;

  const existing = findUserByIdentity(email);
  const authProvider = String(payload.authProvider || existing?.authProvider || "google").toLowerCase();
  if (!["google", "microsoft", "local"].includes(authProvider)) {
    throw new Error("authProvider must be one of: local, google, microsoft");
  }

  const user = existing || {
    id: crypto.randomUUID(),
    username: email,
    email,
    displayName: payload.displayName || email,
    passwordHash: null,
    authProvider,
    createdAt: now
  };

  user.email = email;
  user.username = user.username || email;
  user.displayName = payload.displayName || user.displayName || email;
  user.role = role;
  user.fullAccess = fullAccess;
  user.allowedCountries = allowedCountries;
  user.allowedAdops = allowedAdops;
  user.allowedTabs = allowedTabs;
  user.authProvider = authProvider;
  user.chatbotEnabled = chatbotEnabled;

  if (authProvider === "local") {
    if (payload.password) {
      if (String(payload.password).length < 6) throw new Error("Password must be at least 6 characters");
      user.passwordHash = bcrypt.hashSync(String(payload.password), 10);
    } else if (!user.passwordHash) {
      throw new Error("Password is required for local login users");
    }
    // If payload.password is empty but user.passwordHash exists, keep the existing password
  } else {
    // SSO user: only clear password if explicitly switching from local to SSO
    if (existing && existing.authProvider === "local" && authProvider !== "local") {
      user.passwordHash = null;
    }
    // Otherwise, preserve existing passwordHash (don't clear it)
  }
  user.updatedAt = now;

  await userStore.saveUser(user);
  return sanitizeUser(user);
}

async function createUser(payload) {
  const email = normalizeEmail(payload.email || payload.username);
  if (findUserByIdentity(email)) throw new Error("Email already exists");
  return upsertAccessUser(payload);
}

async function updateUser(identity, updates) {
  const existing = findUserByIdentity(identity);
  if (!existing) throw new Error("User not found");

  if (updates.password) {
    if (String(updates.password).length < 6) throw new Error("Password must be at least 6 characters");
    existing.passwordHash = await hashPassword(updates.password);
    existing.authProvider = "local";
  }

  return upsertAccessUser({
    ...existing,
    ...updates,
    email: existing.email || existing.username
  });
}

async function resetPasswordWithCurrent(identity, currentPassword, newPassword) {
  const user = findUserByIdentity(identity);
  if (!user) throw new Error("User not found");
  if (!user.passwordHash) throw new Error("Password reset is only available for local-password accounts");
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw new Error("Current password is incorrect");
  if (!newPassword || String(newPassword).length < 6) throw new Error("New password must be at least 6 characters");
  user.passwordHash = await hashPassword(newPassword);
  user.updatedAt = new Date().toISOString();
  await userStore.saveUser(user);
  return sanitizeUser(user);
}

async function listUsers() {
  const users = await userStore.getUsers();
  return users.map(sanitizeUser);
}

async function deleteUser(identity) {
  const user = findUserByIdentity(identity);
  if (!user) return false;
  if ((user.username || "").toLowerCase() === "admin" || normalizeEmail(user.email) === ADMIN_LOGIN_EMAIL) {
    throw new Error("Default admin cannot be deleted");
  }
  return await userStore.deleteUser(user.username);
}

module.exports = {
  ensureDefaultAdmin,
  login,
  loginWithMicrosoft,
  loginWithGoogle,
  verifyToken,
  listUsers,
  createUser,
  updateUser,
  upsertAccessUser,
  deleteUser,
  resetPasswordWithCurrent
};
