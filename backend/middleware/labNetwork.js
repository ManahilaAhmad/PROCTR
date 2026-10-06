import { isIP } from 'node:net';
import pool from '../db.js';

const DEFAULT_LAB_CIDR = '192.168.18.0/24';

function normalizeIp(ip) {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function ipv4ToNumber(ip) {
  if (isIP(ip) !== 4) return null;
  return ip.split('.').reduce((value, octet) => (value * 256) + Number(octet), 0) >>> 0;
}

export function isAllowedLabIp(ip, cidr = process.env.LAB_NETWORK_CIDR || DEFAULT_LAB_CIDR) {
  const normalizedIp = normalizeIp(ip);
  const [networkAddress, prefixText] = cidr.split('/');
  const prefix = Number(prefixText);
  const ipNumber = ipv4ToNumber(normalizedIp);
  const networkNumber = ipv4ToNumber(networkAddress);

  if (ipNumber === null || networkNumber === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipNumber & mask) === (networkNumber & mask);
}

async function getSetting(key, fallback) {
  try {
    const result = await pool.query('SELECT setting_value FROM system_setting WHERE setting_key=$1', [key]);
    return result.rows.length ? result.rows[0].setting_value : fallback;
  } catch {
    return fallback;
  }
}

export async function resolveLabNetwork(sessionCode) {
  if (sessionCode) {
    const result = await pool.query(`
      SELECT l.lab_id, l.lab_name, l.network_range
      FROM live_exam_session les
      JOIN exam_schedule es ON es.exam_id=les.exam_id
      JOIN lab l ON l.lab_id=es.lab_id
      WHERE UPPER(les.session_code)=UPPER($1) AND les.status='ACTIVE'
      LIMIT 1
    `, [String(sessionCode).trim()]).catch(error => {
      if (error.code === '42P01') return { rows: [] };
      throw error;
    });
    if (result.rows.length && result.rows[0].network_range && result.rows[0].network_range !== '*') return result.rows[0];
  }
  const fallback = await getSetting('default_lab_cidr', process.env.LAB_NETWORK_CIDR || DEFAULT_LAB_CIDR);
  return { lab_id: null, lab_name: 'Default lab network', network_range: fallback || DEFAULT_LAB_CIDR };
}

export async function requireLabNetwork(req, res, next) {
  const clientIp = normalizeIp(req.ip || req.socket.remoteAddress || '');
  try {
    const lab = await resolveLabNetwork(req.body?.session_code);
    const labCidr = lab.network_range;
    const allowLoopback = await getSetting('allow_loopback_exam_access', false);
    const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1';

    if (!(allowLoopback && isLoopback) && !isAllowedLabIp(clientIp, labCidr)) {
      return res.status(403).json({ status: 'error', code: 'OUTSIDE_LAB_NETWORK', message: `Exam access is only available from ${lab.lab_name} (${labCidr}).` });
    }

    req.labNetwork = { clientIp, cidr: labCidr, labId: lab.lab_id, labName: lab.lab_name };
    next();
  } catch (error) {
    console.error('Lab network resolution error:', error);
    res.status(500).json({ status: 'error', message: 'Could not validate the lab network.' });
  }
}
