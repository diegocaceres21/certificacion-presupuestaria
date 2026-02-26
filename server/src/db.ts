import mysql, { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

let pool: Pool;

export function createPool(): Pool {
  pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'certificacion_presupuestaria',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true,
  });
  return pool;
}

export function getPool(): Pool {
  if (!pool) throw new Error('Database pool not initialized');
  return pool;
}

export { RowDataPacket, ResultSetHeader };
