CREATE TABLE conversation_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  language_code VARCHAR(5) NOT NULL,
  total_messages INTEGER NOT NULL DEFAULT 0,
  total_tokens_used INTEGER NOT NULL DEFAULT 0,
  ai_cost_estimate_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
  session_duration_seconds INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_conversation_session_user_id ON conversation_session(user_id, created_at DESC);
CREATE INDEX idx_conversation_session_status ON conversation_session(status) WHERE status = 'active';
CREATE INDEX idx_conversation_session_language ON conversation_session(language_code);
