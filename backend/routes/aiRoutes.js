// routes/aiRoutes.js - AI-related routes

const express = require('express');
const { db } = require('../db');
const { simulateData, analyzeHealthData, callOpenRouterAPI } = require('../utils');
const { sanitizeUserId, MAX_CHAT_MESSAGE } = require('../validation');

const router = express.Router();

router.get('/recommend', (req, res) => {
  try {
    const userId = sanitizeUserId(req.query.userId, 'testUser');
    db.all('SELECT data FROM biomarkers WHERE userId = ? ORDER BY timestamp DESC LIMIT 7', [userId], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to retrieve data', message: err.message });
      }
      
      const history = rows.map(row => ({ data: JSON.parse(row.data) }));
      const latest = history[0] || { data: simulateData() };
      
      const analysis = analyzeHealthData(latest.data, history);
      
      res.json({
        recommendation: analysis.recommendation,
        alert: analysis.alert,
        providerView: analysis.providerView,
        insights: analysis.insights,
        trends: analysis.trends
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Recommendation endpoint error', message: error.message });
  }
});

// Endpoint for processing user questions
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body || {};
    const userId = sanitizeUserId(req.body?.userId, 'testUser');

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }
    const trimmed = message.trim();
    if (!trimmed.length) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    if (trimmed.length > MAX_CHAT_MESSAGE) {
      return res.status(400).json({ error: `Message too long (max ${MAX_CHAT_MESSAGE} characters)` });
    }

    // Get data for analysis
    db.all('SELECT data FROM biomarkers WHERE userId = ? ORDER BY timestamp DESC LIMIT 14', [userId], async (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to retrieve data', message: err.message });
      }
      
      const history = rows.map(row => ({ data: JSON.parse(row.data) }));
      const latest = history[0] ? history[0].data : simulateData();
      
      // Strict API-only flow: no local fallback
      const analysis = analyzeHealthData(latest, history);
      const waterIntake = latest.waterIntake || 0;
      const modelResult = await callOpenRouterAPI(trimmed, {
        latest,
        history,
        analysis,
        waterIntake
      });

      if (modelResult?.content && modelResult.content.trim()) {
        return res.json({
          response: modelResult.content.trim(),
          type: 'ai',
          source: 'openrouter',
          data: {
            latest: latest,
            historyCount: history.length
          }
        });
      }
      return res.status(502).json({
        error: 'OpenRouter API request failed',
        message: modelResult?.error || 'No response from cloud model'
      });
    });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ error: 'Failed to process message', message: error.message });
  }
});

module.exports = router;