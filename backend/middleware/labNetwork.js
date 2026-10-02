import { isIP } from 'node:net';

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

export function requireLabNetwork(req, res, next) {
  const clientIp = normalizeIp(req.socket.remoteAddress || '');
  const labCidr = process.env.LAB_NETWORK_CIDR || DEFAULT_LAB_CIDR;

  if (!isAllowedLabIp(clientIp, labCidr)) {
    return res.status(403).json({
      status: 'error',
      code: 'OUTSIDE_LAB_NETWORK',
      message: `Exam access is only available from the ${labCidr} lab network.`,
    });
  }

  req.labNetwork = { clientIp, cidr: labCidr };
  next();
}