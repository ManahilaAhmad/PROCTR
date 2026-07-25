import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Neon
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Without this, a dropped idle connection in the pool can crash the whole
// process instead of just failing the one request that was using it.
pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client:", err.message);
});

export default pool;