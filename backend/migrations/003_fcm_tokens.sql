-- 003: Create push_tokens table for Firebase Cloud Messaging

CREATE TABLE IF NOT EXISTS push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id
ON push_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_push_tokens_token
ON push_tokens(token);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on push_tokens"
ON push_tokens;

CREATE POLICY "Service role full access on push_tokens"
ON push_tokens
FOR ALL
USING (true)
WITH CHECK (true);