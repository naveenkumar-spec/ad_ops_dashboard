# CSV Download - Updated Implementation

## Changes Made

### 1. Button Placement ✅
**Before**: Button was separate, aligned to the right of header
```
┌─────────────────────────────────────────────┐
│ Table Title                        [CSV ↓]  │
└─────────────────────────────────────────────┘
```

**After**: Button is inline with the title text
```
┌─────────────────────────────────────────────┐
│ Table Title [CSV ↓]                         │
└─────────────────────────────────────────────┘
```

### 2. CSV Format for Expandable Tables ✅

**Before**: Type column with Region/Country mixed
```csv
Type,Region / Country,Total Campaigns,...
Region,India+SEA,251,...
Country,Vietnam,48,...
Country,Philippines,45,...
```

**After**: Separate Region and Country columns
```csv
Region,Country,Total Campaigns,...
India+SEA,Vietnam,48,...
India+SEA,Philippines,45,...
India+SEA,Thailand,54,...
Total,,627,...
```

### 3. Totals Row Included ✅
The last row in the CSV now shows totals:
```csv
Region,Country,Total Campaigns,Budget Groups,...
India+SEA,Vietnam,48,478,...
India+SEA,Philippines,45,261,...
...
Total,,627,3011,...
```

## Implementation Details

### CountryWiseTable Component

#### Download Handler
```javascript
const handleDownload = () => {
  const exportData = [];
  
  // Add country rows (not region rows)
  sortedData.forEach((region) => {
    const children = childrenByRegion[region.region] || [];
    children.forEach((country) => {
      exportData.push({
        region: region.region,      // Parent region
        country: country.country,   // Country name
        campaigns: country.campaigns,
        // ... other metrics
      });
    });
  });
  
  // Add totals row
  if (totals) {
    exportData.push({
      region: 'Total',
      country: '',
      campaigns: totals.campaigns,
      // ... other totals
    });
  }
  
  const columns = [
    { key: 'region', label: 'Region' },
    { key: 'country', label: 'Country' },
    // ... other columns
  ];
  
  exportTableToCSV(exportData, columns, `country-wise-data-${timestamp}`);
};
```

#### JSX Structure
```jsx
<h3 className="adv-table-title">
  Region / Country wise Data
  {totals?.rowCount && ` - Showing ${data.length} of ${totals.rowCount} regions`}
  <DownloadButton onClick={handleDownload} disabled={loading || !data.length} />
</h3>
```

### CSS Updates

#### Table Header
```css
.table-card-header h3 {
  display: flex;
  align-items: center;
  gap: 12px;  /* Space between title text and button */
}
```

#### Download Button
```css
.download-btn {
  padding: 4px 10px;      /* Smaller padding */
  font-size: 12px;        /* Smaller font */
  gap: 4px;               /* Tighter icon spacing */
  flex-shrink: 0;         /* Don't shrink */
}

.download-btn svg {
  width: 14px;            /* Smaller icon */
  height: 14px;
}
```

## CSV Output Example

### India+SEA Region
```csv
Region,Country,Total Campaigns,Budget Groups,Booked Revenue (USD),Spend (USD),...
India+SEA,Vietnam,48,478,3935396.02,1274381.71,...
India+SEA,Philippines,45,261,1516234.72,387589.15,...
India+SEA,Thailand,54,230,957878.72,341905.28,...
India+SEA,India,30,131,951020.33,482931.01,...
India+SEA,Indonesia,66,233,813591.97,283609.81,...
India+SEA,Malaysia,5,19,186710.25,70879.25,...
India+SEA,Singapore,3,3,16725.81,5086.84,...
```

### North America Region
```csv
North America,United States,50,300,4500000.00,2800000.00,...
North America,Canada,18,90,1124636.66,528091.34,...
```

### Totals Row
```csv
Total,,627,3011,24590000.00,10840000.00,...
```

## Benefits

1. **Cleaner Layout**: Button doesn't take up extra space
2. **Better CSV Format**: Region-Country relationship is clear
3. **Complete Data**: Totals included for analysis
4. **Consistent**: Matches user's expected format
5. **Compact**: Smaller button fits better inline

## Visual Comparison

### Before
```
┌────────────────────────────────────────────────────┐
│ Region / Country wise Data - Showing 8 of 8 [CSV] │
├────────────────────────────────────────────────────┤
```

### After
```
┌────────────────────────────────────────────────────┐
│ Region / Country wise Data - Showing 8 of 8 [CSV] │
├────────────────────────────────────────────────────┤
```
(Button is now part of the title, not separate)

## Next Steps

Apply the same pattern to remaining tables:
1. ProductWiseTable
2. CampaignWiseTable
3. BottomCampaignsTable
4. PlatformSpendsTable
5. OwnerPerformanceTable
6. RegionTable
7. CampaignTable

Each will follow the same pattern:
- Button inline with title
- Proper column structure
- Include totals row
- Timestamp in filename

## Status
- ✅ Button placement updated
- ✅ CSV format corrected
- ✅ Totals row included
- ✅ Styles updated
- ✅ CountryWiseTable complete
- ⏳ 7 tables remaining
