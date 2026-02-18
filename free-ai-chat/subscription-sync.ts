import { Subscription } from "encore.dev/pubsub";
import { userUpgradedToPaid } from "../subscription/events";
import { freeAIChatDB } from "./db";

const _ = new Subscription(userUpgradedToPaid, "sync-free-subscription-status", {
  handler: async (event) => {
    await freeAIChatDB.exec`
      INSERT INTO free_subscription_status (user_id, plan_type, updated_at)
      VALUES (${event.user_id}, 'expired', NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        plan_type = 'expired',
        updated_at = NOW()
    `;
  },
});
