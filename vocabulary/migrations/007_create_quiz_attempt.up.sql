CREATE TABLE quiz_attempt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  quiz_id UUID NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  score DECIMAL(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quiz_attempt_user ON quiz_attempt(user_id, completed_at DESC);
CREATE INDEX idx_quiz_attempt_quiz ON quiz_attempt(quiz_id);
