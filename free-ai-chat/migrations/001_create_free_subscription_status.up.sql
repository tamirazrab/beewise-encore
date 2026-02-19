CREATE TABLE free_subscription_status (
  user_id UUID PRIMARY KEY,
  plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('free', 'trial', 'expired')),
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_free_subscription_plan_type ON free_subscription_status(plan_type);
CREATE INDEX idx_free_subscription_trial_ends ON free_subscription_status(trial_ends_at) WHERE trial_ends_at IS NOT NULL;
