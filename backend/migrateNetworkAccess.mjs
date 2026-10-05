import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(here, '..', 'Database', 'migrations', '004_network_access_approval.sql');

try {
  await pool.query(await fs.readFile(migrationPath, 'utf8'));
  console.log('Network access approval migration completed successfully.');
} catch (error) {
  console.error('Network access approval migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
