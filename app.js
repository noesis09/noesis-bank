/* =====================================================================
   NOESIS Bank & Trust — Shared App Logic
   ---------------------------------------------------------------------
   Everything here runs in the browser only — there is no real server,
   so every balance and transaction is pseudo money for demonstration.
   Data lives in localStorage under these keys:
     noesisUsers                → array of all accounts (the "bank")
     noesisUser                 → the signed-in session (a copy of one user)
     noesisTransactions_<id>    → each user's transaction history
     noesisOTP_<id>             → a pending PIN-change verification code
     noesisTheme                → 'light' | 'dark'

   CONFIGURE THESE three services before Google address search and
   automatic emails go live. Nothing else breaks if you leave the
   placeholders in — those two features just quietly no-op and log
   a note to the console instead.
   ===================================================================== */

const NOESIS_CONFIG = {
    // Google Cloud Console → APIs & Services → Credentials.
    // Enable "Places API (New)" + "Maps JavaScript API" for this key,
    // then restrict it to your domain before going live.
    GOOGLE_MAPS_API_KEY: 'YOUR_GOOGLE_MAPS_API_KEY',

    // emailjs.com (free tier is fine) → Email Services → connect Gmail
    // for the service ID, Email Templates for the template ID, and
    // Account → General for the public key. One template covers every
    // email this app sends — see EMAILJS_SETUP.md for the exact fields.
    EMAILJS_PUBLIC_KEY: 'YOUR_EMAILJS_PUBLIC_KEY',
    EMAILJS_SERVICE_ID: 'YOUR_EMAILJS_SERVICE_ID',
    EMAILJS_TEMPLATE_ID: 'YOUR_EMAILJS_TEMPLATE_ID'
};

(function initEmailJS() {
    if (typeof emailjs !== 'undefined' && !NOESIS_CONFIG.EMAILJS_PUBLIC_KEY.startsWith('YOUR_')) {
        emailjs.init({ publicKey: NOESIS_CONFIG.EMAILJS_PUBLIC_KEY });
    }
})();

const NoesisBank = {

    /* ---------------- Accounts ---------------- */

    getUsers() {
        return JSON.parse(localStorage.getItem('noesisUsers') || '[]');
    },

    saveUsers(users) {
        localStorage.setItem('noesisUsers', JSON.stringify(users));
    },

    findByEmail(email) {
        const e = (email || '').trim().toLowerCase();
        return this.getUsers().find(u => u.email === e);
    },

    findByAccountNumber(accNum) {
        return this.getUsers().find(u => u.accountNumber === accNum);
    },

    generateAccountNumber() {
        const users = this.getUsers();
        let accNum;
        do {
            accNum = '20' + String(Math.floor(10000000 + Math.random() * 90000000));
        } while (users.some(u => u.accountNumber === accNum));
        return accNum;
    },

    updateUser(userId, changes) {
        const users = this.getUsers();
        const idx = users.findIndex(u => u.id === userId);
        if (idx === -1) return null;
        users[idx] = Object.assign({}, users[idx], changes);
        this.saveUsers(users);

        // Mirror the relevant fields into the active session, if it's this user.
        const session = this.getCurrentUser();
        if (session && session.id === userId) {
            ['balance', 'accountType', 'tier'].forEach(k => {
                if (k in changes) session[k] = changes[k];
            });
            localStorage.setItem('noesisUser', JSON.stringify(session));
        }
        return users[idx];
    },

    /* ---------------- Session ---------------- */

    getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem('noesisUser'));
        } catch (e) {
            return null;
        }
    },

    logout() {
        localStorage.removeItem('noesisUser');
        window.location.href = 'login.html';
    },

    updateNavForSession() {
        const user = this.getCurrentUser();
        const cta = document.querySelector('.nav-cta');
        if (user && user.name && cta) {
            cta.textContent = 'My Account';
            cta.href = 'dashboard.html';
        }
    },

    /* ---------------- Transactions ---------------- */

    getTransactions(userId) {
        return JSON.parse(localStorage.getItem('noesisTransactions_' + userId) || '[]');
    },

    addTransaction(userId, tx) {
        const list = this.getTransactions(userId);
        list.push(Object.assign({
            id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            date: new Date().toISOString()
        }, tx));
        localStorage.setItem('noesisTransactions_' + userId, JSON.stringify(list));
        return list;
    },

    formatMoney(amount) {
        return '₦' + Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    /* ---------------- Transfers — same-bank ledger ----------------
       Moving money to a NOESIS account for real (within this demo's
       storage): both balances and both transaction histories update.
       Transfers to other banks stay a simulated one-sided debit,
       since there's no real external bank to actually reach. */

    transferFunds(senderId, recipientAccountNumber, amount, narration) {
        const sender = this.getUsers().find(u => u.id === senderId);
        const recipient = this.findByAccountNumber(recipientAccountNumber);

        if (!sender) return { ok: false, error: 'Sender not found.' };
        if (!recipient) return { ok: false, error: 'No NOESIS account found with that number.' };
        if (recipient.accountNumber === sender.accountNumber) return { ok: false, error: 'You cannot transfer to your own account.' };
        if (!(amount > 0)) return { ok: false, error: 'Enter a valid amount.' };
        if (amount > sender.balance) return { ok: false, error: 'Insufficient balance.' };

        this.updateUser(sender.id, { balance: sender.balance - amount });
        this.updateUser(recipient.id, { balance: recipient.balance + amount });

        const desc = (narration && narration.trim()) ? narration.trim() : 'Transfer';

        this.addTransaction(sender.id, {
            type: 'debit',
            desc: 'Transfer to ' + recipient.firstName + ' ' + recipient.lastName + ' (****' + recipient.accountNumber.slice(-4) + ') — ' + desc,
            amount
        });
        this.addTransaction(recipient.id, {
            type: 'credit',
            desc: 'Transfer from ' + sender.firstName + ' ' + sender.lastName + ' (****' + sender.accountNumber.slice(-4) + ') — ' + desc,
            amount
        });

        return { ok: true, recipientName: recipient.firstName + ' ' + recipient.lastName };
    },

    addFunds(userId, amount) {
        const user = this.getUsers().find(u => u.id === userId);
        if (!user) return { ok: false, error: 'User not found.' };
        if (!(amount > 0)) return { ok: false, error: 'Enter a valid amount.' };
        this.updateUser(userId, { balance: user.balance + amount });
        this.addTransaction(userId, { type: 'credit', desc: 'Added money (demo top-up)', amount });
        return { ok: true };
    },

    /* ---------------- Transaction PIN ---------------- */

    verifyPin(userId, pin) {
        const user = this.getUsers().find(u => u.id === userId);
        return !!(user && user.pin && user.pin === pin);
    },

    verifyPassword(userId, password) {
        const user = this.getUsers().find(u => u.id === userId);
        return !!(user && user.password === password);
    },

    setPin(userId, newPin) {
        return this.updateUser(userId, { pin: newPin });
    },

    /* ---------------- One-time verification codes ----------------
       Used to confirm it's really the account owner before a PIN
       change goes through: re-enter the password, then enter the
       code emailed to the address on file. */

    generateOTP(userId) {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        localStorage.setItem('noesisOTP_' + userId, JSON.stringify({
            code,
            expiresAt: Date.now() + 10 * 60 * 1000
        }));
        return code;
    },

    verifyOTP(userId, code) {
        const raw = localStorage.getItem('noesisOTP_' + userId);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (Date.now() > parsed.expiresAt) return false;
        return parsed.code === String(code).trim();
    },

    clearOTP(userId) {
        localStorage.removeItem('noesisOTP_' + userId);
    },

    /* ---------------- BVN / NIN ----------------
       Format-checked only (11 digits) — this demo has no connection
       to NIBSS or NIMC, so it can't verify these against the real
       national databases. Treat this as a placeholder for wherever a
       licensed verification API would plug in later. */

    isValidIdNumber(value) {
        return /^\d{11}$/.test((value || '').trim());
    },

    upgradeAccount(userId, idType, idValue) {
        const user = this.getUsers().find(u => u.id === userId);
        if (!user) return { ok: false, error: 'User not found.' };
        if (!this.isValidIdNumber(idValue)) {
            return { ok: false, error: (idType === 'BVN' ? 'BVN' : 'NIN') + ' must be exactly 11 digits.' };
        }
        if (idType === 'BVN' && user.bvn && user.bvn !== idValue.trim()) {
            return { ok: false, error: 'That BVN does not match the one on your account.' };
        }
        const changes = { tier: 'premium' };
        if (idType === 'NIN') changes.nin = idValue.trim();
        this.updateUser(userId, changes);
        return { ok: true };
    },

    /* ---------------- Email — via EmailJS → your connected Gmail ----------------
       If the three config values above are still placeholders, this
       quietly skips the network call and logs the email to the
       console instead, so every flow (including OTP codes) stays
       testable before EmailJS is wired up. */

    sendEmail({ to_email, to_name, subject, message }) {
        const configured = typeof emailjs !== 'undefined' &&
            !NOESIS_CONFIG.EMAILJS_PUBLIC_KEY.startsWith('YOUR_') &&
            !NOESIS_CONFIG.EMAILJS_SERVICE_ID.startsWith('YOUR_') &&
            !NOESIS_CONFIG.EMAILJS_TEMPLATE_ID.startsWith('YOUR_');

        if (!configured) {
            console.info('[NOESIS email — EmailJS not configured, not actually sent]\nTo: ' + to_email + '\nSubject: ' + subject + '\nMessage: ' + message);
            return Promise.resolve({ sent: false });
        }

        return emailjs.send(
            NOESIS_CONFIG.EMAILJS_SERVICE_ID,
            NOESIS_CONFIG.EMAILJS_TEMPLATE_ID,
            { to_email, to_name, subject, message },
            { publicKey: NOESIS_CONFIG.EMAILJS_PUBLIC_KEY }
        ).then(() => ({ sent: true })).catch(err => {
            console.error('[NOESIS] Email failed to send:', err);
            return { sent: false, error: err };
        });
    },

    maskEmail(email) {
        if (!email || !email.includes('@')) return email || '';
        const [user, domain] = email.split('@');
        const visible = user.slice(0, Math.min(2, user.length));
        return visible + '•'.repeat(Math.max(user.length - visible.length, 3)) + '@' + domain;
    },

    /* ---------------- Theme ---------------- */

    getTheme() {
        return localStorage.getItem('noesisTheme') || 'light';
    },

    setTheme(theme) {
        localStorage.setItem('noesisTheme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    },

    applyStoredTheme() {
        document.documentElement.setAttribute('data-theme', this.getTheme());
    }
};

document.addEventListener('DOMContentLoaded', () => NoesisBank.updateNavForSession());
