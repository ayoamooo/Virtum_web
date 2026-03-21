/**
 * API base URL.
 * - file:// → always hit local backend
 * - Page served from Express on :5001 (any host: localhost, 127.0.0.1, LAN IP) → same origin
 * - Other ports (e.g. Live Server) → default backend on localhost:5001
 */
function getApiBaseUrl() {
    const { protocol, port } = window.location;
    if (protocol === 'file:') return 'http://localhost:5001';
    const p = String(port || '');
    // Express serves HTML + API on the same port in dev
    if (p === '5001') return window.location.origin;
    return 'http://localhost:5001';
}
const API_URL = getApiBaseUrl();
let heartRateChart = null;
let stepsChart = null;
let fullHeartChart = null;
let fullStepsChart = null;
let fullWaterChart = null;
let fullCaloriesChart = null;
let fullSleepChart = null;
let waterIntake = parseFloat(localStorage.getItem('waterIntake')) || 0;
let lastHistory = [];
let latestMetricsSnapshot = null;
let reminderIntervalId = null;
const DEFAULT_GOALS = { water: 2.5, steps: 10000, calories: 2200, sleep: 8 };

const BIOMARKER_INFO = {
    heartRate: {
        title: 'Heart Rate',
        unit: 'bpm',
        description: 'Heart rate shows how hard your cardiovascular system is working at this moment.',
        tips: ['Normal resting range for many adults is roughly 60-100 bpm.', 'Very high or very low values should be rechecked with a proper measurement.']
    },
    steps: {
        title: 'Steps',
        unit: 'steps',
        description: 'Daily steps reflect your overall physical activity and movement volume.',
        tips: ['Build up gradually to avoid overtraining.', 'Consistency across the week matters more than one perfect day.']
    },
    bloodPressure: {
        title: 'Blood Pressure',
        unit: 'mmHg',
        description: 'Blood pressure estimates the force your blood applies to vessel walls.',
        tips: ['Record measurements at similar times for better comparison.', 'Stress, caffeine, and activity can temporarily change values.']
    },
    waterIntake: {
        title: 'Water Intake',
        unit: 'L',
        description: 'Hydration supports focus, temperature regulation, and normal metabolic function.',
        tips: ['Spread intake through the day instead of drinking all at once.', 'Higher activity and heat usually increase hydration needs.']
    },
    weight: {
        title: 'Weight',
        unit: 'kg',
        description: 'Weight trend gives context about energy balance and fluid shifts over time.',
        tips: ['Track trends weekly, not just single-day fluctuations.', 'Use the same scale/time conditions for cleaner comparisons.']
    },
    calorieIntake: {
        title: 'Calorie Intake',
        unit: 'kcal',
        description: 'Calorie intake indicates daily energy consumption from nutrition.',
        tips: ['A stable routine helps interpret intake vs activity.', 'Quality of calories is as important as total amount.']
    },
    oxygenSaturation: {
        title: 'Oxygen Saturation',
        unit: '%',
        description: 'SpO2 shows how much oxygen is carried by your blood.',
        tips: ['Values are usually highest when breathing is calm and regular.', 'If values are repeatedly low, consider a medical-grade check.']
    },
    activityScore: {
        title: 'Activity Score',
        unit: '/100',
        description: 'A simplified index combining steps and heart rate context for daily activity quality.',
        tips: ['Use this score as a trend signal, not a diagnosis.', 'Aim for consistency and gradual improvement across the week.']
    }
};

function toNumberSafe(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function formatMetricValue(key, value) {
    if (key === 'bloodPressure') return String(value || '120/80');
    const n = toNumberSafe(value, 0);
    if (key === 'waterIntake' || key === 'weight') return n.toFixed(1);
    if (key === 'activityScore' || key === 'oxygenSaturation') return String(Math.round(n));
    return String(Math.round(n));
}

function getMetricRangeText(key) {
    const ranges = {
        heartRate: 'Range: 60-100 bpm (resting)',
        steps: 'Goal: 7k-10k daily',
        bloodPressure: 'Target: around 120/80 mmHg',
        waterIntake: 'Goal: around 2.5L daily',
        weight: 'Focus on weekly trend',
        calorieIntake: 'Personalized by profile',
        oxygenSaturation: 'Range: 95-100%',
        activityScore: 'Target: 70+'
    };
    return ranges[key] || 'Track trend over time';
}

function getMetricStatus(key, value) {
    const n = toNumberSafe(value, 0);
    if (key === 'heartRate') return n < 55 || n > 105 ? 'Watch' : 'Good';
    if (key === 'steps') return n >= 8000 ? 'Great' : n >= 5000 ? 'Good' : 'Low';
    if (key === 'waterIntake') return n >= 2.5 ? 'Goal hit' : n >= 1.5 ? 'In progress' : 'Low';
    if (key === 'oxygenSaturation') return n >= 95 ? 'Good' : 'Watch';
    if (key === 'activityScore') return n >= 75 ? 'Great' : n >= 55 ? 'Good' : 'Low';
    return 'Track';
}

function getStatusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('great') || s.includes('good') || s.includes('goal hit')) return 'status-good';
    if (s.includes('watch') || s.includes('low') || s.includes('track') || s.includes('in progress')) return 'status-watch';
    return 'status-neutral';
}

function getMetricTrend(history, key) {
    if (!Array.isArray(history) || history.length < 2) return { arrow: '→', text: 'stable' };
    const extractNumber = (row) => {
        const v = row?.data?.[key];
        if (key === 'bloodPressure') {
            const [s] = String(v || '').split('/').map(Number);
            return Number.isFinite(s) ? s : null;
        }
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };
    const curr = extractNumber(history[0]);
    const prev = extractNumber(history[1]);
    if (curr === null || prev === null) return { arrow: '→', text: 'stable' };
    const diff = curr - prev;
    if (Math.abs(diff) < 0.1) return { arrow: '→', text: 'stable' };
    return diff > 0 ? { arrow: '↑', text: 'up' } : { arrow: '↓', text: 'down' };
}

function calculateActivityScore(steps, heartRate) {
    const s = Math.min(100, Math.max(0, (toNumberSafe(steps, 0) / 10000) * 70));
    const h = toNumberSafe(heartRate, 70);
    const hrScore = h >= 55 && h <= 110 ? 30 : 18;
    return Math.round(s + hrScore);
}

function getWeeklyAverage(history, key) {
    if (key === 'bloodPressure') {
        const pairs = history
            .slice(0, 7)
            .map((h) => String(h?.data?.bloodPressure || '').split('/').map((v) => Number(v)))
            .filter((p) => p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
        if (!pairs.length) return null;
        const sys = Math.round(pairs.reduce((acc, p) => acc + p[0], 0) / pairs.length);
        const dia = Math.round(pairs.reduce((acc, p) => acc + p[1], 0) / pairs.length);
        return `${sys}/${dia}`;
    }
    if (key === 'oxygenSaturation') {
        const vals = history
            .slice(0, 7)
            .map((h) => toNumberSafe(h?.data?.o2 ?? h?.data?.oxygenSaturation, NaN))
            .filter((v) => Number.isFinite(v));
        if (!vals.length) return null;
        return String(Math.round(vals.reduce((a, b) => a + b, 0) / vals.length));
    }
    if (key === 'activityScore') {
        const vals = history
            .slice(0, 7)
            .map((h) => calculateActivityScore(h?.data?.steps, h?.data?.heartRate))
            .filter((v) => Number.isFinite(v));
        if (!vals.length) return null;
        return String(Math.round(vals.reduce((a, b) => a + b, 0) / vals.length));
    }
    const values = history
        .slice(0, 7)
        .map((h) => h?.data?.[key])
        .filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (!values.length) return null;
    const avg = values.reduce((acc, v) => acc + v, 0) / values.length;
    return key === 'weight' || key === 'waterIntake' ? avg.toFixed(1) : String(Math.round(avg));
}

function getLastUpdatedText(history) {
    const ts = history?.[0]?.data?.timestamp || null;
    if (!ts) return 'Updated just now';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return 'Updated recently';
    const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
    if (mins < 1) return 'Updated just now';
    if (mins < 60) return `Updated ${mins} min ago`;
    const hrs = Math.round(mins / 60);
    return `Updated ${hrs} h ago`;
}

function renderProviderSummary(latest, recommend) {
    const root = document.getElementById('provider-summary');
    if (!root || !latest) return;
    const risks = [];
    if (toNumberSafe(latest.heartRate, 70) > 110 || toNumberSafe(latest.heartRate, 70) < 50) risks.push('Heart rate out of typical range');
    if (toNumberSafe(latest.steps, 0) < 4000) risks.push('Low activity level');
    if (toNumberSafe(latest.waterIntake, 0) < 1.5) risks.push('Hydration below target');
    const [sys = 120, dia = 80] = String(latest.bloodPressure || '120/80').split('/').map(Number);
    if (sys > 140 || dia > 90) risks.push('Elevated blood pressure marker');
    const level = risks.length >= 3 ? 'High' : risks.length >= 1 ? 'Medium' : 'Low';
    const levelClass = level === 'High' ? 'risk-high' : level === 'Medium' ? 'risk-medium' : 'risk-low';
    const insights = (recommend?.insights || []).slice(0, 2);
    root.innerHTML = `
        <div class="provider-header">
            <div class="stats-title">🩺 Provider Mode v2</div>
            <span class="risk-badge ${levelClass}">Risk: ${level}</span>
        </div>
        <p class="provider-note">Simplified clinician summary for quick triage and follow-up.</p>
        <div class="provider-kpis">
            <div><strong>HR:</strong> ${formatMetricValue('heartRate', latest.heartRate)} bpm</div>
            <div><strong>BP:</strong> ${latest.bloodPressure}</div>
            <div><strong>Steps:</strong> ${formatMetricValue('steps', latest.steps)}</div>
            <div><strong>Hydration:</strong> ${formatMetricValue('waterIntake', latest.waterIntake)} L</div>
        </div>
        <div class="provider-risks">
            <strong>Flags:</strong>
            ${risks.length ? `<ul>${risks.map((r) => `<li>${r}</li>`).join('')}</ul>` : '<p>No critical flags from current snapshot.</p>'}
        </div>
        ${insights.length ? `<div class="provider-risks"><strong>AI notes:</strong><ul>${insights.map((i) => `<li>${i}</li>`).join('')}</ul></div>` : ''}
    `;
}

function renderDailyFocus(metrics, recommend) {
    const root = document.getElementById('daily-focus');
    if (!root || !metrics) return;
    const goals = getGoals();
    const checklist = [
        { label: 'Hydration target', done: toNumberSafe(metrics.waterIntake, 0) >= goals.water },
        { label: 'Steps target', done: toNumberSafe(metrics.steps, 0) >= goals.steps },
        { label: 'Calorie target', done: toNumberSafe(metrics.calorieIntake, 0) >= goals.calories * 0.85 },
        { label: 'Sleep target', done: toNumberSafe(metrics.sleepHours, 0) >= goals.sleep }
    ];
    const pending = checklist.filter((x) => !x.done).length;
    const topActions = [];
    if (toNumberSafe(metrics.waterIntake, 0) < goals.water) topActions.push('Drink 250ml water now');
    if (toNumberSafe(metrics.steps, 0) < goals.steps) topActions.push('Take a 10-minute walk');
    if (toNumberSafe(metrics.heartRate, 70) > 105) topActions.push('Take a 3-minute breathing break');
    if (!topActions.length) topActions.push('Great momentum today — keep consistency');

    root.innerHTML = `
        <div class="daily-focus-header">
            <div class="stats-title">📌 Daily Focus</div>
            <span class="daily-focus-chip">${pending === 0 ? 'All on track' : `${pending} pending`}</span>
        </div>
        <p class="daily-focus-note">Actionable plan based on your current metrics and personal goals.</p>
        <div class="daily-checklist">
            ${checklist.map((c) => `<div class="daily-item ${c.done ? 'done' : ''}">${c.done ? '✅' : '⬜'} ${c.label}</div>`).join('')}
        </div>
        <div class="daily-actions">
            <strong>Next actions:</strong>
            <ul>${topActions.map((a) => `<li>${a}</li>`).join('')}</ul>
        </div>
        ${recommend?.recommendation ? `<p class="daily-ai-tip"><strong>AI tip:</strong> ${recommend.recommendation}</p>` : ''}
    `;
}

/** JSON fetch with timeout — used for all API calls */
async function apiJson(url, options = {}, timeoutMs = 25000) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const text = await response.text();
        let data = null;
        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                data = { _parseError: true, raw: text.slice(0, 300) };
            }
        }
        return { ok: response.ok, status: response.status, data };
    } catch (e) {
        if (e.name === 'AbortError') {
            return { ok: false, status: 0, data: { error: 'Request timed out. Try again.' } };
        }
        return { ok: false, status: 0, data: { error: e.message || 'Network error' } };
    } finally {
        clearTimeout(tid);
    }
}

function updateConnectionBanner() {
    const el = document.getElementById('connection-banner');
    if (!el) return;
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    el.hidden = !offline;
    el.textContent = offline
        ? 'You are offline — reconnect to sync with the server.'
        : '';
}

/** Data export: profile and preferences stored in this browser (GDPR-style portability) */
function exportMyData() {
    if (!isLoggedIn()) {
        showToast('Please login first', 'error');
        return;
    }
    const keys = ['username', 'userId', 'email', 'newsletterOptIn', 'termsAcceptedAt', 'isLoggedIn'];
    const obj = {
        app: 'Virtum',
        exportNote: 'This file contains profile fields stored in this browser. Health records on the server are associated with your userId and can be requested separately per your privacy rights.'
    };
    keys.forEach((k) => {
        const v = localStorage.getItem(k);
        if (v !== null) obj[k] = v;
    });
    obj.waterIntakeLiters = localStorage.getItem('waterIntake');
    obj.exportedAt = new Date().toISOString();
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `virtum-export-${(obj.username || 'user').replace(/\W/g, '_')}-${Date.now()}.json`;
    a.rel = 'noopener';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Export downloaded', 'success');
}

function togglePassword(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (input && toggle) {
        if (input.type === 'password') {
            input.type = 'text';
            toggle.textContent = '🙈';
        } else {
            input.type = 'password';
            toggle.textContent = '👁️';
        }
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) {
        console.warn('[Virtum]', message);
        return;
    }
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function setSession(user, token) {
    localStorage.setItem('authToken', token || '');
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userId', user.id);
    localStorage.setItem('username', user.username);
    localStorage.setItem('email', user.email);
}

function clearSessionStorage() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    localStorage.removeItem('email');
    localStorage.removeItem('pendingVerifyEmail');
    localStorage.removeItem('pendingVerifyUsername');
    localStorage.removeItem('pendingLoginIdentifier');
}

function showScreen(screenId) {
    // Protect dashboard and other screens - require login
    const protectedScreens = ['dashboard-screen', 'ai-chat-screen', 'biomarker-detail-screen', 'charts-screen'];
    if (protectedScreens.includes(screenId) && !isLoggedIn()) {
        showToast('Please login first', 'error');
        setTimeout(() => showScreen('login-screen'), 500);
        return;
    }
    
    // Hide all screens with smooth transition
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        setTimeout(() => {
            targetScreen.classList.add('active');
        }, 50);
    }
    
    // Update nav buttons - hide on landing/auth screens
    const navButtons = document.getElementById('nav-buttons');
    const authScreens = ['landing-screen', 'login-screen', 'register-screen', 'verify-register-screen', 'verify-login-screen'];
    const navVisible = !authScreens.includes(screenId);
    document.body.classList.toggle('nav-visible', navVisible);
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const navMap = {
        'login-screen': 'nav-login',
        'register-screen': 'nav-register',
        'dashboard-screen': 'nav-dashboard',
        'charts-screen': 'nav-charts',
        'ai-chat-screen': 'nav-chat'
    };
    const activeNavId = navMap[screenId];
    if (activeNavId) {
        const activeNav = document.getElementById(activeNavId);
        if (activeNav) activeNav.classList.add('active');
    }

    if (screenId === 'dashboard-screen') {
        setTimeout(() => {
            loadData();
            startDashboardAutoRefresh();
        }, 150);
    } else {
        // Stop auto-refresh when leaving dashboard
        if (dashboardRefreshInterval) {
            clearInterval(dashboardRefreshInterval);
            dashboardRefreshInterval = null;
        }
    }
    
    if (screenId === 'ai-chat-screen') {
        // Scroll chat to bottom
        setTimeout(() => {
            const chatContainer = document.getElementById('chat-messages');
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }, 100);
    }
    if (screenId === 'charts-screen' && Array.isArray(lastHistory) && lastHistory.length > 0) {
        setTimeout(() => renderExtendedCharts(lastHistory), 100);
    }

    if (screenId === 'register-screen') {
        clearRegisterFieldErrors();
        updateRegisterPasswordRules();
        const createBtn = document.getElementById('create-account-btn');
        if (createBtn) createBtn.textContent = 'Create account';
    }
    if (screenId === 'verify-register-screen') {
        const pendingEmail = localStorage.getItem('pendingVerifyEmail') || '';
        const label = document.getElementById('register-verify-email-label');
        if (label) label.textContent = pendingEmail || '-';
    }
    if (screenId === 'verify-login-screen') {
        const pendingIdentifier = localStorage.getItem('pendingLoginIdentifier') || '';
        const label = document.getElementById('login-code-identifier-label');
        if (label) label.textContent = pendingIdentifier || '-';
    }

    refreshAuthNavVisibility();
}

// Check if user is logged in
function isLoggedIn() {
    return !!(localStorage.getItem('authToken') && localStorage.getItem('userId'));
}

/** Hide Login/Register nav when session is active */
function refreshAuthNavVisibility() {
    document.body.classList.toggle('user-logged-in', isLoggedIn());
}

// Auth-related functions are split into assets/js/virtum.auth.js

async function loadData(options = {}) {
    const { showErrorToast = false } = options;
    try {
        const userId = localStorage.getItem('userId');
        if (!userId || !isLoggedIn()) {
            showToast('Please login to view your data', 'error');
            return;
        }
        const metricsGrid = document.getElementById('metrics-grid');
        const aiInsight = document.getElementById('ai-insight');
        
        // Show loading state
        if (metricsGrid) metricsGrid.innerHTML = '<div class="loading">Loading metrics...</div>';
        if (aiInsight) aiInsight.innerHTML = '<div class="loading">Loading AI insights...</div>';

        const uid = encodeURIComponent(userId);
        const [hRes, rRes] = await Promise.all([
            apiJson(`${API_URL}/api/data/history?userId=${uid}`),
            apiJson(`${API_URL}/api/ai/recommend?userId=${uid}`)
        ]);

        if (!hRes.ok) {
            const msg = (hRes.data && (hRes.data.message || hRes.data.error)) || `Server error (${hRes.status})`;
            throw new Error(msg);
        }
        const history = Array.isArray(hRes.data) ? hRes.data : [];
        const recommend = rRes.ok && rRes.data && typeof rRes.data === 'object' ? rRes.data : {
            recommendation: 'Insights temporarily unavailable.',
            alert: null,
            insights: [],
            trends: {},
            providerView: { o2: 98, calories: 0 }
        };

        if (history.length === 0) {
            if (metricsGrid) {
                metricsGrid.innerHTML = '<div class="error-message">No data in database yet. Click "Generate & Store New Data" to create some!</div>';
            }
            if (aiInsight) {
                aiInsight.innerHTML = 'Generate some health data first to get personalized insights!';
            }
            return;
        }

        const latest = history[0].data;
        if (!latest || typeof latest !== 'object') {
            throw new Error('Invalid data format from server');
        }

        // Metrics from the latest database record
        lastHistory = history;
        const oxygenSaturation = toNumberSafe(recommend?.providerView?.o2, 98);
        const activityScore = calculateActivityScore(latest.steps, latest.heartRate);

        latestMetricsSnapshot = {
            heartRate: latest.heartRate ?? 70,
            steps: latest.steps ?? 0,
            bloodPressure: latest.bloodPressure || '120/80',
            waterIntake: toNumberSafe(waterIntake, 0),
            weight: latest.weight ?? 70,
            calorieIntake: latest.calorieIntake ?? 0,
            oxygenSaturation,
            activityScore,
            sleepHours: toNumberSafe(latest.sleepHours, 0)
        };

        const metricCards = [
            { key: 'heartRate', label: 'Heart Rate', unit: 'bpm' },
            { key: 'steps', label: 'Steps Today', unit: 'steps' },
            { key: 'bloodPressure', label: 'Blood Pressure', unit: 'mmHg' },
            { key: 'waterIntake', label: 'Water Intake', unit: 'L' },
            { key: 'weight', label: 'Weight', unit: 'kg' },
            { key: 'calorieIntake', label: 'Calories', unit: 'kcal' },
            { key: 'oxygenSaturation', label: 'Oxygen (SpO2)', unit: '%' },
            { key: 'activityScore', label: 'Activity Score', unit: '/100' }
        ];

        const metrics = metricCards.map((card) => {
            const weekly = getWeeklyAverage(history, card.key);
            const weeklyText = weekly === null ? formatMetricValue(card.key, latestMetricsSnapshot[card.key]) : weekly;
            const status = getMetricStatus(card.key, latestMetricsSnapshot[card.key]);
            const trend = getMetricTrend(history, card.key);
            const updated = getLastUpdatedText(history);
            return `
            <button class="metric-card metric-card-button metric-key-${card.key}" type="button" onclick="openBiomarkerDetail('${card.key}')" aria-label="Open details for ${card.label}">
                <div class="metric-head">
                    <div class="metric-label">${card.label}</div>
                    <span class="metric-trend">${trend.arrow}</span>
                </div>
                <div class="metric-value">${formatMetricValue(card.key, latestMetricsSnapshot[card.key])}</div>
                <div class="metric-unit">${card.unit}</div>
                <div class="metric-info">
                    <span class="status-chip ${getStatusClass(status)}">${status}</span><br>
                    <strong>${getMetricRangeText(card.key)}</strong><br>
                    <strong>7d avg:</strong> ${weeklyText}<br>
                    <strong>${updated}</strong>
                </div>
            </button>
        `;
        }).join('');
        document.getElementById('metrics-grid').innerHTML = metrics;
        renderGoalsProgress(latestMetricsSnapshot);
        renderProviderSummary(latestMetricsSnapshot, recommend);
        renderDailyFocus(latestMetricsSnapshot, recommend);

        // AI insight from the database with enhanced analysis
        let insight = recommend.recommendation || 'Analyzing your health data...';
        if (recommend.alert) {
            insight += '<br><br><strong style="color: #e53e3e;">⚠️ ' + recommend.alert + '</strong>';
        }
        if (recommend.insights && recommend.insights.length > 0) {
            insight += '<br><br><strong>📋 Observations:</strong><br>';
            recommend.insights.forEach(item => {
                insight += '• ' + item + '<br>';
            });
        }
        if (recommend.trends && recommend.trends.steps) {
            insight += '<br><strong>📈 Trend:</strong> ' + recommend.trends.steps;
        }
        if (recommend.providerView) {
            insight += '<br><br><strong>📊 Additional:</strong><br>';
            insight += '• Oxygen: ' + recommend.providerView.o2 + '%<br>';
            insight += '• Calories: ' + recommend.providerView.calories + ' kcal';
        }
        document.getElementById('ai-insight').innerHTML = insight;

        // Water progress
        const waterPercent = Math.min((waterIntake / 2.5) * 100, 100);
        document.getElementById('water-progress').style.width = `${waterPercent}%`;
        
        // Update water amount display
        const waterAmountEl = document.getElementById('water-amount');
        if (waterAmountEl) {
            waterAmountEl.textContent = `${waterIntake.toFixed(1)} / 2.5 L`;
        }

        // Charts built from database history
        const labels = history.slice(0, 7).reverse().map((_, i) => `Record ${i+1}`);
        const hrData = history.slice(0, 7).reverse().map(h => h.data.heartRate);
        const stepsData = history.slice(0, 7).reverse().map(h => h.data.steps / 1000);

        const hrCanvas = document.getElementById('heart-rate-chart');
        const stepsCanvas = document.getElementById('steps-chart');
        if (!hrCanvas || !stepsCanvas) return;

        if (typeof Chart === 'undefined') {
            throw new Error('Chart.js did not load (check network / CDN).');
        }

        if (heartRateChart) heartRateChart.destroy();
        if (stepsChart) stepsChart.destroy();

        heartRateChart = new Chart(hrCanvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Heart Rate (bpm)',
                        data: hrData,
                        borderColor: '#0071e3',
                        backgroundColor: 'rgba(0, 113, 227, 0.12)',
                        tension: 0.35,
                        fill: true,
                        borderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 4,
                        pointBackgroundColor: '#0071e3',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 10,
                        titleFont: {
                            family: 'Inter',
                            size: 12,
                            weight: '600'
                        },
                        bodyFont: {
                            family: 'Inter',
                            size: 11
                        },
                        cornerRadius: 6,
                        displayColors: true
                    }
                }
            }
        });

        stepsChart = new Chart(stepsCanvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Steps (x1000)',
                        data: stepsData,
                        backgroundColor: 'rgba(52, 199, 89, 0.35)',
                        borderColor: '#34c759',
                        borderWidth: 1.5,
                        borderRadius: 6,
                        maxBarThickness: 20
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 10,
                        titleFont: {
                            family: 'Inter',
                            size: 12,
                            weight: '600'
                        },
                        bodyFont: {
                            family: 'Inter',
                            size: 11
                        },
                        cornerRadius: 6,
                        displayColors: true
                    }
                }
            }
        });
        renderExtendedCharts(history);
    } catch (e) {
        console.error('Error loading data:', e);
        const metricsGrid = document.getElementById('metrics-grid');
        const aiInsight = document.getElementById('ai-insight');
        const detail = (e && e.message) ? String(e.message) : 'Unknown error';
        const isNetwork = /failed to fetch|network|load failed|aborted/i.test(detail) || detail === 'Unknown error';
        const esc = (s) => String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        const hintHtml = isNetwork
            ? `Cannot reach API at <strong>${esc(API_URL)}</strong>. Start the backend (<code>cd backend &amp;&amp; npm start</code>) and open the app from <strong>http://localhost:5001/virtum.html</strong>.`
            : esc(detail);

        if (metricsGrid) {
            metricsGrid.innerHTML = `<div class="error-message">⚠️ ${hintHtml}</div>`;
        }
        if (aiInsight) {
            aiInsight.innerHTML = `<div class="error-message">${hintHtml}</div>`;
        }
        // Inline message is enough on load; optional toast for manual refresh
        if (showErrorToast) {
            showToast(isNetwork ? 'Cannot reach server. See message on dashboard.' : detail, 'error');
        }
    }
}

function renderExtendedCharts(history) {
    const h = Array.isArray(history) ? history.slice(0, 14).reverse() : [];
    const labels = h.map((_, i) => `Record ${i + 1}`);
    const heart = h.map((x) => toNumberSafe(x?.data?.heartRate, 0));
    const steps = h.map((x) => toNumberSafe(x?.data?.steps, 0));
    const water = h.map((x) => toNumberSafe(x?.data?.waterIntake, 0));
    const calories = h.map((x) => toNumberSafe(x?.data?.calorieIntake, 0));
    const sleep = h.map((x) => toNumberSafe(x?.data?.sleepHours, 0));

    const heartCanvas = document.getElementById('chart-full-heart');
    const stepsCanvas = document.getElementById('chart-full-steps');
    const waterCanvas = document.getElementById('chart-full-water');
    const caloriesCanvas = document.getElementById('chart-full-calories');
    const sleepCanvas = document.getElementById('chart-full-sleep');
    if (!heartCanvas || !stepsCanvas || !waterCanvas || !caloriesCanvas || !sleepCanvas || typeof Chart === 'undefined') return;

    [fullHeartChart, fullStepsChart, fullWaterChart, fullCaloriesChart, fullSleepChart].forEach((c) => c && c.destroy());

    const baseOpts = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
    };

    fullHeartChart = new Chart(heartCanvas, {
        type: 'line',
        data: { labels, datasets: [{ data: heart, borderColor: '#0071e3', backgroundColor: 'rgba(0,113,227,0.12)', fill: true, tension: 0.3 }] },
        options: baseOpts
    });
    fullStepsChart = new Chart(stepsCanvas, {
        type: 'bar',
        data: { labels, datasets: [{ data: steps, backgroundColor: 'rgba(0,113,227,0.22)', borderColor: '#0071e3', borderWidth: 1, borderRadius: 6 }] },
        options: baseOpts
    });
    fullWaterChart = new Chart(waterCanvas, {
        type: 'line',
        data: { labels, datasets: [{ data: water, borderColor: '#34c759', backgroundColor: 'rgba(52,199,89,0.14)', fill: true, tension: 0.3 }] },
        options: baseOpts
    });
    fullCaloriesChart = new Chart(caloriesCanvas, {
        type: 'line',
        data: { labels, datasets: [{ data: calories, borderColor: '#ff9500', backgroundColor: 'rgba(255,149,0,0.14)', fill: true, tension: 0.3 }] },
        options: baseOpts
    });
    fullSleepChart = new Chart(sleepCanvas, {
        type: 'bar',
        data: { labels, datasets: [{ data: sleep, backgroundColor: 'rgba(88,86,214,0.22)', borderColor: '#5856d6', borderWidth: 1, borderRadius: 6 }] },
        options: baseOpts
    });
}

async function storeNewData() {
    const btn = event.target;
    const originalText = btn.textContent;
    const originalBg = btn.style.background;
    
    // Loading animation
    btn.textContent = '⏳ Generating...';
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.style.transform = 'scale(0.95)';
    
    try {
        const userId = localStorage.getItem('userId') || 'guest';
        const res = await apiJson(`${API_URL}/api/data/store`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        if (!res.ok) {
            const msg = (res.data && (res.data.message || res.data.error)) || `Server error (${res.status})`;
            throw new Error(msg);
        }
        
        // Success animation
        btn.textContent = '✅ Saved!';
        btn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
        btn.style.opacity = '1';
        btn.style.transform = 'scale(1.05)';
        showToast('Data saved successfully!', 'success');
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = originalBg || '';
            btn.style.transform = 'scale(1)';
            btn.disabled = false;
        }, 2000);
        
        // Update data with smooth animation
        setTimeout(() => {
            loadData();
        }, 500);
    } catch (e) {
        console.error('Error storing data:', e);
        btn.textContent = '❌ Error';
        btn.style.background = 'linear-gradient(135deg, #f56565 0%, #e53e3e 100%)';
        btn.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = originalBg || '';
            btn.style.transform = 'scale(1)';
            btn.disabled = false;
            btn.style.opacity = '1';
        }, 2000);
    }
}

function logWater() {
    waterIntake += 0.25;
    if (waterIntake > 2.5) waterIntake = 2.5;
    localStorage.setItem('waterIntake', waterIntake);
    
    // Smooth progress update
    const waterPercent = Math.min((waterIntake / 2.5) * 100, 100);
    const progressBar = document.getElementById('water-progress');
    if (progressBar) {
        progressBar.style.transition = 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        progressBar.style.width = `${waterPercent}%`;
    }
    
    const waterAmountEl = document.getElementById('water-amount');
    if (waterAmountEl) {
        waterAmountEl.style.transition = 'all 0.3s';
        waterAmountEl.style.transform = 'scale(1.1)';
        waterAmountEl.textContent = `${waterIntake.toFixed(1)} / 2.5 L`;
        setTimeout(() => {
            waterAmountEl.style.transform = 'scale(1)';
        }, 300);
    }
    
    // Button animation
    const btn = event.target;
    const originalText = btn.textContent;
    const originalBg = btn.style.background;
    
    btn.textContent = '✓ +250ml';
    btn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
    btn.style.transform = 'scale(1.1)';
    btn.style.boxShadow = '0 4px 15px rgba(72, 187, 120, 0.4)';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = originalBg || '';
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = '';
    }, 1500);
    
    // Mobile vibration (if supported)
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
}

function resetWater() {
    waterIntake = 0;
    localStorage.setItem('waterIntake', '0');
    const progressBar = document.getElementById('water-progress');
    if (progressBar) progressBar.style.width = '0%';
    const waterAmountEl = document.getElementById('water-amount');
    if (waterAmountEl) waterAmountEl.textContent = '0.0 / 2.5 L';
    showToast('Water amount reset', 'info');
}

function setReminder() {
    toggleReminderPanel(true);
}

function toggleReminderPanel(forceOpen = null) {
    const panel = document.getElementById('reminder-panel');
    if (!panel) return;
    const shouldOpen = forceOpen === null ? panel.hidden : !!forceOpen;
    panel.hidden = !shouldOpen;
}

function requestNotificationPermissionIfNeeded() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }
}

function showReminderAlert() {
    const text = 'Time to drink water and check your current metrics.';
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
            new Notification('Virtum Reminder', { body: text, icon: 'assets/img/bot-logo.svg' });
        } catch (e) {
            // fallback below
        }
    }
    showToast('⏰ Reminder: drink water and review dashboard.', 'info');
}

function setReminderTimer() {
    const input = document.getElementById('reminder-minutes');
    const statusEl = document.getElementById('reminder-status');
    const minutes = Number(input && input.value ? input.value : 120);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
        showToast('Enter interval from 1 to 1440 minutes.', 'error');
        return;
    }

    if (reminderIntervalId) {
        clearInterval(reminderIntervalId);
        reminderIntervalId = null;
    }

    const ms = Math.round(minutes * 60 * 1000);
    reminderIntervalId = setInterval(showReminderAlert, ms);
    localStorage.setItem('reminderMinutes', String(minutes));
    localStorage.setItem('reminderEnabled', '1');
    requestNotificationPermissionIfNeeded();
    if (statusEl) statusEl.textContent = `Timer active: every ${minutes} min.`;
    showToast(`Reminder timer started: every ${minutes} min`, 'success');
}

function stopReminderTimer() {
    const statusEl = document.getElementById('reminder-status');
    if (reminderIntervalId) {
        clearInterval(reminderIntervalId);
        reminderIntervalId = null;
    }
    localStorage.setItem('reminderEnabled', '0');
    if (statusEl) statusEl.textContent = 'Timer is off.';
    showToast('Reminder timer stopped', 'info');
}

function restoreReminderTimer() {
    const input = document.getElementById('reminder-minutes');
    const statusEl = document.getElementById('reminder-status');
    const savedMinutes = Number(localStorage.getItem('reminderMinutes') || '120');
    const enabled = localStorage.getItem('reminderEnabled') === '1';
    const minutes = Number.isFinite(savedMinutes) && savedMinutes >= 1 && savedMinutes <= 1440 ? savedMinutes : 120;
    if (input) input.value = String(minutes);
    if (!enabled) {
        if (statusEl) statusEl.textContent = 'Timer is off.';
        return;
    }
    const ms = Math.round(minutes * 60 * 1000);
    if (reminderIntervalId) clearInterval(reminderIntervalId);
    reminderIntervalId = setInterval(showReminderAlert, ms);
    if (statusEl) statusEl.textContent = `Timer active: every ${minutes} min.`;
}

function getGoals() {
    try {
        const raw = localStorage.getItem('userGoals');
        if (!raw) return { ...DEFAULT_GOALS };
        const parsed = JSON.parse(raw);
        return {
            water: toNumberSafe(parsed.water, DEFAULT_GOALS.water),
            steps: toNumberSafe(parsed.steps, DEFAULT_GOALS.steps),
            calories: toNumberSafe(parsed.calories, DEFAULT_GOALS.calories),
            sleep: toNumberSafe(parsed.sleep, DEFAULT_GOALS.sleep)
        };
    } catch {
        return { ...DEFAULT_GOALS };
    }
}

function fillGoalInputs() {
    const goals = getGoals();
    const water = document.getElementById('goal-water');
    const steps = document.getElementById('goal-steps');
    const calories = document.getElementById('goal-calories');
    const sleep = document.getElementById('goal-sleep');
    if (water) water.value = String(goals.water);
    if (steps) steps.value = String(Math.round(goals.steps));
    if (calories) calories.value = String(Math.round(goals.calories));
    if (sleep) sleep.value = String(goals.sleep);
}

function saveGoals() {
    const next = {
        water: toNumberSafe(document.getElementById('goal-water')?.value, DEFAULT_GOALS.water),
        steps: toNumberSafe(document.getElementById('goal-steps')?.value, DEFAULT_GOALS.steps),
        calories: toNumberSafe(document.getElementById('goal-calories')?.value, DEFAULT_GOALS.calories),
        sleep: toNumberSafe(document.getElementById('goal-sleep')?.value, DEFAULT_GOALS.sleep)
    };
    localStorage.setItem('userGoals', JSON.stringify(next));
    renderGoalsProgress(latestMetricsSnapshot);
    showToast('Goals saved', 'success');
}

function resetGoals() {
    localStorage.setItem('userGoals', JSON.stringify(DEFAULT_GOALS));
    fillGoalInputs();
    renderGoalsProgress(latestMetricsSnapshot);
    showToast('Goals reset to default', 'info');
}

async function quickAddMetric(key, delta) {
    if (!isLoggedIn()) {
        showToast('Please login first', 'error');
        return;
    }
    const base = toNumberSafe(latestMetricsSnapshot?.[key], 0);
    const next = Math.max(0, base + toNumberSafe(delta, 0));
    const payload = { [key]: next };
    const userId = localStorage.getItem('userId') || 'testUser';
    const res = await apiJson(`${API_URL}/api/data/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...payload })
    });
    if (!res.ok) {
        const msg = (res.data && (res.data.message || res.data.error)) || 'Failed to save metric';
        // Backward-compatible fallback: if backend route doesn't support sleepHours yet.
        if (key === 'sleepHours' && /at least one metric required/i.test(String(msg))) {
            localStorage.setItem('sleepHours', String(next));
            latestMetricsSnapshot = { ...(latestMetricsSnapshot || {}), sleepHours: next };
            renderGoalsProgress(latestMetricsSnapshot);
            showToast('Sleep updated locally. Restart backend to persist sleep to DB.', 'info');
            return;
        }
        showToast(msg, 'error');
        return;
    }
    showToast(`Updated ${key}`, 'success');
    await loadData();
}

async function setMetricValue(key, inputId) {
    const input = document.getElementById(inputId);
    const raw = input ? input.value : '';
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
        showToast('Enter a valid non-negative number', 'error');
        return;
    }
    await saveMetricValue(key, value);
    if (input) input.value = '';
}

async function saveMetricValue(key, value) {
    if (!isLoggedIn()) {
        showToast('Please login first', 'error');
        return;
    }
    const payload = { [key]: value };
    const userId = localStorage.getItem('userId') || 'testUser';
    const res = await apiJson(`${API_URL}/api/data/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...payload })
    });
    if (!res.ok) {
        const msg = (res.data && (res.data.message || res.data.error)) || 'Failed to save metric';
        if (key === 'sleepHours' && /at least one metric required/i.test(String(msg))) {
            localStorage.setItem('sleepHours', String(value));
            latestMetricsSnapshot = { ...(latestMetricsSnapshot || {}), sleepHours: value };
            renderGoalsProgress(latestMetricsSnapshot);
            showToast('Sleep updated locally. Restart backend to persist sleep to DB.', 'info');
            return;
        }
        showToast(msg, 'error');
        return;
    }
    showToast(`Saved ${key}`, 'success');
    await loadData();
}

function progressPercent(value, goal) {
    const g = Math.max(0.1, toNumberSafe(goal, 1));
    return Math.max(0, Math.min(100, Math.round((toNumberSafe(value, 0) / g) * 100)));
}

function renderGoalsProgress(metrics) {
    const root = document.getElementById('goals-progress');
    if (!root) return;
    const goals = getGoals();
    const m = metrics || latestMetricsSnapshot || {};
    const sleepVal = toNumberSafe(m.sleepHours ?? localStorage.getItem('sleepHours') ?? 0, 0);
    const items = [
        { label: 'Water', value: toNumberSafe(m.waterIntake, 0), goal: goals.water, unit: 'L' },
        { label: 'Steps', value: toNumberSafe(m.steps, 0), goal: goals.steps, unit: '' },
        { label: 'Calories', value: toNumberSafe(m.calorieIntake, 0), goal: goals.calories, unit: 'kcal' },
        { label: 'Sleep', value: sleepVal, goal: goals.sleep, unit: 'h' }
    ];
    root.innerHTML = items.map((it) => {
        const pct = progressPercent(it.value, it.goal);
        const shownValue = it.unit ? `${it.value}${it.unit}` : `${Math.round(it.value)}`;
        const shownGoal = it.unit ? `${it.goal}${it.unit}` : `${Math.round(it.goal)}`;
        return `
            <div class="goal-progress-item">
                <div class="goal-progress-head"><span>${it.label}</span><span>${shownValue} / ${shownGoal}</span></div>
                <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            </div>
        `;
    }).join('');
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    
    // Add user message
    addMessage('user', msg);
    input.value = '';
    input.disabled = true;
    
    // Show sending animation
    const sendBtn = input.nextElementSibling;
    if (sendBtn) {
        sendBtn.style.opacity = '0.5';
        sendBtn.style.transform = 'scale(0.9)';
    }

    // Show typing indicator with animation
    const typingMessages = ['Analyzing your data...', 'Processing information...', 'Forming response...'];
    let typingIndex = 0;
    const typingId = addMessage('ai', typingMessages[0], true);
    
    const typingInterval = setInterval(() => {
        const typingMsg = document.getElementById(typingId);
        if (typingMsg) {
            typingIndex = (typingIndex + 1) % typingMessages.length;
            const bubble = typingMsg.querySelector('.message-bubble');
            if (bubble) {
                bubble.textContent = typingMessages[typingIndex];
            }
        }
    }, 1500);

    try {
        const userId = localStorage.getItem('userId') || 'testUser';
        const res = await apiJson(`${API_URL}/api/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg, userId })
        }, 60000);

        clearInterval(typingInterval);
        const typingMsg = document.getElementById(typingId);
        if (typingMsg) typingMsg.remove();

        if (!res.ok) {
            const errText = (res.data && (res.data.message || res.data.error)) || `Request failed (${res.status})`;
            addMessage('ai', `⚠️ ${errText}`);
        } else if (res.data && res.data.response) {
            setTimeout(() => addMessage('ai', res.data.response), 150);
        } else {
            addMessage('ai', '⚠️ Empty response from assistant. Try again.');
        }

        if (sendBtn) {
            sendBtn.style.opacity = '1';
            sendBtn.style.transform = 'scale(1)';
        }
    } catch (e) {
        console.error('Error sending message:', e);
        clearInterval(typingInterval);
        const typingMsg = document.getElementById(typingId);
        if (typingMsg) typingMsg.remove();
        addMessage('ai', `⚠️ ${e.message || 'Connection error. Is the backend running on port 5001?'}`);
        if (sendBtn) {
            sendBtn.style.opacity = '1';
            sendBtn.style.transform = 'scale(1)';
        }
    } finally {
        input.disabled = false;
        input.focus();
    }
}

function addMessage(sender, text, isTyping = false) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    div.id = messageId;
    div.className = `message ${sender}`;
    
    // Escape HTML and preserve line breaks
    const escapedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    
    const avatarHtml = sender === 'ai'
        ? '<img src="assets/img/bot-logo.svg" alt="Jeffrey logo" class="bot-avatar-img">'
        : '👤';

    div.innerHTML = `
        <div class="message-avatar">${avatarHtml}</div>
        <div class="message-bubble">${escapedText}</div>
    `;
    container.appendChild(div);
    
    // Smooth scroll to bottom
    setTimeout(() => {
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
        });
    }, 100);
    
    return messageId;
}

function openBiomarkerDetail(metricKey) {
    if (!latestMetricsSnapshot) {
        showToast('Load dashboard data first', 'error');
        return;
    }
    const info = BIOMARKER_INFO[metricKey];
    if (!info) return;

    const value = latestMetricsSnapshot[metricKey];
    const titleEl = document.getElementById('biomarker-detail-title');
    const subtitleEl = document.getElementById('biomarker-detail-subtitle');
    const valueEl = document.getElementById('biomarker-detail-value');
    const aboutEl = document.getElementById('biomarker-detail-about');
    const insightsEl = document.getElementById('biomarker-detail-insights');
    if (!titleEl || !subtitleEl || !valueEl || !aboutEl || !insightsEl) return;

    titleEl.textContent = info.title;
    subtitleEl.textContent = 'Tap cards on dashboard to review biomarker context';
    valueEl.textContent = `${formatMetricValue(metricKey, value)} ${info.unit}`.trim();
    aboutEl.textContent = info.description;

    const trend = getBiomarkerTrend(metricKey);
    insightsEl.innerHTML = `
        <div class="stats-card">
            <div class="stats-title">What this means</div>
            <p>${info.tips[0]}</p>
            <p>${info.tips[1]}</p>
        </div>
        <div class="stats-card">
            <div class="stats-title">Recent trend</div>
            <p>${trend}</p>
        </div>
    `;
    showScreen('biomarker-detail-screen');
}

function getBiomarkerTrend(metricKey) {
    if (!Array.isArray(lastHistory) || lastHistory.length < 2) {
        return 'Not enough history yet. Save more records to see trend insights.';
    }
    const sample = lastHistory
        .slice(0, 7)
        .map((row) => (row && row.data ? row.data[metricKey] : undefined))
        .filter((v) => typeof v === 'number');
    if (sample.length < 2) {
        return 'Trend is available after more numeric records are collected.';
    }
    const first = sample[sample.length - 1];
    const last = sample[0];
    const delta = Math.round((last - first) * 10) / 10;
    if (delta === 0) return 'Stable over recent records.';
    return delta > 0 ? `Increasing by ${delta} over recent records.` : `Decreasing by ${Math.abs(delta)} over recent records.`;
}

function logout() {
    showToast('Logged out successfully', 'info');
    clearSessionStorage();
    setTimeout(() => {
        showScreen('login-screen');
        console.log('🚪 Logged out');
    }, 800);
}

async function restoreSessionFromToken() {
    const token = localStorage.getItem('authToken');
    if (!token) return false;
    const res = await apiJson(`${API_URL}/api/auth/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok || !res.data || !res.data.id) {
        clearSessionStorage();
        return false;
    }
    const user = {
        id: res.data.id,
        username: res.data.username || localStorage.getItem('username') || 'User',
        email: res.data.email || localStorage.getItem('email') || ''
    };
    setSession(user, token);
    return true;
}

// Auto-refresh dashboard data every 30 seconds
let dashboardRefreshInterval = null;
function startDashboardAutoRefresh() {
    if (dashboardRefreshInterval) clearInterval(dashboardRefreshInterval);
    dashboardRefreshInterval = setInterval(() => {
        const currentScreen = document.querySelector('.screen.active');
        if (currentScreen && currentScreen.id === 'dashboard-screen' && isLoggedIn()) {
            loadData();
        }
    }, 30000); // 30 seconds
}

// Auto-load on start
window.onload = async () => {
    // Always start from landing screen ("Get Started"), even if a token exists.
    const restored = await restoreSessionFromToken();
    if (restored && isLoggedIn()) {
        const savedUser = localStorage.getItem('username');
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) {
            userNameEl.textContent = savedUser;
        }
    }
    showScreen('landing-screen');
    
    // Initialize water intake display
    const waterAmountEl = document.getElementById('water-amount');
    if (waterAmountEl) {
        waterAmountEl.textContent = `${waterIntake.toFixed(1)} / 2.5 L`;
    }
    const waterPercent = Math.min((waterIntake / 2.5) * 100, 100);
    const waterProgress = document.getElementById('water-progress');
    if (waterProgress) {
        waterProgress.style.width = `${waterPercent}%`;
    }
    fillGoalInputs();
    renderGoalsProgress({
        waterIntake: waterIntake,
        steps: 0,
        calorieIntake: 0,
        sleepHours: toNumberSafe(localStorage.getItem('sleepHours'), 0)
    });
    restoreReminderTimer();

    const regPwd = document.getElementById('register-password');
    if (regPwd) {
        regPwd.addEventListener('input', updateRegisterPasswordRules);
    }

    const regForm = document.getElementById('register-form');
    if (regForm) {
        regForm.addEventListener('submit', (e) => {
            e.preventDefault();
            register().catch((err) => {
                console.error(err);
                showToast(err.message || 'Something went wrong. Try again.', 'error');
                const btn = document.getElementById('create-account-btn');
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Create account';
                }
            });
        });
    }

    updateConnectionBanner();
    window.addEventListener('online', () => {
        updateConnectionBanner();
        showToast('Back online', 'success');
    });
    window.addEventListener('offline', updateConnectionBanner);

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            try {
                if (heartRateChart && typeof heartRateChart.resize === 'function') heartRateChart.resize();
                if (stepsChart && typeof stepsChart.resize === 'function') stepsChart.resize();
                if (fullHeartChart && typeof fullHeartChart.resize === 'function') fullHeartChart.resize();
                if (fullStepsChart && typeof fullStepsChart.resize === 'function') fullStepsChart.resize();
                if (fullWaterChart && typeof fullWaterChart.resize === 'function') fullWaterChart.resize();
                if (fullCaloriesChart && typeof fullCaloriesChart.resize === 'function') fullCaloriesChart.resize();
                if (fullSleepChart && typeof fullSleepChart.resize === 'function') fullSleepChart.resize();
            } catch (e) { /* ignore */ }
        }, 200);
    });
};
