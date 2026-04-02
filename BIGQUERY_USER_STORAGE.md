# BigQuery User Storage

## Overview
User data is now stored in BigQuery instead of a JSON file. This solves the Render restart problem where users added via the Admin panel would be lost.

## Benefits
✅ **Persistent Storage** - Users survive Render restarts  
✅ **No Data Loss** - Add users via Admin panel without worrying about deployments  
✅ **Automatic Migration** - Existing users from JSON are automatically migrated  
✅ **Fallback Support** - Falls back to JSON if BigQuery is unavailable  

---

## Setup (Already Done!)

Since you're already using `DATA_SOURCE=bigquery`, user storage is automatically enabled in BigQuery.

### What Happens on First Deploy:
1. Backend starts and detects `DATA_SOURCE=bigquery`
2. Creates `dashboard_users` table in your BigQuery dataset
3. Automatically migrates existing users from `users.json` to BigQuery
4. All future user operations use BigQuery

---

## BigQuery Table Schema

**Table Name:** `adops_dashboard.dashboard_users`

**Columns:**
- `id` (STRING) - Unique user ID
- `username` (STRING) - Username (usually email)
- `email` (STRING) - User email
- `displayName` (STRING) - Display name
- `passwordHash` (STRING) - Hashed password (null for SSO users)
- `role` (STRING) - "admin" or "user"
- `authProvider` (STRING) - "local", "google", or "microsoft"
- `fullAccess` (BOOLEAN) - Full access flag
- `allowedCountries` (STRING, REPEATED) - Array of allowed countries
- `allowedAdops` (STRING, REPEATED) - Array of allowed AdOps
- `allowedTabs` (STRING, REPEATED) - Array of allowed tabs
- `chatbotEnabled` (BOOLEAN) - Chatbot enabled flag
- `createdAt` (TIMESTAMP) - Creation timestamp
- `updatedAt` (TIMESTAMP) - Last update timestamp

---

## How It Works

### On Render Startup:
1. Backend initializes
2. Checks if `dashboard_users` table exists
3. If not, creates it
4. If table is empty, migrates users from `users.json`
5. All user operations now use BigQuery

### User Operations:
- **Add User** (Admin panel) → Saved to BigQuery ✅
- **Update User** (Admin panel) → Updated in BigQuery ✅
- **Delete User** (Admin panel) → Deleted from BigQuery ✅
- **Login** → Reads from BigQuery ✅

### Render Restarts:
- Users persist in BigQuery ✅
- No data loss ✅
- No need to commit to Git ✅

---

## Manual Migration (If Needed)

If you need to manually migrate users to BigQuery:

```bash
cd backend
npm run migrate:users
```

This will:
1. Create the `dashboard_users` table
2. Read users from `backend/data/users.json`
3. Insert them into BigQuery
4. Confirm migration success

---

## Viewing Users in BigQuery

### Via BigQuery Console:
1. Go to [BigQuery Console](https://console.cloud.google.com/bigquery)
2. Select project: `tactile-petal-820`
3. Navigate to dataset: `adops_dashboard`
4. Open table: `dashboard_users`
5. Click "Preview" to see all users

### Via SQL Query:
```sql
SELECT 
  username,
  email,
  role,
  authProvider,
  fullAccess,
  chatbotEnabled,
  allowedTabs,
  createdAt,
  updatedAt
FROM `tactile-petal-820.adops_dashboard.dashboard_users`
ORDER BY createdAt DESC
```

---

## Current Users (Migrated)

After deployment, these users will be in BigQuery:
1. **admin@silverpush.local** - Admin account
2. **naveen.kumar@silverpush.co** - Full access user
3. **yogi.wadhwa@silverpush.co** - Full access user (password: Yogi@123)
4. **mansi.matela@silverpush.co** - Full access user (password: Mansi@123)

---

## Fallback Behavior

If BigQuery is unavailable:
- System automatically falls back to JSON file storage
- No errors or crashes
- Users can still login and be managed
- Warning logged in console

---

## Environment Variables

**Current Setup (Automatic):**
```env
DATA_SOURCE=bigquery
```

**Alternative (Explicit):**
```env
USER_STORAGE=bigquery
```

Either variable enables BigQuery user storage.

---

## Testing

### After Deployment:
1. **Add a test user** via Admin panel
2. **Trigger Render restart** (push any code change)
3. **Wait for redeploy** (2-3 minutes)
4. **Check Admin panel** - Test user should still be there ✅
5. **Login as test user** - Should work ✅

### Verify in BigQuery:
```sql
SELECT COUNT(*) as user_count 
FROM `tactile-petal-820.adops_dashboard.dashboard_users`
```

Should show 4+ users (admin, naveen, yogi, mansi, + any you added).

---

## Troubleshooting

### "Table not found" error
- Run migration script: `npm run migrate:users`
- Check BigQuery permissions for service account

### Users not persisting
- Verify `DATA_SOURCE=bigquery` in backend/.env
- Check Render logs for BigQuery errors
- Ensure service account has BigQuery write permissions

### Migration failed
- Check service account key file exists
- Verify GCP project ID is correct
- Ensure BigQuery API is enabled

### Fallback to JSON
- Check Render logs for error messages
- Verify BigQuery dataset exists
- Check service account permissions

---

## Cost

**BigQuery Storage:**
- First 10 GB free per month
- User table size: ~1 KB per user
- 1000 users = ~1 MB
- Essentially free for user storage

**BigQuery Queries:**
- First 1 TB free per month
- User queries are tiny (~1 KB each)
- Thousands of logins per month = still free

**Total Cost:** $0/month for typical usage

---

## Backup

Users are still saved to `users.json` as a backup when using JSON fallback. To backup BigQuery users:

```sql
EXPORT DATA OPTIONS(
  uri='gs://your-bucket/users-backup-*.json',
  format='JSON'
) AS
SELECT * FROM `tactile-petal-820.adops_dashboard.dashboard_users`
```

Or simply use the Admin panel to view/export user list.

---

## Next Steps

1. ✅ Deploy to Render (automatic)
2. ✅ Users automatically migrated to BigQuery
3. ✅ Test by adding a user via Admin panel
4. ✅ Verify persistence after Render restart
5. ✅ Enjoy worry-free user management!

No manual steps required - everything is automatic! 🎉
