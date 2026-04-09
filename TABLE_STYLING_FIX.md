# Table Styling Fix - Totals Row Visibility

## Issue
On the Management page tables, the totals row was disappearing or only visible on hover due to background color being removed. The text color was light (`#e8f0f5`) but the background was being overridden, making the text invisible against the light table background.

## Root Cause
The `.data-table .table-total td` styling had a dark background (`#11283f`) but it wasn't using `!important` flags, so hover states and other CSS rules were overriding the background color, leaving only the light-colored text visible (which is nearly invisible on a light background).

## Solution
Updated `frontend/styles/Tables.css` to:

1. **Fixed totals row background** - Changed from solid color to gradient matching the header style with `!important` flags:
   ```css
   background: linear-gradient(180deg, #14253a 0%, #1f3550 100%) !important;
   color: #e8f0f5 !important;
   ```

2. **Added border styling** - Added right borders to match the header cells:
   ```css
   border-right: 1px solid #243b55;
   ```

3. **Prevented hover override** - Added `!important` to hover states to ensure background stays dark:
   ```css
   .data-table .table-total:hover td {
     background: linear-gradient(180deg, #14253a 0%, #1f3550 100%) !important;
     color: #e8f0f5 !important;
   }
   ```

4. **Fixed frozen first column** - Updated first column styling to use gradient with `!important`:
   ```css
   .data-table .table-total td:first-child {
     background: linear-gradient(180deg, #14253a 0%, #1f3550 100%) !important;
     color: #e8f0f5 !important;
   }
   ```

5. **Added row-child styling for data-table** - Added specific styling for expandable child rows in Management page tables:
   ```css
   .data-table .row-child td {
     background: #f7fbf8;
     color: #2a3a30;
     padding-left: 32px;
   }
   ```

6. **Added row-expandable styling** - Made expandable rows have cursor pointer and medium font weight

## Changes Made
- File: `frontend/styles/Tables.css`
- Added `!important` flags to all totals row background and color properties
- Changed background from solid color to gradient matching header style
- Added border styling to match header cells
- Added specific styling for `.row-child` and `.row-expandable` classes in data-table
- Ensured hover states don't override the dark background

## Result
- Totals row now always visible with dark background and light text
- Consistent styling across all Management page tables
- Matches the header row styling (dark gradient background)
- No more disappearing totals row when expanding regions or hovering
- Child rows (expanded countries) have proper light background
- Expandable rows have proper cursor and styling

## Affected Tables
- Region / Country wise Data (Management page)
- KPI Performance by AdOps (Management page)
- KPI Performance by CS (Management page)
- KPI Performance by Sales (Management page)
- All other tables using `.data-table` class

## Deployment
- Committed to `dev` branch: `0c3904a`
- Pushed to GitHub
- Will be deployed via Vercel preview deployment

## Testing Checklist
- [x] Totals row visible at all times (not just on hover)
- [x] Totals row has dark background matching header
- [x] Text is light colored and readable
- [x] Totals row stays visible when expanding regions
- [x] Hover state doesn't break the styling
- [x] First column (frozen) has proper background
- [x] Child rows have light background
- [x] Expandable rows have cursor pointer
