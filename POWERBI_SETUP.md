# Power BI Semantic Model Setup Guide

## Quick Setup

Your dashboard is now configured to use the **Live Power BI Semantic Model** instead of Google Sheets!

### What You Need to Do:

1. **Update the `.env` file** in the `backend/` folder with your Power BI credentials:

```env
# Your Power BI Workspace Email/User
POWERBI_USERNAME=your-email@company.com

# Your Power BI Password
POWERBI_PASSWORD=your-password

# Keep these as-is (already configured)
POWERBI_DATASET_ID=36816ea5-480d-46ca-9f91-32ee6e6846e2
POWERBI_WORKSPACE_ID=Test_Copilot
```

### Finding Your Workspace ID:

1. Go to your Power BI app: `https://app.powerbi.com/`
2. Look at the URL - it will contain your workspace ID
3. Or check the workspace name from the sidebar

### Key Column Names in Your Dataset:

The Power BI service expects these columns in your semantic model:
- `Campaign ID` - Unique identifier for campaigns
- `Campaign Name` - Name of the campaign
- `Status` - Campaign status
- `Revenue (USD)` - Revenue amount
- `Spends (USD)` - Spend amount
- `Gross Profit %` - Gross profit percentage
- `% Net gross margin` - Net margin percentage
- `Country` - Country/Region
- `Year` - Year dimension
- `Month` - Month dimension
- `Impressions` - Impression count

**If your column names are different**, update the DAX queries in `backend/services/powerBiService.js` to match.

### Testing the Connection:

1. Save the `.env` file with your credentials
2. Run the dashboard: `run-dashboard.bat`
3. Watch the backend console for these messages:
   - ✓ Server running on http://localhost:5000
   - 🔌 Power BI Dataset ID: 36816ea5-480d-46ca-9f91-32ee6e6846e2
   - 🔐 Authenticating with Power BI
   - ✓ Power BI authentication successful

### Troubleshooting:

**Error: "Failed to authenticate with Power BI"**
- Check your username and password in `.env`
- Ensure your account has access to the semantic model
- Verify your Power BI subscription is active

**Error: "Failed to execute DAX query"**
- Check the column names match your semantic model
- Verify the semantic model is accessible from your Power BI workspace
- Check the dataset ID (36816ea5-480d-46ca-9f91-32ee6e6846e2) is correct

**No data appears in dashboard**
- Check backend console for error messages (look for ❌ symbols)
- Fallback data should appear if Power BI is unavailable
- Try the health check: `http://localhost:5000/health`

### Data Refresh:

- Power BI data is refreshed on each API call
- Authentication tokens are cached for 1 hour
- If data doesn't update, restart the server

### Advanced: Using Service Principal (Recommended for Production)

For production, use a Service Principal instead of user credentials:

1. Register an app in Azure AD
2. Get the Client ID, Client Secret, and Tenant ID
3. Update `.env`:

```env
POWERBI_CLIENT_ID=your-client-id
POWERBI_CLIENT_SECRET=your-client-secret
POWERBI_TENANT_ID=your-tenant-id
```

4. Update `backend/services/powerBiService.js` function `getAccessToken()` to use these values

---

**Created**: March 14, 2026  
**Dataset ID**: 36816ea5-480d-46ca-9f91-32ee6e6846e2  
**Connection**: Power BI REST API with DAX Queries
