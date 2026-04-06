# Info Icon Positioning Fix

## Issue
Info icons in KPI cards were positioned in the top-right corner (absolute positioning) instead of appearing inline next to the card titles.

## Solution
Updated the KPICards component to position info icons inline with titles using flexbox layout.

## Changes Made

### 1. KPICards Component (`frontend/src/components/KPICards.jsx`)

**Before:**
```jsx
<article className="kpi-card" style={{ position: 'relative' }}>
  <p className="kpi-title" title={safeTitle(kpi.title)}>
    {kpi.title}
  </p>
  {hasManagementAccess && kpiExplanations[kpi.title] && (
    <InfoIcon tooltip={kpiExplanations[kpi.title]} />
  )}
  ...
</article>
```

**After:**
```jsx
<article className="kpi-card" style={{ position: 'relative' }}>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
    <p className="kpi-title" title={safeTitle(kpi.title)} style={{ margin: 0 }}>
      {kpi.title}
    </p>
    {hasManagementAccess && kpiExplanations[kpi.title] && (
      <InfoIcon 
        tooltip={kpiExplanations[kpi.title]} 
        style={{ position: 'relative', top: '0', right: '0' }}
      />
    )}
  </div>
  ...
</article>
```

### 2. InfoIcon Component (`frontend/src/components/InfoIcon.jsx`)

Already updated to support:
- `style` prop for custom positioning
- Relative positioning by default (instead of absolute)
- Flexible content (string or JSX)

## Visual Result

### Before:
```
┌─────────────────────────┐
│ No of Campaigns      (i)│  ← Icon in corner
│                         │
│         12              │
│                         │
│ Budget Groups: 19       │
└─────────────────────────┘
```

### After:
```
┌─────────────────────────┐
│  No of Campaigns (i)    │  ← Icon next to title
│                         │
│         12              │
│                         │
│ Budget Groups: 19       │
└─────────────────────────┘
```

## Layout Details

### Flexbox Container:
- `display: flex` - Creates flex container
- `alignItems: center` - Vertically centers title and icon
- `justifyContent: center` - Horizontally centers the group
- `gap: 6px` - Adds 6px space between title and icon

### Title Styling:
- `margin: 0` - Removes default paragraph margin for proper alignment

### Icon Styling:
- `position: relative` - Overrides default absolute positioning
- `top: 0, right: 0` - Resets any offset positioning

## Other Info Icon Locations

### Currency Toggle (FiltersPanel)
Already correctly positioned inline:
```jsx
<InfoIcon 
  content={ratesInfo}
  style={{ marginLeft: "8px", verticalAlign: "middle" }}
/>
```

This appears as: `[USD] [Native Currency] (i)`

## Testing

1. Refresh the browser
2. Check KPI cards at the top of the dashboard
3. Info icons should appear immediately to the right of each card title
4. Icons should be vertically centered with the title text
5. Hover over icons to see tooltips

## Status
✅ Fixed - Info icons now appear inline next to card titles instead of in the corner
