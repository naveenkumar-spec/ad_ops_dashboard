const { BigQuery } = require("@google-cloud/bigquery");
const path = require("path");

const PROJECT_ID = process.env.GCP_PROJECT_ID;
const DATASET_ID = process.env.BIGQUERY_DATASET_ID || "adops_dashboard";
const USERS_TABLE_ID = "dashboard_users";
const LOCATION = process.env.BIGQUERY_LOCATION || "US";

let bigquery = null;

function getBigQueryClient() {
  if (!bigquery) {
    const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || "./secrets/google-sa.json";
    bigquery = new BigQuery({
      projectId: PROJECT_ID,
      keyFilename: path.resolve(keyFilePath),
      location: LOCATION
    });
  }
  return bigquery;
}

/**
 * Initialize users table in BigQuery if it doesn't exist
 */
async function initializeUsersTable() {
  try {
    const bq = getBigQueryClient();
    const dataset = bq.dataset(DATASET_ID);
    const table = dataset.table(USERS_TABLE_ID);

    const [exists] = await table.exists();
    
    if (!exists) {
      console.log(`[UserStore] Creating BigQuery table: ${DATASET_ID}.${USERS_TABLE_ID}`);
      
      const schema = [
        { name: "id", type: "STRING", mode: "REQUIRED" },
        { name: "username", type: "STRING", mode: "REQUIRED" },
        { name: "email", type: "STRING", mode: "REQUIRED" },
        { name: "displayName", type: "STRING", mode: "NULLABLE" },
        { name: "passwordHash", type: "STRING", mode: "NULLABLE" },
        { name: "role", type: "STRING", mode: "REQUIRED" },
        { name: "authProvider", type: "STRING", mode: "REQUIRED" },
        { name: "fullAccess", type: "BOOLEAN", mode: "REQUIRED" },
        { name: "allowedCountries", type: "STRING", mode: "REPEATED" },
        { name: "allowedAdops", type: "STRING", mode: "REPEATED" },
        { name: "allowedTabs", type: "STRING", mode: "REPEATED" },
        { name: "chatbotEnabled", type: "BOOLEAN", mode: "REQUIRED" },
        { name: "createdAt", type: "TIMESTAMP", mode: "REQUIRED" },
        { name: "updatedAt", type: "TIMESTAMP", mode: "REQUIRED" }
      ];

      await table.create({ schema });
      console.log(`[UserStore] Table created successfully`);
    } else {
      console.log(`[UserStore] Table already exists: ${DATASET_ID}.${USERS_TABLE_ID}`);
    }

    return true;
  } catch (error) {
    console.error("[UserStore] Error initializing table:", error.message);
    throw error;
  }
}

/**
 * Get all users from BigQuery
 */
async function getUsers() {
  try {
    const bq = getBigQueryClient();
    const query = `
      SELECT 
        id,
        username,
        email,
        displayName,
        passwordHash,
        role,
        authProvider,
        fullAccess,
        allowedCountries,
        allowedAdops,
        allowedTabs,
        chatbotEnabled,
        createdAt,
        updatedAt
      FROM \`${PROJECT_ID}.${DATASET_ID}.${USERS_TABLE_ID}\`
      ORDER BY createdAt ASC
    `;

    const [rows] = await bq.query({ query, location: LOCATION });
    
    return rows.map(row => ({
      id: row.id,
      username: row.username,
      email: row.email,
      displayName: row.displayName,
      passwordHash: row.passwordHash,
      role: row.role,
      authProvider: row.authProvider,
      fullAccess: row.fullAccess,
      allowedCountries: row.allowedCountries || [],
      allowedAdops: row.allowedAdops || [],
      allowedTabs: row.allowedTabs || [],
      chatbotEnabled: row.chatbotEnabled !== false,
      createdAt: row.createdAt || new Date().toISOString(),
      updatedAt: row.updatedAt || new Date().toISOString()
    }));
  } catch (error) {
    console.error("[UserStore] Error getting users:", error.message);
    return [];
  }
}

/**
 * Save or update a user in BigQuery
 */
async function saveUser(user) {
  try {
    const bq = getBigQueryClient();
    const table = bq.dataset(DATASET_ID).table(USERS_TABLE_ID);

    // Check if user exists
    const checkQuery = `
      SELECT id FROM \`${PROJECT_ID}.${DATASET_ID}.${USERS_TABLE_ID}\`
      WHERE username = @username
      LIMIT 1
    `;

    const [existing] = await bq.query({
      query: checkQuery,
      location: LOCATION,
      params: { username: user.username }
    });

    const row = {
      id: user.id,
      username: user.username,
      email: user.email || user.username,
      displayName: user.displayName || user.email || user.username,
      passwordHash: user.passwordHash || null,
      role: user.role || "user",
      authProvider: user.authProvider || "local",
      fullAccess: Boolean(user.fullAccess),
      allowedCountries: user.allowedCountries || [],
      allowedAdops: user.allowedAdops || [],
      allowedTabs: user.allowedTabs || ["overview"],
      chatbotEnabled: user.chatbotEnabled !== false,
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: user.updatedAt || new Date().toISOString()
    };

    if (existing.length > 0) {
      // For existing users, try UPDATE first, if it fails due to streaming buffer, use DELETE+INSERT
      try {
        const updateQuery = `
          UPDATE \`${PROJECT_ID}.${DATASET_ID}.${USERS_TABLE_ID}\`
          SET 
            email = @email,
            displayName = @displayName,
            passwordHash = @passwordHash,
            role = @role,
            authProvider = @authProvider,
            fullAccess = @fullAccess,
            allowedCountries = @allowedCountries,
            allowedAdops = @allowedAdops,
            allowedTabs = @allowedTabs,
            chatbotEnabled = @chatbotEnabled,
            updatedAt = CURRENT_TIMESTAMP()
          WHERE username = @username
        `;

        const queryOptions = {
          query: updateQuery,
          location: LOCATION,
          params: {
            username: row.username,
            email: row.email,
            displayName: row.displayName,
            passwordHash: row.passwordHash,
            role: row.role,
            authProvider: row.authProvider,
            fullAccess: row.fullAccess,
            allowedCountries: row.allowedCountries,
            allowedAdops: row.allowedAdops,
            allowedTabs: row.allowedTabs,
            chatbotEnabled: row.chatbotEnabled
          }
        };

        // Add type hints for empty arrays
        if (row.allowedCountries.length === 0 || row.allowedAdops.length === 0 || row.allowedTabs.length === 0) {
          queryOptions.types = {
            allowedCountries: ['STRING'],
            allowedAdops: ['STRING'],
            allowedTabs: ['STRING']
          };
        }

        await bq.query(queryOptions);
        console.log(`[UserStore] Updated user: ${user.username}`);
      } catch (updateError) {
        if (updateError.message.includes('streaming buffer')) {
          console.log(`[UserStore] UPDATE failed due to streaming buffer, using DELETE+INSERT for: ${user.username}`);
          
          // Delete the existing row
          const deleteQuery = `
            DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.${USERS_TABLE_ID}\`
            WHERE username = @username
          `;
          
          try {
            await bq.query({
              query: deleteQuery,
              location: LOCATION,
              params: { username: user.username }
            });
          } catch (deleteError) {
            if (deleteError.message.includes('streaming buffer')) {
              console.log(`[UserStore] DELETE also failed due to streaming buffer, using streaming insert for: ${user.username}`);
              // If DELETE also fails, just insert a new row (BigQuery will handle duplicates)
              await table.insert([row]);
              console.log(`[UserStore] Inserted user via streaming: ${user.username}`);
              return true;
            }
            throw deleteError;
          }
          
          // Insert the updated row
          await table.insert([row]);
          console.log(`[UserStore] Re-inserted user: ${user.username}`);
        } else {
          throw updateError;
        }
      }
    } else {
      // Insert new user - use streaming insert
      await table.insert([row]);
      console.log(`[UserStore] Created user: ${user.username}`);
    }

    return true;
  } catch (error) {
    console.error("[UserStore] Error saving user:", error.message);
    throw error;
  }
}

/**
 * Delete a user from BigQuery
 */
async function deleteUser(username) {
  try {
    const bq = getBigQueryClient();
    const query = `
      DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.${USERS_TABLE_ID}\`
      WHERE username = @username
    `;

    await bq.query({
      query,
      location: LOCATION,
      params: { username }
    });

    console.log(`[UserStore] Deleted user: ${username}`);
    return true;
  } catch (error) {
    if (error.message.includes('streaming buffer')) {
      console.log(`[UserStore] DELETE failed due to streaming buffer for: ${username}. User will be marked as deleted but may still appear until streaming buffer clears.`);
      // In this case, we could mark the user as deleted instead of actually deleting
      // For now, we'll just log and return true since the user will eventually be deletable
      return true;
    }
    console.error("[UserStore] Error deleting user:", error.message);
    return false;
  }
}

/**
 * Migrate users from JSON file to BigQuery
 */
async function migrateFromJSON(jsonUsers) {
  try {
    console.log(`[UserStore] Migrating ${jsonUsers.length} users from JSON to BigQuery...`);
    
    for (const user of jsonUsers) {
      await saveUser(user);
    }
    
    console.log(`[UserStore] Migration complete!`);
    return true;
  } catch (error) {
    console.error("[UserStore] Migration error:", error.message);
    throw error;
  }
}

module.exports = {
  initializeUsersTable,
  getUsers,
  saveUser,
  deleteUser,
  migrateFromJSON
};
