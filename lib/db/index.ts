import { drizzle } from 'drizzle-orm/mysql2';
import mysql2 from 'mysql2/promise';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  conn: mysql2.Pool | undefined;
};

const conn =
  globalForDb.conn ??
  mysql2.createPool({
    uri: process.env.DATABASE_URL!,
    connectionLimit: 10,
  });
if (process.env.NODE_ENV !== 'production') globalForDb.conn = conn;

export const db = drizzle(conn, { schema, mode: 'default' });
