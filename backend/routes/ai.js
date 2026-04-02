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
      try {
        const filters = withUserScope(parseFilters(req.query), req.user);
        
        // Fetch relevant data based on query keywords
        const needsKPIs = /revenue|spend|margin|cpm|total/i.test(query);
        const needsCampaigns = /campaign/i.test(query);
        const needsProducts = /product/i.test(query);
        const needsRegions = /region|country|location/i.test(query);

        const dataPromises = [];
        
        if (needsKPIs) dataPromises.push(getKpis(filters).catch(err => { console.error('[AI] KPIs error:', err.message); return null; }));
        if (needsCampaigns) dataPromises.push(getCampaignsDetailed(5, 0, filters, 'top').catch(err => { console.error('[AI] Campaigns error:', err.message); return { rows: [] }; }));
        if (needsProducts) dataPromises.push(getProductWiseTable(5, 0, filters).catch(err => { console.error('[AI] Products error:', err.message); return { rows: [] }; }));
        if (needsRegions) dataPromises.push(getCountryWiseTable(5, 0, filters).catch(err => { console.error('[AI] Regions error:', err.message); return { rows: [] }; }));

        const results = await Promise.all(dataPromises);
        
        let idx = 0;
        if (needsKPIs && results[idx]) context.kpis = results[idx++];
        if (needsCampaigns && results[idx]) context.campaigns = results[idx++]?.rows;
        if (needsProducts && results[idx]) context.products = results[idx++]?.rows;
        if (needsRegions && results[idx]) context.regions = results[idx++]?.rows;
        
        console.log('[AI] Context prepared:', Object.keys(context));
      } catch (contextError) {
        console.error('[AI] Error preparing context:', contextError.message);
        // Continue with empty context rather than failing
      }
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
