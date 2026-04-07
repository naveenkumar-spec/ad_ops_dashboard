# Trigger Production Full Refresh

## Quick Fix for Production Data Duplication

The production database has duplicate data because incremental syncs were appending instead of replacing data. Here's how to fix it immediately:

## Option 1: Via Admin Panel (Easiest)

1. Go to: https://ad-ops-dashboard.vercel.app/admin-setup
2. Login with admin credentials
3. Click "Manual Data Refresh" button
4. Wait for sync to complete (may take 2-3 minutes)
5. Refresh dashboard to see clean data

## Option 2: Via API Call

If you have access to the backend logs or can run curl commands:

```bash
# Step 1: Get admin token
curl -X POST https://adops-dashboard-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@silverpush.local",
    "password": "Admin@123"
  }'

# Copy the token from response

# Step 2: Trigger full refresh (replace YOUR_TOKEN with actual token)
curl -X POST "https://adops-dashboard-backend.onrender.com/api/overview/sync/bigquery?fullRefresh=true&async=true" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response should be:
# {"ok":true,"status":"started","syncId":"sync_...","message":"Sync started"}
```

## Option 3: Via Render Dashboard

1. Go to: https://dashboard.render.com
2. Find your backend service: `adops-dashboard-backend`
3. Go to "Shell" tab
4. Run:
```bash
node -e "
const sync = require('./services/bigQuerySyncService');
sync.syncToBigQuery({ fullRefresh: true, forceRefresh: true })
  .then(r => console.log('Success:', r))
  .catch(e => console.error('Error:', e));
"
```

## What This Does

1. Truncates the BigQuery table (removes all rows)
2. Reads fresh data from all Google Sheets
3. Inserts clean data without duplicates
4. Should result in ~2,969 rows (current actual data)

## Expected Results

Before:
- Total rows: 10,840 (with duplicates)
- Campaigns appearing multiple times

After:
- Total rows: ~2,969 (clean data)
- Each campaign appears once
- Accurate metrics on dashboard

## Verify Fix

After running the refresh, check:

```bash
# Run diagnostic script
node backend/scripts/diagnoseProdData.js
```

Should show:
- Total rows: ~2,969
- No duplicate campaigns
- All countries present
- Recent sync shows "full_refresh" mode

## Next Steps

After cleaning production data:
1. Deploy the scheduler fix (already done in dev branch)
2. This prevents future duplicates
3. Monitor next few syncs to ensure stability

## Troubleshooting

If sync fails:
- Check Render logs for errors
- Verify Google Sheets are accessible
- Check BigQuery quotas
- Try again (sync is idempotent)

If data still looks wrong:
- Run diagnostic script to see actual state
- Check which countries are missing data
- Verify Google Sheets have data
- Contact admin for manual investigation
