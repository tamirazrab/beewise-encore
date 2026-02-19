CREATE TABLE practice_recording (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES practice_session(id) ON DELETE CASCADE,
  s3_key VARCHAR(512) NOT NULL,
  duration_seconds INTEGER,
  pronunciation_score INTEGER CHECK (pronunciation_score BETWEEN 0 AND 100),
  ai_feedback JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_practice_recording_session ON practice_recording(session_id, created_at DESC);
CREATE INDEX idx_practice_recording_s3_key ON practice_recording(s3_key);
