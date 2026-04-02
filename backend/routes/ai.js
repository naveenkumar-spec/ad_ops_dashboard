const express = require('express');
const router = express.Router();
const { generateInsights, handleChatQuery } = require('../services/aiService');
const { getKPIs, getCampaignsDetailed, getProductWiseTable, getCountryWiseTable } = require('../services/bigQueryReadService');
const { parseFilters, withUserScope } = require('../services/authService');

/**
 * GET /api/ai/insights
 * Generate AI insights based on current dashboard data
 */
router.get('/insights', async (req, res) => {
  try {
    const filters = withUserScope(parseFilters(req.query), req.user);
    
    // Fetch dashboard data
    const [kpis, topCampaigns, bottomCampaigns, products, regions] = await Promise.all([
      getKPIs(filters),
      getCampaignsDetailed(filters, 'top', 10, 0),
      getCampaignsDetailed(filters, 'bottom', 10, 0),
      getProductWiseTable(filters, 10, 0),
      getCountryWiseTable(filters, 10, 0)
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
 * Handle chatbot queries
 */
router.post('/chat', async (req, res) => {
  try {
    const { query, includeContext = true } = req.body;

    console.log('[AI] Chat request received:', { query, includeContext });

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    let context = {};
    
    if (includeContext) {
      const filters = withUserScope(parseFilters(req.query), req.user);
      
      // Fetch relevant data based on query keywords
      const needsKPIs = /revenue|spend|margin|cpm|total/i.test(query);
      const needsCampaigns = /campaign/i.test(query);
      const needsProducts = /product/i.test(query);
      const needsRegions = /region|country|location/i.test(query);

      const dataPromises = [];
      
      if (needsKPIs) dataPromises.push(getKPIs(filters));
      if (needsCampaigns) dataPromises.push(getCampaignsDetailed(filters, 'top', 5, 0));
      if (needsProducts) dataPromises.push(getProductWiseTable(filters, 5, 0));
      if (needsRegions) dataPromises.push(getCountryWiseTable(filters, 5, 0));

      const results = await Promise.all(dataPromises);
      
      let idx = 0;
      if (needsKPIs) context.kpis = results[idx++];
      if (needsCampaigns) context.campaigns = results[idx++]?.rows;
      if (needsProducts) context.products = results[idx++]?.rows;
      if (needsRegions) context.regions = results[idx++]?.rows;
      
      console.log('[AI] Context prepared:', Object.keys(context));
    }

    const response = await handleChatQuery(query, context);

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
