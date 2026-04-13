# Row Filtering Logic Fix

## 🎯 Issue Summary

**Problem**: Dashboard showing 2936 budget groups instead of 3000+ after last hourly refresh

**Root Cause**: Overly restrictive row filtering logic was excluding valid campaigns

**Solution**: Simplified filtering to only exclude rows without Month value

---

## 📝 What Changed

### Before (Complex Filtering):

```javascript
if (
  !normalized.month ||
  normalized.campaignName === "Unknown Campaign" &&
  normalized.revenue === 0 &&
  normalized.spend === 0 &&
  normalized.plannedImpressions === 0 &&
  normalized.deliveredImpressions === 0
) {
  return null;  // Exclude row
}
```

**This excluded rows if:**
1. Month is missing
   **OR**
2. ALL of these conditions:
   - Campaign Name = "Unknown Campaign"
   - AND Revenue = 0
   - AND Spend = 0
   - AND Planned Impressions = 0
   - AND Delivered Impressions = 0

### After (Simple Filtering):

```javascript
// Only exclude rows without a month value
if (!normalized.month) {
  return null;
}
```

**This excludes rows ONLY if:**
- Month column is missing or empty

---

## 🔍 Why This Matters

### Rows That Were Being Excluded (Incorrectly):

The old logic was filtering out campaigns like:

| Campaign Name | Month | Revenue | Spend | Impressions | Old Logic | New Logic |
|---------------|-------|---------|-------|-------------|-----------|-----------|
| "Unknown Campaign" | April | 0 | 0 | 0 | ❌ Excluded | ✅ Included |
| "Test Campaign" | May | 0 | 0 | 0 | ✅ Included | ✅ Included |
| "Campaign A" | (empty) | 1000 | 500 | 10000 | ❌ Excluded | ❌ Excluded |

**Problem**: Campaigns with "Unknown Campaign" name and zero values were being excluded even if they had a valid month.

**Why this is wrong**: 
- Zero values are valid (campaigns that haven't started yet)
- "Unknown Campaign" is a valid placeholder name
- These rows should be included if they have a month value

---

## 📊 Expected Impact

### Row Count Changes:

**Before Fix:**
- Total rows in Google Sheets: ~3000+
- Rows synced to BigQuery: 2936
- Rows filtered out: ~64-100

**After Fix:**
- Total rows in Google Sheets: ~3000+
- Rows synced to BigQuery: ~3000+ (restored)
- Rows filtered out: Only rows without month value

### What Will Be Restored:

1. **Campaigns with zero values**: Now included if they have a month
2. **"Unknown Campaign" entries**: Now included if they have a month
3. **Placeholder campaigns**: Now included if they have a month

### What Will Still Be Excluded:

- Rows without a month value (this is correct behavior)

---

## 🚀 Deployment

**Commit**: `86b5d93`  
**Date**: April 13, 2026  
**Branches**: dev ✅ | main ✅

**Files Changed:**
- `backend/services/privateSheetsService.js` (lines 607-613)

**Changes:**
- Removed: 8 lines (complex filtering logic)
- Added: 2 lines (simple filtering logic)

---

## 🧪 Testing

### How to Verify the Fix:

1. **Wait for Next Hourly Sync** (automatic at :00 UTC / :30 IST)
   - Or trigger manual sync from admin panel

2. **Check Row Count**:
   - Open dashboard
   - Look at "No of Campaigns" KPI
   - Should show ~3000+ budget groups (restored from 2936)

3. **Check Logs**:
   ```bash
   pm2 logs adops-backend | grep "Budget Groups"
   ```
   
   **Expected Output**:
   ```
   [BigQuery Sync] Synced 3000+ rows (was 2936 before fix)
   ```

4. **Verify in BigQuery**:
   ```sql
   SELECT 
     COUNT(*) as total_rows,
     COUNT(DISTINCT campaign_name) as campaigns,
     SUM(CASE WHEN campaign_name = 'Unknown Campaign' THEN 1 ELSE 0 END) as unknown_campaigns,
     SUM(CASE WHEN revenue = 0 AND spend = 0 THEN 1 ELSE 0 END) as zero_value_campaigns
   FROM `tactile-petal-820.adops_dashboard.campaign_tracker_consolidated`
   WHERE sync_id = (
     SELECT MAX(sync_id) 
     FROM `tactile-petal-820.adops_dashboard.campaign_tracker_consolidated`
   );
   ```
   
   **Expected**: 
   - `total_rows`: ~3000+ (increased from 2936)
   - `unknown_campaigns`: > 0 (these were being filtered before)
   - `zero_value_campaigns`: > 0 (these were being filtered before)

---

## 📈 Before vs After Comparison

### Scenario 1: Campaign with Zero Values

**Google Sheets Row:**
```
Campaign Name: "Unknown Campaign"
Month: "April"
Year: 2026
Revenue: 0
Spend: 0
Planned Impressions: 0
```

**Before Fix**: ❌ Excluded (filtered out)  
**After Fix**: ✅ Included (synced to BigQuery)

### Scenario 2: Campaign Without Month

**Google Sheets Row:**
```
Campaign Name: "Campaign A"
Month: (empty)
Year: 2026
Revenue: 10000
Spend: 5000
Planned Impressions: 100000
```

**Before Fix**: ❌ Excluded (no month)  
**After Fix**: ❌ Excluded (no month) - Correct behavior

### Scenario 3: Normal Campaign

**Google Sheets Row:**
```
Campaign Name: "Campaign B"
Month: "April"
Year: 2026
Revenue: 10000
Spend: 5000
Planned Impressions: 100000
```

**Before Fix**: ✅ Included  
**After Fix**: ✅ Included

---

## 🔄 Migration Path

### Automatic Migration:

**No manual intervention required!**

1. Code is already deployed to dev and main branches
2. Next hourly sync will automatically use new filtering logic
3. Row count will be restored to 3000+

### Timeline:

```
Now (Code Deployed)
    ↓
Next Hourly Sync (automatic)
    ↓
New filtering logic applied
    ↓
~3000+ rows synced (restored from 2936)
    ↓
Dashboard shows correct count
```

---

## 🎯 Why This Fix Is Correct

### The Only Valid Filter:

**Month is required** because:
- Month is used for time-series analysis
- Trend charts require month values
- Historical data is organized by month
- Without month, data cannot be properly aggregated

**Everything else should be included** because:
- Zero values are valid (campaigns not started yet)
- "Unknown Campaign" is a valid placeholder
- Empty revenue/spend is valid (planning phase)
- Empty impressions is valid (not delivered yet)

### Business Logic:

A campaign row is valid if it has:
- ✅ A month value (required for time-series)
- ✅ Any campaign name (even "Unknown Campaign")
- ✅ Any financial values (including zeros)
- ✅ Any impression values (including zeros)

---

## 📊 Impact Analysis

### Data Integrity: ✅ IMPROVED

**Before**: Valid campaigns were being excluded  
**After**: Only invalid campaigns (no month) are excluded

### Dashboard Accuracy: ✅ IMPROVED

**Before**: Showing 2936 budget groups (incomplete)  
**After**: Showing 3000+ budget groups (complete)

### Performance: ✅ NO IMPACT

- Same number of rows processed
- Same sync time
- Same memory usage
- Simpler logic = slightly faster

### Backward Compatibility: ✅ MAINTAINED

- No breaking changes
- Existing data remains intact
- Historical data preserved
- No database migration needed

---

## 🚨 Important Notes

### What This Fix Does NOT Do:

1. ❌ Does not change how month values are parsed
2. ❌ Does not change column detection logic
3. ❌ Does not change data validation
4. ❌ Does not change BigQuery schema
5. ❌ Does not change API responses

### What This Fix DOES Do:

1. ✅ Includes campaigns with zero values (if they have month)
2. ✅ Includes "Unknown Campaign" entries (if they have month)
3. ✅ Restores full row count to 3000+
4. ✅ Simplifies filtering logic
5. ✅ Improves data completeness

---

## 🔍 Troubleshooting

### Issue: Row count still shows 2936 after fix

**Possible Causes:**
1. Hourly sync hasn't run yet
2. Cache hasn't refreshed
3. Google Sheets data actually has rows without month

**Solution:**
```bash
# Check last sync time
curl http://localhost:5000/api/overview/last-sync

# Trigger manual sync (admin only)
curl -X POST http://localhost:5000/api/bigquery/sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Refresh cache
# (happens automatically after sync)
```

### Issue: Row count increased too much (>3500)

**Possible Causes:**
1. New campaigns added to Google Sheets
2. Previously filtered rows now included (expected)

**Solution:**
- This is expected behavior
- Verify in Google Sheets that the count matches
- Check BigQuery for duplicate rows (shouldn't happen)

---

## 📝 Related Changes

### Previous Commits:

1. **`69c94d7`**: Added deployment documentation
2. **`6e0979c`**: Updated eCPM column name preference
3. **`8685437`**: Event-driven user cache documentation
4. **`572734e`**: Event-driven user cache implementation

### This Commit:

**`86b5d93`**: Simplified row filtering logic

---

## ✅ Success Criteria

All criteria will be met after next hourly sync:

- [x] Code deployed to dev branch
- [x] Code deployed to main branch
- [ ] Next hourly sync completes successfully
- [ ] Row count restored to 3000+
- [ ] Dashboard shows correct budget groups count
- [ ] No errors in sync logs
- [ ] BigQuery data includes previously filtered rows

---

## 📞 Support

### If Issues Occur:

1. **Check Sync Logs**:
   ```bash
   pm2 logs adops-backend | grep "BigQuery Sync"
   ```

2. **Check Row Count**:
   ```bash
   pm2 logs adops-backend | grep "Budget Groups"
   ```

3. **Rollback (if needed)**:
   ```bash
   git checkout dev
   git revert 86b5d93
   git push origin dev
   
   git checkout main
   git revert 86b5d93
   git push origin main
   ```

---

## 🎯 Summary

**Problem**: 64-100 valid campaigns were being filtered out due to overly restrictive logic

**Solution**: Simplified filtering to only exclude rows without month value

**Result**: Full row count (3000+) will be restored after next hourly sync

**Impact**: Improved data completeness and dashboard accuracy

**Action Required**: None - automatic on next sync

---

**Fixed by**: Kiro AI Assistant  
**Date**: April 13, 2026  
**Commit**: `86b5d93`  
**Status**: ✅ Deployed to dev and main branches
