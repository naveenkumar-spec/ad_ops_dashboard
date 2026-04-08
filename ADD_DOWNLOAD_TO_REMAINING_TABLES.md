# Add Download Buttons to Remaining Tables

## Tables to Update

1. ✅ CountryWiseTable - Already done
2. ✅ ProductWiseTable - Just completed
3. ⏳ CampaignWiseTable
4. ⏳ BottomCampaignsTable
5. ⏳ PlatformSpendsTable
6. ⏳ OwnerPerformanceTable
7. ⏳ RegionTable
8. ⏳ CampaignTable

## Steps for Each Table

### 1. Add Imports
```javascript
import DownloadButton from "./DownloadButton.jsx";
import { exportTableToCSV } from "../utils/csvExport.js";
```

### 2. Add handleDownload Function
```javascript
const handleDownload = () => {
  const headers = ["Column1", "Column2", ...];
  const dataRows = rows.map(row => [row.field1, row.field2, ...]);
  if (totals) {
    dataRows.push(["Total", totals.field1, totals.field2, ...]);
  }
  exportTableToCSV(headers, dataRows, "filename");
};
```

### 3. Add Button to Header
```javascript
<h3 className="adv-table-title">
  Table Title
  <DownloadButton onClick={handleDownload} title="Download as CSV" />
</h3>
```

## Modern Button Design

- Icon-only button (no text)
- 28x28px size
- 16px icon
- Transparent background
- Hover: light gray background
- Tooltip on hover

## Next Steps

Due to the large number of files, I'll commit the current changes (CountryWiseTable + ProductWiseTable) and then add the remaining tables in the next session to avoid overwhelming the commit.
