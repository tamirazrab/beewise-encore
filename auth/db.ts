import { SQLDatabase } from "encore.dev/storage/sqldb";

// Auth service owns app_db so Encore Cloud configures it for this process.
// Other services use SQLDatabase.named("app_db") from root db.ts.
export const authDB = new SQLDatabase("app_db", {
  migrations: "../migrations",
});
