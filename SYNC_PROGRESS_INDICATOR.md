# Sync Progress Indicator Feature

## Overview

Added a real-time sync progress indicator in the dashboard header that shows when data refresh is in progress.

## User Experience

### When Sync is NOT Running
```
Campaign Performance Dashboard
Last data sync: 09 Apr 2026, 06:50 pm IST
```

### When Sync IS Running
```
Campaign Performance Dashboard
🔄 Data refresh in progress
```

The spinner icon rotates continuously while the sync is active.

## Implementation

### Frontend Changes

#### DashboardHeader Component (`frontend/src/components/DashboardHeader.jsx`)

1. **Added State Management**
   - `isSyncing` state to track sync status
   - Polls `/api/overview/sync/bigquery/status` every 10 seconds

2. **Conditional Rendering**
   - Shows spinner + "Data refresh in progress" when `isSyncing === true`
   - Shows "Last data sync: [time]" when sync is complete
   - Automatically refreshes last sync time when sync completes

3. **Polling Logic**
   - Checks sync status immediately on mount
   - Continues checking every 10 seconds
   - Cleans up interval on unmount

#### CSS Styles (`frontend/styles/DashboardHeader.css`)

1. **Spinner Animation**
   ```css
   .sync-spinner {
     width: 14px;
     height: 14px;
     border: 2px solid rgba(255, 167, 38, 0.3);
     border-top-color: #ffa726;
     border-radius: 50%;
     animation: spin 0.8s linear infinite;
   }
   ```

2. **Syncing Text Style**
   - Orange color (#ffa726) to indicate activity
   - Slightly bolder font weight (500)
   - Flexbox layout with 8px gap between spinner and text

### Backend Changes

#### Overview Routes (`backend/routes/overview.js`)

**Removed Admin-Only Restriction**

Before:
```javascript
if (!_req.user || _req.user.role !== "admin") {
  return res.status(403).json({ error: "Admin access required" });
}
```

After:
```javascript
// Allow all authenticated users to check sync status (for loading indicator)
```

This allows all users to see the sync progress, not just admins.

## How It Works

### Sync Status Flow

1. **Sync Starts** (Hourly at :00 minutes)
   - Backend: `bigQuerySyncService` sets status to "running"
   - Frontend: Polling detects status change
   - UI: Shows spinner + "Data refresh in progress"

2. **Sync In Progress**
   - Backend: Status remains "running"
   - Frontend: Continues showing spinner
   - UI: Spinner animates continuously

3. **Sync Completes**
   - Backend: Status changes to "completed"
   - Frontend: Detects completion, fetches new last sync time
   - UI: Hides spinner, shows updated "Last data sync: [new time]"

### Polling Strategy

- **Interval**: 10 seconds
- **Why 10 seconds?**: Balance between responsiveness and server load
- **Cleanup**: Interval cleared on component unmount

### Status Values

The backend returns these status values:
- `"idle"` - No sync has run yet
- `"running"` - Sync currently in progress
- `"completed"` - Sync finished successfully
- `"failed"` - Sync encountered an error
- `"stopped"` - Sync was manually stopped

## Visual Design

### Colors
- **Syncing**: Orange (#ffa726) - indicates activity/progress
- **Last Sync**: Green (#8bb59a) - indicates success/completion

### Animation
- **Spinner**: 0.8s rotation (smooth, not too fast)
- **Size**: 14px diameter (matches text height)
- **Border**: 2px width with transparent bottom for visual effect

## Performance Considerations

### Polling Impact
- **Request frequency**: 1 request every 10 seconds
- **Payload size**: ~100 bytes (minimal JSON)
- **Server load**: Negligible (simple status check)

### Optimization
- Only polls when component is mounted
- Cleans up interval on unmount
- Uses existing authenticated session (no extra auth overhead)

## Testing

### Manual Testing

1. **Start Sync**
   - Trigger manual sync from admin panel
   - Verify spinner appears immediately (within 10 seconds)
   - Verify text shows "Data refresh in progress"

2. **During Sync**
   - Verify spinner continues rotating
   - Verify text remains visible
   - Verify no console errors

3. **After Sync**
   - Verify spinner disappears
   - Verify "Last data sync" appears with updated time
   - Verify time is in IST format

### Automated Testing

```javascript
// Test sync status polling
test('shows spinner when sync is running', async () => {
  // Mock API to return running status
  mockApiGet('/api/overview/sync/bigquery/status', { status: 'running' });
  
  render(<DashboardHeader />);
  
  await waitFor(() => {
    expect(screen.getByText('Data refresh in progress')).toBeInTheDocument();
    expect(screen.getByClassName('sync-spinner')).toBeInTheDocument();
  });
});

// Test sync completion
test('shows last sync time when sync completes', async () => {
  // Mock API to return completed status
  mockApiGet('/api/overview/sync/bigquery/status', { status: 'completed' });
  mockApiGet('/api/overview/last-sync', { lastSyncAt: '2026-04-09T18:50:00Z' });
  
  render(<DashboardHeader />);
  
  await waitFor(() => {
    expect(screen.getByText(/Last data sync:/)).toBeInTheDocument();
    expect(screen.queryByText('Data refresh in progress')).not.toBeInTheDocument();
  });
});
```

## Browser Compatibility

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers

CSS animations and fetch API are supported in all modern browsers.

## Accessibility

- **Screen readers**: Text clearly indicates sync status
- **Visual indicators**: Both spinner and text provide feedback
- **Color contrast**: Orange text meets WCAG AA standards on dark background

## Future Enhancements

### Possible Improvements

1. **Progress Percentage**
   - Show "Data refresh in progress (45%)"
   - Requires backend to track sync progress

2. **Estimated Time Remaining**
   - Show "Data refresh in progress (~2 min remaining)"
   - Based on historical sync duration

3. **Error Indication**
   - Show red indicator if sync fails
   - Provide retry button

4. **Toast Notification**
   - Show toast when sync completes
   - "Data refreshed successfully"

5. **Sync History**
   - Click to see recent sync history
   - Show success/failure status

## Files Modified

- `frontend/src/components/DashboardHeader.jsx` - Added sync status polling and conditional rendering
- `frontend/styles/DashboardHeader.css` - Added spinner animation and syncing styles
- `backend/routes/overview.js` - Removed admin-only restriction from status endpoint

## Related Documentation

- HOURLY_SYNC_FIX_MONTHNAMES_BUG.md - Hourly sync bug fix
- BIGQUERY_SNAPSHOT_MODE_FIX.md - Data accumulation fix
- USER_CACHE_LOGIN_FIX.md - User cache improvements
