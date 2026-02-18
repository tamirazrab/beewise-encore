CREATE TABLE subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('free', 'trial', 'paid', 'expired')),
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscription_user_id ON subscription(user_id);
CREATE INDEX idx_subscription_plan_type ON subscription(plan_type);
CREATE INDEX idx_subscription_stripe_customer ON subscription(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_subscription_stripe_subscription ON subscription(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
