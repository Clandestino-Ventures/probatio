# Probatio E2E Integration Test Flow

## Pre-conditions
- App running on localhost:3000
- Supabase project accessible with schema applied
- Mock mode active (MODAL_BASE_URL not set) OR Modal functions deployed
- Inngest dev server running: `npx inngest-cli dev`

## Test Flow

### 1. LANDING PAGE
- [ ] Visit localhost:3000
- [ ] Marketing nav visible: Product, Pricing, Methodology, EN/ES, Sign In, Get Started
- [ ] Landing page renders: hero with animated spectrogram, two-modes, pipeline visual, evidence section, audience, pricing, FAQ, footer
- [ ] Click language toggle → all text changes to Spanish
- [ ] Switch back to English
- [ ] Click "Get Started" → navigates to /signup
- [ ] Smooth scroll works for "See How It Works" and "Pricing" nav links

### 2. SIGNUP
- [ ] Fill form: display name, email, password (min 8 chars), organization (optional)
- [ ] Language selector (EN/ES) visible
- [ ] Submit → account created (or email verification page shown)
- [ ] Verify in Supabase Auth: new user exists
- [ ] Verify in Supabase profiles table: role='user', plan_tier='free'
- [ ] Verify in Supabase credits table: balance=3
- [ ] Verify in credit_usage: signup_bonus entry with amount=3
- [ ] Redirected to /dashboard (or /login if email verification required)

### 3. FIRST-TIME DASHBOARD
- [ ] Welcome/first-time experience shown (not empty state)
- [ ] Upload zone prominent and centered
- [ ] "You have 3 free analyses" message visible
- [ ] Sidebar: Dashboard, History, Settings (NO Forensic Cases for free tier)
- [ ] Header intelligence bar: 0 active, 0 attention, 3 credits

### 4. UPLOAD + ANALYSIS
- [ ] Select an MP3/WAV file (any audio, under 50MB)
- [ ] "Computing file hash..." appears with spinner
- [ ] SHA-256 hash displayed (first 8...last 8 chars)
- [ ] Dedup check: "New file — ready to analyze"
- [ ] Click "Analyze Track"
- [ ] Upload progress shown
- [ ] Analysis queued → card appears in "Active Now"
- [ ] Header: active count = 1, credits = 2
- [ ] Pipeline progress updates in real-time

### 5. PIPELINE COMPLETION
- [ ] Steps advance: Fingerprinting → Separating → Extracting → etc.
- [ ] Progress bar fills gradually
- [ ] On completion: toast "Analysis complete"
- [ ] Card moves from "Active Now" to "Recent" (or "Needs Attention" if high risk)
- [ ] Header: active = 0, attention updates if applicable

### 6. VIEW RESULTS
- [ ] Click completed analysis card → /dashboard/analyses/[id]
- [ ] Header: file name, duration, tempo, key, risk badge, match count
- [ ] Audio player renders (waveform with evidence markers)
- [ ] Executive summary visible (Claude-generated or template)
- [ ] Match cards with dimension scores (melody/harmony/rhythm/timbre)
- [ ] Click match card → deep-dive expands (radar, timeline, evidence list)
- [ ] Click evidence point → audio seeks to timestamp
- [ ] Chain of custody: expandable timeline with "Verified" badge
- [ ] PDF download button works → PDF opens with cover, methodology, matches, custody

### 7. DEDUP TEST
- [ ] Return to dashboard
- [ ] Upload the SAME file again
- [ ] "Already analyzed on [date]. View results?" appears
- [ ] 0 credits consumed (balance still 2)

### 8. SETTINGS
- [ ] Navigate to /dashboard/settings
- [ ] Profile: edit display name, save → toast "Profile updated"
- [ ] Security: change password form visible
- [ ] Plan & Usage: shows Free plan, 2/3 credits, usage stats
- [ ] Data & Privacy: delete account button visible with warning

### 9. SECOND ANALYSIS
- [ ] Upload a different file
- [ ] Pipeline completes → credits = 1
- [ ] Vector search may find first track as candidate (low similarity expected)

### 10. ZERO CREDITS
- [ ] Upload third file → credits = 0
- [ ] Try fourth upload → "Insufficient credits" with upgrade CTA
- [ ] Upload zone disabled or shows upgrade message

### 11. HISTORY
- [ ] Navigate to /dashboard/history
- [ ] All 3 analyses visible
- [ ] Risk filter works (select "high" → filters correctly)
- [ ] Status filter works
- [ ] Search by filename works
- [ ] Pagination works if >10 analyses

### 12. LOGOUT + RE-LOGIN
- [ ] Sign out → redirected to /login
- [ ] /dashboard redirects to /login (protected route)
- [ ] Login with email/password → dashboard shows all previous analyses
- [ ] Credits preserved (0 remaining)

### 13. ACCESS CONTROL
- [ ] Create second account (different email)
- [ ] Login as second user → dashboard shows 0 analyses
- [ ] Navigate to first user's analysis URL directly → "Analysis not found"
- [ ] First user's data never visible to second user

## Security Audit Checklist

| # | Test | Expected | Status |
|---|------|----------|--------|
| 1 | User A analyses hidden from User B | 0 rows returned | |
| 2 | User A chain of custody hidden from User B | 0 rows returned | |
| 3 | User A match evidence hidden from User B | 0 rows returned | |
| 4 | User A credits hidden from User B | 0 rows returned | |
| 5 | User B cannot access User A storage files | 403/404 | |
| 6 | API uses session user, ignores body user_id | Correct user charged | |
| 7 | User B cannot download User A's PDF | 404 returned | |
| 8 | chain_of_custody UPDATE blocked | Trigger raises exception | |
| 9 | chain_of_custody DELETE blocked | Trigger raises exception | |

## Post-Test Verification SQL

```sql
-- Verify chain integrity for any analysis
SELECT * FROM verify_custody_chain('analysis', '<analysis_id>');
-- Must return is_valid = true

-- Check credit accounting
SELECT u.action, u.amount, u.balance_after, u.description
FROM credit_usage u WHERE u.user_id = '<user_id>'
ORDER BY u.created_at;

-- Verify RLS isolation
-- (Run as User B's JWT)
SELECT count(*) FROM analyses WHERE user_id = '<user_a_id>';
-- Must return 0
```
