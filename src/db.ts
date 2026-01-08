import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const isProd = process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(isProd
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});

pool
  .connect()
  .then(() => console.log("✅ Postgres connected"))
  .catch((err) => console.error("❌ Postgres connection error", err));
