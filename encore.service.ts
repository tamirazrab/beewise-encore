import { Service } from "encore.dev/service";
import { freeSubscriptionCheck } from "./free-ai-chat/middleware";
import { paidSubscriptionCheck } from "./paid-ai-chat/middleware";
import "./db";


export default new Service("api", {
  middlewares: [freeSubscriptionCheck, paidSubscriptionCheck],
});
