const fs = require("fs");
const path = require("path");

const dataDir = path.resolve(__dirname, "..", "data");
const usersFile = path.join(dataDir, "users.json");

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

function getUsers() {
  return readStore().users;
}

function findUserByUsername(username) {
  const key = String(username || "").trim().toLowerCase();
  return getUsers().find((u) => String(u.username || "").toLowerCase() === key) || null;
}

function saveUser(user) {
  const store = readStore();
  const key = String(user.username || "").toLowerCase();
  const idx = store.users.findIndex((u) => String(u.username || "").toLowerCase() === key);
  if (idx >= 0) store.users[idx] = user;
  else store.users.push(user);
  writeStore(store);
  return user;
}

function deleteUser(username) {
  const store = readStore();
  const key = String(username || "").toLowerCase();
  const before = store.users.length;
  store.users = store.users.filter((u) => String(u.username || "").toLowerCase() !== key);
  writeStore(store);
  return before !== store.users.length;
}

module.exports = {
  getUsers,
  findUserByUsername,
  saveUser,
  deleteUser
};
