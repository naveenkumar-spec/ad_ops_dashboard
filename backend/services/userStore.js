const fs = require("fs");
const path = require("path");

const dataDir = path.resolve(__dirname, "..", "data");
const usersFile = path.join(dataDir, "users.json");

// Use BigQuery for user storage if enabled
const USE_BIGQUERY = process.env.USER_STORAGE === "bigquery" || process.env.DATA_SOURCE === "bigquery";
let bigQueryStore = null;

if (USE_BIGQUERY) {
  try {
    bigQueryStore = require("./userStoreBigQuery");
    console.log("[UserStore] ✅ Using BigQuery for user storage (JSON fallbacks disabled)");
  } catch (error) {
    console.error("[UserStore] ❌ Failed to load BigQuery store:", error.message);
    throw new Error("BigQuery user storage is required but failed to initialize");
  }
} else {
  console.warn("[UserStore] ⚠️  BigQuery user storage is not enabled. Set USER_STORAGE=bigquery or DATA_SOURCE=bigquery");
}

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify({ users: [] }, null, 2), "utf-8");
  }
}

function readStore() {
  ensureStore();
  const raw = fs.readFileSync(usersFile, "utf-8");
  const parsed = JSON.parse(raw || "{}");
  if (!Array.isArray(parsed.users)) parsed.users = [];
  return parsed;
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(usersFile, JSON.stringify(store, null, 2), "utf-8");
}

async function getUsers() {
  if (bigQueryStore) {
    return await bigQueryStore.getUsers();
  }
  
  throw new Error("BigQuery user storage is not available. Check configuration.");
}

function getUsersSync() {
  console.warn("[UserStore] getUsersSync() is deprecated. Use async getUsers() instead.");
  throw new Error("Synchronous user access is not supported with BigQuery storage. Use async getUsers() instead.");
}

function findUserByUsername(username) {
  const key = String(username || "").trim().toLowerCase();
  return getUsersSync().find((u) => String(u.username || "").toLowerCase() === key) || null;
}

async function saveUser(user) {
  if (bigQueryStore) {
    await bigQueryStore.saveUser(user);
    return user;
  }
  
  throw new Error("BigQuery user storage is not available. Check configuration.");
}

async function deleteUser(username) {
  if (bigQueryStore) {
    return await bigQueryStore.deleteUser(username);
  }
  
  throw new Error("BigQuery user storage is not available. Check configuration.");
}

async function initializeBigQueryStore() {
  if (bigQueryStore) {
    try {
      await bigQueryStore.initializeUsersTable();
      
      // Check if we need to migrate from JSON
      const bqUsers = await bigQueryStore.getUsers();
      if (bqUsers.length === 0) {
        const jsonUsers = readStore().users;
        if (jsonUsers.length > 0) {
          console.log("[UserStore] Migrating users from JSON to BigQuery...");
          await bigQueryStore.migrateFromJSON(jsonUsers);
          console.log("[UserStore] Migration complete!");
        }
      }
      
      return true;
    } catch (error) {
      console.error("[UserStore] BigQuery initialization failed:", error.message);
      return false;
    }
  }
  return false;
}

module.exports = {
  getUsers,
  getUsersSync,
  findUserByUsername,
  saveUser,
  deleteUser,
  initializeBigQueryStore
};
