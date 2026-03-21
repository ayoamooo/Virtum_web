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
let waterIntake = parseFloat(localStorage.getItem('waterIntake')) || 0;

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
    const protectedScreens = ['dashboard-screen', 'ai-chat-screen'];
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
    
    // Update nav buttons - hide on login/register screens
    const navButtons = document.getElementById('nav-buttons');
    const authScreens = ['login-screen', 'register-screen', 'verify-register-screen', 'verify-login-screen'];
    const navVisible = !authScreens.includes(screenId);
    document.body.classList.toggle('nav-visible', navVisible);
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const navMap = {
        'login-screen': 'nav-login',
        'register-screen': 'nav-register',
        'dashboard-screen': 'nav-dashboard',
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
        const metrics = `
            <div class="metric-card"><div class="metric-label">Heart Rate</div><div class="metric-value">${latest.heartRate}</div><div class="metric-unit">bpm</div></div>
            <div class="metric-card"><div class="metric-label">Steps Today</div><div class="metric-value">${latest.steps}</div><div class="metric-unit">steps</div></div>
            <div class="metric-card"><div class="metric-label">Blood Pressure</div><div class="metric-value">${latest.bloodPressure}</div><div class="metric-unit">mmHg</div></div>
            <div class="metric-card"><div class="metric-label">Water Intake</div><div class="metric-value">${waterIntake.toFixed(1)}L</div><div class="metric-unit">of 2.5L</div></div>
        `;
        document.getElementById('metrics-grid').innerHTML = metrics;

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

function setReminder() {
    showToast('Water reminder set for every 2 hours!', 'success');
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
    
    div.innerHTML = `
        <div class="message-avatar">${sender === 'ai' ? '🤖' : '👤'}</div>
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
    const restored = await restoreSessionFromToken();
    if (restored && isLoggedIn()) {
        const savedUser = localStorage.getItem('username');
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) {
            userNameEl.textContent = savedUser;
        }
        showScreen('dashboard-screen');
    } else {
        showScreen('login-screen');
    }
    
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
            } catch (e) { /* ignore */ }
        }, 200);
    });
};
