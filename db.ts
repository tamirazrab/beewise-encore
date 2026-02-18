import { SQLDatabase } from "encore.dev/storage/sqldb";

export const db = new SQLDatabase("beewise_backend_db", {
  migrations: "./migrations",
});
