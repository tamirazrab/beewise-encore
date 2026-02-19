import { SQLDatabase } from "encore.dev/storage/sqldb";

export const paidAIChatDB = new SQLDatabase("paid_ai_chat_db", {
  migrations: "./migrations",
});
