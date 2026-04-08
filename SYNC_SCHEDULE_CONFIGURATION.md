# BigQuery Sync Schedule Configuration

## Current Configuration
The BigQuery sync schedule has been updated to run **every hour** instead of every 2 hours.

## How to Change the Sync Schedule

### Location
File: `backend/.env`

### Setting
```env
BIGQUERY_SYNC_CRON=0 * * * *
```

### Cron Expression Format
The cron expression follows this format:
```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, where 0 and 7 are Sunday)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Common Schedule Examples

#### Every Hour (Current Setting)
```env
BIGQUERY_SYNC_CRON=0 * * * *
```
Runs at: 00:00, 01:00, 02:00, 03:00, etc.

#### Every 2 Hours (Previous Setting)
```env
BIGQUERY_SYNC_CRON=0 */2 * * *
```
Runs at: 00:00, 02:00, 04:00, 06:00, etc.

#### Every 30 Minutes
```env
BIGQUERY_SYNC_CRON=*/30 * * * *
```
Runs at: 00:00, 00:30, 01:00, 01:30, etc.

#### Every 15 Minutes
```env
BIGQUERY_SYNC_CRON=*/15 * * * *
```
Runs at: 00:00, 00:15, 00:30, 00:45, 01:00, etc.

#### Every 3 Hours
```env
BIGQUERY_SYNC_CRON=0 */3 * * *
```
Runs at: 00:00, 03:00, 06:00, 09:00, etc.

#### Every 6 Hours
```env
BIGQUERY_SYNC_CRON=0 */6 * * *
```
Runs at: 00:00, 06:00, 12:00, 18:00

#### Specific Times
```env
# Every day at 9 AM
BIGQUERY_SYNC_CRON=0 9 * * *

# Every day at 9 AM and 5 PM
BIGQUERY_SYNC_CRON=0 9,17 * * *

# Every weekday at 9 AM
BIGQUERY_SYNC_CRON=0 9 * * 1-5
```

## How to Apply Changes

### For Development (Local)
1. Edit `backend/.env`
2. Change `BIGQUERY_SYNC_CRON` to your desired schedule
3. Restart the backend server:
   ```bash
   cd backend
   npm start
   ```

### For Production (Render)
1. Go to Render Dashboard
2. Select your backend service
3. Go to "Environment" tab
4. Find `BIGQUERY_SYNC_CRON` variable
5. Update the value
6. Click "Save Changes"
7. Service will automatically restart

### For Development (Vercel/Render Dev)
Same as production - update the environment variable in the respective platform's dashboard.

## Other Related Settings

### Enable/Disable Sync
```env
BIGQUERY_SYNC_ENABLED=true  # Set to false to disable scheduled syncs
```

### Sync Mode
```env
BIGQUERY_SYNC_FULL_REFRESH=false  # false = incremental (recommended)
                                   # true = full refresh every time
```

### Skip Unchanged Data
```env
BIGQUERY_SKIP_IF_UNCHANGED=true  # Skip sync if data hasn't changed
```

## Daily Full Refresh Schedule

The daily full refresh (including transition table) is hardcoded in `backend/services/bigQueryScheduler.js`:

```javascript
const transitionCron = "30 18 * * *"; // 12:00 AM IST = 6:30 PM UTC
```

To change this, edit line 18 in `backend/services/bigQueryScheduler.js`.

## Monitoring

After changing the schedule:
1. Check server logs to confirm the new schedule is active
2. Look for: `[BigQuery Scheduler] Tracker sync: <cron expression>`
3. Monitor the first few syncs to ensure they run at expected times
4. Check data consistency after each sync

## Recommendations

- **Hourly sync** (current): Good balance of freshness and resource usage
- **Every 30 minutes**: Use if you need very fresh data, but increases API usage
- **Every 2 hours**: Use if you want to reduce API calls and resource usage
- **Every 3-6 hours**: Use for less critical environments or to minimize costs

## Important Notes

1. More frequent syncs = more Google Sheets API calls
2. Each sync refreshes the in-memory cache automatically
3. The daily full refresh ensures data consistency
4. Incremental syncs only update the last 2 months of data
5. Manual syncs can be triggered anytime from the admin panel

## Current Setup Summary

- **Hourly Sync**: Every hour (incremental, last 2 months)
- **Daily Full Refresh**: 12:00 AM IST (full refresh with transition table)
- **Manual Sync**: Available anytime via admin panel
