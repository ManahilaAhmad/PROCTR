import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(here, '..', 'Database', 'migrations', '003_security_hardening.sql');

try {
  const sql = await fs.readFile(migrationPath, 'utf8');
  await pool.query(sql);
  console.log('Security hardening migration completed successfully.');
} catch (error) {
  console.error('Security migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
