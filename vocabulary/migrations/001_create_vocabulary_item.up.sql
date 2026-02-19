CREATE TYPE difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced');

CREATE TABLE vocabulary_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code VARCHAR(5) NOT NULL,
  difficulty_level difficulty_level NOT NULL,
  word VARCHAR(255) NOT NULL,
  meaning TEXT NOT NULL,
  example_sentence TEXT,
  audio_url TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vocabulary_language_difficulty 
  ON vocabulary_item(language_code, difficulty_level) WHERE deleted_at IS NULL;
CREATE INDEX idx_vocabulary_word_gin ON vocabulary_item USING GIN (to_tsvector('english', word)) WHERE deleted_at IS NULL;
CREATE INDEX idx_vocabulary_language ON vocabulary_item(language_code) WHERE deleted_at IS NULL;
