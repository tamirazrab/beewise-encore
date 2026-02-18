import { SQLDatabase } from "encore.dev/storage/sqldb";

// This service owns beewise_backend_db so Encore Cloud injects DB config here.
// Other modules (subscription, paid-ai-chat, vocabulary) use SQLDatabase.named("beewise_backend_db") via root db.ts.
export const freeAIChatDB = new SQLDatabase("beewise_backend_db", {
  migrations: "./migrations",
});
