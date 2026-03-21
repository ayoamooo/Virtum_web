// Provider API endpoints for healthcare providers
// This provides anonymized access to patient data patterns

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();

// Middleware to verify provider role (simplified - in production use proper JWT verification)
const verifyProvider = (req, res, next) => {
  // In production, verify JWT token and check role === 'provider'
  const role = req.headers['x-role'] || req.query.role;
  if (role === 'provider') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Provider role required.' });
  }
};

// Get anonymized aggregated statistics across all users
router.get('/api/provider/aggregate', verifyProvider, (req, res) => {
  const db = new sqlite3.Database('./virtum.db');
  
  db.all(`
    SELECT 
      AVG(CAST(json_extract(data, '$.steps') AS INTEGER)) as avg_steps,
      AVG(CAST(json_extract(data, '$.heartRate') AS INTEGER)) as avg_heart_rate,
      COUNT(*) as total_records,
      SUM(flagged) as anomaly_count
    FROM biomarkers
    WHERE timestamp >= datetime('now', '-30 days')
  `, (err, rows) => {
    if (err) {
      db.close();
      return res.status(500).json({ error: err.message });
    }
    
    const stats = rows[0] || {};
    res.json({
      period: 'last_30_days',
      averageSteps: Math.round(stats.avg_steps || 0),
      averageHeartRate: Math.round(stats.avg_heart_rate || 70),
      totalRecords: stats.total_records || 0,
      anomalyCount: stats.anomaly_count || 0,
      anomalyRate: stats.total_records > 0 
        ? ((stats.anomaly_count / stats.total_records) * 100).toFixed(2) + '%'
        : '0%'
    });
    db.close();
  });
});

// Get anonymized patterns (no user IDs exposed)
router.get('/api/provider/patterns', verifyProvider, (req, res) => {
  const db = new sqlite3.Database('./virtum.db');
  
  db.all(`
    SELECT 
      date(timestamp) as date,
      AVG(CAST(json_extract(data, '$.steps') AS INTEGER)) as avg_steps,
      AVG(CAST(json_extract(data, '$.heartRate') AS INTEGER)) as avg_heart_rate,
      COUNT(*) as record_count
    FROM biomarkers
    WHERE timestamp >= datetime('now', '-7 days')
    GROUP BY date(timestamp)
    ORDER BY date DESC
  `, (err, rows) => {
    if (err) {
      db.close();
      return res.status(500).json({ error: err.message });
    }
    
    // Anonymize: remove any user-identifying information
    const patterns = rows.map(row => ({
      date: row.date,
      averageSteps: Math.round(row.avg_steps || 0),
      averageHeartRate: Math.round(row.avg_heart_rate || 70),
      recordCount: row.record_count
    }));
    
    res.json({
      patterns: patterns,
      note: 'All data is anonymized. No user identifiers are included.'
    });
    db.close();
  });
});

module.exports = router;

