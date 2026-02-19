import { SQLDatabase } from "encore.dev/storage/sqldb";

export const freeAIChatDB = new SQLDatabase("free_ai_chat_db", {
  migrations: "./migrations",
});
