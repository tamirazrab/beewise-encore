import { SQLDatabase } from "encore.dev/storage/sqldb";

// beewise_backend_db is owned by free-ai-chat (free-ai-chat/db.ts). This named reference
// lets subscription, paid-ai-chat, vocabulary get the same DB config on Encore Cloud.
export const db = SQLDatabase.named("beewise_backend_db");
