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
    console.log("[UserStore] Using BigQuery for user storage");
  } catch (error) {
    console.error("[UserStore] Failed to load BigQuery store, falling back to JSON:", error.message);
  }
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
    try {
      return await bigQueryStore.getUsers();
    } catch (error) {
      console.error("[UserStore] BigQuery getUsers failed, using JSON fallback:", error.message);
      return readStore().users;
    }
  }
  return readStore().users;
}

function getUsersSync() {
  return readStore().users;
}

function findUserByUsername(username) {
  const key = String(username || "").trim().toLowerCase();
  return getUsersSync().find((u) => String(u.username || "").toLowerCase() === key) || null;
}

async function saveUser(user) {
  if (bigQueryStore) {
    try {
      await bigQueryStore.saveUser(user);
      return user;
    } catch (error) {
      console.error("[UserStore] BigQuery saveUser failed, using JSON fallback:", error.message);
    }
  }
  
  // JSON fallback
  const store = readStore();
  const key = String(user.username || "").toLowerCase();
  const idx = store.users.findIndex((u) => String(u.username || "").toLowerCase() === key);
  if (idx >= 0) store.users[idx] = user;
  else store.users.push(user);
  writeStore(store);
  return user;
}

async function deleteUser(username) {
  if (bigQueryStore) {
    try {
      return await bigQueryStore.deleteUser(username);
    } catch (error) {
      console.error("[UserStore] BigQuery deleteUser failed, using JSON fallback:", error.message);
    }
  }
  
  // JSON fallback
  const store = readStore();
  const key = String(username || "").toLowerCase();
  const before = store.users.length;
  store.users = store.users.filter((u) => String(u.username || "").toLowerCase() !== key);
  writeStore(store);
  return before !== store.users.length;
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
