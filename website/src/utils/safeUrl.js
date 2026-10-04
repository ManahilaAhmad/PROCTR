import { SERVER_BASE_URL } from '../config/apiConfig';

export function trustedFileUrl(value) {
  try {
    const url = new URL(String(value || ''));
    const backendOrigin = new URL(SERVER_BASE_URL).origin;
    const hostname = url.hostname.toLowerCase();
    const isCloudinary = url.protocol === 'https:' && (
      hostname === 'res.cloudinary.com'
      || hostname.endsWith('.cloudinary.com')
      || hostname.endsWith('.cloudinary.net')
    );
    if (url.origin === backendOrigin || isCloudinary) return url.toString();
  } catch {
    // Invalid and relative URLs are not trusted file destinations.
  }
  return null;
}

export function openTrustedFile(value) {
  const url = trustedFileUrl(value);
  if (!url) {
    window.alert('This file location is not trusted. Ask an administrator to verify the uploaded record.');
    return false;
  }
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) opened.opener = null;
  return Boolean(opened);
}
