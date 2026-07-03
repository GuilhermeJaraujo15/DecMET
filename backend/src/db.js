/**
 * Database Connection Module
 * Provides MySQL connection pool for safe database queries
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const useSsl = process.env.DB_SSL === "true";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
  supportBigNumbers: true,
  bigNumberStrings: true,
  ssl: useSsl
    ? {
        rejectUnauthorized: false
      }
    : undefined
});

// Test the connection on module load
(async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log("✓ Database connection successful");
  } catch (error) {
    console.error("✗ Database connection failed:", error.message);
    process.exit(1);
  }
})();

export default pool;