CREATE TYPE favorite_type AS ENUM ('vocabulary', 'quiz');

CREATE TABLE favorite_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_type favorite_type NOT NULL,
  item_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, item_type, item_id)
);

CREATE INDEX idx_favorite_item_user ON favorite_item(user_id, created_at DESC);
CREATE INDEX idx_favorite_item_type ON favorite_item(item_type, item_id);
