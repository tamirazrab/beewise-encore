CREATE TYPE practice_type AS ENUM ('speaking', 'listening');

CREATE TABLE practice_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type practice_type NOT NULL,
  language_code VARCHAR(5) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_practice_session_user ON practice_session(user_id, created_at DESC);
CREATE INDEX idx_practice_session_type ON practice_session(type, language_code);
