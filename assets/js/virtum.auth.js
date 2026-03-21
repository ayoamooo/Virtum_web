/** Username: 3-20 chars, letters, digits, underscore only */
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
/** Practical email validation (RFC-style, not exhaustive) */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

let FIREBASE_RUNTIME_CONFIG = null;
let FIREBASE_INITIALIZED = false;

function clearRegisterFieldErrors() {
    const ids = ['register-username', 'register-email', 'register-password', 'register-password-confirm'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('input-error');
    });
    ['register-username-error', 'register-email-error', 'register-password-error', 'register-confirm-error', 'register-terms-error'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
    });
}

function setRegisterFieldError(inputId, errorElId, message) {
    const input = document.getElementById(inputId);
    const err = document.getElementById(errorElId);
    if (err) err.textContent = message || '';
    if (input) input.classList.toggle('input-error', !!message);
}

function validatePasswordRules(password) {
    return {
        ok: password.length >= 8 &&
            /[a-z]/.test(password) &&
            /[A-Z]/.test(password) &&
            /[0-9]/.test(password) &&
            /[^a-zA-Z0-9]/.test(password),
        len: password.length >= 8,
        lower: /[a-z]/.test(password),
        upper: /[A-Z]/.test(password),
        num: /[0-9]/.test(password),
        sym: /[^a-zA-Z0-9]/.test(password)
    };
}

function updateRegisterPasswordRules() {
    const pwdEl = document.getElementById('register-password');
    const pwd = pwdEl ? pwdEl.value : '';
    const rules = validatePasswordRules(pwd);
    document.querySelectorAll('#register-password-rules li').forEach((li) => {
        const key = li.dataset.rule;
        if (key && rules[key] !== undefined) {
            li.classList.toggle('met', !!rules[key]);
        }
    });
}

function setButtonLoading(btn, loadingText) {
    if (!btn) return () => {};
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = loadingText;
    return () => {
        btn.disabled = false;
        btn.textContent = original;
    };
}

function firebaseAuthMessage(err, fallback) {
    const code = String(err && err.code ? err.code : '');
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') return 'Invalid email/username or password.';
    if (code === 'auth/user-not-found') return 'Account not found. Check email/username or register first.';
    if (code === 'auth/too-many-requests') return 'Too many login attempts. Try again later or reset password.';
    if (code === 'auth/invalid-email') return 'Invalid email format.';
    return (err && err.message) || fallback || 'Firebase auth failed';
}

async function getFirebaseConfig() {
    if (FIREBASE_RUNTIME_CONFIG) return FIREBASE_RUNTIME_CONFIG;
    const res = await apiJson(`${API_URL}/api/auth/firebase-config`);
    if (!res.ok || !res.data) return { enabled: false };
    FIREBASE_RUNTIME_CONFIG = res.data;
    return FIREBASE_RUNTIME_CONFIG;
}

async function ensureFirebaseAuth() {
    const cfg = await getFirebaseConfig();
    if (!cfg.enabled) throw new Error('Firebase is not configured on server');
    if (!window.firebase || !window.firebase.auth) throw new Error('Firebase SDK is not loaded');
    if (!FIREBASE_INITIALIZED) {
        window.firebase.initializeApp({
            apiKey: cfg.apiKey,
            authDomain: cfg.authDomain,
            appId: cfg.appId
        });
        FIREBASE_INITIALIZED = true;
    }
    return window.firebase.auth();
}

async function exchangeFirebaseTokenForAppSession(idToken) {
    const res = await apiJson(`${API_URL}/api/auth/login-firebase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
    });
    if (!res.ok || !res.data || !res.data.user || !res.data.token) {
        const msg = (res.data && (res.data.message || res.data.error)) || 'Firebase login failed';
        throw new Error(msg);
    }
    setSession(res.data.user, res.data.token);
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) userNameEl.textContent = res.data.user.username;
}

async function registerWithFirebaseEmail() {
    const createBtn = document.getElementById('create-account-btn');
    const restoreBtn = setButtonLoading(createBtn, 'Creating...');
    const email = (document.getElementById('register-email')?.value || '').trim().toLowerCase();
    const password = document.getElementById('register-password')?.value || '';
    const username = (document.getElementById('register-username')?.value || '').trim();
    const termsChecked = !!document.getElementById('register-terms')?.checked;

    if (!USERNAME_REGEX.test(username)) {
        restoreBtn();
        return showToast('Use a valid username first', 'error');
    }
    if (!EMAIL_REGEX.test(email)) {
        restoreBtn();
        return showToast('Enter a valid email first', 'error');
    }
    if (!validatePasswordRules(password).ok) {
        restoreBtn();
        return showToast('Meet all password rules first', 'error');
    }
    if (!termsChecked) {
        restoreBtn();
        return showToast('Accept Terms and Privacy Policy', 'error');
    }

    try {
        const auth = await ensureFirebaseAuth();
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        if (cred.user) {
            await cred.user.updateProfile({ displayName: username });
            const idToken = await cred.user.getIdToken(true);
            const profileRes = await apiJson(`${API_URL}/api/auth/firebase-register-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken, username })
            });
            if (!profileRes.ok) {
                const msg = (profileRes.data && (profileRes.data.message || profileRes.data.error)) || 'Failed to save username';
                throw new Error(msg);
            }
            await cred.user.sendEmailVerification();
        }
        await auth.signOut();
        localStorage.setItem('pendingFirebaseVerifyEmail', email);
        showToast('Verification email sent. Confirm it to continue.', 'success');
        setTimeout(() => showScreen('verify-email-wait-screen'), 300);
    } catch (e) {
        showToast(firebaseAuthMessage(e, 'Firebase register failed'), 'error');
    } finally {
        restoreBtn();
    }
}

async function loginWithFirebaseEmail() {
    const loginBtn = document.getElementById('firebase-login-btn');
    const restoreBtn = setButtonLoading(loginBtn, 'Logging in...');
    const identifier = (document.getElementById('login-email')?.value || '').trim();
    const password = document.getElementById('login-password')?.value || '';
    if (!identifier) {
        restoreBtn();
        return showToast('Enter email or username', 'error');
    }
    if (!password) {
        restoreBtn();
        return showToast('Enter password', 'error');
    }
    try {
        let email = identifier.toLowerCase();
        if (!EMAIL_REGEX.test(email)) {
            const resolved = await apiJson(`${API_URL}/api/auth/firebase-resolve-identifier`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier })
            });
            if (!resolved.ok || !resolved.data?.email) throw new Error('Invalid credentials');
            email = String(resolved.data.email).toLowerCase();
        }

        const auth = await ensureFirebaseAuth();
        const cred = await auth.signInWithEmailAndPassword(email, password);
        const user = cred.user;
        if (!user) throw new Error('Firebase user is missing');
        await user.reload();
        if (!user.emailVerified) {
            await user.sendEmailVerification();
            await auth.signOut();
            localStorage.setItem('pendingFirebaseVerifyEmail', email);
            showToast('Email not verified. Check your inbox and spam folder.', 'error');
            setTimeout(() => showScreen('verify-email-wait-screen'), 250);
            return;
        }
        const idToken = await user.getIdToken(true);
        await exchangeFirebaseTokenForAppSession(idToken);
        showToast('Welcome with Firebase!', 'success');
        setTimeout(() => showScreen('dashboard-screen'), 300);
    } catch (e) {
        showToast(firebaseAuthMessage(e, 'Firebase login failed'), 'error');
    } finally {
        restoreBtn();
    }
}

async function requestFirebasePasswordReset() {
    const sendBtn = document.getElementById('firebase-reset-send-btn');
    const restoreBtn = setButtonLoading(sendBtn, 'Sending...');
    const email = (document.getElementById('firebase-reset-email')?.value || '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
        restoreBtn();
        showToast('Enter email for password reset', 'error');
        return;
    }
    try {
        const auth = await ensureFirebaseAuth();
        await auth.sendPasswordResetEmail(email);
        showToast('Firebase password reset email sent.', 'success');
        setTimeout(() => showScreen('login-screen'), 350);
    } catch (e) {
        showToast(firebaseAuthMessage(e, 'Could not send reset email'), 'error');
    } finally {
        restoreBtn();
    }
}

async function checkFirebaseVerificationAndContinue() {
    const verifyBtn = document.getElementById('firebase-verify-continue-btn');
    const restoreBtn = setButtonLoading(verifyBtn, 'Checking...');
    localStorage.removeItem('pendingFirebaseVerifyEmail');
    showToast('Great. Now login with your email and password.', 'success');
    setTimeout(() => showScreen('login-screen'), 250);
    restoreBtn();
}

async function resendFirebaseVerificationEmail() {
    const resendBtn = document.getElementById('firebase-verify-resend-btn');
    const restoreBtn = setButtonLoading(resendBtn, 'Sending...');
    const email = localStorage.getItem('pendingFirebaseVerifyEmail') || '';
    if (!EMAIL_REGEX.test(email)) {
        restoreBtn();
        showToast('No pending verification email found. Register again.', 'error');
        showScreen('register-screen');
        return;
    }
    const password = window.prompt('Enter your password to resend verification email:') || '';
    if (!password) {
        restoreBtn();
        return;
    }
    try {
        const auth = await ensureFirebaseAuth();
        const cred = await auth.signInWithEmailAndPassword(email, password);
        const user = cred.user;
        if (!user) throw new Error('Firebase user is missing');
        await user.sendEmailVerification();
        await auth.signOut();
        showToast('Verification email sent again.', 'success');
    } catch (e) {
        showToast(firebaseAuthMessage(e, 'Could not resend verification email'), 'error');
    } finally {
        restoreBtn();
    }
}

async function register() {
    await registerWithFirebaseEmail();
}

async function login() {
    await loginWithFirebaseEmail();
}

async function initFirebaseEmailAuth() {
    const cfg = await getFirebaseConfig();
    const loginBtn = document.getElementById('firebase-login-btn');
    const registerBtn = document.getElementById('create-account-btn');
    if (cfg.enabled) {
        if (loginBtn) loginBtn.style.display = 'block';
        if (registerBtn) registerBtn.style.display = 'block';
    }
}
