// routes/dataRoutes.js - Data-related routes

const express = require('express');
const crypto = require('crypto-js');
const { db } = require('../db');
const { validateInput } = require('../middlewares');
const { simulateData } = require('../utils');
const { sanitizeUserId } = require('../validation');

const router = express.Router();

router.get('/simulate', (req, res) => {
  try {
    res.json(simulateData());
  } catch (error) {
    res.status(500).json({ error: 'Failed to simulate data', message: error.message });
  }
});

router.post('/store', (req, res) => {
  try {
    const userId = sanitizeUserId(req.body?.userId, 'testUser');
    console.log('📝 Received POST /api/data/store with userId:', userId);
    let data = simulateData();
    if (data.steps > 50000 || data.heartRate > 200) data.flagged = true;

    db.run('INSERT INTO biomarkers (userId, data, flagged) VALUES (?, ?, ?)',
      [userId, JSON.stringify(data), data.flagged ? 1 : 0],
      function(err) {
        if (err) {
          console.error('Error storing data:', err);
          return res.status(500).json({ error: 'Failed to store data', message: err.message });
        }
        res.json({ id: this.lastID, ...data });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Store endpoint error', message: error.message });
  }
});

router.get('/history', (req, res) => {
  try {
    const userId = sanitizeUserId(req.query.userId, 'testUser');
    db.all('SELECT data, flagged FROM biomarkers WHERE userId = ? ORDER BY timestamp DESC LIMIT 14',
      [userId],
      (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to retrieve history', message: err.message });
        }
        const history = rows.map(row => ({ 
          data: JSON.parse(row.data),
          flagged: row.flagged === 1 
        }));
        res.json(history);
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'History endpoint error', message: error.message });
  }
});

router.post('/custom', validateInput({
  userId: { type: 'string', maxLength: 100, required: false },
  steps: { type: 'number', min: 0, max: 100000, required: false },
  heartRate: { type: 'number', min: 20, max: 250, required: false },
  bloodPressure: { type: 'string', pattern: /^\d{1,3}\/\d{1,3}$/, required: false },
  weight: { type: 'number', min: 20, max: 500, required: false },
  calorieIntake: { type: 'number', min: 0, max: 10000, required: false },
  waterIntake: { type: 'number', min: 0, max: 100, required: false },
  sleepHours: { type: 'number', min: 0, max: 24, required: false }
}), (req, res) => {
  const { steps, heartRate, bloodPressure, weight, calorieIntake, waterIntake, sleepHours } = req.body;
  const userId = sanitizeUserId(req.body?.userId, 'testUser');
  
  console.log('📝 Received POST /api/data/custom');
  console.log('   userId:', userId);
  
  // At least one metric required
  if (steps === undefined && heartRate === undefined && waterIntake === undefined &&
      bloodPressure === undefined && weight === undefined && calorieIntake === undefined &&
      sleepHours === undefined) {
    return res.status(400).json({ error: 'At least one metric required' });
  }

  db.get('SELECT data FROM biomarkers WHERE userId = ? ORDER BY timestamp DESC LIMIT 1',
    [userId],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error', message: err.message });
      }
      
      const lastData = row ? JSON.parse(row.data) : {};
      
      const data = {
        steps: steps !== undefined ? steps : (lastData.steps || 0),
        heartRate: heartRate !== undefined ? heartRate : (lastData.heartRate || 70),
        bloodPressure: bloodPressure || (lastData.bloodPressure || '120/80'),
        weight: weight !== undefined ? weight : (lastData.weight || 70),
        calorieIntake: calorieIntake !== undefined ? calorieIntake : (lastData.calorieIntake || 0),
        waterIntake: waterIntake !== undefined ? waterIntake : (lastData.waterIntake || 0),
        sleepHours: sleepHours !== undefined ? sleepHours : (lastData.sleepHours || 0),
        weather: lastData.weather || 'unknown',
        location: lastData.location || 'unknown',
        accuracy: 'user-input',
        timestamp: new Date(),
        isUserInput: true
      };

      let flagged = false;
      if (data.steps > 50000 || data.heartRate > 200 || data.heartRate < 30) {
        flagged = true;
      }

      db.run('INSERT INTO biomarkers (userId, data, flagged) VALUES (?, ?, ?)',
        [userId, JSON.stringify(data), flagged ? 1 : 0],
        function(err) {
          if (err) {
            console.error('Error saving custom data:', err);
            return res.status(500).json({ error: 'Failed to save data', message: err.message });
          }
          res.json({ 
            success: true, 
            id: this.lastID, 
            data: data,
            message: 'Data saved successfully!'
          });
        }
      );
    }
  );
});

// Quick water intake save
router.post('/water', validateInput({
  userId: { type: 'string', maxLength: 100, required: false },
  waterIntake: { type: 'number', min: 0, max: 100, required: true }
}), (req, res) => {
  const { waterIntake } = req.body;
  const userId = sanitizeUserId(req.body?.userId, 'testUser');
  
  console.log('💧 Received POST /api/data/water with userId:', userId, 'waterIntake:', waterIntake);

  db.get('SELECT data FROM biomarkers WHERE userId = ? ORDER BY timestamp DESC LIMIT 1',
    [userId],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error', message: err.message });
      }
      
      const lastData = row ? JSON.parse(row.data) : {};
      
      const data = {
        ...lastData,
        waterIntake: waterIntake,
        timestamp: new Date(),
        isUserInput: true
      };

      db.run('INSERT INTO biomarkers (userId, data, flagged) VALUES (?, ?, ?)',
        [userId, JSON.stringify(data), 0],
        function(err) {
          if (err) {
            console.error('Error saving water data:', err);
            return res.status(500).json({ error: 'Failed to save water intake', message: err.message });
          }
          res.json({ 
            success: true, 
            waterIntake: waterIntake,
            message: 'Water updated! 💧'
          });
        }
      );
    }
  );
});

// Legacy sample — replace with KMS/HSM-backed crypto in production
router.post('/secure', (req, res) => {
  const encrypted = crypto.AES.encrypt(JSON.stringify(req.body), 'secret_key').toString();
  res.json({
    encrypted,
    warning: 'Sample encryption only — use managed keys and rotation in production'
  });
});

module.exports = router;