CREATE TABLE paid_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID REFERENCES paid_ai_session(id) ON DELETE SET NULL,
  tokens_used INTEGER NOT NULL,
  cost_usd DECIMAL(10,6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_paid_ai_usage_user_date ON paid_ai_usage(user_id, created_at DESC);
CREATE INDEX idx_paid_ai_usage_session ON paid_ai_usage(session_id);
