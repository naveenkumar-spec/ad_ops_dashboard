const axios = require('axios');

// Hugging Face API configuration - Using free tier models
// These models are guaranteed to work on free tier
const HF_MODELS = [
  'HuggingFaceH4/zephyr-7b-beta',  // Primary: Good quality, free tier
  'google/flan-t5-base',  // Fallback: Smaller, faster, always available
  'facebook/blenderbot-400M-distill'  // Backup: Chat-optimized, very reliable
];

const HF_MODEL = process.env.HF_MODEL || HF_MODELS[0];
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;
const HF_API_TOKEN = process.env.HUGGINGFACE_API_KEY;

/**
 * Call Hugging Face API for text generation
 */
async function callHuggingFace(prompt, maxTokens = 500) {
  try {
    if (!HF_API_TOKEN) {
      throw new Error('HUGGINGFACE_API_KEY environment variable is not set');
    }

    console.log('[AI] Calling Hugging Face API with model:', HF_MODEL);
    
    const response = await axios.post(
      HF_API_URL,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: maxTokens,
          temperature: 0.7,
          top_p: 0.95,
          return_full_text: false
        },
        options: {
          wait_for_model: true,
          use_cache: false
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${HF_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    console.log('[AI] Response status:', response.status);
    console.log('[AI] Response data:', JSON.stringify(response.data).substring(0, 200));

    if (response.data && response.data[0] && response.data[0].generated_text) {
      return response.data[0].generated_text.trim();
    }
    
    // Handle error responses
    if (response.data && response.data.error) {
      console.error('[AI] Hugging Face API error:', response.data.error);
      throw new Error(response.data.error);
    }
    
    throw new Error('Invalid response from Hugging Face API');
  } catch (error) {
    if (error.response?.status === 503) {
      // Model is loading, retry after delay
      console.log('[AI] Model loading, retrying in 20 seconds...');
      await new Promise(resolve => setTimeout(resolve, 20000));
      return callHuggingFace(prompt, maxTokens);
    }
    
    if (error.response?.status === 410) {
      // This specific model is not available on free tier
      console.error('[AI] Model not available on free tier. Error:', error.response?.data);
      throw new Error(`Model ${HF_MODEL} is not available. The free Inference API may have restrictions on this model. Try using a different model or upgrade to a paid tier.`);
    }
    
    console.error('[AI] Hugging Face API error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    throw error;
  }
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
    const response = await callHuggingFace(prompt, 300);
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
  callHuggingFace
};
