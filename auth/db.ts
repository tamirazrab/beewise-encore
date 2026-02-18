import { SQLDatabase } from "encore.dev/storage/sqldb";

/** Dedicated database for auth (users table only). */
export const authDB = new SQLDatabase("auth_db", {
  migrations: "./migrations",
});
