CREATE TABLE quiz (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code VARCHAR(5) NOT NULL,
  difficulty_level difficulty_level NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quiz_language_difficulty ON quiz(language_code, difficulty_level) WHERE deleted_at IS NULL;
