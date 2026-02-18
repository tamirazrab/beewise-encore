CREATE TABLE user_usage_daily (
  user_id UUID NOT NULL,
  usage_date DATE NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  session_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX idx_user_usage_daily_date ON user_usage_daily(usage_date);
