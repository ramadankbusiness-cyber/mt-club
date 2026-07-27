-- Migration: Drop push_tokens table (FCM is no longer used)
-- OneSignal manages subscriptions server-side

DROP TABLE IF EXISTS push_tokens CASCADE;
