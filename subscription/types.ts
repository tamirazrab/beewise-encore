export type PlanType = "free" | "trial" | "paid" | "expired";

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_type: PlanType;
  trial_ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionStatusResponse {
  plan_type: PlanType;
  trial_ends_at: Date | null;
  is_paid: boolean;
}

export interface GetUserSubscriptionResponse {
  subscription: Subscription | null;
}
