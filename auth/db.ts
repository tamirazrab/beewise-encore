import { SQLDatabase } from "encore.dev/storage/sqldb";

export const authDB = new SQLDatabase("auth_db", {
  migrations: "./migrations",
});
