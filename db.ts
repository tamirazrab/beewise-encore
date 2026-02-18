import { SQLDatabase } from "encore.dev/storage/sqldb";

// Database is owned by auth service (auth/db.ts). Other services use this named reference
// so Encore Cloud injects app_db config into every process that uses it.
export const db = SQLDatabase.named("app_db");
