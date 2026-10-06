import { randomUUID, createHash } from 'node:crypto';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

export const REPORT_FILENAME = 'security_log_report.html';
const MAX_FILES = 500;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_SUBMISSION_BYTES = 40 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 60_000;
const UPLOAD_RETRY_LIMIT = 3;

function storageError(message, status) {
  return Object.assign(new Error(message), { status });
}

export function assertCloudinaryConfigured() {
  const config = {
    cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
    api_key: (process.env.CLOUDINARY_API_KEY || '').trim(),
    api_secret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
    secure: true
  };
  if (!config.cloud_name || !config.api_key || !config.api_secret) {
    throw storageError('Cloud submission storage is not configured.', 503);
  }
  cloudinary.config(config);
}

export function normalizeSubmissionPath(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath || relativePath.length > 4096 ||
      /[\x00-\x1f\x7f-\x9f:<>"|?*]/.test(relativePath)) {
    throw storageError('Each submitted file must have a valid relative path.', 400);
  }
  const normalized = relativePath.replace(/\\/g, '/');
  if (path.posix.isAbsolute(normalized) || path.win32.isAbsolute(relativePath) ||
      normalized.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw storageError('Submitted file paths must be relative and cannot contain traversal segments.', 400);
  }
  return normalized;
}

export function prepareSubmissionFiles(files) {
  if (!Array.isArray(files)) throw storageError('files must be an array.', 400);
  if (files.length > MAX_FILES) throw storageError(`A submission can contain at most ${MAX_FILES} files.`, 413);
  const seen = new Set();
  let totalBytes = 0;
  return files.map(file => {
    if (!file || typeof file !== 'object') throw storageError('Invalid submitted file.', 400);
    const relative_path = normalizeSubmissionPath(file.relativePath);
    if (seen.has(relative_path)) throw storageError('Submission contains duplicate file paths.', 400);
    seen.add(relative_path);
    const encoded = file.contentBase64;
    if (typeof encoded !== 'string') throw storageError('Each submitted file must contain base64 content.', 400);
    // Check encoded length before allocating a decoded buffer. Comparing the
    // canonical encoding also rejects bad padding and non-zero padding bits.
    if (encoded.length > 4 * Math.ceil(MAX_FILE_BYTES / 3)) {
      throw storageError('Each submitted file must be 10 MB or smaller.', 413);
    }
    if (encoded.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(encoded)) {
      throw storageError('Submitted file content is not valid base64.', 400);
    }
    const buffer = Buffer.from(encoded, 'base64');
    if (buffer.toString('base64') !== encoded) throw storageError('Submitted file content is not valid base64.', 400);
    if (buffer.length > MAX_FILE_BYTES) throw storageError('Each submitted file must be 10 MB or smaller.', 413);
    totalBytes += buffer.length;
    if (totalBytes > MAX_SUBMISSION_BYTES) throw storageError('A submission must be 40 MB or smaller.', 413);
    return { relative_path, buffer };
  });
}

function identifier(value) {
  const result = String(value ?? '');
  if (!/^[A-Za-z0-9_-]+$/.test(result) || result.length > 100) {
    throw storageError('Invalid submission owner or exam identifier.', 400);
  }
  return result;
}

function isTransientUploadError(error) {
  return ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH'].includes(error?.code);
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function uploadBufferOnce(buffer, publicId) {
  return new Promise((resolve, reject) => {
    // Node 24 can keep TLS connections alive by default. A fresh connection
    // avoids reusing a Cloudinary socket that a campus proxy has reset.
    const agent = new https.Agent({ keepAlive: false, maxSockets: 1 });
    const stream = cloudinary.uploader.upload_stream({
      public_id: publicId,
      resource_type: 'raw',
      type: 'authenticated',
      // A retry after a lost response may find that Cloudinary accepted the
      // first request. Reusing this UUID with overwrite makes that retry
      // idempotent instead of creating duplicate submission assets.
      overwrite: true,
      timeout: REQUEST_TIMEOUT_MS,
      agent,
      disable_promise: true
    }, (error, result) => {
      agent.destroy();
      if (error || !result?.public_id) reject(error || new Error('Missing upload result.'));
      else resolve(result);
    });
    stream.once('error', error => { agent.destroy(); reject(error); });
    stream.end(buffer);
  });
}

async function uploadBuffer(buffer, publicId) {
  let lastError;
  for (let attempt = 1; attempt <= UPLOAD_RETRY_LIMIT; attempt += 1) {
    try {
      return await uploadBufferOnce(buffer, publicId);
    } catch (error) {
      lastError = error;
      if (!isTransientUploadError(error) || attempt === UPLOAD_RETRY_LIMIT) throw error;
      await wait(500 * attempt);
    }
  }
  throw lastError;
}

export async function uploadSubmissionAssets({ examId, studentId, teacherId, files, reportHtml }) {
  assertCloudinaryConfigured();
  const folder = `proctr/submissions/teacher_${identifier(teacherId)}/exam_${identifier(examId)}/student_${identifier(studentId)}/${randomUUID()}`;
  const manifest = { version: 1, provider: 'cloudinary', folder, files: [], report: null };
  const uploadAsset = async (relativePath, buffer) => {
    const asset = {
      relative_path: relativePath,
      file_size: buffer.length,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      public_id: null,
      resource_type: 'raw',
      type: 'authenticated'
    };
    // Cloudinary rejects zero-byte uploads. Their paths and exact size are
    // persisted in the database manifest and recreated on download.
    if (buffer.length) {
      const extension = path.posix.extname(relativePath).replace(/[^A-Za-z0-9._-]/g, '_');
      const result = await uploadBuffer(buffer, `${folder}/${randomUUID()}${extension}`);
      asset.public_id = result.public_id;
    }
    return asset;
  };
  try {
    // Sequential uploads make failure cleanup deterministic: no upload can
    // complete after cleanup has started.
    for (const file of files) {
      manifest.files.push(await uploadAsset(file.relative_path, file.buffer));
    }
    manifest.report = await uploadAsset(REPORT_FILENAME, Buffer.from(reportHtml, 'utf8'));
    return manifest;
  } catch (error) {
    console.error('[Submissions] Cloudinary upload failed:', error?.http_code || error?.code || error?.message || 'unknown error');
    await deleteSubmissionAssets(manifest);
    throw storageError('Cloud submission upload failed. Please retry.', 502);
  }
}

export async function deleteSubmissionAssets(manifest) {
  if (manifest?.provider !== 'cloudinary') return;
  const assets = [...(Array.isArray(manifest.files) ? manifest.files : []), manifest.report];
  const publicIds = [...new Set(assets.filter(asset => asset?.public_id &&
    asset.resource_type === 'raw' && asset.type === 'authenticated').map(asset => asset.public_id))];
  if (!publicIds.length) return;
  try {
    assertCloudinaryConfigured();
  } catch {
    console.warn('[Submissions] Cloud asset cleanup could not run: storage is not configured.');
    return;
  }
  for (const publicId of publicIds) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw', type: 'authenticated', invalidate: true, timeout: REQUEST_TIMEOUT_MS
      });
      if (!['ok', 'not found'].includes(result?.result)) throw new Error('Cleanup failed.');
    } catch {
      // Never log SDK errors: they may include signed URLs or credentials.
      console.warn('[Submissions] A cloud asset could not be cleaned up.');
    }
  }
}

export async function readSubmissionAsset(asset) {
  if (!asset || asset.resource_type !== 'raw' || asset.type !== 'authenticated' ||
      !Number.isSafeInteger(asset.file_size) || asset.file_size < 0) {
    throw storageError('Cloud submission metadata is invalid.', 502);
  }
  if (asset.file_size === 0 && asset.public_id === null) return Buffer.alloc(0);
  assertCloudinaryConfigured();
  if (typeof asset.public_id !== 'string' || !asset.public_id) {
    throw storageError('Cloud submission metadata is invalid.', 502);
  }
  try {
    // Raw public IDs already include their extension. A separate format
    // would address a different asset. The URL is never sent to the browser.
    const url = cloudinary.utils.private_download_url(asset.public_id, undefined, {
      resource_type: 'raw',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 300,
      secure: true
    });
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) throw new Error('Cloud download failed.');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length !== asset.file_size) throw new Error('Cloud download was incomplete.');
    if (asset.sha256 && createHash('sha256').update(buffer).digest('hex') !== asset.sha256) throw new Error('Cloud file integrity check failed.');
    return buffer;
  } catch {
    throw storageError('Unable to retrieve the submitted file from cloud storage. Please retry.', 502);
  }
}
