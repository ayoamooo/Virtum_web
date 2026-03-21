// routes/summaryRoutes.js - Summary routes

const express = require('express');
const { db } = require('../db');
const { calculateStats } = require('../utils');
const { sanitizeUserId } = require('../validation');

const router = express.Router();

router.get('/daily', (req, res) => {
  try {
    const userId = sanitizeUserId(req.query.userId, 'testUser');
    db.all('SELECT data, flagged FROM biomarkers WHERE userId = ? AND date(timestamp) = date("now")', [userId], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to retrieve daily stats', message: err.message });
      }
      res.json(calculateStats(rows));
    });
  } catch (error) {
    res.status(500).json({ error: 'Daily stats endpoint error', message: error.message });
  }
});

router.get('/weekly', (req, res) => {
  try {
    const userId = sanitizeUserId(req.query.userId, 'testUser');
    db.all(`SELECT data, flagged FROM biomarkers WHERE userId = ? AND timestamp >= datetime('now', '-7 days')`, [userId], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to retrieve weekly stats', message: err.message });
      }
      res.json(calculateStats(rows));
    });
  } catch (error) {
    res.status(500).json({ error: 'Weekly stats endpoint error', message: error.message });
  }
});

router.get('/monthly', (req, res) => {
  try {
    const userId = sanitizeUserId(req.query.userId, 'testUser');
    db.all(`SELECT data, flagged FROM biomarkers WHERE userId = ? AND timestamp >= datetime('now', '-30 days')`, [userId], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to retrieve monthly stats', message: err.message });
      }
      res.json(calculateStats(rows));
    });
  } catch (error) {
    res.status(500).json({ error: 'Monthly stats endpoint error', message: error.message });
  }
});

router.get('/yearly', (req, res) => {
  try {
    const userId = sanitizeUserId(req.query.userId, 'testUser');
    db.all(`SELECT data, flagged FROM biomarkers WHERE userId = ? AND timestamp >= datetime('now', '-365 days')`, [userId], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to retrieve yearly stats', message: err.message });
      }
      res.json(calculateStats(rows));
    });
  } catch (error) {
    res.status(500).json({ error: 'Yearly stats endpoint error', message: error.message });
  }
});

module.exports = router;