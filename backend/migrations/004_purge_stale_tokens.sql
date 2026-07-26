-- 004: Purge stale OneSignal tokens from push_tokens
-- The old tokens were OneSignal subscription IDs, not FCM tokens.
-- After migration to Firebase, all stored tokens are invalid and must be removed.
-- Users will auto-re-register with real FCM tokens on next login.

DELETE FROM push_tokens;
