CREATE TABLE IF NOT EXISTS notification_history (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'all',
  target_value TEXT,
  sent_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_history_created_at
  ON notification_history(created_at DESC);

ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON notification_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read notification history"
  ON notification_history FOR SELECT
  TO authenticated
  USING (true);
