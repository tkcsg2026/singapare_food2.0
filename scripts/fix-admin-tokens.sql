-- Fix "Database error querying schema" when logging in as Admin@gmail.com
-- Run this in Supabase Dashboard → SQL Editor if login fails with that error.
-- Supabase Auth requires these token columns to be empty strings, not NULL.

UPDATE auth.users
SET
  confirmation_token     = COALESCE(confirmation_token, ''),
  email_change           = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  recovery_token         = COALESCE(recovery_token, ''),
  updated_at             = now()
WHERE email = 'Admin@gmail.com';
