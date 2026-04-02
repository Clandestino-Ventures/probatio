-- ──────────────────────────────────────────────────────────────────────────────
-- SPECTRA — Super Admin Setup
-- ──────────────────────────────────────────────────────────────────────────────
-- Run this in the Supabase SQL Editor AFTER the user has signed up.
-- This promotes eddclandestino@gmail.com to super admin with enterprise tier.
-- ──────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Update profile: role → admin, plan → enterprise
UPDATE public.profiles
SET
  role       = 'admin',
  plan_tier  = 'enterprise',
  updated_at = now()
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'eddclandestino@gmail.com'
);

-- 2. Update credits: 9999 balance
UPDATE public.credits
SET
  balance    = 9999,
  plan_tier  = 'enterprise',
  updated_at = now()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'eddclandestino@gmail.com'
);

-- 3. Verify
SELECT
  p.id,
  u.email,
  p.role,
  p.plan_tier,
  c.balance AS credits,
  p.updated_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
LEFT JOIN public.credits c ON c.user_id = p.id
WHERE u.email = 'eddclandestino@gmail.com';

COMMIT;
