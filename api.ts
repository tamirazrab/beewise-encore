// Load environment variables from .env file
import "dotenv/config";

// Load gateway so auth handler and gateway are registered
import "./gateway";

// Register all API endpoints, cron jobs, and pubsub subscriptions
import "./auth/api";
import "./free-ai-chat/api";
import "./free-ai-chat/cron";
import "./free-ai-chat/subscription-sync";
import "./paid-ai-chat/api";
import "./subscription/api";
import "./subscription/webhooks";
import "./vocabulary/api";
