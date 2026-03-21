// utils.js - Helper functions

// Data simulation function
const simulateData = () => {
  const biomarkers = {
    steps: Math.floor(Math.random() * 10000),
    heartRate: Math.floor(Math.random() * (100 - 60) + 60),
    bloodGlucose: Math.random() * (200 - 70) + 70,
    bloodPressure: `${Math.floor(Math.random() * (140 - 90) + 90)}/${Math.floor(Math.random() * (90 - 60) + 60)}`,
    weight: Math.random() * (100 - 50) + 50,
    calorieIntake: Math.floor(Math.random() * 3000),
  };
  const context = {
    weather: ['sunny', 'rainy', 'cloudy'][Math.floor(Math.random() * 3)],
    location: 'Aktobe, KZ',
    accuracy: Math.random() > 0.9 ? 'high' : 'low',
  };
  return { ...biomarkers, ...context, timestamp: new Date() };
};

// Enhanced health analysis function
const analyzeHealthData = (data, history = []) => {
  const analysis = {
    recommendation: '',
    alert: null,
    providerView: { o2: 98, calories: data.calorieIntake || 0 },
    insights: [],
    trends: {}
  };

  // Steps analysis
  if (data.steps < 3000) {
    analysis.recommendation = 'Your activity is low. I recommend taking at least a 30-minute walk today.';
    analysis.insights.push('Low physical activity can affect overall well-being.');
  } else if (data.steps < 5000) {
    analysis.recommendation = 'Good activity! Try to reach 5000+ steps for optimal health.';
  } else if (data.steps < 10000) {
    analysis.recommendation = 'Excellent activity! You are on the right track to a healthy lifestyle.';
  } else {
    analysis.recommendation = 'Outstanding! You have achieved an excellent level of activity. Keep it up!';
  }

  // Heart rate analysis
  if (data.heartRate > 100) {
    analysis.alert = 'Your heart rate is elevated. I recommend resting and avoiding physical exertion.';
    analysis.insights.push('Elevated heart rate may indicate stress or overexertion.');
  } else if (data.heartRate < 60) {
    analysis.insights.push('Low heart rate can be normal for trained individuals.');
  } else {
    analysis.insights.push('Your heart rate is within normal range.');
  }

  // Blood pressure analysis
  if (data.bloodPressure) {
    const [systolic, diastolic] = data.bloodPressure.split('/').map(Number);
    if (systolic > 130 || diastolic > 85) {
      analysis.alert = (analysis.alert ? analysis.alert + ' ' : '') + 'Blood pressure is elevated. I recommend consulting a doctor.';
      analysis.insights.push('High blood pressure requires attention and monitoring.');
    } else if (systolic < 90 || diastolic < 60) {
      analysis.insights.push('Low blood pressure - monitor how you feel.');
    }
  }

  // Weight and calories analysis
  if (data.calorieIntake < 1200) {
    analysis.insights.push('Calorie intake is very low. Make sure you are getting enough nutrients.');
  } else if (data.calorieIntake > 3000) {
    analysis.insights.push('High calorie intake. Ensure balance with physical activity.');
  }

  // Trend analysis from history
  if (history.length >= 3) {
    const recentSteps = history.slice(0, 3).map(h => h.data.steps || 0);
    const avgSteps = recentSteps.reduce((a, b) => a + b, 0) / recentSteps.length;
    
    if (data.steps > avgSteps * 1.2) {
      analysis.trends.steps = 'Activity is improving!';
    } else if (data.steps < avgSteps * 0.8) {
      analysis.trends.steps = 'Activity has decreased. Try to move more.';
    }
  }

  return analysis;
};

// Helper to call the OpenRouter API
async function callOpenRouterAPI(userMessage, healthContext) {
  const { OPENROUTER_API_KEY, OPENROUTER_API_URL, OPENROUTER_MODEL, USE_OPENROUTER } = require('./config');
  if (!USE_OPENROUTER) {
    return { content: null, error: 'OPENROUTER_NOT_CONFIGURED' };
  }

  try {
    // Form compact context for faster model response
    const latest = healthContext.latest || {};
    const history = healthContext.history || [];
    const analysis = healthContext.analysis || {};
    
    // Analyze trends
    let trends = '';
    if (history.length >= 3) {
      const recentSteps = history.slice(0, 3).map(h => h.data.steps || 0);
      const avgSteps = recentSteps.reduce((a, b) => a + b, 0) / recentSteps.length;
      const currentSteps = latest.steps || 0;
      
      if (currentSteps > avgSteps * 1.2) {
        trends += '📈 Activity is improving! ';
      } else if (currentSteps < avgSteps * 0.8) {
        trends += '📉 Activity has decreased. ';
      }
    }
    
    const systemPrompt = `You are Jeffrey. Answer any topic (health and non-health).
Respond in the user's language, concise and practical (max ~8 lines).
Use health context only when relevant.
If severe medical risk signs appear, recommend doctor consultation calmly.`;

    const contextBlock = `Health snapshot: steps=${latest.steps || 0}, hr=${latest.heartRate || 70}, bp=${latest.bloodPressure || '120/80'}, water=${healthContext.waterIntake || 0}L, records=${history.length}. ${analysis.alert ? `Alert: ${analysis.alert}.` : ''} ${analysis.recommendation || ''} ${trends}`;

    const controller = new AbortController();
    const timeoutMs = 12000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'system', content: contextBlock },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.4,
        max_tokens: 320,
        top_p: 0.8
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      return { content: null, error: errorText };
    }

    const data = await response.json();
    return { content: data?.choices?.[0]?.message?.content || null, error: null };
  } catch (error) {
    console.error('OpenRouter API request failed:', error);
    return { content: null, error: error?.message || 'request_failed' };
  }
}

// Calculate statistics from data array
const calculateStats = (rows) => {
  if (rows.length === 0) {
    return {
      avgSteps: 0,
      avgHeartRate: 70,
      avgWaterIntake: 0,
      totalSteps: 0,
      maxHeartRate: 70,
      minHeartRate: 70,
      flaggedCount: 0,
      recordCount: 0
    };
  }
  
  const data = rows.map(row => JSON.parse(row.data));
  const steps = data.map(d => d.steps || 0);
  const heartRates = data.map(d => d.heartRate || 70);
  const waterIntakes = data.map(d => d.waterIntake || 0);
  const flagged = rows.filter(row => row.flagged === 1).length;
  
  return {
    avgSteps: Math.round(steps.reduce((a, b) => a + b, 0) / steps.length),
    avgHeartRate: Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length),
    avgWaterIntake: (waterIntakes.reduce((a, b) => a + b, 0) / waterIntakes.length).toFixed(2),
    totalSteps: steps.reduce((a, b) => a + b, 0),
    maxHeartRate: Math.max(...heartRates),
    minHeartRate: Math.min(...heartRates),
    flaggedCount: flagged,
    recordCount: rows.length
  };
};

module.exports = { simulateData, analyzeHealthData, callOpenRouterAPI, calculateStats };