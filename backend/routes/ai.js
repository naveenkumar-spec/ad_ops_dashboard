const express = require('express');
const router = express.Router();
const { generateInsights, handleChatQuery } = require('../services/aiService');
const { getKpis, getCampaignsDetailed, getProductWiseTable, getCountryWiseTable } = require('../services/bigQueryReadService');
const { parseFilters, withUserScope } = require('../utils/filters');

/**
 * GET /api/ai/insights
 * Generate AI insights based on current dashboard data
 */
router.get('/insights', async (req, res) => {
  try {
    const filters = withUserScope(parseFilters(req.query), req.user);
    
    // Fetch dashboard data
    const [kpis, topCampaigns, bottomCampaigns, products, regions] = await Promise.all([
      getKpis(filters),
      getCampaignsDetailed(10, 0, filters, 'top'),
      getCampaignsDetailed(10, 0, filters, 'bottom'),
      getProductWiseTable(10, 0, filters),
      getCountryWiseTable(10, 0, filters)
    ]);

    const dashboardData = {
      kpis,
      topCampaigns: topCampaigns.rows,
      bottomCampaigns: bottomCampaigns.rows,
      products: products.rows,
      regions: regions.rows
    };

    const insights = await generateInsights(dashboardData);

    res.json({
      success: true,
      insights,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate insights',
      message: error.message
    });
  }
});

/**
 * POST /api/ai/chat
 * Handle chatbot queries with intelligent data fetching
 */
router.post('/chat', async (req, res) => {
  try {
    const { query } = req.body;

    console.log('[AI] Chat request received:', { query });

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    const filters = withUserScope(parseFilters(req.query), req.user);
    
    // Create data fetcher functions that the AI can use
    const dataFetcher = {
      getKPIs: async (additionalFilters = {}) => {
        try {
          return await getKpis({ ...filters, ...additionalFilters });
        } catch (error) {
          console.error('[AI] Error fetching KPIs:', error.message);
          return null;
        }
      },
      getCountryData: async (additionalFilters = {}) => {
        try {
          const result = await getCountryWiseTable(10, 0, { ...filters, ...additionalFilters });
          return result.rows || [];
        } catch (error) {
          console.error('[AI] Error fetching country data:', error.message);
          return [];
        }
      },
      getPlatformData: async (additionalFilters = {}) => {
        try {
          const result = await getProductWiseTable(10, 0, { ...filters, ...additionalFilters });
          return result.rows || [];
        } catch (error) {
          console.error('[AI] Error fetching platform data:', error.message);
          return [];
        }
      },
      getProductData: async (additionalFilters = {}) => {
        try {
          const result = await getProductWiseTable(10, 0, { ...filters, ...additionalFilters });
          return result.rows || [];
        } catch (error) {
          console.error('[AI] Error fetching product data:', error.message);
          return [];
        }
      },
      getCampaignData: async (additionalFilters = {}) => {
        try {
          const result = await getCampaignsDetailed(10, 0, { ...filters, ...additionalFilters }, 'top');
          return result.rows || [];
        } catch (error) {
          console.error('[AI] Error fetching campaign data:', error.message);
          return [];
        }
      }
    };

    const response = await handleChatQuery(query, {}, dataFetcher);

    console.log('[AI] Sending response:', { success: !response.error });

    res.json({
      success: true,
      query,
      ...response
    });
  } catch (error) {
    console.error('[AI] Error handling chat query:', {
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to process chat query',
      message: error.message
    });
  }
});

module.exports = router;
