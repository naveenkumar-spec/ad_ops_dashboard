# True Incremental Sync Design

## Goal

Update only changed/new data without scanning entire dataset:
- **Changed rows**: Camp1 revenue 100→200 (update only this)
- **Unchanged rows**: Camp2 revenue 300→300 (skip)
- **New rows**: Camp3 added (insert)
- **Deleted rows**: Camp4 removed (delete)

## The Challenge: Google Sheets Limitations

### What We Need vs What Google Sheets Provides

| Need | Google Sheets API | Available? |
|------|-------------------|------------|
| Last modified timestamp per row | ❌ No | ❌ |
| Change tracking/audit log | ❌ No | ❌ |
| Row-level version history | ❌ No | ❌ |
| Incremental export API | ❌ No | ❌ |
| Change notifications/webhooks | ❌ No | ❌ |
| Cell-level edit timestamps | ❌ No | ❌ |

**Reality:** Google Sheets API only provides:
- ✅ Full sheet data export
- ✅ Sheet-level last modified time (not row-level)
- ✅ Cell values (no metadata about when changed)

### The Fundamental Problem

```
Google Sheets API Response:
[
  ["Campaign Name", "Revenue", "Spend", ...],
  ["Camp1", "200", "150", ...],        // Was this changed or not?
  ["Camp2", "300", "200", ...],        // No way to know!
  ["Camp3", "400", "250", ...]         // Is this new or existing?
]

Missing Information:
- When was each row last modified?
- Which cells changed since last sync?
- Which rows are new vs existing?
- Which rows were deleted?
```

## Possible Solutions

### Solution 1: Client-Side Change Detection (Recommended)

**Approach:** Compare current sheet data with previous BigQuery data to detect changes.

```javascript
// Pseudo-code
async function detectChanges() {
  // 1. Read current data from Google Sheets
  const currentData = await readAllSheets(); // 2,969 rows
  
  // 2. Read previous data from BigQuery
  const previousData = await bigquery.query(`
    SELECT * FROM table WHERE sync_id = (
      SELECT sync_id FROM state_table 
      ORDER BY synced_at DESC LIMIT 1
    )
  `); // 2,969 rows
  
  // 3. Build hash maps for comparison
  const currentMap = new Map();
  currentData.forEach(row => {
    const key = `${row.campaign_id}_${row.month}_${row.year}`;
    const hash = computeRowHash(row); // Hash of all values
    currentMap.set(key, { row, hash });
  });
  
  const previousMap = new Map();
  previousData.forEach(row => {
    const key = `${row.campaign_id}_${row.month}_${row.year}`;
    const hash = computeRowHash(row);
    previousMap.set(key, { row, hash });
  });
  
  // 4. Detect changes
  const toInsert = []; // New rows
  const toUpdate = []; // Changed rows
  const toDelete = []; // Deleted rows
  
  // Find new and changed rows
  for (const [key, current] of currentMap) {
    const previous = previousMap.get(key);
    
    if (!previous) {
      toInsert.push(current.row); // New row
    } else if (current.hash !== previous.hash) {
      toUpdate.push(current.row); // Changed row
    }
    // else: unchanged, skip
  }
  
  // Find deleted rows
  for (const [key, previous] of previousMap) {
    if (!currentMap.has(key)) {
      toDelete.push(previous.row); // Deleted row
    }
  }
  
  return { toInsert, toUpdate, toDelete };
}
```

**Performance:**
```
Read Sheets: 2-3 seconds (unavoidable)
Read BigQuery: 1-2 seconds (need previous data)
Compare: <1 second (in-memory hash comparison)
Write Changes: 0.5-2 seconds (only changed rows)
Total: ~5-8 seconds

vs Full Refresh:
Read Sheets: 2-3 seconds
Truncate: <1 second
Write All: 1-2 seconds
Total: ~4-6 seconds
```

**Problem:** Not much faster! Still need to read all sheets to detect changes.

### Solution 2: Add Timestamp Column to Sheets (Best but Requires Sheet Changes)

**Approach:** Add "Last Modified" column to each sheet, manually updated or via Apps Script.

```javascript
// Google Sheets structure:
Campaign Name | Revenue | Spend | Last Modified
Camp1         | 200     | 150   | 2026-04-07 10:30:00  ← Changed today
Camp2         | 300     | 200   | 2026-04-06 14:20:00  ← Old
Camp3         | 400     | 250   | 2026-04-07 11:00:00  ← New today

// Sync logic:
async function syncIncremental() {
  const lastSyncTime = await getLastSyncTime(); // 2026-04-07 09:00:00
  
  // Only read rows modified after last sync
  const changedRows = await readSheets({
    filter: row => row.lastModified > lastSyncTime
  });
  
  // Use MERGE to update/insert
  await bigquery.query(`
    MERGE INTO table AS target
    USING temp_table AS source
    ON target.campaign_id = source.campaign_id 
       AND target.month = source.month
       AND target.year = source.year
    WHEN MATCHED THEN UPDATE SET *
    WHEN NOT MATCHED THEN INSERT *
  `);
}
```

**Performance:**
```
Read Sheets: 2-3 seconds (still need to read all to filter)
MERGE Query: 1-2 seconds (only updates changed rows)
Total: ~3-5 seconds

Benefit: Cleaner logic, proper UPSERT
Problem: Still need to read all sheets (API limitation)
```

**Requirements:**
- ❌ Add "Last Modified" column to all 17 country sheets
- ❌ Train users to update timestamp when editing
- ❌ OR implement Apps Script to auto-update timestamp
- ❌ Maintenance overhead

### Solution 3: Use BigQuery MERGE (Recommended Compromise)

**Approach:** Read all data (unavoidable) but use MERGE instead of TRUNCATE+INSERT.

```javascript
async function syncWithMerge() {
  // 1. Read all data from sheets (unavoidable)
  const rows = await readAllSheets(); // 2-3 seconds
  
  // 2. Load into temp table
  await bigquery.load(tempTable, rows); // 1 second
  
  // 3. MERGE into main table
  await bigquery.query(`
    MERGE INTO \`${project}.${dataset}.${table}\` AS target
    USING \`${project}.${dataset}.temp_table\` AS source
    ON target.campaign_id = source.campaign_id
       AND target.month = source.month
       AND target.year = source.year
       AND target.country = source.country
    WHEN MATCHED AND (
      target.revenue != source.revenue OR
      target.spend != source.spend OR
      target.status != source.status
      -- ... check all columns
    ) THEN UPDATE SET
      target.revenue = source.revenue,
      target.spend = source.spend,
      target.status = source.status,
      -- ... update all columns
      target.synced_at = source.synced_at,
      target.sync_id = source.sync_id
    WHEN NOT MATCHED THEN INSERT (
      campaign_id, revenue, spend, ...
    ) VALUES (
      source.campaign_id, source.revenue, source.spend, ...
    )
  `); // 2-3 seconds
  
  // 4. Delete rows not in source (optional)
  await bigquery.query(`
    DELETE FROM \`${project}.${dataset}.${table}\` AS target
    WHERE NOT EXISTS (
      SELECT 1 FROM \`${project}.${dataset}.temp_table\` AS source
      WHERE target.campaign_id = source.campaign_id
        AND target.month = source.month
        AND target.year = source.year
    )
  `); // 1 second
}
```

**Performance:**
```
Read Sheets: 2-3 seconds
Load Temp: 1 second
MERGE: 2-3 seconds
DELETE: 1 second
Total: ~6-8 seconds

vs Full Refresh:
Read Sheets: 2-3 seconds
Truncate: <1 second
Insert: 1-2 seconds
Total: ~4-6 seconds
```

**Benefit:** 
- ✅ Proper UPSERT logic
- ✅ Only updates changed rows in BigQuery
- ✅ No sheet modifications needed

**Problem:** 
- ❌ Still reads all sheets (API limitation)
- ❌ More complex queries
- ❌ Slightly slower than full refresh

### Solution 4: Partition by Date + Only Sync Recent Data

**Approach:** Only sync data from last N days, assume older data doesn't change.

```javascript
async function syncRecentOnly() {
  const daysToSync = 7; // Only sync last 7 days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToSync);
  
  // 1. Read all sheets (unavoidable)
  const allRows = await readAllSheets(); // 2-3 seconds
  
  // 2. Filter to recent data only
  const recentRows = allRows.filter(row => {
    const rowDate = new Date(row.startDate || row.endDate);
    return rowDate >= cutoffDate;
  }); // Might be 500 rows instead of 2,969
  
  // 3. Delete recent data from BigQuery
  await bigquery.query(`
    DELETE FROM table
    WHERE start_date >= '${cutoffDate.toISOString()}'
  `);
  
  // 4. Insert recent data
  await table.insert(recentRows);
}
```

**Performance:**
```
Read Sheets: 2-3 seconds (still all sheets)
Filter: <1 second
Delete Recent: <1 second
Insert Recent: <1 second (fewer rows)
Total: ~4-6 seconds

Benefit: Fewer rows to process
Problem: Assumes old data never changes (risky!)
```

## Reality Check: Why True Incremental is Hard

### The Math

```
Current Approach (Full Refresh):
├─ Read 17 sheets: 2-3 seconds (unavoidable)
├─ Process 2,969 rows: <1 second
├─ Truncate: <1 second
├─ Insert 2,969 rows: 1-2 seconds
└─ Total: ~5-7 seconds

True Incremental (Best Case):
├─ Read 17 sheets: 2-3 seconds (STILL UNAVOIDABLE!)
├─ Read BigQuery previous: 1-2 seconds (NEW OVERHEAD!)
├─ Compare 2,969 rows: <1 second
├─ Update 50 changed rows: <1 second
└─ Total: ~5-7 seconds (SAME!)

Why No Improvement?
- Google Sheets API forces full read (2-3 seconds)
- This is 50-60% of total sync time
- Can't avoid it without sheet-level change tracking
- Comparison overhead negates savings from fewer writes
```

### The Bottleneck

```
Sync Time Breakdown:
┌─────────────────────────────────────┐
│ Read Google Sheets: 2-3 sec (50%)   │ ← BOTTLENECK (unavoidable)
├─────────────────────────────────────┤
│ Process Data: <1 sec (15%)          │
├─────────────────────────────────────┤
│ Write BigQuery: 1-2 sec (35%)       │ ← Can optimize here
└─────────────────────────────────────┘

Even if we optimize writes to 0 seconds:
Total time: 2-3 seconds (still need to read sheets)
Current full refresh: 5-7 seconds
Savings: 2-4 seconds (not worth complexity)
```

## Recommendation: Stick with Full Refresh

### Why True Incremental Isn't Worth It

1. **Minimal Performance Gain**
   - Best case: 2-4 seconds saved
   - Worst case: Same or slower (comparison overhead)
   - Bottleneck is reading sheets (unavoidable)

2. **Significant Complexity**
   - Need to read previous data from BigQuery
   - Complex MERGE queries
   - Change detection logic
   - More things that can break

3. **No User Experience Benefit**
   - Semantic cache makes dashboard instant
   - Sync happens in background
   - Users never wait for sync
   - 2-4 seconds saved = meaningless

4. **Data Integrity Risk**
   - More complex logic = more bugs
   - MERGE queries can have edge cases
   - Harder to debug issues
   - Full refresh is bulletproof

### When True Incremental Makes Sense

True incremental sync is worth it when:
- ✅ Data source supports change tracking (database, not sheets)
- ✅ Dataset is HUGE (millions of rows, not thousands)
- ✅ Sync time is critical (users wait for it)
- ✅ Network/API costs are high

Your situation:
- ❌ Google Sheets (no change tracking)
- ❌ Small dataset (2,969 rows)
- ❌ Background sync (users don't wait)
- ❌ Semantic cache (dashboard instant)

## Alternative: Optimize Full Refresh Instead

If you want better performance, optimize the full refresh:

### Optimization 1: Parallel Sheet Reading

```javascript
// Read all sheets in parallel instead of sequentially
async function readSheetsParallel() {
  const sources = getEnabledSources(); // 17 countries
  
  // Read all sheets simultaneously
  const promises = sources.map(source => 
    fetchSourceRows(sheets, source)
  );
  
  const results = await Promise.all(promises);
  return results.flat();
}

// Performance:
// Sequential: 17 sheets × 0.5 sec = 8.5 seconds
// Parallel: max(0.5 sec) = 0.5 seconds
// Savings: 8 seconds!
```

### Optimization 2: Batch Inserts

```javascript
// Already implemented (batchSize: 100)
// Could increase batch size for better performance
const batchSize = 500; // Up from 100

// Performance:
// Small batches: 2,969 rows ÷ 100 = 30 API calls
// Large batches: 2,969 rows ÷ 500 = 6 API calls
// Savings: 1-2 seconds
```

### Optimization 3: Skip Unchanged Data (Already Implemented)

```javascript
// Your code already has this!
const checksum = computeChecksum(rows);
const previousChecksum = await getLastChecksum();

if (checksum === previousChecksum) {
  return { skipped: true }; // Skip entire sync
}

// When data unchanged: 0 seconds (skip everything)
// When data changed: 5-7 seconds (full refresh)
```

## Final Answer to Your Question

### Can we detect changes without scanning entire data?

**Short Answer:** No, not with Google Sheets API.

**Long Answer:** 
- Google Sheets API doesn't provide row-level change tracking
- Must read all sheets to detect changes (2-3 seconds)
- This is 50% of sync time (unavoidable bottleneck)
- Comparison overhead negates savings from fewer writes
- Net result: Same or slower than full refresh

### Should we implement true incremental sync?

**No, because:**
1. ❌ Minimal performance gain (2-4 seconds at best)
2. ❌ Significant complexity increase
3. ❌ No user experience benefit (cache makes dashboard instant)
4. ❌ Google Sheets API limitations make it ineffective
5. ✅ Full refresh is simpler, faster, and more reliable

### What should we do instead?

**Keep full refresh and optimize it:**
1. ✅ Parallel sheet reading (saves 8 seconds)
2. ✅ Larger batch sizes (saves 1-2 seconds)
3. ✅ Skip unchanged data (already implemented)
4. ✅ Semantic cache (dashboard instant regardless)

**Result:**
- Full refresh: 5-7 seconds → 2-3 seconds (optimized)
- True incremental: 5-7 seconds (no real benefit)
- Dashboard: Instant (cache handles it)

## Implementation Plan (If You Still Want It)

If you absolutely want true incremental sync despite the drawbacks:

### Phase 1: Add MERGE Logic (2-3 hours)
- Implement MERGE query instead of TRUNCATE+INSERT
- Test thoroughly
- Deploy

### Phase 2: Add Change Detection (4-6 hours)
- Read previous data from BigQuery
- Compare with current data
- Only MERGE changed rows
- Test edge cases

### Phase 3: Add Timestamp Columns (8-12 hours)
- Add "Last Modified" to all 17 sheets
- Implement Apps Script for auto-update
- Train users
- Update sync logic

**Total Effort:** 14-21 hours
**Performance Gain:** 2-4 seconds per sync
**User Benefit:** None (cache makes dashboard instant)

**Recommendation:** Not worth it. Stick with optimized full refresh.
