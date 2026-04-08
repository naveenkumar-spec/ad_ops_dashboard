# Environment Verification Checklist

## How to Verify Which Environment You're Using

### 1. Check Your Browser URL

#### Production URLs:
```
Frontend: https://ad-ops-dashboard.vercel.app
Backend:  https://adops-dashboard-backend.onrender.com
```

#### Development URLs:
```
Frontend: https://ad-ops-dashboard-git-dev-[your-username].vercel.app
Backend:  https://adops-dashboard-backend-dev.onrender.com
```

#### Local Development:
```
Frontend: http://localhost:3000
Backend:  http://localhost:5000
```

### 2. Check Backend Dataset in Use

Open browser console and run:
```javascript
// Check which backend you're connected to
fetch('/api/overview/last-sync')
  .then(r => r.json())
  .then(d => console.log('Backend:', d))
```

Or check the Network tab:
- Look at API calls
- Check the domain (localhost, render.com, etc.)

### 3. Check Backend Logs

#### On Render (Production):
1. Go to https://dashboard.render.com
2. Select "adops-dashboard-backend" service
3. Click "Logs" tab
4. Look for: `BIGQUERY_DATASET_ID=adops_dashboard` (production)

#### On Render (Dev):
1. Go to https://dashboard.render.com
2. Select "adops-dashboard-backend-dev" service
3. Click "Logs" tab
4. Look for: `BIGQUERY_DATASET_ID=adops_dashboard_dev` (development)

#### Local:
Check your terminal where you ran `node server.js`
Look for: `BIGQUERY_DATASET_ID=adops_dashboard_dev`

### 4. Check Git Branch Locally

```bash
# Check current branch
git branch --show-current

# Should show: dev (for development work)
# Should show: main (for production deployments)
```

### 5. Check Which Code is Running

#### Check for Semantic Cache (Only in Dev):
```bash
# Call cache stats endpoint (only exists in dev)
curl https://adops-dashboard-backend-dev.onrender.com/api/cache/stats

# Production will return 404 (cache not deployed yet)
curl https://adops-dashboard-backend.onrender.com/api/cache/stats
```

#### Check Server Startup Logs:
```
Development (with cache):
[SemanticCache] Initialized
[CachedBigQueryService] Initializing semantic cache...
✅ Semantic cache ready - dashboard will be fast!

Production (without cache):
(No cache messages - cache not deployed yet)
```

### 6. Verify Dataset Contents

#### Check Dev Dataset:
```sql
SELECT COUNT(*) as row_count, 
       MAX(synced_at) as last_sync
FROM `tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated`
```

#### Check Prod Dataset:
```sql
SELECT COUNT(*) as row_count,
       MAX(synced_at) as last_sync  
FROM `tactile-petal-820.adops_dashboard.campaign_tracker_consolidated`
```

Different row counts = different datasets = proper isolation ✓

## Common Confusion Scenarios

### Scenario 1: "I see the cache issue on the dashboard"

**Question to ask**: Which URL are you using?

- If `*-git-dev-*.vercel.app` → You're on DEV (expected to see dev features)
- If `ad-ops-dashboard.vercel.app` → You're on PROD (shouldn't have cache yet)

### Scenario 2: "The data looks different"

**Question to ask**: Which dataset is being used?

- Dev uses `adops_dashboard_dev` (may have test data)
- Prod uses `adops_dashboard` (real production data)

### Scenario 3: "I made changes but don't see them"

**Question to ask**: Which branch did you push to?

- Pushed to `dev` → Only dev environment updates
- Pushed to `main` → Only production updates
- Need to merge `dev` → `main` to deploy to production

### Scenario 4: "Local changes affect production"

**Answer**: They don't! Local development:
- Uses `backend/.env` (points to dev dataset)
- Runs on `localhost:5000` (not production URL)
- Completely isolated from production

## Quick Reference Table

| Environment | Branch | Dataset | Frontend URL | Backend URL | Has Cache? |
|-------------|--------|---------|--------------|-------------|------------|
| **Local Dev** | dev | adops_dashboard_dev | localhost:3000 | localhost:5000 | ✅ Yes |
| **Render Dev** | dev | adops_dashboard_dev | *-git-dev-*.vercel.app | *-backend-dev.onrender.com | ✅ Yes |
| **Production** | main | adops_dashboard | ad-ops-dashboard.vercel.app | *-backend.onrender.com | ❌ Not yet |

## How to Switch Environments

### To Test on Dev:
1. Make sure you're on dev branch: `git checkout dev`
2. Use dev backend URL in frontend config
3. Or run locally with `backend/.env` (dev dataset)

### To Test on Production:
1. Make sure you're on main branch: `git checkout main`
2. Use production backend URL
3. Or deploy to production (merge dev → main)

### To Deploy Dev Changes to Production:
```bash
# 1. Make sure dev is working
git checkout dev
# Test thoroughly

# 2. Merge to main
git checkout main
git merge dev

# 3. Push to production
git push origin main

# 4. Render and Vercel auto-deploy
# Wait 2-3 minutes for deployment
```

## Verification Script

Save this as `check-environment.sh`:

```bash
#!/bin/bash

echo "=== Environment Check ==="
echo ""
echo "Current Git Branch:"
git branch --show-current
echo ""
echo "Local Dataset Config:"
grep BIGQUERY_DATASET_ID backend/.env
echo ""
echo "Production Dataset Config:"
grep BIGQUERY_DATASET_ID backend/.env.production
echo ""
echo "Recent Commits on Dev (not in Main):"
git log main..dev --oneline | wc -l
echo ""
echo "=== Summary ==="
if [ "$(git branch --show-current)" = "dev" ]; then
    echo "✅ You're on DEV branch (safe to make changes)"
    echo "✅ Changes will NOT affect production"
else
    echo "⚠️  You're on MAIN branch (production)"
    echo "⚠️  Changes will affect production when pushed"
fi
```

Run with: `bash check-environment.sh`

## Final Verification

Before deploying to production, verify:

- [ ] All changes tested on dev environment
- [ ] Dev branch working correctly
- [ ] No errors in dev logs
- [ ] Cache refresh working on dev
- [ ] Ready to merge to main
- [ ] Production backup taken (if needed)
- [ ] Rollback plan ready

## Need Help?

If you're still unsure which environment you're using:

1. **Check the URL in your browser** (easiest way)
2. **Check browser console** for API calls
3. **Check Render dashboard** for which service is running
4. **Check git branch** locally
5. **Check backend logs** for dataset name

Remember: **Dev and Production are completely isolated!** Changes in dev cannot affect production until you explicitly merge and deploy.
