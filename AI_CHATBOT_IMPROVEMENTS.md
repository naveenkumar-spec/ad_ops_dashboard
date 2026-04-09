# AI Chatbot Improvements - Context Awareness

## Problem
The chatbot was misunderstanding time-based queries. When users asked "What's the revenue for this month?", it would show the all-time total revenue instead of explaining that filters are needed.

## Root Cause
The AI prompt lacked:
1. Current date context
2. Understanding that dashboard shows all-time totals by default
3. Instructions to guide users to use filters for specific time periods
4. Clear data structure explanation

## Solution Implemented

### 1. Enhanced System Prompt
Added comprehensive instructions to the AI:

```javascript
IMPORTANT INSTRUCTIONS:
1. The data shown is ALL-TIME TOTAL unless the user specifically filtered by date
2. When user asks "this month" or "current month", explain that dashboard shows all-time totals
3. Tell them they need to use the date filters on the dashboard
4. The dashboard has month/year filters available
5. Be helpful and guide them on how to get the specific data
```

### 2. Current Date Context
Now includes:
- Current date (e.g., "April 9, 2026")
- Current month (e.g., "April 2026")
- Clear labeling of data as "All Time Total"

### 3. Better Data Formatting
Changed from raw JSON to human-readable format:

**Before:**
```json
{
  "kpis": {
    "totalRevenue": 1500000,
    "totalSpend": 1200000
  }
}
```

**After:**
```
Current Date: April 9, 2026
Current Month: April 2026

Dashboard KPIs (All Time Total):
- Total Revenue: $1,500,000
- Total Spend: $1,200,000
- Gross Margin: 20.0%
```

### 4. Helpful Guidance
The AI now:
- Explains that numbers are all-time totals
- Guides users to use dashboard filters
- Suggests how to get specific month data
- Remains friendly and helpful

## Example Interactions

### Before Fix:
```
User: "What's the revenue for this month?"
AI: "The total revenue is $1,500,000"
❌ Wrong - this is all-time, not current month
```

### After Fix:
```
User: "What's the revenue for this month?"
AI: "The dashboard currently shows all-time totals of $1,500,000 in revenue. 
To see revenue specifically for April 2026, please use the month and year 
filters at the top of the dashboard to narrow down the data to the current month."
✅ Correct - explains and guides user
```

## Limitations & Future Improvements

### Current Limitations:
1. **Cannot query by date directly** - The chatbot doesn't have access to month/year filtered data
2. **No training on historical data** - Groq API doesn't support fine-tuning
3. **Context window limited** - Can only see summary data, not full dataset

### Why We Can't "Train" the API:
- Groq (like most LLM APIs) doesn't support custom training
- Fine-tuning requires access to model weights (not available)
- Training would be expensive and complex

### Better Solutions:

#### Option 1: Pass Filtered Data (Recommended - Easy)
Modify the frontend to send current filter state to the chatbot:

```javascript
// In ChatbotWidget.jsx
const sendMessage = async () => {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({
      query: message,
      filters: {
        month: currentMonth,  // From dashboard filters
        year: currentYear,
        country: selectedCountry
      }
    })
  });
};
```

Then update `backend/routes/ai.js` to use these filters when fetching data.

#### Option 2: Function Calling (Advanced)
Teach the AI to call specific functions:

```javascript
// AI can call these functions
functions: [
  {
    name: "get_revenue_by_month",
    description: "Get revenue for a specific month",
    parameters: {
      month: "string",
      year: "number"
    }
  }
]
```

The AI would recognize "this month" and call the function with current month/year.

#### Option 3: RAG (Retrieval Augmented Generation) (Most Advanced)
- Store all campaign data in a vector database
- When user asks a question, retrieve relevant data
- Pass only relevant data to AI
- AI answers based on actual filtered data

### Recommended Next Steps:

1. **Short-term (Easy)**: Implement Option 1 - pass current filters to chatbot
2. **Medium-term**: Add function calling for common queries
3. **Long-term**: Consider RAG if you need complex data queries

## Implementation Guide for Option 1 (Passing Filters)

### Step 1: Update Frontend (ChatbotWidget.jsx)
```javascript
// Get current filters from dashboard context
const { filters } = useDashboardContext();

const sendMessage = async () => {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: message,
      filters: filters  // Pass current dashboard filters
    })
  });
};
```

### Step 2: Update Backend (routes/ai.js)
```javascript
router.post('/chat', async (req, res) => {
  const { query, filters = {} } = req.body;
  
  // Use filters when fetching data
  const kpis = await getKpis(filters);
  const campaigns = await getCampaignsDetailed(5, 0, filters);
  
  // Now the data is filtered by month/year!
});
```

### Step 3: Update AI Prompt
```javascript
const prompt = `
Current Filters Applied:
- Month: ${filters.month || 'All'}
- Year: ${filters.year || 'All'}
- Country: ${filters.country || 'All'}

The data below reflects these filters:
...
`;
```

## Files Changed
- `backend/services/aiService.js` - Enhanced prompt with date context and instructions

## Testing
After deploying, test with:
1. "What's the revenue for this month?" - Should explain about filters
2. "Show me total revenue" - Should show all-time total
3. "What are the top campaigns?" - Should list campaigns with context
4. "How can I see April data?" - Should guide to use filters

## Deployment
- Committed to `dev` branch: `bfcb305`
- Pushed to GitHub
- Will deploy via Render dev service

## Summary
The chatbot now understands that it's showing all-time data and guides users to use filters for specific time periods. For true date-aware queries, implement Option 1 (passing filters) as the next improvement.
