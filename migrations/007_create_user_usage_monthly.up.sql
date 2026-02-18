CREATE TABLE user_usage_monthly (
  user_id UUID NOT NULL,
  usage_year INTEGER NOT NULL,
  usage_month INTEGER NOT NULL CHECK (usage_month BETWEEN 1 AND 12),
  session_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_year, usage_month)
);

CREATE INDEX idx_user_usage_monthly_period ON user_usage_monthly(usage_year, usage_month);
