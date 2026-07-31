# NOESIS Bank — Setup Guide

Everything below is new since the last version. The site is still fully static
(HTML/CSS/vanilla JS, no build step, no real backend) — the only two things
that need real credentials are Google address search and outgoing email.
Everything else works the moment you open the files.

## 1. Same-tab navigation
`<base target="_blank">` is gone from every page. All links and the nav open
in the same tab now.

## 2. Google address autocomplete (signup page)
1. In [Google Cloud Console](https://console.cloud.google.com/), create a
   project (or use one you have) and enable **"Places API (New)"** and
   **"Maps JavaScript API."**
2. Create an API key under **APIs & Services → Credentials**, and restrict
   it to your domain once you deploy (HTTP referrer restriction) — don't
   ship an unrestricted key.
3. Open `app.js` and replace `YOUR_GOOGLE_MAPS_API_KEY` in `NOESIS_CONFIG`
   **and** the matching placeholder in the loader script near the top of
   `signup.html`'s `<head>`.
4. On the signup page's Address step, a "Search Address" box will start
   returning real suggestions and auto-fill the address, state, and
   country fields. Until you add a key, that box just stays quiet and the
   plain address/state/country fields still work fine for manual entry —
   nothing breaks.

## 3. Automatic emails (welcome, login alerts, PIN verification)
There's no mail server here, so this uses [EmailJS](https://emailjs.com)
(free tier is enough) to send through a Gmail account you connect.

1. Create a free EmailJS account.
2. **Email Services** → connect your Gmail → copy the **Service ID**.
3. **Email Templates** → create one template used for every email this
   site sends. Give it these variables in the subject/body:
   - Subject field: `{{subject}}`
   - Body: something like
     `Hi {{to_name}},\n\n{{message}}\n\n— NOESIS Bank & Trust`
   - Copy the **Template ID**.
4. **Account → General** → copy your **Public Key**.
5. Paste all three into `NOESIS_CONFIG` at the top of `app.js`.

Until you fill these in, nothing crashes — emails just get logged to the
browser console instead of sent, and the one place that actually needs the
code to continue (PIN-change verification), that code is also shown to you
directly in a toast so you can keep testing before wiring up EmailJS.

## 4. Accounts start at a clean slate
There's no seeded demo user anymore. `noesisUsers` starts empty; the only
way an account exists is by signing up. Each new account gets a unique
10-digit account number, ₦0 balance, and no transaction history.

Because everything starts at zero and every existing action (Transfer,
Pay Bills, Airtime) only spends money, a new **Add Money** quick action
was added to the dashboard so you can fund an account for testing — it's
clearly labeled as a demo top-up, not a real deposit method.

**To test a real transfer:** sign up two accounts (two different emails/
browsers, or two browser profiles), add money to account A, then from
account A's dashboard choose Transfer → Bank: NOESIS Bank → account B's
10-digit number. Balance and transaction history update on both sides.
Transfers to any other bank stay a one-sided simulated debit, since
there's no real external bank to actually reach.

## 5. Changing the transaction PIN
Settings → Security → "Change Transaction PIN" now runs three steps:
1. Re-enter your account password.
2. Enter the 6-digit code emailed to you (or shown in a toast if EmailJS
   isn't configured yet).
3. Set and confirm the new 4-digit PIN.

A confirmation email goes out afterward either way, same pattern real
banks use for "your PIN was changed" alerts.

## 6. Dark / light theme
Settings → Preferences → Light/Dark. The choice is saved and applied on
every page, not just the dashboard.

## 7. Account upgrade (BVN / NIN required)
Settings → Account Upgrade asks for your BVN or NIN before switching you
to NOESIS Premium (Platinum card, shown on the dashboard). If you choose
BVN, it's checked against the BVN you signed up with. Both are
**format-checked only** (11 digits) — this demo has no connection to
NIBSS or NIMC, so it can't actually verify either number against the real
national databases. That's the natural place a licensed verification API
would plug in for a real deployment.

## A note on the data itself
Everything — passwords, PINs, BVN/NIN — is stored in the browser's
localStorage in plain text, same as the rest of this demo. That's fine
for a local prototype, but if this ever goes to a public URL collecting
real people's real BVN/NIN, it needs a real backend with proper
encryption and a licensed KYC provider instead — don't collect real
government ID numbers into client-side storage on a live site.
