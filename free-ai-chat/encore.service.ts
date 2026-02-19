import { Service } from "encore.dev/service";
import { freeSubscriptionCheck } from "./middleware";
import "./db";

export default new Service("free-ai-chat", {
  middlewares: [freeSubscriptionCheck],
});
