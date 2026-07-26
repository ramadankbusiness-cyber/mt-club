-- Add attendance_points to events table (default 2)
ALTER TABLE events ADD COLUMN IF NOT EXISTS attendance_points INTEGER NOT NULL DEFAULT 2;

-- Create points_transactions table
CREATE TABLE IF NOT EXISTS points_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  points INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('attendance', 'bonus', 'penalty', 'adjustment')),
  reason TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_points_txn_user_id ON points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_txn_event_id ON points_transactions(event_id);
CREATE INDEX IF NOT EXISTS idx_points_txn_created_at ON points_transactions(created_at);

-- RLS: allow service_role full access
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON points_transactions FOR ALL USING (true) WITH CHECK (true);
