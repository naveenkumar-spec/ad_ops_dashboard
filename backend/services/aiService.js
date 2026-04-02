const axios = require('axios');

// Groq API configuration - FREE and FAST!
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama3-8b-8192'; // Fast and free

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
 * Handle chatbot queries
 */
async function handleChatQuery(query, context) {
  const prompt = `You are a helpful marketing analytics assistant. Answer this question based on the dashboard data:

Question: ${query}

Context:
${JSON.stringify(context, null, 2)}

Provide a clear, concise answer. If you need to reference numbers, format them nicely. If the data isn't available, say so politely.

Answer:`;

  try {
    console.log('[AI] Handling chat query:', query);
    const response = await callAI(prompt, 300);
    console.log('[AI] Chat response generated successfully');
    
    return {
      answer: response,
      timestamp: new Date().toISOString()
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
