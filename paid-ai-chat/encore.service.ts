import { Service } from "encore.dev/service";
import { paidSubscriptionCheck } from "./middleware";
import "./db";

export default new Service("paid-ai-chat", {
  middlewares: [paidSubscriptionCheck],
});
