import { SQLDatabase } from "encore.dev/storage/sqldb";

export const db = new SQLDatabase("app_db", {
  migrations: "./migrations",
});
