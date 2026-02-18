import { Service } from "encore.dev/service";
import { freeSubscriptionCheck } from "./free-ai-chat/middleware";
import { paidSubscriptionCheck } from "./paid-ai-chat/middleware";
// Ensure Encore Cloud links app_db to this service process (fixes "database is not configured for this process")
import "./db";

export default new Service("api", {
  middlewares: [freeSubscriptionCheck, paidSubscriptionCheck],
});
