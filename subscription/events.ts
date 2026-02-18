import { Topic } from "encore.dev/pubsub";

export interface UserUpgradedToPaidEvent {
  user_id: string;
}

export const userUpgradedToPaid = new Topic<UserUpgradedToPaidEvent>("user-upgraded-to-paid", {
  deliveryGuarantee: "at-least-once",
});
