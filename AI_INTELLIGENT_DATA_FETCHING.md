# AI Chatbot - Intelligent Data Fetching Solution

## The Problem
You wanted the chatbot to answer questions like:
- "What's the revenue for this month?" → Should show April 2026 revenue
- "Which country has the highest revenue?" → Should show country breakdown
- "Show me platform performance" → Should show platform data

## Why "Training" Isn't the Answer

### What Training Actually Means:
Training an AI model means:
1. Taking the base model (billions of parameters)
2. Fine-tuning it on your specific data
3. Creating a new custom model

### Why You Can't Train Groq:
- Groq is a **hosted API service** - you don't own the model
- Training requires **access to model weights** (not available)
- Training costs **thousands of dollars** and requires ML expertise
- Training is for **teaching behavior**, not for giving it data access

## The Real Solution: Intelligent Data Fetching

Instead of training, we give the AI the ability to **fetch the exact data it needs** based on the question.

### How It Works:

```
User asks: "What's the revenue for April 2026?"
           ↓
AI Service parses query:
- Detects: "revenue" → needs KPIs
- Detects: "April 2026" → needs month filter
- Extracts: month=April, year=2026
           ↓
Fetches data from BigQuery:
- getKPIs({ month: 'April', year: 2026 })
- Returns: { totalRevenue: 150000, ... }
           ↓
Sends to Groq with context:
"Filters Applied: Month=April, Year=2026
 Total Revenue: $150,000"
           ↓
Groq responds:
"The revenue for April 2026 is $150,000"
```

## Implementation Details

### 1. Query Parsing
The AI service now intelligently parses queries to understand:

```javascript
// Detects time-based queries
const needsMonthly = /this month|current month|monthly/i.test(query);

// Detects data type needed
const needsCountry = /country|region|location/i.test(query);
const needsPlatform = /platform|channel/i.test(query);

// Extracts specific month/year
const monthMatch = query.match(/\b(january|february|...)\b/i);
const yearMatch = query.match(/\b(20\d{2})\b/);
```

### 2. Dynamic Filter Building
Based on the query, it builds appropriate filters:

```javascript
const filters = {};
if (needsMonthly) {
  filters.month = 'April';  // Extracted from query or current month
  filters.year = 2026;       // Extracted from query or current year
}
```

### 3. Data Fetcher Functions
The AI has access to these functions:

```javascript
dataFetcher = {
  getKPIs: async (filters) => { ... },           // Revenue, spend, margins
  getCountryData: async (filters) => { ... },    // Country breakdown
  getPlatformData: async (filters) => { ... },   // Platform performance
  getProductData: async (filters) => { ... },    // Product breakdown
  getCampaignData: async (filters) => { ... }    // Campaign details
}
```

### 4. Intelligent Context Building
It fetches only the data needed for the question:

```javascript
if (needsCountry) {
  enhancedContext.countryData = await dataFetcher.getCountryData(filters);
}
```

### 5. Formatted Context for Groq
Sends clean, formatted data to Groq:

```
Current Date: April 9, 2026

Filters Applied:
- Month: April
- Year: 2026

Key Performance Indicators (Filtered):
- Total Revenue: $150,000
- Total Spend: $120,000
- Gross Margin: 20.0%

Top Countries by Revenue:
1. United States: $50,000 revenue, 25.0% margin
2. United Kingdom: $30,000 revenue, 22.0% margin
3. Japan: $25,000 revenue, 18.0% margin
```

## Example Queries That Now Work

### Query 1: "What's the revenue for this month?"
```
Parsing:
- Detects: "this month" → needsMonthly = true
- Sets: month = April, year = 2026

Fetches:
- getKPIs({ month: 'April', year: 2026 })

Response:
"The revenue for April 2026 is $150,000 with a gross margin of 20.0%."
```

### Query 2: "Which country has the highest revenue?"
```
Parsing:
- Detects: "country" → needsCountry = true
- No time filter → uses all-time data

Fetches:
- getCountryData({})

Response:
"The United States has the highest revenue at $500,000, followed by 
the United Kingdom at $300,000 and Japan at $250,000."
```

### Query 3: "Show me platform performance for March 2026"
```
Parsing:
- Detects: "platform" → needsPlatform = true
- Detects: "March 2026" → month = March, year = 2026

Fetches:
- getPlatformData({ month: 'March', year: 2026 })

Response:
"For March 2026, the top platforms are:
1. Google Ads: $80,000 revenue
2. Facebook: $60,000 revenue
3. LinkedIn: $40,000 revenue"
```

### Query 4: "What was the revenue in January 2025?"
```
Parsing:
- Detects: "January 2025" → month = January, year = 2025

Fetches:
- getKPIs({ month: 'January', year: 2025 })

Response:
"The revenue for January 2025 was $120,000."
```

## What This Solution Provides

✅ **No Training Needed** - Uses intelligent data fetching instead
✅ **Real-Time Data** - Always fetches current data from BigQuery
✅ **Time-Aware** - Understands "this month", specific months, years
✅ **Multi-Dimensional** - Can query by country, platform, product, campaign
✅ **Automatic Filtering** - Extracts filters from natural language
✅ **Cost-Effective** - No expensive training, just API calls
✅ **Maintainable** - Easy to add new data sources

## Limitations & Future Enhancements

### Current Limitations:
1. **Simple date parsing** - Only handles month/year, not complex date ranges
2. **English only** - Query parsing is English-specific
3. **No multi-filter queries** - Can't handle "revenue in US for April"
4. **No aggregations** - Can't do "compare March vs April"

### Future Enhancements:

#### 1. Advanced Date Parsing
```javascript
// Handle: "last 3 months", "Q1 2026", "year to date"
const dateParser = new DateParser();
const range = dateParser.parse("last 3 months");
// Returns: { startMonth: 'January', endMonth: 'March', year: 2026 }
```

#### 2. Multi-Filter Support
```javascript
// Handle: "revenue in United States for April 2026"
filters = {
  month: 'April',
  year: 2026,
  country: 'United States'
}
```

#### 3. Comparison Queries
```javascript
// Handle: "compare March vs April revenue"
const marchData = await getKPIs({ month: 'March', year: 2026 });
const aprilData = await getKPIs({ month: 'April', year: 2026 });
// Calculate difference and percentage change
```

#### 4. Trend Analysis
```javascript
// Handle: "show revenue trend for last 6 months"
const months = getLast6Months();
const trendData = await Promise.all(
  months.map(m => getKPIs({ month: m.month, year: m.year }))
);
```

## How to Add More Data Sources

To add a new data source (e.g., "owner performance"):

### Step 1: Add detection in aiService.js
```javascript
const needsOwner = /owner|ops|cs|sales/i.test(query);
```

### Step 2: Add fetcher in ai.js
```javascript
dataFetcher.getOwnerData = async (additionalFilters = {}) => {
  const result = await getOwnerPerformance('ops', { ...filters, ...additionalFilters });
  return result || [];
};
```

### Step 3: Add context building in aiService.js
```javascript
if (enhancedContext.ownerData?.length) {
  contextDescription += `Owner Performance:\n`;
  enhancedContext.ownerData.forEach((o, i) => {
    contextDescription += `${i + 1}. ${o.owner}: $${o.revenue?.toLocaleString()}\n`;
  });
}
```

That's it! The AI will now understand owner-related queries.

## Summary

This solution gives the AI **intelligence without training** by:
1. Parsing natural language queries
2. Extracting filters (month, year, country, etc.)
3. Fetching the exact data needed
4. Formatting it clearly for Groq
5. Getting accurate, data-driven responses

The chatbot now truly understands your data and can answer complex questions about monthly revenue, country performance, platform metrics, and more - all without expensive training!
