require('dotenv').config();
const { ensureServiceAccountFile } = require("../bootstrapServiceAccount");
ensureServiceAccountFile();

const userStoreBigQuery = require("../services/userStoreBigQuery");
const fs = require("fs");
const path = require("path");

async function migrate() {
  try {
    console.log("Starting user migration to BigQuery...");
    
    // Initialize table
    await userStoreBigQuery.initializeUsersTable();
    
    // Read users from JSON
    const usersFile = path.resolve(__dirname, "..", "data", "users.json");
    const raw = fs.readFileSync(usersFile, "utf-8");
    const parsed = JSON.parse(raw);
    const users = parsed.users || [];
    
    console.log(`Found ${users.length} users in JSON file`);
    
    // Migrate to BigQuery
    await userStoreBigQuery.migrateFromJSON(users);
    
    console.log("Migration complete!");
    console.log("\nTo enable BigQuery user storage, ensure your backend/.env has:");
    console.log("DATA_SOURCE=bigquery");
    console.log("\nOr add:");
    console.log("USER_STORAGE=bigquery");
    
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
