# Probatio — Production E2E Verification Checklist

Run this after every significant production deploy.

**Date:** ___________
**URL:** ___________
**Tester:** ___________

---

## 1. PUBLIC PAGES (no auth)

- [ ] Landing page loads < 3 seconds
- [ ] All sections render: hero, modes, how-it-works, audience, pricing, FAQ
- [ ] Language toggle switches ALL content to Spanish
- [ ] Language toggle switches back to English
- [ ] "Start Free Analysis" → /signup
- [ ] Methodology page at /methodology (8 sections)
- [ ] Terms of Service at /terms
- [ ] Privacy Policy at /privacy
- [ ] Disclaimer at /disclaimer
- [ ] Footer links all work
- [ ] Mobile: landing page responsive
- [ ] SEO: title, meta description, og:image (view-source)

## 2. AUTH

- [ ] Signup creates account with 3 free credits
- [ ] Login with email/password → dashboard
- [ ] /dashboard without auth → redirects to /login
- [ ] Forgot password sends email
- [ ] Logout works

## 3. DASHBOARD

- [ ] Sidebar: Dashboard, History, Settings visible
- [ ] "Forensic Cases" hidden for free tier
- [ ] Header: 0 active, 0 attention, 3 credits
- [ ] First-time experience for 0-analysis users

## 4. SCREENING ANALYSIS

- [ ] Upload audio file → hash computed
- [ ] "Analyze Track" → credit deducted
- [ ] Live pipeline progress updates
- [ ] Completion toast notification
- [ ] Card moves to Recent/Attention

## 5. RESULTS

- [ ] Detail page: header, risk badge, audio player
- [ ] Match cards with dimension scores
- [ ] Evidence list with timestamps
- [ ] Chain of custody: expandable, "Verified" badge
- [ ] PDF download works

## 6. DEDUP + CREDITS

- [ ] Re-upload same file → "Already analyzed"
- [ ] 0 credits → upload blocked with upgrade CTA
- [ ] Low credit banner at < 5

## 7. BILLING (test mode)

- [ ] Upgrade CTA → Stripe Checkout
- [ ] Test card payment → plan updated, credits refreshed
- [ ] Manage Subscription → Stripe Customer Portal

## 8. FORENSIC (Professional tier)

- [ ] /dashboard/forensic accessible after upgrade
- [ ] New case: dual upload + acknowledgment
- [ ] Payment flow → pipeline starts
- [ ] Side-by-side results view

## 9. SETTINGS

- [ ] Profile editable
- [ ] Plan & usage visible
- [ ] Language toggle works

## 10. SECURITY

- [ ] Second account sees 0 analyses
- [ ] Direct URL to other user's analysis → "Not found"
- [ ] Chain of custody verification returns is_valid = true

## 11. MONITORING

- [ ] Error triggers Sentry event
- [ ] PostHog captures page views

---

**Total: ___/45**
**Decision:** [ ] READY FOR BETA  [ ] NEEDS FIXES

---

# Quick Smoke Test (5 min)

- [ ] Landing page loads
- [ ] Login works
- [ ] Dashboard renders
- [ ] Upload + analysis works
- [ ] PDF downloads
- [ ] Settings accessible
