const axios = require('axios');

// Groq API configuration - FREE and FAST!
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
// Updated to current available models (as of 2024)
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant'; // Fast and free

// Fallback to other free APIs if Groq not configured
const USE_GROQ = !!GROQ_API_KEY;

/**
 * Call Groq API for text generation (FREE and FAST!)
 */
async function callGroq(prompt, maxTokens = 500) {
  try {
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is not set');
    }

    console.log('[AI] Calling Groq API with model:', GROQ_MODEL);
    
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful marketing analytics assistant. Provide clear, concise answers based on the data provided.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
        top_p: 0.95
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('[AI] Response status:', response.status);

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content.trim();
    }
    
    throw new Error('Invalid response from Groq API');
  } catch (error) {
    console.error('[AI] Groq API error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}

/**
 * Main function to call AI API (uses Groq if available)
 */
async function callAI(prompt, maxTokens = 500) {
  if (USE_GROQ) {
    return callGroq(prompt, maxTokens);
  }
  
  throw new Error('No AI API configured. Please set GROQ_API_KEY environment variable.');
}

/**
 * Generate insights from dashboard data
 */
async function generateInsights(data) {
  const { kpis, trends, topCampaigns, bottomCampaigns, products, regions } = data;

  const prompt = `You are a marketing analytics expert. Analyze this dashboard data and provide 5 key insights:

KPIs:
- Total Revenue: $${kpis.totalRevenue?.toLocaleString() || 0}
- Total Spend: $${kpis.totalSpend?.toLocaleString() || 0}
- Gross Margin: ${kpis.grossMargin?.toFixed(1) || 0}%
- Net Margin: ${kpis.netMargin?.toFixed(1) || 0}%
- Average CPM: $${kpis.avgCPM?.toFixed(2) || 0}

Top Performing Campaigns: ${topCampaigns?.length || 0}
Bottom Performing Campaigns: ${bottomCampaigns?.length || 0}
Products Tracked: ${products?.length || 0}
Regions: ${regions?.length || 0}

Provide exactly 5 actionable insights in this format:
1. [Insight about revenue/margins]
2. [Insight about campaign performance]
3. [Insight about products/regions]
4. [Recommendation for optimization]
5. [Trend observation]

Keep each insight to 1-2 sentences. Be specific and actionable.`;

  try {
    const response = await callHuggingFace(prompt, 400);
    return parseInsights(response);
  } catch (error) {
    console.error('Error generating insights:', error);
    return getDefaultInsights(data);
  }
}

/**
 * Parse AI response into structured insights
 */
function parseInsights(text) {
  const lines = text.split('\n').filter(line => line.trim());
  const insights = [];
  
  for (const line of lines) {
    const match = line.match(/^\d+\.\s*(.+)$/);
    if (match) {
      insights.push({
        text: match[1].trim(),
        type: getInsightType(match[1])
      });
    }
  }
  
  return insights.slice(0, 5);
}

/**
 * Determine insight type for icon/color
 */
function getInsightType(text) {
  const lower = text.toLowerCase();
  if (lower.includes('increase') || lower.includes('growth') || lower.includes('improve')) return 'positive';
  if (lower.includes('decrease') || lower.includes('decline') || lower.includes('drop')) return 'negative';
  if (lower.includes('recommend') || lower.includes('should') || lower.includes('consider')) return 'recommendation';
  return 'neutral';
}

/**
 * Fallback insights if AI fails
 */
function getDefaultInsights(data) {
  const { kpis } = data;
  return [
    {
      text: `Current gross margin is ${kpis.grossMargin?.toFixed(1)}%. Monitor campaigns below 50% margin threshold.`,
      type: 'neutral'
    },
    {
      text: `Total revenue of $${kpis.totalRevenue?.toLocaleString()} with $${kpis.totalSpend?.toLocaleString()} in spend.`,
      type: 'neutral'
    },
    {
      text: 'Review bottom-performing campaigns for optimization opportunities.',
      type: 'recommendation'
    },
    {
      text: `Average CPM is $${kpis.avgCPM?.toFixed(2)}. Compare against industry benchmarks.`,
      type: 'neutral'
    },
    {
      text: 'Analyze regional performance to identify growth markets.',
      type: 'recommendation'
    }
  ];
}

/**
 * Handle chatbot queries with intelligent data fetching
 */
async function handleChatQuery(query, context, dataFetcher) {
  // Get current date information
  const now = new Date();
  const currentMonth = now.toLocaleString('en-US', { month: 'long' });
  const currentYear = now.getFullYear();
  
  // Parse query to understand what data is needed
  const queryLower = query.toLowerCase();
  const needsMonthly = /this month|current month|monthly|month of/i.test(query);
  const needsDaily = /today|daily|this day/i.test(query);
  const needsCountry = /country|region|location|where/i.test(query);
  const needsPlatform = /platform|channel/i.test(query);
  const needsProduct = /product/i.test(query);
  const needsCampaign = /campaign/i.test(query);
  
  // Extract month/year from query if mentioned
  let targetMonth = currentMonth;
  let targetYear = currentYear;
  
  const monthMatch = query.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
  if (monthMatch) {
    targetMonth = monthMatch[1].charAt(0).toUpperCase() + monthMatch[1].slice(1).toLowerCase();
  }
  
  const yearMatch = query.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    targetYear = parseInt(yearMatch[1]);
  }
  
  // Build filters based on query
  const filters = {};
  if (needsMonthly) {
    filters.month = targetMonth;
    filters.year = targetYear;
  }
  
  // Fetch relevant data using the dataFetcher
  let enhancedContext = { ...context };
  
  if (dataFetcher) {
    try {
      // Fetch data based on what's needed
      if (needsCountry && dataFetcher.getCountryData) {
        enhancedContext.countryData = await dataFetcher.getCountryData(filters);
      }
      if (needsPlatform && dataFetcher.getPlatformData) {
        enhancedContext.platformData = await dataFetcher.getPlatformData(filters);
      }
      if (needsProduct && dataFetcher.getProductData) {
        enhancedContext.productData = await dataFetcher.getProductData(filters);
      }
      if (needsCampaign && dataFetcher.getCampaignData) {
        enhancedContext.campaignData = await dataFetcher.getCampaignData(filters);
      }
      // Always fetch KPIs with appropriate filters
      if (dataFetcher.getKPIs) {
        enhancedContext.kpis = await dataFetcher.getKPIs(filters);
      }
    } catch (error) {
      console.error('[AI] Error fetching enhanced data:', error);
    }
  }
  
  // Build context description
  let contextDescription = `Current Date: ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
  
  if (Object.keys(filters).length > 0) {
    contextDescription += `\nFilters Applied:\n`;
    if (filters.month) contextDescription += `- Month: ${filters.month}\n`;
    if (filters.year) contextDescription += `- Year: ${filters.year}\n`;
    contextDescription += `\n`;
  }
  
  if (enhancedContext.kpis) {
    const kpis = enhancedContext.kpis;
    contextDescription += `Key Performance Indicators${Object.keys(filters).length > 0 ? ' (Filtered)' : ' (All Time)'}:\n`;
    contextDescription += `- Total Revenue: $${kpis.totalRevenue?.toLocaleString() || 0}\n`;
    contextDescription += `- Total Spend: $${kpis.totalSpend?.toLocaleString() || 0}\n`;
    contextDescription += `- Gross Margin: ${kpis.grossMargin?.toFixed(1) || 0}%\n`;
    contextDescription += `- Net Margin: ${kpis.netMargin?.toFixed(1) || 0}%\n`;
    contextDescription += `- Total Campaigns: ${kpis.totalCampaigns || 0}\n`;
    contextDescription += `- Budget Groups: ${kpis.budgetGroups || 0}\n`;
    contextDescription += `- Average CPM: $${kpis.avgCPM?.toFixed(2) || 0}\n\n`;
  }
  
  if (enhancedContext.countryData?.length) {
    contextDescription += `Top Countries by Revenue:\n`;
    enhancedContext.countryData.slice(0, 5).forEach((c, i) => {
      contextDescription += `${i + 1}. ${c.country || c.region}: $${c.revenue?.toLocaleString() || 0} revenue, ${c.grossMarginPct?.toFixed(1) || 0}% margin\n`;
    });
    contextDescription += `\n`;
  }
  
  if (enhancedContext.platformData?.length) {
    contextDescription += `Platform Performance:\n`;
    enhancedContext.platformData.slice(0, 5).forEach((p, i) => {
      contextDescription += `${i + 1}. ${p.platform}: $${p.revenue?.toLocaleString() || 0} revenue, ${p.campaigns || 0} campaigns\n`;
    });
    contextDescription += `\n`;
  }
  
  if (enhancedContext.productData?.length) {
    contextDescription += `Product Performance:\n`;
    enhancedContext.productData.slice(0, 5).forEach((p, i) => {
      contextDescription += `${i + 1}. ${p.product}: $${p.revenue?.toLocaleString() || 0} revenue, ${p.grossMarginPct?.toFixed(1) || 0}% margin\n`;
    });
    contextDescription += `\n`;
  }
  
  if (enhancedContext.campaignData?.length) {
    contextDescription += `Top Campaigns:\n`;
    enhancedContext.campaignData.slice(0, 5).forEach((c, i) => {
      contextDescription += `${i + 1}. ${c.campaignName}: $${c.revenue?.toLocaleString() || 0} revenue, ${c.grossMarginPct?.toFixed(1) || 0}% margin\n`;
    });
    contextDescription += `\n`;
  }

  const prompt = `You are a helpful marketing analytics assistant. Answer the user's question based on the data provided.

${contextDescription}

User Question: ${query}

Instructions:
- Answer directly with the numbers and insights from the data above
- Format currency values with $ and commas (e.g., $1,234,567)
- Format percentages with % symbol (e.g., 25.5%)
- Be concise and specific
- If the data shows filtered results, mention the time period
- If asked about a specific metric not in the data, say you don't have that information

Answer:`;

  try {
    console.log('[AI] Handling chat query:', query);
    console.log('[AI] Filters applied:', filters);
    const response = await callAI(prompt, 500);
    console.log('[AI] Chat response generated successfully');
    
    return {
      answer: response,
      timestamp: new Date().toISOString(),
      filters: filters
    };
  } catch (error) {
    console.error('[AI] Error handling chat query:', {
      message: error.message,
      query: query,
      stack: error.stack
    });
    
    return {
      answer: "I'm having trouble processing your question right now. Please try again in a moment.",
      timestamp: new Date().toISOString(),
      error: true,
      errorMessage: error.message
    };
  }
}

module.exports = {
  generateInsights,
  handleChatQuery,
  callAI
};
