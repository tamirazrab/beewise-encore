import { SQLDatabase } from "encore.dev/storage/sqldb";

export const subscriptionDB = new SQLDatabase("subscription_db", {
  migrations: "./migrations",
});
