/** Username: 3-20 chars, letters, digits, underscore only */
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
/** Practical email validation (RFC-style, not exhaustive) */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function clearRegisterFieldErrors() {
    const ids = ['register-username', 'register-email', 'register-password', 'register-password-confirm'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('input-error');
    });
    ['register-username-error', 'register-email-error', 'register-password-error', 'register-confirm-error', 'register-terms-error', 'register-code-error'].forEach((id) => {
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

async function register() {
    const usernameInput = document.getElementById('register-username');
    const emailInput = document.getElementById('register-email');
    const passwordInput = document.getElementById('register-password');
    const confirmInput = document.getElementById('register-password-confirm');
    const termsInput = document.getElementById('register-terms');
    const newsletterInput = document.getElementById('register-newsletter');
    const createBtn = document.getElementById('create-account-btn');

    if (!usernameInput || !emailInput || !passwordInput || !confirmInput || !termsInput) {
        showToast('Form not loaded', 'error');
        return;
    }

    const restoreSubmitBtn = () => {
        if (!createBtn) return;
        createBtn.disabled = false;
        createBtn.textContent = 'Create account';
    };

    clearRegisterFieldErrors();
    updateRegisterPasswordRules();

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    let valid = true;

    if (!username) {
        setRegisterFieldError('register-username', 'register-username-error', 'Enter a username.');
        valid = false;
    } else if (!USERNAME_REGEX.test(username)) {
        setRegisterFieldError('register-username', 'register-username-error', 'Use 3-20 characters: letters, numbers, underscore only.');
        valid = false;
    }

    if (!email) {
        setRegisterFieldError('register-email', 'register-email-error', 'Enter your email address.');
        valid = false;
    } else if (!EMAIL_REGEX.test(email)) {
        setRegisterFieldError('register-email', 'register-email-error', 'Enter a valid email (e.g. name@domain.com).');
        valid = false;
    }

    const pwdCheck = validatePasswordRules(password);
    if (!password) {
        setRegisterFieldError('register-password', 'register-password-error', 'Enter a password.');
        valid = false;
    } else if (!pwdCheck.ok) {
        setRegisterFieldError('register-password', 'register-password-error', 'Meet all password rules below.');
        valid = false;
    }

    if (!confirm) {
        setRegisterFieldError('register-password-confirm', 'register-confirm-error', 'Confirm your password.');
        valid = false;
    } else if (password !== confirm) {
        setRegisterFieldError('register-password-confirm', 'register-confirm-error', 'Passwords do not match.');
        valid = false;
    }

    if (!termsInput.checked) {
        const te = document.getElementById('register-terms-error');
        if (te) te.textContent = 'You must accept the Terms and Privacy Policy.';
        valid = false;
    }

    if (!valid) {
        showToast('Please fix the highlighted fields.', 'error');
        return;
    }

    if (createBtn) {
        createBtn.disabled = true;
        createBtn.textContent = 'Sending code…';
    }

    let res;
    try {
        res = await apiJson(`${API_URL}/api/auth/register-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                email,
                password,
                newsletterOptIn: !!(newsletterInput && newsletterInput.checked)
            })
        });
    } catch (e) {
        console.error(e);
        showToast(e.message || 'Request failed', 'error');
        restoreSubmitBtn();
        return;
    }

    if (!res.ok) {
        const msg = (res.data && (res.data.message || res.data.error)) || 'Registration failed';
        showToast(msg, 'error');
        restoreSubmitBtn();
        return;
    }

    localStorage.setItem('pendingVerifyEmail', email);
    localStorage.setItem('pendingVerifyUsername', username);
    if (createBtn) {
        createBtn.disabled = false;
        createBtn.textContent = 'Create account';
    }
    if (res.data && res.data.user && res.data.token) {
        setSession(res.data.user, res.data.token);
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.textContent = res.data.user.username;
        localStorage.removeItem('pendingVerifyEmail');
        localStorage.removeItem('pendingVerifyUsername');
        showToast('Account created successfully!', 'success');
        setTimeout(() => showScreen('dashboard-screen'), 600);
        return;
    }
    showToast('Account created. You can login now.', 'success');
    showScreen('login-screen');
}

async function verifyRegistration() {
    const email = localStorage.getItem('pendingVerifyEmail') || '';
    const codeEl = document.getElementById('register-verify-code');
    const code = codeEl ? codeEl.value.trim() : '';
    if (!email) {
        showToast('No pending verification email found.', 'error');
        return;
    }
    if (!/^\d{6}$/.test(code)) {
        setRegisterFieldError('register-verify-code', 'register-code-error', 'Enter a valid 6-digit code.');
        return;
    }

    const res = await apiJson(`${API_URL}/api/auth/register-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
    });
    if (!res.ok) {
        const msg = (res.data && (res.data.message || res.data.error)) || 'Verification failed';
        setRegisterFieldError('register-verify-code', 'register-code-error', msg);
        return;
    }
    setSession(res.data.user, res.data.token);
    localStorage.removeItem('pendingVerifyEmail');
    localStorage.removeItem('pendingVerifyUsername');
    if (codeEl) codeEl.value = '';
    const userNameEl = document.getElementById('user-name');
    if (userNameEl && res.data.user) userNameEl.textContent = res.data.user.username;
    localStorage.removeItem('pendingLoginIdentifier');
    showToast('Account verified successfully!', 'success');
    setTimeout(() => showScreen('dashboard-screen'), 600);
}

async function submitRegisterVerification() {
    await verifyRegistration();
}

async function resendRegisterCode(event) {
    const username = localStorage.getItem('pendingVerifyUsername') || '';
    const email = localStorage.getItem('pendingVerifyEmail') || '';
    if (!email || !username) {
        showToast('No pending verification found. Register again.', 'error');
        return;
    }
    const btn = event && event.currentTarget ? event.currentTarget : null;
    const original = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Sending...';
    }
    const res = await apiJson(`${API_URL}/api/auth/register-resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    if (btn) {
        btn.disabled = false;
        btn.textContent = original || 'Send new code';
    }
    if (!res.ok) {
        const msg = (res.data && (res.data.message || res.data.error)) || 'Failed to resend code';
        showToast(msg, 'error');
        return;
    }
    showToast('New verification code sent.', 'success');
}

async function login() {
    const usernameInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');

    const identifier = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!identifier) {
        showToast('Please enter email or username', 'error');
        return;
    }
    if (!password) {
        showToast('Enter your password', 'error');
        return;
    }

    const res = await apiJson(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
    });

    if (!res.ok) {
        const msg = (res.data && (res.data.message || res.data.error)) || 'Login failed';
        showToast(msg, 'error');
        return;
    }

    setSession(res.data.user, res.data.token);
    document.getElementById('user-name').textContent = res.data.user.username;
    usernameInput.value = '';
    passwordInput.value = '';
    showToast('Welcome back!', 'success');
    setTimeout(() => showScreen('dashboard-screen'), 700);
}

async function sendLoginCode(event) {
    const identifierInput = document.getElementById('login-email');
    const sendBtn = event && event.currentTarget ? event.currentTarget : null;
    const originalBtnText = sendBtn ? sendBtn.textContent : '';
    const identifier = (identifierInput && identifierInput.value.trim())
        ? identifierInput.value.trim()
        : (localStorage.getItem('pendingLoginIdentifier') || '').trim();
    if (!identifier) {
        showToast('Enter email or username first', 'error');
        return;
    }
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';
    }
    const res = await apiJson(`${API_URL}/api/auth/send-login-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
    });
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = originalBtnText || 'Send login code';
    }
    if (!res.ok) {
        const msg = (res.data && (res.data.message || res.data.error)) || 'Failed to send login code';
        showToast(msg, 'error');
        return;
    }
    localStorage.setItem('pendingLoginIdentifier', identifier);
    const label = document.getElementById('login-code-identifier-label');
    if (label) label.textContent = identifier;
    showToast('Login code sent. Check your email.', 'success');
    showScreen('verify-login-screen');
}

async function submitLoginCodeVerification() {
    const identifier = localStorage.getItem('pendingLoginIdentifier') || '';
    const codeInput = document.getElementById('login-verify-code');
    const code = codeInput ? codeInput.value.trim() : '';
    if (!identifier) {
        showToast('No pending login code request. Send a code first.', 'error');
        return;
    }
    if (!/^\d{6}$/.test(code)) {
        setRegisterFieldError('login-verify-code', 'login-code-error', 'Enter a valid 6-digit code.');
        return;
    }
    const res = await apiJson(`${API_URL}/api/auth/login-with-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, code })
    });
    if (!res.ok) {
        const msg = (res.data && (res.data.message || res.data.error)) || 'Code login failed';
        setRegisterFieldError('login-verify-code', 'login-code-error', msg);
        return;
    }
    setSession(res.data.user, res.data.token);
    localStorage.removeItem('pendingLoginIdentifier');
    if (codeInput) codeInput.value = '';
    const userNameEl = document.getElementById('user-name');
    if (userNameEl && res.data.user) userNameEl.textContent = res.data.user.username;
    showToast('Welcome back!', 'success');
    setTimeout(() => showScreen('dashboard-screen'), 500);
}
