import { middleware } from "encore.dev/api";
import { APIError } from "encore.dev/api";
import { currentRequest } from "encore.dev";
import { getAuthData } from "~encore/auth";
import { subscription } from "~encore/clients";

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

    const { allowed } = await subscription.checkPaidAccess({ userId: userID });

    if (!allowed) {
      throw APIError.permissionDenied(
        "Paid subscription required. Please upgrade your plan."
      );
    }

    return next(req);
  }
);
