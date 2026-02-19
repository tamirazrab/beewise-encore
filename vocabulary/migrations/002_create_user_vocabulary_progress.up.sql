CREATE TABLE user_vocabulary_progress (
  user_id UUID NOT NULL,
  vocabulary_id UUID NOT NULL REFERENCES vocabulary_item(id) ON DELETE CASCADE,
  mastery_level INTEGER NOT NULL DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 100),
  last_practiced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, vocabulary_id)
);

CREATE INDEX idx_user_vocab_progress_user ON user_vocabulary_progress(user_id, mastery_level);
CREATE INDEX idx_user_vocab_progress_vocab ON user_vocabulary_progress(vocabulary_id);
CREATE INDEX idx_user_vocab_progress_practiced ON user_vocabulary_progress(user_id, last_practiced_at DESC);
