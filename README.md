# AdOps Dashboard - Deployment Guide

## Overview
AdOps Dashboard is a full-stack application for managing and visualizing advertising operations data. It syncs data from Google Sheets to BigQuery and provides real-time analytics through a React frontend.

## Architecture

### Frontend
- **Framework**: React 18 with Vite
- **UI Libraries**: Victory Charts, Material-UI
- **State Management**: React Context API
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js (Express)
- **Database**: Google BigQuery
- **Cache**: Upstash Redis (optional, for semantic cache)
- **Authentication**: Google OAuth 2.0 / Microsoft Entra ID
- **Scheduler**: node-cron (hourly data sync)

### Data Flow
```
Google Sheets → Backend Sync Service → BigQuery → Cached Service → Frontend
                     ↓
                 Redis Cache (optional)
```

## Prerequisites

### Required
- Node.js 18+ and npm
- Google Cloud Platform account with BigQuery enabled
- Google Service Account with permissions:
  - BigQuery Data Editor
  - BigQuery Job User
  - Google Sheets API access
- Google Sheets with campaign tracker data

### Optional
- Upstash Redis account (for semantic cache)
- Microsoft Entra ID app (for SSO)

## Environment Setup

### 1. Backend Environment Variables

 `backend/.env` :


### 2. Frontend Environment Variables

 `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000      # Backend URL
```

For production, update to your backend URL:
```env
VITE_API_BASE_URL=https://your-backend-domain.com
```

### 3. Google Service Account Setup

1. Create a service account in Google Cloud Console
2. Grant permissions:
   - BigQuery Data Editor
   - BigQuery Job User
3. Enable Google Sheets API
4. Download JSON key file
5. Place in `backend/secrets/google-sa.json`
6. Share Google Sheets with service account email

### 4. Google Sheets Configuration

Update `backend/config/googleSheetsSources.json`:

```json
[
  {
    "country": "India",
    "sheetId": "your-sheet-id-here",
    "tabName": "Campaign Tracker",
    "enabled": true
  },
  {
    "country": "Japan",
    "sheetId": "your-sheet-id-here",
    "tabName": "Campaign Tracker",
    "enabled": true
  }
]
```

## Installation

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
npm install
```

## Running Locally

### Development Mode

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

Access: http://localhost:5173

### Production Mode

Backend:
```bash
cd backend
npm start
```

Frontend:
```bash
cd frontend
npm run build
npm run preview
```

## Deployment

### Option 1: Render.com (Recommended)

#### Backend Deployment
1. Connect GitHub repository to Render
2. Create new Web Service
3. Configure:
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Environment**: Node
4. Add all environment variables from `backend/.env`
5. Deploy

#### Frontend Deployment
1. Create new Static Site
2. Configure:
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/dist`
3. Add environment variable:
   - `VITE_API_BASE_URL`: Your backend URL
4. Deploy

### Option 2: Internal Servers

#### Using PM2 (Process Manager)

1. Install PM2 globally:
```bash
npm install -g pm2
```

2. Backend deployment:
```bash
cd backend
npm install --production
pm2 start server.js --name adops-backend
pm2 save
pm2 startup
```

3. Frontend deployment:
```bash
cd frontend
npm install
npm run build

# Serve with nginx or any static file server
# Copy dist/ folder to your web server root
```

#### Using Docker

Create `Dockerfile` in root:

```dockerfile
# Backend
FROM node:18-alpine AS backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./

# Frontend
FROM node:18-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Production
FROM node:18-alpine
WORKDIR /app
COPY --from=backend /app/backend ./backend
COPY --from=frontend /app/frontend/dist ./frontend/dist
EXPOSE 5000
CMD ["node", "backend/server.js"]
```

Build and run:
```bash
docker build -t adops-dashboard .
docker run -p 5000:5000 --env-file backend/.env adops-dashboard
```

## Smart Sync Strategy (IMPORTANT)

### How It Works

The system uses an intelligent sync strategy:

#### First Sync (After Deployment)
- **Detection**: Table is empty OR has < 500 rows OR no historical data (>3 months old)
- **Action**: Syncs ALL historical data from Google Sheets
- **Duration**: ~5-10 minutes (depending on data volume)
- **Log**: `🚀 FIRST SYNC DETECTED: Syncing ALL historical data`

#### Subsequent Syncs (Hourly)
- **Detection**: Historical data exists in BigQuery
- **Action**: Syncs ONLY last 2 months (current + previous)
- **Duration**: ~1-2 minutes
- **Log**: `📅 SUBSEQUENT SYNC: Syncing recent 2 months only`

### Why This Matters

1. **Automatic Recovery**: If data is lost, the system automatically restores it on the next sync
2. **Performance**: Hourly syncs are fast (only 2 months)
3. **Data Preservation**: Historical data is never deleted by hourly syncs
4. **No Manual Intervention**: System self-heals automatically

### Deployment Steps

1. **Deploy the application** (backend + frontend)
2. **Wait for first hourly sync** (at :00 minutes)
   - System will detect empty/incomplete table
   - Will sync ALL historical data automatically
   - Check logs for: `🚀 FIRST SYNC DETECTED`
3. **Verify data in BigQuery**:
   ```sql
   SELECT COUNT(*) FROM campaign_tracker_consolidated;
   -- Should have ~3,000+ rows (all historical data)
   ```
4. **Subsequent syncs** will only refresh recent 2 months
   - Check logs for: `📅 SUBSEQUENT SYNC`

### Manual Sync (If Needed)

If you need to trigger a manual full refresh:

```bash
curl -X POST https://your-backend-url/api/overview/sync/bigquery \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullRefresh": true}'
```

Or use the admin panel in the dashboard.

## Monitoring

### Check Sync Status

#### Via API
```bash
curl https://your-backend-url/api/overview/sync/bigquery/status
```

#### Via BigQuery
```sql
SELECT sync_id, synced_at, status, mode, row_count, message
FROM `your-project.adops_dashboard.campaign_tracker_sync_state`
ORDER BY synced_at DESC
LIMIT 10;
```

Expected modes:
- `first_sync` - Initial sync after deployment (should see once)
- `recent_only` - Normal hourly sync (should see every hour)
- `full_refresh` - Manual full refresh

### Check Data Integrity

```sql
-- Total row count
SELECT COUNT(*) as total_rows 
FROM `your-project.adops_dashboard.campaign_tracker_consolidated`;

-- Data distribution by month/year
SELECT year, month, COUNT(*) as row_count
FROM `your-project.adops_dashboard.campaign_tracker_consolidated`
GROUP BY year, month
ORDER BY year DESC, 
  CASE month
    WHEN 'January' THEN 1
    WHEN 'February' THEN 2
    WHEN 'March' THEN 3
    WHEN 'April' THEN 4
    WHEN 'May' THEN 5
    WHEN 'June' THEN 6
    WHEN 'July' THEN 7
    WHEN 'August' THEN 8
    WHEN 'September' THEN 9
    WHEN 'October' THEN 10
    WHEN 'November' THEN 11
    WHEN 'December' THEN 12
  END DESC;

-- Check for recent data
SELECT MAX(synced_at) as last_sync
FROM `your-project.adops_dashboard.campaign_tracker_consolidated`;
```

### Application Logs

Monitor these log patterns:

**Successful Sync**:
```
[BigQuery Scheduler] Starting scheduled sync...
[isFirstSyncNeeded] Current table row count: X
[BigQuery Scheduler] 🚀 FIRST SYNC DETECTED / 📅 SUBSEQUENT SYNC
[BigQuery Sync] ✅ Sync completed: X rows
[BigQuery Scheduler] Refreshing cache after sync...
```

**Sync Errors**:
```
[BigQuery Scheduler] Sync failed: [error message]
```

**Cache Refresh**:
```
[Semantic Cache] Refreshing cache...
[Semantic Cache] Cache refreshed successfully
```

## Troubleshooting

### Issue: Hourly Sync Not Running

**Check**:
1. `BIGQUERY_SYNC_ENABLED=true` in environment variables
2. Cron expression is valid: `BIGQUERY_SYNC_CRON=0 * * * *`
3. Server logs for scheduler initialization

**Solution**:
```bash
# Restart the backend service
pm2 restart adops-backend

# Or trigger manual sync
curl -X POST https://your-backend-url/api/overview/sync/bigquery
```

### Issue: Login Errors Every Hour

**Cause**: User cache TTL too short, conflicts with BigQuery sync

**Solution**: Ensure `BIGQUERY_USER_CACHE_MS=3600000` (1 hour)

### Issue: Missing Historical Data

**Cause**: Table was cleared or recent-only sync ran before first sync

**Solution**: 
1. Clear BigQuery table to trigger first sync:
   ```sql
   TRUNCATE TABLE `your-project.adops_dashboard.campaign_tracker_consolidated`;
   ```
2. Wait for next hourly sync (at :00 minutes)
3. System will automatically sync ALL historical data

### Issue: Slow Dashboard Performance

**Check**:
1. Redis cache is configured (optional but recommended)
2. Cache refresh intervals are appropriate
3. BigQuery query optimization

**Solution**:
- Enable Upstash Redis for semantic cache
- Adjust `SEMANTIC_CACHE_REFRESH_INTERVAL` if needed
- Monitor BigQuery query costs

### Issue: BigQuery Quota Exceeded

**Cause**: Too many queries or large data volume

**Solution**:
1. Increase cache TTL values
2. Reduce sync frequency (change cron to `0 */2 * * *` for every 2 hours)
3. Enable query result caching in BigQuery

## Security Considerations

1. **Service Account Key**: Never commit `google-sa.json` to version control
2. **Environment Variables**: Use secure secret management (e.g., Render secrets, AWS Secrets Manager)
3. **Session Secret**: Use strong random string (min 32 characters)
4. **CORS**: Configure allowed origins in production
5. **Authentication**: Enable Google OAuth or Entra ID for production
6. **API Rate Limiting**: Consider adding rate limiting middleware

## Performance Optimization

1. **Enable Redis Cache**: Reduces BigQuery queries by 80%+
2. **Adjust Cache TTLs**: Balance freshness vs. performance
3. **BigQuery Partitioning**: Partition tables by date for faster queries
4. **CDN for Frontend**: Use CDN for static assets
5. **Compression**: Enable gzip compression in Express

## Backup and Recovery

### Backup BigQuery Data
```bash
# Export to Google Cloud Storage
bq extract \
  --destination_format=NEWLINE_DELIMITED_JSON \
  your-project:adops_dashboard.campaign_tracker_consolidated \
  gs://your-bucket/backup-$(date +%Y%m%d).json
```

### Restore from Backup
```bash
# Import from Google Cloud Storage
bq load \
  --source_format=NEWLINE_DELIMITED_JSON \
  your-project:adops_dashboard.campaign_tracker_consolidated \
  gs://your-bucket/backup-20260409.json
```

### Automatic Recovery
The smart sync strategy provides automatic recovery:
- If data is lost, next hourly sync will restore ALL historical data
- No manual intervention required

## Scaling Considerations

### Horizontal Scaling
- Backend: Multiple instances behind load balancer
- Frontend: Static files on CDN
- Database: BigQuery scales automatically

### Vertical Scaling
- Increase backend instance size for more concurrent users
- Optimize BigQuery queries for large datasets

## Support and Documentation

### Additional Documentation
- `SMART_SYNC_STRATEGY.md` - Detailed sync strategy documentation
- `BIGQUERY_DEV_PROD_SETUP.md` - Dev/Prod environment setup
- `AI_SETUP_GUIDE.md` - AI chatbot configuration
- `UPSTASH_REDIS_SETUP_GUIDE.md` - Redis cache setup

### Common Tasks

**Add New Country**:
1. Update `backend/config/googleSheetsSources.json`
2. Restart backend service
3. Trigger manual sync

**Change Sync Schedule**:
1. Update `BIGQUERY_SYNC_CRON` in environment variables
2. Restart backend service

**Disable Automatic Sync**:
1. Set `BIGQUERY_SYNC_ENABLED=false`
2. Restart backend service

**View Sync Logs**:
```bash
# PM2
pm2 logs adops-backend

# Docker
docker logs -f container-id

# Render
View logs in Render dashboard
```

## License
Proprietary - Internal Use Only

## Contact
For deployment issues or questions, contact the development team.
