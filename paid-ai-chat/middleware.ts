import { middleware } from "encore.dev/api";
import { APIError } from "encore.dev/api";
import { currentRequest } from "encore.dev";
import { getAuthData } from "~encore/auth";
import { subscriptionDB } from "../subscription/db";

export const paidSubscriptionCheck = middleware(
  { target: { auth: true } },
  async (req, next) => {
    const meta = currentRequest();
    if (meta?.type !== "api-call" || !meta.path.startsWith("/paid/")) {
      return next(req);
    }

    const authData = getAuthData();
    const userID = authData?.userID;
    if (!userID) {
      throw APIError.unauthenticated("User ID not found");
    }

    const subscription = await subscriptionDB.queryRow<{
      plan_type: string;
    }>`
      SELECT plan_type
      FROM subscription
      WHERE user_id = ${userID}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!subscription || subscription.plan_type !== "paid") {
      throw APIError.permissionDenied(
        "Paid subscription required. Please upgrade your plan."
      );
    }

    return next(req);
  }
);
