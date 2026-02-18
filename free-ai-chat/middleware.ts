import { middleware } from "encore.dev/api";
import { APIError } from "encore.dev/api";
import { currentRequest } from "encore.dev";
import { getAuthData } from "~encore/auth";
import { freeAIChatDB } from "./db";

export const freeSubscriptionCheck = middleware(
  { target: { auth: true } },
  async (req, next) => {
    const meta = currentRequest();
    if (meta?.type !== "api-call" || !meta.path.startsWith("/free/")) {
      return next(req);
    }

    const authData = getAuthData();
    const userID = authData?.userID;
    if (!userID) {
      throw APIError.unauthenticated("User ID not found");
    }

    const status = await freeAIChatDB.queryRow<{
      plan_type: string;
    }>`
      SELECT plan_type
      FROM free_subscription_status
      WHERE user_id = ${userID}
    `;

    if (status && (status.plan_type === "paid" || status.plan_type === "expired")) {
      throw APIError.permissionDenied(
        "Free tier access denied. Please use the paid AI chat module."
      );
    }

    return next(req);
  }
);
