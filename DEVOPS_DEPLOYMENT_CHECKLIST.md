# DevOps Deployment Checklist

## Pre-Deployment

### 1. Environment Preparation
- [ ] Node.js 18+ installed on server
- [ ] npm installed and updated
- [ ] Git installed
- [ ] PM2 installed globally (if using PM2): `npm install -g pm2`
- [ ] Nginx installed (for frontend static files)

### 2. Google Cloud Setup
- [ ] GCP project created
- [ ] BigQuery API enabled
- [ ] Google Sheets API enabled
- [ ] Service account created with permissions:
  - [ ] BigQuery Data Editor
  - [ ] BigQuery Job User
  - [ ] Google Sheets API access
- [ ] Service account JSON key downloaded
- [ ] Google Sheets shared with service account email

### 3. BigQuery Setup
- [ ] Dataset created: `adops_dashboard` (production) or `adops_dashboard_dev` (development)
- [ ] Tables will be auto-created on first sync:
  - `campaign_tracker_consolidated`
  - `overview_transition_metrics`
  - `campaign_tracker_sync_state`

### 4. Configuration Files
- [ ] `backend/.env` created with all required variables
- [ ] `backend/secrets/google-sa.json` placed (service account key)
- [ ] `backend/config/googleSheetsSources.json` configured with sheet IDs
- [ ] `frontend/.env` created with backend URL

## Deployment Steps

### Backend Deployment

#### Option A: Using PM2 (Recommended for Internal Servers)

```bash
# 1. Clone repository
git clone https://github.com/naveenkumar-spec/ad_ops_dashboard.git
cd ad_ops_dashboard
git checkout dev  # or main for production

# 2. Install backend dependencies
cd backend
npm install --production

# 3. Verify environment variables
cat .env  # Check all variables are set

# 4. Test run (optional)
npm start  # Press Ctrl+C after verifying it starts

# 5. Start with PM2
pm2 start server.js --name adops-backend --env production

# 6. Save PM2 configuration
pm2 save

# 7. Setup PM2 to start on boot
pm2 startup
# Follow the command it outputs

# 8. Check status
pm2 status
pm2 logs adops-backend --lines 50
```

#### Option B: Using Docker

```bash
# 1. Build Docker image
docker build -t adops-dashboard:latest .

# 2. Run container
docker run -d \
  --name adops-backend \
  -p 5000:5000 \
  --env-file backend/.env \
  --restart unless-stopped \
  adops-dashboard:latest

# 3. Check logs
docker logs -f adops-backend
```

### Frontend Deployment

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Build for production
npm run build

# 3. Copy dist folder to web server
sudo cp -r dist/* /var/www/html/adops-dashboard/

# 4. Configure Nginx (see below)
```

#### Nginx Configuration

Create `/etc/nginx/sites-available/adops-dashboard`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /var/www/html/adops-dashboard;
        try_files $uri $uri/ /index.html;
        
        # Enable gzip compression
        gzip on;
        gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/adops-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Post-Deployment Verification

### 1. Backend Health Check
- [ ] Backend is running: `pm2 status` or `docker ps`
- [ ] Backend logs show no errors: `pm2 logs adops-backend` or `docker logs adops-backend`
- [ ] Backend responds to health check: `curl http://localhost:5000/api/health`

### 2. Scheduler Verification
- [ ] Check logs for scheduler initialization:
  ```
  [BigQuery Scheduler] Tracker sync: 0 * * * * (recent 2 months only, hourly)
  [BigQuery Scheduler] Transition refresh: Daily at 12:00 AM IST
  ```
- [ ] Wait for first hourly sync (at :00 minutes)
- [ ] Check logs for first sync detection:
  ```
  [BigQuery Scheduler] 🚀 FIRST SYNC DETECTED: Syncing ALL historical data
  ```

### 3. BigQuery Data Verification
- [ ] Check sync state table:
  ```sql
  SELECT sync_id, synced_at, status, mode, row_count, message
  FROM `your-project.adops_dashboard.campaign_tracker_sync_state`
  ORDER BY synced_at DESC
  LIMIT 5;
  ```
- [ ] Verify first sync mode is `first_sync`
- [ ] Check data in main table:
  ```sql
  SELECT COUNT(*) as total_rows
  FROM `your-project.adops_dashboard.campaign_tracker_consolidated`;
  -- Should have 3000+ rows after first sync
  ```
- [ ] Verify historical data exists:
  ```sql
  SELECT year, month, COUNT(*) as row_count
  FROM `your-project.adops_dashboard.campaign_tracker_consolidated`
  GROUP BY year, month
  ORDER BY year DESC, month DESC
  LIMIT 20;
  -- Should show data from multiple years
  ```

### 4. Frontend Verification
- [ ] Frontend loads: `curl http://your-domain.com`
- [ ] Frontend can reach backend: Check browser console for API errors
- [ ] Dashboard displays data correctly
- [ ] All charts render properly
- [ ] Filters work correctly
- [ ] Download buttons work

### 5. Authentication Verification
- [ ] Google OAuth login works (if enabled)
- [ ] Microsoft Entra ID login works (if enabled)
- [ ] User sessions persist correctly
- [ ] No login errors after hourly sync

### 6. Subsequent Sync Verification
- [ ] Wait for second hourly sync (1 hour after first)
- [ ] Check logs for recent-only mode:
  ```
  [BigQuery Scheduler] 📅 SUBSEQUENT SYNC: Syncing recent 2 months only
  ```
- [ ] Verify data count remains stable:
  ```sql
  SELECT COUNT(*) FROM campaign_tracker_consolidated;
  -- Should be same as after first sync (~3000+ rows)
  ```
- [ ] Verify historical data preserved:
  ```sql
  SELECT COUNT(*) FROM campaign_tracker_consolidated
  WHERE year < 2026;
  -- Should have historical data intact
  ```

## Monitoring Setup

### 1. Application Monitoring
- [ ] PM2 monitoring enabled: `pm2 monitor`
- [ ] Log rotation configured:
  ```bash
  pm2 install pm2-logrotate
  pm2 set pm2-logrotate:max_size 10M
  pm2 set pm2-logrotate:retain 7
  ```

### 2. Alerts Setup (Optional)
- [ ] Configure email alerts for sync failures
- [ ] Set up uptime monitoring (e.g., UptimeRobot, Pingdom)
- [ ] Configure BigQuery quota alerts

### 3. Backup Setup
- [ ] Schedule BigQuery exports to Cloud Storage:
  ```bash
  # Add to crontab
  0 2 * * * bq extract --destination_format=NEWLINE_DELIMITED_JSON \
    your-project:adops_dashboard.campaign_tracker_consolidated \
    gs://your-backup-bucket/backup-$(date +\%Y\%m\%d).json
  ```

## Common Issues and Solutions

### Issue: First Sync Not Detected
**Symptoms**: Logs show "SUBSEQUENT SYNC" on first run, missing historical data

**Solution**:
```sql
-- Clear table to trigger first sync
TRUNCATE TABLE `your-project.adops_dashboard.campaign_tracker_consolidated`;
```
Wait for next hourly sync.

### Issue: Hourly Sync Not Running
**Symptoms**: No sync logs at :00 minutes

**Check**:
1. `BIGQUERY_SYNC_ENABLED=true` in .env
2. Backend is running: `pm2 status`
3. No errors in logs: `pm2 logs adops-backend`

**Solution**:
```bash
pm2 restart adops-backend
pm2 logs adops-backend --lines 100
```

### Issue: Login Errors Every Hour
**Symptoms**: Users get logged out or errors at :00 minutes

**Cause**: User cache TTL too short

**Solution**: Verify `BIGQUERY_USER_CACHE_MS=3600000` in .env

### Issue: Slow Dashboard Performance
**Symptoms**: Dashboard takes >5 seconds to load

**Solutions**:
1. Enable Redis cache (Upstash)
2. Check BigQuery query performance
3. Verify cache refresh intervals
4. Enable Nginx gzip compression

### Issue: BigQuery Quota Exceeded
**Symptoms**: Sync fails with quota error

**Solutions**:
1. Increase cache TTL values
2. Reduce sync frequency: `BIGQUERY_SYNC_CRON=0 */2 * * *` (every 2 hours)
3. Request quota increase from Google Cloud

## Rollback Procedure

If deployment fails or issues occur:

### 1. Rollback Code
```bash
# Find previous commit
git log --oneline -5

# Rollback to previous version
git checkout <previous-commit-hash>

# Restart services
pm2 restart adops-backend
```

### 2. Restore BigQuery Data (if needed)
```bash
# From backup
bq load \
  --source_format=NEWLINE_DELIMITED_JSON \
  your-project:adops_dashboard.campaign_tracker_consolidated \
  gs://your-backup-bucket/backup-YYYYMMDD.json
```

### 3. Disable Automatic Sync (if needed)
```bash
# Update .env
BIGQUERY_SYNC_ENABLED=false

# Restart
pm2 restart adops-backend
```

## Performance Benchmarks

Expected performance after deployment:

- **First Sync Duration**: 5-10 minutes (3000+ rows)
- **Subsequent Sync Duration**: 1-2 minutes (recent 2 months)
- **Dashboard Load Time**: 2-3 seconds (with cache)
- **API Response Time**: <500ms (cached queries)
- **BigQuery Query Cost**: ~$0.01 per sync (with cache)

## Security Checklist

- [ ] Service account key file has restricted permissions: `chmod 600 backend/secrets/google-sa.json`
- [ ] .env file has restricted permissions: `chmod 600 backend/.env`
- [ ] Firewall configured to allow only necessary ports
- [ ] HTTPS enabled (SSL certificate installed)
- [ ] CORS configured for production domain only
- [ ] Session secret is strong (32+ characters)
- [ ] No sensitive data in logs
- [ ] Regular security updates scheduled

## Maintenance Schedule

### Daily
- Check application logs for errors
- Verify hourly syncs are running
- Monitor BigQuery costs

### Weekly
- Review sync performance metrics
- Check disk space usage
- Verify backups are working

### Monthly
- Update dependencies: `npm update`
- Review and rotate logs
- Test disaster recovery procedure
- Review BigQuery quota usage

## Support Contacts

- **Development Team**: [contact info]
- **Google Cloud Support**: [support link]
- **Emergency Escalation**: [contact info]

## Documentation References

- Main README: `README.md`
- Smart Sync Strategy: `SMART_SYNC_STRATEGY.md`
- Implementation Summary: `SMART_SYNC_IMPLEMENTATION_SUMMARY.md`
- BigQuery Setup: `BIGQUERY_DEV_PROD_SETUP.md`
- Redis Setup: `UPSTASH_REDIS_SETUP_GUIDE.md`

## Sign-off

Deployment completed by: ___________________  
Date: ___________________  
Environment: [ ] Development [ ] Production  
All checks passed: [ ] Yes [ ] No  
Issues noted: ___________________
