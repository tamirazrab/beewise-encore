import { api } from "encore.dev/api";
import { subscriptionDB } from "./db";
import type { Subscription } from "./types";

interface StripeWebhookEvent {
  type: string;
  data: {
    object: {
      id: string;
      customer: string;
      status?: string;
      trial_end?: number | null;
      cancel_at_period_end?: boolean;
      [key: string]: any;
    };
  };
}

export const stripeWebhook = api.raw(
  {
    method: "POST",
    path: "/webhooks/stripe",
    expose: true,
  },
  async (req, resp) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      resp.writeHead(400, { "Content-Type": "application/json" });
      resp.end(JSON.stringify({ error: "Missing stripe-signature header" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const event: StripeWebhookEvent = JSON.parse(body);

        switch (event.type) {
          case "customer.subscription.created":
          case "customer.subscription.updated":
            await handleSubscriptionCreatedOrUpdated(event);
            break;
          case "customer.subscription.deleted":
            await handleSubscriptionDeleted(event);
            break;
          case "customer.subscription.trial_will_end":
            await handleTrialWillEnd(event);
            break;
          default:
            console.log(`Unhandled event type: ${event.type}`);
        }

        resp.writeHead(200, { "Content-Type": "application/json" });
        resp.end(JSON.stringify({ received: true }));
      } catch (error) {
        console.error("Webhook error:", error);
        resp.writeHead(500, { "Content-Type": "application/json" });
        resp.end(JSON.stringify({ error: "Webhook processing failed" }));
      }
    });
  }
);

async function handleSubscriptionCreatedOrUpdated(event: StripeWebhookEvent) {
  const subscription = event.data.object;
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  let planType: "trial" | "paid" = "paid";
  if (status === "trialing" || (subscription.trial_end && subscription.trial_end > Date.now() / 1000)) {
    planType = "trial";
  }

  const trialEndsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000)
    : null;

  const customer = await getStripeCustomer(customerId);
  if (!customer || !customer.metadata?.user_id) {
    console.error(`No user_id found for customer ${customerId}`);
    return;
  }

  const userId = customer.metadata.user_id;

  const existing = await subscriptionDB.queryRow<{ id: string }>`
    SELECT id FROM subscription WHERE user_id = ${userId}
  `;

  if (existing) {
    await subscriptionDB.exec`
      UPDATE subscription
      SET stripe_customer_id = ${customerId},
          stripe_subscription_id = ${subscriptionId},
          plan_type = ${planType},
          trial_ends_at = ${trialEndsAt},
          updated_at = NOW()
      WHERE user_id = ${userId}
    `;
  } else {
    await subscriptionDB.exec`
      INSERT INTO subscription (user_id, stripe_customer_id, stripe_subscription_id, plan_type, trial_ends_at)
      VALUES (${userId}, ${customerId}, ${subscriptionId}, ${planType}, ${trialEndsAt})
    `;
  }

  if (planType === "paid") {
    await publishUserUpgradedEvent(userId);
  }
}

async function handleSubscriptionDeleted(event: StripeWebhookEvent) {
  const subscription = event.data.object;
  const subscriptionId = subscription.id;

  await subscriptionDB.exec`
    UPDATE subscription
    SET plan_type = 'expired',
        updated_at = NOW()
    WHERE stripe_subscription_id = ${subscriptionId}
  `;
}

async function handleTrialWillEnd(event: StripeWebhookEvent) {
  const subscription = event.data.object;
  const subscriptionId = subscription.id;
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;

  await subscriptionDB.exec`
    UPDATE subscription
    SET trial_ends_at = ${trialEnd},
        updated_at = NOW()
    WHERE stripe_subscription_id = ${subscriptionId}
  `;
}

async function getStripeCustomer(customerId: string): Promise<any> {
  const stripe = await import("stripe");
  const stripeClient = new stripe.default(process.env.STRIPE_SECRET_KEY || "");
  return await stripeClient.customers.retrieve(customerId);
}

async function publishUserUpgradedEvent(userId: string) {
  const { userUpgradedToPaid } = await import("./events");
  await userUpgradedToPaid.publish({ user_id: userId });
}
