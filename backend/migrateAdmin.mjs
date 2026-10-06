import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pool from './db.js';

const currentFile = fileURLToPath(import.meta.url);
const migrationPath = path.join(path.dirname(currentFile), '..', 'Database', 'migrations', '001_admin_foundation.sql');

try {
  const sql = await readFile(migrationPath, 'utf8');
  await pool.query(sql);
  console.log('Admin foundation migration applied successfully.');
} catch (error) {
  console.error('Admin foundation migration failed:');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
