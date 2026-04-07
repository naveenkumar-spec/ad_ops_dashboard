# What "Incremental" Actually Means in Your System

## TL;DR - The Problem

**"Incremental" in your system does NOT mean "only sync changed data"**

It means:
1. ✅ Read ALL data from ALL Google Sheets (same as full refresh)
2. ✅ Process ALL campaigns (same as full refresh)
3. ❌ **BUT: Don't truncate the table before inserting**
4. ❌ **Result: APPEND all data on top of existing data**

This is why you're getting duplicates!

## What Actually Happens

### Incremental Mode (fullRefresh: false)
```javascript
// Line 647: Read ALL data from sheets
const rows = await privateSheetsService.loadAllRows(...);
// Returns: 2,969 rows (ALL campaigns, ALL countries)

// Line 672: Skip transition table (performance optimization)
if (fullRefresh) {
  // Only runs on full refresh
} else {
  console.log("INCREMENTAL SYNC: Skipping transition table");
}

// Line 724: NO TRUNCATE - This is the problem!
if (fullRefresh) {
  await bigquery.query(`TRUNCATE TABLE ...`); // Only runs on full refresh
}

// Line 735: INSERT all 2,969 rows
await table.insert(batch); // Appends to existing data
```

**Result:**
- Hour 1: Table has 2,969 rows (sync_id_1)
- Hour 2: Table has 5,938 rows (sync_id_1 + sync_id_2) ← Duplicates!
- Hour 3: Table has 8,907 rows (sync_id_1 + sync_id_2 + sync_id_3) ← More duplicates!

### Full Refresh Mode (fullRefresh: true)
```javascript
// Line 647: Read ALL data from sheets
const rows = await privateSheetsService.loadAllRows(...);
// Returns: 2,969 rows (ALL campaigns, ALL countries)

// Line 672: Also read transition table data
const rawBrandingData = await getBrandingSheetRawData();
transitionRows = toTransitionRows(...);

// Line 724: TRUNCATE FIRST - This prevents duplicates!
if (fullRefresh) {
  await bigquery.query(`TRUNCATE TABLE ...`); // Deletes all existing rows
}

// Line 735: INSERT all 2,969 rows into empty table
await table.insert(batch);
```

**Result:**
- Hour 1: Table has 2,969 rows (sync_id_1)
- Hour 2: Table has 2,969 rows (sync_id_2) ← Old data deleted, new data inserted
- Hour 3: Table has 2,969 rows (sync_id_3) ← Always clean data

## What "Incremental" Does NOT Do

❌ **It does NOT sync only recent data (last 3 days)**
❌ **It does NOT sync only changed campaigns**
❌ **It does NOT update existing rows**
❌ **It does NOT delete old rows**

## What "Incremental" DOES Do

✅ Reads ALL data from ALL sheets (same as full refresh)
✅ Processes ALL campaigns (same as full refresh)
✅ Skips transition table update (performance optimization)
✅ Skips checksum comparison if data unchanged (can skip sync entirely)
✅ **Appends data without truncating** (THIS CAUSES DUPLICATES)

## Why Was It Designed This Way?

Looking at the code comments:

```javascript
// Line 632: "Use lighter options for incremental sync"
// Line 658: "Skip transition table processing for incremental syncs to save resources"
// Line 659: "INCREMENTAL SYNC: Skipping transition table update for better performance"
```

**Intent:** Save resources by:
1. Not updating transition table (legacy branding data)
2. Potentially skipping sync if data unchanged (checksum comparison)

**Problem:** The code reads ALL data but doesn't truncate before inserting, causing duplicates.

## The Real Issue

The "incremental" mode was designed to be a **performance optimization**, not a true incremental sync. It should have been called "skip_transition_table" mode.

A true incremental sync would:
1. Track which campaigns changed since last sync
2. Only read changed campaigns from sheets
3. Use MERGE/UPSERT to update existing rows
4. Delete campaigns that no longer exist

But your current implementation:
1. Reads ALL campaigns every time
2. Inserts ALL campaigns every time
3. Never deletes old data
4. Results in duplicates

## Why Checksum Doesn't Help

The code has checksum logic (line 680-700):
```javascript
const checksum = computeChecksum(rows, transitionRows);
const previousChecksum = await getLastChecksum();

if (skipIfUnchanged && previousChecksum && previousChecksum === checksum) {
  // Skip sync entirely if data unchanged
  return { skipped: true, message: "No data change detected" };
}
```

**This helps when:**
- Data hasn't changed at all → Skip sync entirely
- Saves BigQuery writes

**This doesn't help when:**
- Data HAS changed (which is most of the time)
- Sync runs and appends duplicates

## The Fix

Change incremental mode to full refresh mode:
```javascript
// Before (causes duplicates):
fullRefresh: false, // Reads all data, doesn't truncate, appends

// After (prevents duplicates):
fullRefresh: true, // Reads all data, truncates first, then inserts
```

**Performance Impact:**
- Incremental: ~3-5 seconds (no truncate, no transition table)
- Full refresh: ~8-10 seconds (truncate + transition table)
- Trade-off: 5 extra seconds for data accuracy

## Alternative Solutions

### Option 1: True Incremental Sync (Complex)
```javascript
// 1. Track last sync time
const lastSyncTime = await getLastSyncTime();

// 2. Only read campaigns modified after lastSyncTime
const changedRows = await privateSheetsService.loadChangedRows(lastSyncTime);

// 3. Use MERGE to update existing rows
await bigquery.query(`
  MERGE INTO table AS target
  USING temp_table AS source
  ON target.campaign_id = source.campaign_id
  WHEN MATCHED THEN UPDATE SET ...
  WHEN NOT MATCHED THEN INSERT ...
`);
```

**Problems:**
- Google Sheets doesn't track modification time per row
- Would need to read all sheets anyway to detect changes
- More complex code
- Same resource usage as full refresh

### Option 2: Delete Old Sync IDs Before Insert
```javascript
// 1. Get current sync_id
const currentSyncId = `sync_${Date.now()}`;

// 2. Delete all rows except current sync
await bigquery.query(`
  DELETE FROM table
  WHERE sync_id != '${currentSyncId}'
`);

// 3. Insert new data
await table.insert(rows);
```

**Problems:**
- Still requires reading all data
- More queries (DELETE + INSERT vs TRUNCATE + INSERT)
- Same resource usage as full refresh

### Option 3: Use Full Refresh (Recommended)
```javascript
// 1. Truncate table
await bigquery.query(`TRUNCATE TABLE ...`);

// 2. Insert all data
await table.insert(rows);
```

**Benefits:**
- Simple and reliable
- Guarantees no duplicates
- Only 5 seconds slower
- Same resource usage as alternatives

## Conclusion

Your "incremental" mode is actually a **broken full refresh** that:
- Reads all data (like full refresh)
- Processes all data (like full refresh)
- But doesn't truncate (unlike full refresh)
- Results in duplicates

**Solution:** Use full refresh mode for all syncs. It's only 5 seconds slower and guarantees data accuracy.

## Your Question Answered

> "Are you refreshing the data only for the last 3 days and not the older or are you refreshing the data whenever you find any change?"

**Answer:** Neither!

Your incremental mode:
- ❌ Does NOT refresh only last 3 days
- ❌ Does NOT refresh only changed data
- ✅ Reads ALL data from ALL sheets
- ✅ Inserts ALL data into BigQuery
- ❌ But doesn't delete old data first
- ❌ Results in duplicates accumulating

It's essentially a full refresh without the truncate step, which causes duplicates.
