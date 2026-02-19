import { api } from "encore.dev/api";
import { APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { subscriptionDB } from "./db";
import type { Subscription, SubscriptionStatusResponse, GetUserSubscriptionResponse } from "./types";

/** Internal API for paid-ai-chat middleware: check if user has paid access. Not exposed to the internet. */
export const checkPaidAccess = api(
  { method: "POST", path: "/subscription/check-paid-access" },
  async (req: { userId: string }): Promise<{ allowed: boolean }> => {
    const subscription = await subscriptionDB.queryRow<{ plan_type: string }>`
      SELECT plan_type
      FROM subscription
      WHERE user_id = ${req.userId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return { allowed: !!subscription && subscription.plan_type === "paid" };
  }
);

export const getSubscriptionStatus = api(
  { method: "GET", path: "/subscription/status", auth: true },
  async (req: {}): Promise<SubscriptionStatusResponse> => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("User ID not found");
    }

    const subscription = await subscriptionDB.queryRow<Subscription>`
      SELECT id, user_id, stripe_customer_id, stripe_subscription_id, plan_type, trial_ends_at, created_at, updated_at
      FROM subscription
      WHERE user_id = ${authData.userID}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!subscription) {
      return {
        plan_type: "free",
        trial_ends_at: null,
        is_paid: false,
      };
    }

    return {
      plan_type: subscription.plan_type,
      trial_ends_at: subscription.trial_ends_at,
      is_paid: subscription.plan_type === "paid",
    };
  }
);

export const getUserSubscription = api(
  { method: "GET", path: "/subscription", auth: true },
  async (req: {}): Promise<GetUserSubscriptionResponse> => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("User ID not found");
    }

    const subscription = await subscriptionDB.queryRow<Subscription>`
      SELECT id, user_id, stripe_customer_id, stripe_subscription_id, plan_type, trial_ends_at, created_at, updated_at
      FROM subscription
      WHERE user_id = ${authData.userID}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return { subscription: subscription || null };
  }
);
