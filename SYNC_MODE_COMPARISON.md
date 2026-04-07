# Sync Mode Comparison - Visual Guide

## Current Implementation

### Incremental Mode (fullRefresh: false) - BROKEN ❌

```
Hour 1 (10:00 AM):
┌─────────────────────────────────────┐
│ 1. Read ALL Google Sheets           │
│    → 2,969 campaigns                 │
├─────────────────────────────────────┤
│ 2. Skip transition table             │
│    (performance optimization)        │
├─────────────────────────────────────┤
│ 3. NO TRUNCATE                       │
│    (table keeps existing data)       │
├─────────────────────────────────────┤
│ 4. INSERT 2,969 rows                 │
│    sync_id: sync_1775570400013       │
└─────────────────────────────────────┘

BigQuery Table After Hour 1:
┌──────────────────┬──────────┬────────────────────────┐
│ campaign_id      │ revenue  │ sync_id                │
├──────────────────┼──────────┼────────────────────────┤
│ CAMP_001         │ 10000    │ sync_1775570400013     │
│ CAMP_002         │ 15000    │ sync_1775570400013     │
│ ...              │ ...      │ ...                    │
└──────────────────┴──────────┴────────────────────────┘
Total: 2,969 rows ✅


Hour 2 (11:00 AM):
┌─────────────────────────────────────┐
│ 1. Read ALL Google Sheets           │
│    → 2,969 campaigns (same data)     │
├─────────────────────────────────────┤
│ 2. Skip transition table             │
├─────────────────────────────────────┤
│ 3. NO TRUNCATE                       │
│    (old data still there!)           │
├─────────────────────────────────────┤
│ 4. INSERT 2,969 rows AGAIN           │
│    sync_id: sync_1775574000010       │
└─────────────────────────────────────┘

BigQuery Table After Hour 2:
┌──────────────────┬──────────┬────────────────────────┐
│ campaign_id      │ revenue  │ sync_id                │
├──────────────────┼──────────┼────────────────────────┤
│ CAMP_001         │ 10000    │ sync_1775570400013     │ ← Old
│ CAMP_002         │ 15000    │ sync_1775570400013     │ ← Old
│ ...              │ ...      │ ...                    │
│ CAMP_001         │ 10000    │ sync_1775574000010     │ ← Duplicate!
│ CAMP_002         │ 15000    │ sync_1775574000010     │ ← Duplicate!
│ ...              │ ...      │ ...                    │
└──────────────────┴──────────┴────────────────────────┘
Total: 5,938 rows ❌ (DUPLICATES!)


Hour 3 (12:00 PM):
┌─────────────────────────────────────┐
│ 1. Read ALL Google Sheets           │
│    → 2,969 campaigns                 │
├─────────────────────────────────────┤
│ 2. Skip transition table             │
├─────────────────────────────────────┤
│ 3. NO TRUNCATE                       │
├─────────────────────────────────────┤
│ 4. INSERT 2,969 rows AGAIN           │
│    sync_id: sync_1775577600009       │
└─────────────────────────────────────┘

BigQuery Table After Hour 3:
┌──────────────────┬──────────┬────────────────────────┐
│ campaign_id      │ revenue  │ sync_id                │
├──────────────────┼──────────┼────────────────────────┤
│ CAMP_001         │ 10000    │ sync_1775570400013     │ ← Old
│ CAMP_002         │ 15000    │ sync_1775570400013     │ ← Old
│ ...              │ ...      │ ...                    │
│ CAMP_001         │ 10000    │ sync_1775574000010     │ ← Duplicate
│ CAMP_002         │ 15000    │ sync_1775574000010     │ ← Duplicate
│ ...              │ ...      │ ...                    │
│ CAMP_001         │ 10000    │ sync_1775577600009     │ ← Duplicate!
│ CAMP_002         │ 15000    │ sync_1775577600009     │ ← Duplicate!
│ ...              │ ...      │ ...                    │
└──────────────────┴──────────┴────────────────────────┘
Total: 8,907 rows ❌ (MORE DUPLICATES!)
```

**Dashboard Impact:**
```
Query: SELECT SUM(revenue) FROM table WHERE campaign_id = 'CAMP_001'
Result: 30,000 (10,000 × 3) ❌ WRONG!
Should be: 10,000 ✅
```

---

### Full Refresh Mode (fullRefresh: true) - CORRECT ✅

```
Hour 1 (10:00 AM):
┌─────────────────────────────────────┐
│ 1. Read ALL Google Sheets           │
│    → 2,969 campaigns                 │
├─────────────────────────────────────┤
│ 2. Read transition table             │
│    (legacy branding data)            │
├─────────────────────────────────────┤
│ 3. TRUNCATE TABLE                    │
│    (delete all existing rows)        │
├─────────────────────────────────────┤
│ 4. INSERT 2,969 rows                 │
│    sync_id: sync_1775570400013       │
└─────────────────────────────────────┘

BigQuery Table After Hour 1:
┌──────────────────┬──────────┬────────────────────────┐
│ campaign_id      │ revenue  │ sync_id                │
├──────────────────┼──────────┼────────────────────────┤
│ CAMP_001         │ 10000    │ sync_1775570400013     │
│ CAMP_002         │ 15000    │ sync_1775570400013     │
│ ...              │ ...      │ ...                    │
└──────────────────┴──────────┴────────────────────────┘
Total: 2,969 rows ✅


Hour 2 (11:00 AM):
┌─────────────────────────────────────┐
│ 1. Read ALL Google Sheets           │
│    → 2,969 campaigns                 │
├─────────────────────────────────────┤
│ 2. Read transition table             │
├─────────────────────────────────────┤
│ 3. TRUNCATE TABLE                    │
│    (delete Hour 1 data)              │
├─────────────────────────────────────┤
│ 4. INSERT 2,969 rows                 │
│    sync_id: sync_1775574000010       │
└─────────────────────────────────────┘

BigQuery Table After Hour 2:
┌──────────────────┬──────────┬────────────────────────┐
│ campaign_id      │ revenue  │ sync_id                │
├──────────────────┼──────────┼────────────────────────┤
│ CAMP_001         │ 10000    │ sync_1775574000010     │ ← Fresh data
│ CAMP_002         │ 15000    │ sync_1775574000010     │ ← Fresh data
│ ...              │ ...      │ ...                    │
└──────────────────┴──────────┴────────────────────────┘
Total: 2,969 rows ✅ (NO DUPLICATES!)


Hour 3 (12:00 PM):
┌─────────────────────────────────────┐
│ 1. Read ALL Google Sheets           │
│    → 2,969 campaigns                 │
├─────────────────────────────────────┤
│ 2. Read transition table             │
├─────────────────────────────────────┤
│ 3. TRUNCATE TABLE                    │
│    (delete Hour 2 data)              │
├─────────────────────────────────────┤
│ 4. INSERT 2,969 rows                 │
│    sync_id: sync_1775577600009       │
└─────────────────────────────────────┘

BigQuery Table After Hour 3:
┌──────────────────┬──────────┬────────────────────────┐
│ campaign_id      │ revenue  │ sync_id                │
├──────────────────┼──────────┼────────────────────────┤
│ CAMP_001         │ 10000    │ sync_1775577600009     │ ← Fresh data
│ CAMP_002         │ 15000    │ sync_1775577600009     │ ← Fresh data
│ ...              │ ...      │ ...                    │
└──────────────────┴──────────┴────────────────────────┘
Total: 2,969 rows ✅ (ALWAYS CLEAN!)
```

**Dashboard Impact:**
```
Query: SELECT SUM(revenue) FROM table WHERE campaign_id = 'CAMP_001'
Result: 10,000 ✅ CORRECT!
```

---

## Side-by-Side Comparison

| Aspect | Incremental Mode | Full Refresh Mode |
|--------|------------------|-------------------|
| **Reads Google Sheets** | ✅ ALL sheets | ✅ ALL sheets |
| **Processes Campaigns** | ✅ ALL campaigns | ✅ ALL campaigns |
| **Reads Transition Table** | ❌ Skipped | ✅ Yes |
| **Truncates Before Insert** | ❌ NO | ✅ YES |
| **Result** | ❌ Duplicates | ✅ Clean data |
| **Time** | ~3-5 seconds | ~8-10 seconds |
| **Resource Usage** | Lower | Slightly higher |
| **Data Accuracy** | ❌ WRONG | ✅ CORRECT |

---

## What Your Production Looks Like Now

```
Production BigQuery Table (Current State):
┌──────────────────┬──────────┬────────────────────────┐
│ campaign_id      │ revenue  │ sync_id                │
├──────────────────┼──────────┼────────────────────────┤
│ CAMP_001         │ 10000    │ sync_1775570400013     │ ← April 7, 2PM
│ CAMP_002         │ 15000    │ sync_1775570400013     │
│ ... (2,969 rows) │ ...      │ ...                    │
│ CAMP_001         │ 10000    │ sync_1775574000010     │ ← April 7, 3PM
│ CAMP_002         │ 15000    │ sync_1775574000010     │
│ ... (2,969 rows) │ ...      │ ...                    │
│ CAMP_001         │ 10000    │ sync_1775577600009     │ ← April 7, 4PM
│ CAMP_002         │ 15000    │ sync_1775577600009     │
│ ... (2,969 rows) │ ...      │ ...                    │
│ ... more duplicates from earlier syncs ...            │
└──────────────────┴──────────┴────────────────────────┘
Total: 10,840 rows (should be 2,969)
```

**Dashboard shows:**
- Revenue: 3-4x higher than actual
- Campaign count: 3-4x higher than actual
- All metrics inflated

---

## The Fix

Change one line in `backend/services/bigQueryScheduler.js`:

```javascript
// Line 33
// BEFORE:
fullRefresh: false, // ❌ Causes duplicates

// AFTER:
fullRefresh: true, // ✅ Prevents duplicates
```

**Result:**
- Next sync will truncate table
- Insert fresh data
- No more duplicates
- Accurate dashboard metrics

---

## Performance Impact

```
Incremental Mode:
├─ Read sheets: 2-3 seconds
├─ Skip transition: 0 seconds (saved)
├─ No truncate: 0 seconds (saved)
├─ Insert data: 1-2 seconds
└─ Total: ~3-5 seconds
   BUT: ❌ Creates duplicates

Full Refresh Mode:
├─ Read sheets: 2-3 seconds
├─ Read transition: 2-3 seconds (extra)
├─ Truncate: <1 second (extra)
├─ Insert data: 1-2 seconds
└─ Total: ~8-10 seconds
   AND: ✅ Guarantees accuracy
```

**Trade-off:** 5 extra seconds for data accuracy = Worth it!

---

## Summary

**Your "incremental" mode is NOT incremental at all!**

It:
- ❌ Does NOT sync only changed data
- ❌ Does NOT sync only recent data
- ✅ Reads ALL data (same as full refresh)
- ✅ Processes ALL data (same as full refresh)
- ❌ But doesn't truncate (unlike full refresh)
- ❌ Results in duplicates

**Solution:** Use full refresh mode for all syncs.
