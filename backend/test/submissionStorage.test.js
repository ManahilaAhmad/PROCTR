import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { Writable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import {
  REPORT_FILENAME, assertCloudinaryConfigured, normalizeSubmissionPath,
  prepareSubmissionFiles, uploadSubmissionAssets, deleteSubmissionAssets, readSubmissionAsset
} from '../service/submissionStorage.js';

const envKeys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
let originalEnv;
let originalConfig;

beforeEach(() => {
  originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  originalConfig = { ...cloudinary.config() };
  process.env.CLOUDINARY_CLOUD_NAME = 'submission-test';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
});

afterEach(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  cloudinary.config(originalConfig);
});

const sourceFile = (relativePath = 'src/main.py', content = 'print("submitted")') => ({
  relativePath, contentBase64: Buffer.from(content).toString('base64')
});

function mockUploads(t, failAt = -1) {
  const uploads = [];
  t.mock.method(cloudinary.uploader, 'upload_stream', (options, callback) => {
    const entry = { options, chunks: [] };
    uploads.push(entry);
    return new Writable({
      write(chunk, encoding, done) { entry.chunks.push(Buffer.from(chunk)); done(); },
      final(done) {
        if (uploads.length === failAt) callback(new Error('secret upstream details'));
        else callback(null, { public_id: options.public_id });
        done();
      }
    });
  });
  const deleted = [];
  t.mock.method(cloudinary.uploader, 'destroy', async (publicId, options) => {
    deleted.push({ publicId, options });
    return { result: 'ok' };
  });
  return { uploads, deleted };
}

const uploadInput = files => ({
  examId: 17, studentId: 23, teacherId: 4,
  files: prepareSubmissionFiles(files), reportHtml: '<html>Security report</html>'
});

test('normalizes Windows paths and preserves nested filenames', () => {
  assert.equal(normalizeSubmissionPath('project\\src\\main.py'), 'project/src/main.py');
  assert.equal(normalizeSubmissionPath('project/report final.txt'), 'project/report final.txt');
});

test('rejects traversal, absolute paths, empty segments, streams, and controls', () => {
  for (const path of ['', null, '../secret', 'src/../secret', './main.py', 'src/./main.py',
    '/etc/passwd', 'C:\\file.txt', 'C:relative.txt', '\\\\server\\file', 'src//main.py',
    'src/', 'file.txt:stream', 'file\u0000.txt', 'file\n.txt']) {
    assert.throws(() => normalizeSubmissionPath(path), { status: 400 });
  }
});

test('prepares binary and empty files without discarding either', () => {
  const binary = Buffer.from([0, 255, 42, 128]);
  const result = prepareSubmissionFiles([
    { relativePath: 'data.bin', contentBase64: binary.toString('base64') },
    sourceFile('empty.txt', '')
  ]);
  assert.deepEqual(result, [
    { relative_path: 'data.bin', buffer: binary },
    { relative_path: 'empty.txt', buffer: Buffer.alloc(0) }
  ]);
  assert.deepEqual(prepareSubmissionFiles([]), []);
});

test('rejects malformed input and duplicate normalized paths', () => {
  for (const files of [null, {}, [null], [{ relativePath: 'main.py' }],
    [sourceFile('src/main.py'), sourceFile('src\\main.py')]]) {
    assert.throws(() => prepareSubmissionFiles(files), { status: 400 });
  }
  for (const contentBase64 of ['a', 'Zg', 'Zg=', 'Zg===', 'Zh==', 'Zg==\n',
    'data:text/plain;base64,Zg==', '====', 'Z===', '-w==', 42]) {
    assert.throws(() => prepareSubmissionFiles([{ relativePath: 'a.txt', contentBase64 }]), { status: 400 });
  }
});

test('enforces file count, individual size, and aggregate decoded size', () => {
  assert.throws(() => prepareSubmissionFiles(Array.from({ length: 501 }, (_, i) => sourceFile(`${i}.txt`, ''))), { status: 413 });
  const tenMb = Buffer.alloc(10 * 1024 * 1024).toString('base64');
  assert.equal(prepareSubmissionFiles([{ relativePath: 'max.bin', contentBase64: tenMb }])[0].buffer.length, 10 * 1024 * 1024);
  assert.throws(() => prepareSubmissionFiles([
    { relativePath: 'large.bin', contentBase64: Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64') }
  ]), { status: 413 });
  assert.throws(() => prepareSubmissionFiles(Array.from({ length: 5 }, (_, i) => ({ relativePath: `${i}.bin`, contentBase64: tenMb }))), { status: 413 });
});

test('uploads private raw buffers and persists empty files as metadata', async t => {
  const { uploads, deleted } = mockUploads(t);
  const manifest = await uploadSubmissionAssets(uploadInput([sourceFile(), sourceFile('empty.txt', '')]));
  assert.equal(manifest.provider, 'cloudinary');
  assert.equal(manifest.version, 1);
  assert.match(manifest.folder, /^proctr\/submissions\/teacher_4\/exam_17\/student_23\/[0-9a-f-]{36}$/);
  assert.equal(uploads.length, 2);
  assert.equal(manifest.files.length, 2);
  assert.equal(manifest.files[0].relative_path, 'src/main.py');
  assert.equal(manifest.files[1].public_id, null);
  assert.equal(manifest.files[1].file_size, 0);
  assert.equal(manifest.report.relative_path, REPORT_FILENAME);
  assert.equal(Buffer.concat(uploads[0].chunks).toString(), 'print("submitted")');
  assert.equal(Buffer.concat(uploads[1].chunks).toString(), '<html>Security report</html>');
  for (const { options } of uploads) {
    assert.equal(options.resource_type, 'raw');
    assert.equal(options.type, 'authenticated');
    assert.equal(options.overwrite, false);
    assert.ok(options.public_id.startsWith(`${manifest.folder}/`));
  }
  assert.match(manifest.files[0].public_id, /\.py$/);
  assert.match(manifest.report.public_id, /\.html$/);
  assert.equal(deleted.length, 0);
});

test('uses separate folders for every upload attempt and exam', async t => {
  mockUploads(t);
  const first = await uploadSubmissionAssets(uploadInput([]));
  const second = await uploadSubmissionAssets(uploadInput([]));
  const anotherExam = await uploadSubmissionAssets({ ...uploadInput([]), examId: 18 });
  assert.notEqual(first.folder, second.folder);
  assert.match(anotherExam.folder, /\/exam_18\//);
});

test('cleans successful uploads when a file upload fails and sanitizes errors', async t => {
  const { uploads, deleted } = mockUploads(t, 2);
  await assert.rejects(uploadSubmissionAssets(uploadInput([sourceFile('a.py'), sourceFile('b.py')])), {
    status: 502, message: 'Cloud submission upload failed. Please retry.'
  });
  assert.equal(uploads.length, 2);
  assert.deepEqual(deleted.map(item => item.publicId), [uploads[0].options.public_id]);
  assert.equal(deleted[0].options.resource_type, 'raw');
  assert.equal(deleted[0].options.type, 'authenticated');
});

test('cleans uploaded files if the security report upload fails', async t => {
  const { uploads, deleted } = mockUploads(t, 2);
  await assert.rejects(uploadSubmissionAssets(uploadInput([sourceFile()])), { status: 502 });
  assert.deepEqual(deleted.map(item => item.publicId), [uploads[0].options.public_id]);
});

test('handles upload stream errors', async t => {
  t.mock.method(cloudinary.uploader, 'upload_stream', () => new Writable({
    write(chunk, encoding, callback) { callback(new Error('secret stream error')); }
  }));
  await assert.rejects(uploadSubmissionAssets(uploadInput([sourceFile()])), { status: 502 });
});

test('missing Cloudinary credentials fail without uploading or writing locally', async t => {
  const { uploads } = mockUploads(t);
  process.env.CLOUDINARY_API_SECRET = ' ';
  assert.throws(() => assertCloudinaryConfigured(), { status: 503 });
  await assert.rejects(uploadSubmissionAssets(uploadInput([sourceFile()])), { status: 503 });
  assert.equal(uploads.length, 0);
});

test('cleanup only destroys listed raw authenticated assets, continues on failure', async t => {
  const deleted = [];
  const warnings = [];
  t.mock.method(console, 'warn', warning => warnings.push(warning));
  t.mock.method(cloudinary.uploader, 'destroy', async publicId => {
    deleted.push(publicId);
    if (publicId === 'first') throw new Error('secret credentials');
    return { result: 'ok' };
  });
  const asset = public_id => ({ public_id, resource_type: 'raw', type: 'authenticated' });
  await deleteSubmissionAssets({ provider: 'cloudinary', files: [asset('first'), asset('second'), asset('first'), asset(null)], report: asset('report') });
  assert.deepEqual(deleted, ['first', 'second', 'report']);
  assert.equal(warnings.length, 1);
  assert.ok(!warnings[0].includes('secret'));
  await deleteSubmissionAssets(null);
  await deleteSubmissionAssets({ provider: 'local', files: [asset('unrelated')] });
  assert.equal(deleted.length, 3);
});

test('downloads bytes through a short-lived signed authenticated API URL', async t => {
  const bytes = Buffer.from('submitted source');
  let signedOptions;
  let fetchOptions;
  t.mock.method(cloudinary.utils, 'private_download_url', (id, format, options) => {
    assert.equal(id, 'submission/main.py');
    assert.equal(format, undefined);
    signedOptions = options;
    return 'https://api.cloudinary.com/test/raw/download?signed=true';
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.cloudinary.com/test/raw/download?signed=true');
    fetchOptions = options;
    return new Response(bytes);
  });
  const before = Math.floor(Date.now() / 1000);
  const result = await readSubmissionAsset({ public_id: 'submission/main.py', resource_type: 'raw', type: 'authenticated', file_size: bytes.length });
  assert.deepEqual(result, bytes);
  assert.equal(signedOptions.resource_type, 'raw');
  assert.equal(signedOptions.type, 'authenticated');
  assert.ok(signedOptions.expires_at >= before + 300 && signedOptions.expires_at <= Math.floor(Date.now() / 1000) + 300);
  assert.ok(fetchOptions.signal instanceof AbortSignal);
});

test('empty file downloads need no cloud request', async t => {
  t.mock.method(globalThis, 'fetch', () => { assert.fail('Empty files must not make a network request.'); });
  assert.deepEqual(await readSubmissionAsset({ public_id: null, resource_type: 'raw', type: 'authenticated', file_size: 0 }), Buffer.alloc(0));
});

test('download HTTP, network, and incomplete-body failures are sanitized', async t => {
  t.mock.method(cloudinary.utils, 'private_download_url', () => 'https://api.cloudinary.com/test/raw/download');
  const asset = { public_id: 'file.txt', resource_type: 'raw', type: 'authenticated', file_size: 4 };
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('secret', { status: 403 }));
  await assert.rejects(readSubmissionAsset(asset), { status: 502, message: 'Unable to retrieve the submitted file from cloud storage. Please retry.' });
  mock.mock.mockImplementation(async () => { throw new Error('secret signed URL'); });
  await assert.rejects(readSubmissionAsset(asset), { status: 502 });
  mock.mock.mockImplementation(async () => new Response('a'));
  await assert.rejects(readSubmissionAsset(asset), { status: 502 });
});
