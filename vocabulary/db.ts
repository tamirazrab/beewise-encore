import { SQLDatabase } from "encore.dev/storage/sqldb";

export const vocabularyDB = new SQLDatabase("vocabulary_db", {
  migrations: "./migrations",
});
