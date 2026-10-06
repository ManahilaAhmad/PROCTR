import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';

// No real database connection, Cloudinary request, or environment file is used.
const REPORT_FILENAME = 'security_log_report.html';
let state;

function manifest(folder = 'submissions/teacher_33/exam_11/student_22/new') {
  const asset = (relative_path, file_size) => ({
    relative_path,
    file_size,
    public_id: `${folder}/${relative_path}`,
    resource_type: 'raw',
    type: 'authenticated'
  });
  return {
    version: 1,
    provider: 'cloudinary',
    folder,
    files: [asset('src/answer.txt', 6), asset('empty.txt', 0)],
    report: asset(REPORT_FILENAME, 100)
  };
}

const pool = {
  async query(sql, values) {
    state.poolQueries.push({ sql, values });
    if (state.poolReplies.length === 0) throw new Error('Unexpected pool query');
    return { rows: state.poolReplies.shift() };
  },
  async connect() {
    state.events.push('connect');
    if (state.connectError) throw state.connectError;
    return {
      async query(sql, values) {
        state.clientQueries.push({ sql, values });
        if (/^\s*BEGIN\b/i.test(sql)) state.events.push('begin');
        if (/pg_advisory_xact_lock/i.test(sql)) state.events.push('lock');
        if (/SELECT[\s\S]+FOR UPDATE/i.test(sql)) {
          state.events.push('previous');
          return { rows: state.previousManifest ? [{ submission_manifest: state.previousManifest }] : [] };
        }
        if (/INSERT INTO student_submission/i.test(sql)) {
          state.events.push('insert');
          if (state.insertError) throw state.insertError;
          return { rows: [{ submission_id: 44 }] };
        }
        if (/^\s*COMMIT\b/i.test(sql)) {
          state.events.push('commit');
          if (state.commitError) throw state.commitError;
        }
        if (/^\s*ROLLBACK\b/i.test(sql)) state.events.push('rollback');
        return { rows: [] };
      },
      release() { state.events.push('release'); }
    };
  }
};

mock.module('../db.js', { defaultExport: pool });
mock.module('../service/submissionStorage.js', {
  namedExports: {
    REPORT_FILENAME,
    prepareSubmissionFiles(files) {
      if (state.prepareError) throw state.prepareError;
      return files.map(file => ({
        relative_path: file.relativePath,
        buffer: Buffer.from(file.contentBase64, 'base64')
      }));
    },
    normalizeSubmissionPath(value) {
      if (typeof value !== 'string' || !value || value.includes('..') || value.startsWith('/')) {
        throw Object.assign(new Error('Invalid submission path'), { status: 400 });
      }
      return value.replaceAll('\\', '/');
    },
    async uploadSubmissionAssets(args) {
      state.events.push('upload');
      state.uploads.push(args);
      if (state.uploadError) throw state.uploadError;
      return state.newManifest;
    },
    async deleteSubmissionAssets(value) {
      state.responseSentAtCleanup = Boolean(state.responseSent);
      state.events.push(value === state.newManifest ? 'delete-new' : 'delete-old');
      state.deleted.push(value);
      if (state.deleteError) throw state.deleteError;
    },
    async readSubmissionAsset(value) {
      state.reads.push(value);
      if (state.readError) throw state.readError;
      return state.assetBuffer;
    }
  }
});

const controller = await import('../controllers/submissionController.js');

beforeEach(() => {
  state = {
    poolReplies: [], poolQueries: [], clientQueries: [], events: [],
    uploads: [], deleted: [], reads: [],
    newManifest: manifest(), previousManifest: null,
    assetBuffer: Buffer.from('answer')
  };
});

function response() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; state.responseSent = true; return this; },
    send(body) { this.body = body; return this; },
    attachment(filename) { return this.set('Content-Disposition', `attachment; filename="${filename}"`); },
    set(name, value) {
      if (typeof name === 'object') {
        for (const [key, item] of Object.entries(name)) this.set(key, item);
      } else this.headers[name.toLowerCase()] = value;
      return this;
    },
    get(name) { return this.headers[name.toLowerCase()]; },
    type(value) { return this.set('Content-Type', value); },
    setHeader(name, value) { return this.set(name, value); },
    header(name, value) { return this.set(name, value); }
  };
}

async function invoke(handler, request = {}) {
  const res = response();
  await controller[handler]({ params: {}, query: {}, body: {}, headers: {}, socket: {}, ...request }, res);
  return res;
}

function uploadRequest() {
  state.poolReplies = [
    [{ teacher_id: 33, course_code: 'CS101', course_title: 'Programming', section_name: 'A', exam_type: 'Final' }],
    [{ registration_no: 'REG22', name: 'Student <Name>' }],
    []
  ];
  return {
    body: {
      exam_id: 11, student_id: 22, mac_address: 'AA:BB:CC:DD:EE:FF',
      files: [
        { relativePath: 'src/answer.txt', contentBase64: Buffer.from('answer').toString('base64') },
        { relativePath: 'empty.txt', contentBase64: '' }
      ]
    },
    socket: { remoteAddress: '::ffff:127.0.0.1' }
  };
}

function storedSubmission(overrides = {}) {
  return {
    submission_id: 44,
    student_id: 22,
    teacher_id: 33,
    course_offering_id: 55,
    registration_no: 'REG22',
    submitted_at: '2026-09-25T12:00:00.000Z',
    submission_path: `cloudinary://${state.newManifest.folder}`,
    submission_manifest: state.newManifest,
    ...overrides
  };
}

test('upload persists the cloud manifest and deletes replaced assets only after commit', async () => {
  state.previousManifest = manifest('submissions/previous');
  const res = await invoke('uploadSubmission', uploadRequest());

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'success');
  assert.equal(res.body.submission_id, 44);
  assert.equal(res.body.file_count, 2);
  assert.equal(state.responseSentAtCleanup, true, 'slow cleanup must not delay the committed success response');
  assert.equal(state.uploads.length, 1);
  assert.equal(state.uploads[0].examId, 11);
  assert.equal(state.uploads[0].studentId, 22);
  assert.equal(state.uploads[0].teacherId, 33);
  assert.equal(state.uploads[0].files[1].buffer.length, 0);
  assert.match(state.uploads[0].reportHtml, /Student &lt;Name&gt;/);

  const insert = state.clientQueries.find(query => /INSERT INTO student_submission/i.test(query.sql));
  assert.match(insert.sql, /submission_manifest/);
  assert.ok(insert.values.includes(`cloudinary://${state.newManifest.folder}`));
  assert.ok(insert.values.some(value =>
    typeof value === 'string' && value.startsWith('{') &&
    JSON.stringify(JSON.parse(value)) === JSON.stringify(state.newManifest) || value === state.newManifest
  ));
  for (const [first, second] of [['upload', 'begin'], ['begin', 'lock'], ['lock', 'previous'], ['previous', 'insert'], ['insert', 'commit'], ['commit', 'delete-old']]) {
    assert.ok(state.events.indexOf(first) < state.events.indexOf(second), `${first} must occur before ${second}`);
  }
  assert.deepEqual(state.deleted, [state.previousManifest]);
  assert.ok(state.events.includes('release'));
  assert.ok(!state.events.includes('rollback'));
});

test('Cloudinary failure cannot create or report a successful submission', async () => {
  state.uploadError = new Error('Cloudinary unavailable');
  const res = await invoke('uploadSubmission', uploadRequest());

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.status, 'error');
  assert.ok(!state.events.includes('connect'));
  assert.equal(state.clientQueries.length, 0);
  assert.equal(state.deleted.length, 0);
});

test('database failure rolls back and removes only the newly uploaded assets', async () => {
  state.previousManifest = manifest('submissions/previous');
  state.insertError = new Error('Database write failed');
  const res = await invoke('uploadSubmission', uploadRequest());

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.status, 'error');
  assert.deepEqual(state.deleted, [state.newManifest]);
  assert.ok(state.events.includes('rollback'));
  assert.ok(!state.events.includes('commit'));
  assert.ok(state.events.includes('release'));
});

test('failure to acquire a database connection cleans up the uploaded assets', async () => {
  state.connectError = new Error('Database unavailable');
  const res = await invoke('uploadSubmission', uploadRequest());

  assert.equal(res.statusCode, 500);
  assert.deepEqual(state.deleted, [state.newManifest]);
  assert.equal(state.clientQueries.length, 0);
});

test('an uncertain commit retains both asset sets and never reports success', async () => {
  state.previousManifest = manifest('submissions/previous');
  state.commitError = new Error('Connection dropped while committing');
  const res = await invoke('uploadSubmission', uploadRequest());

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.status, 'error');
  assert.equal(res.body.message, 'Could not confirm the submission was saved. Please check your submitted work and retry.');
  assert.ok(state.events.includes('insert'));
  assert.ok(state.events.includes('commit'));
  assert.ok(state.events.includes('release'));
  assert.deepEqual(state.deleted, []);
});

test('failure to clean old assets does not undo the committed submission', async () => {
  state.previousManifest = manifest('submissions/previous');
  state.deleteError = new Error('Old asset deletion failed');
  const res = await invoke('uploadSubmission', uploadRequest());

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'success');
  assert.deepEqual(state.deleted, [state.previousManifest]);
  assert.ok(state.events.includes('commit'));
  assert.ok(!state.events.includes('rollback'));
});

test('invalid submitted files are rejected before cloud or database writes', async () => {
  state.prepareError = Object.assign(new Error('Invalid submission path'), { status: 400 });
  const res = await invoke('uploadSubmission', uploadRequest());

  assert.equal(res.statusCode, 400);
  assert.equal(state.uploads.length, 0);
  assert.equal(state.clientQueries.length, 0);
});

test('teacher student listing counts cloud files and excludes the report', async () => {
  state.poolReplies = [[{ teacher_id: 33 }], [storedSubmission({ name: 'Student' })]];
  const res = await invoke('getLabStudents', { params: { teacherId: '33', courseOfferingId: '55' } });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.students[0].file_count, 2);
  assert.match(state.poolQueries[1].sql, /submission_manifest/);
  assert.deepEqual(state.poolQueries[1].values, ['55']);
  assert.equal(state.reads.length, 0);
});

for (const handler of ['getLabStudents', 'getStudentSubmissionFiles']) {
  test(`${handler} denies a teacher who does not own the lab`, async () => {
    state.poolReplies = [[{ teacher_id: 99 }]];
    const res = await invoke(handler, { params: { teacherId: '33', courseOfferingId: '55', studentId: '22' } });

    assert.equal(res.statusCode, 403);
    assert.equal(state.poolQueries.length, 1);
    assert.equal(state.reads.length, 0);
  });
}

test('teacher file listing exposes file metadata and report availability from the manifest', async () => {
  state.poolReplies = [[{ teacher_id: 33 }], [storedSubmission()]];
  const res = await invoke('getStudentSubmissionFiles', {
    params: { teacherId: '33', courseOfferingId: '55', studentId: '22' }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.submission.has_report, true);
  assert.deepEqual(res.body.files, [
    { relative_path: 'src/answer.txt', file_size: 6 },
    { relative_path: 'empty.txt', file_size: 0 }
  ]);
  assert.match(state.poolQueries[1].sql, /submission_manifest/);
  assert.deepEqual(state.poolQueries[1].values, ['55', '22']);
});

test('student file listing is scoped to the student and excludes private cloud/report metadata', async () => {
  state.poolReplies = [[storedSubmission()]];
  const res = await invoke('getStudentOwnFiles', { params: { studentId: '22', courseOfferingId: '55' } });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.files, [
    { relative_path: 'src/answer.txt', file_size: 6, submission_id: 44 },
    { relative_path: 'empty.txt', file_size: 0, submission_id: 44 }
  ]);
  assert.deepEqual(state.poolQueries[0].values, ['55', '22']);
  assert.match(state.poolQueries[0].sql, /ss\.student_id\s*=\s*\$2/);
  assert.match(state.poolQueries[0].sql, /submission_manifest/);
  assert.ok(!JSON.stringify(res.body).includes(REPORT_FILENAME));
  assert.ok(!JSON.stringify(res.body).includes('public_id'));
});

test('student lab listing queries only the requested student', async () => {
  state.poolReplies = [[{ course_offering_id: 55, course_code: 'CS101', course_title: 'Programming', section_name: 'A', submitted_at: '2026-09-25' }]];
  const res = await invoke('getStudentOwnLabs', { params: { studentId: '22' } });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.labs[0].course_offering_id, 55);
  assert.deepEqual(state.poolQueries[0].values, ['22']);
  assert.match(state.poolQueries[0].sql, /ss\.student_id\s*=\s*\$1/);
});

for (const identity of [{ studentId: '22' }, { teacherId: '33' }]) {
  test(`owning ${Object.keys(identity)[0]} can download exactly the requested manifest asset`, async () => {
    state.poolReplies = [[storedSubmission()]];
    const res = await invoke('downloadFile', {
      params: { submissionId: '44' },
      query: { relativePath: 'src/answer.txt', download: 'true', ...identity }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, state.assetBuffer);
    assert.deepEqual(state.reads, [state.newManifest.files[0]]);
    assert.match(res.get('Content-Disposition'), /^attachment;.*answer\.txt/);
    assert.match(state.poolQueries[0].sql, /submission_manifest/);
    assert.deepEqual(state.poolQueries[0].values, ['44']);
  });
}

test('preview streams the cloud file with inline disposition', async () => {
  state.poolReplies = [[storedSubmission()]];
  const res = await invoke('downloadFile', {
    params: { submissionId: '44' }, query: { relativePath: 'src/answer.txt', studentId: '22' }
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, state.assetBuffer);
  assert.match(res.get('Content-Disposition'), /^inline;/);
});

for (const query of [{ studentId: '99' }, { teacherId: '99' }, {}]) {
  test(`file download denies unauthorized identity ${JSON.stringify(query)}`, async () => {
    state.poolReplies = [[storedSubmission()]];
    const res = await invoke('downloadFile', {
      params: { submissionId: '44' }, query: { relativePath: 'src/answer.txt', ...query }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(state.reads.length, 0);
  });
}

for (const relativePath of [REPORT_FILENAME, 'unlisted.txt', '../src/answer.txt']) {
  test(`ordinary file endpoint never reads ${relativePath}`, async () => {
    state.poolReplies = [[storedSubmission()]];
    const res = await invoke('downloadFile', {
      params: { submissionId: '44' }, query: { relativePath, studentId: '22' }
    });

    assert.ok(res.statusCode >= 400 && res.statusCode < 500);
    assert.equal(state.reads.length, 0);
  });
}

test('report endpoint lets only the owning teacher retrieve the manifest report', async () => {
  state.poolReplies = [[storedSubmission()]];
  const res = await invoke('downloadReport', {
    params: { submissionId: '44', teacherId: '33' }, query: { download: 'true' }
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(state.reads, [state.newManifest.report]);
  assert.deepEqual(res.body, state.assetBuffer);
  assert.match(res.get('Content-Disposition'), /^attachment;.*security_log_REG22\.html/);
  assert.match(state.poolQueries[0].sql, /submission_manifest/);
});

test('report endpoint denies a different teacher before reading cloud data', async () => {
  state.poolReplies = [[storedSubmission()]];
  const res = await invoke('downloadReport', { params: { submissionId: '44', teacherId: '99' } });

  assert.equal(res.statusCode, 403);
  assert.equal(state.reads.length, 0);
});

for (const handler of ['downloadFile', 'downloadReport']) {
  test(`${handler} returns a cloud read failure as 502 JSON without sending an attachment`, async () => {
    state.poolReplies = [[storedSubmission()]];
    state.readError = Object.assign(new Error('Cloudinary asset fetch failed'), { status: 502 });
    const res = await invoke(handler, {
      params: { submissionId: '44', teacherId: '33' },
      query: { relativePath: 'src/answer.txt', studentId: '22', download: 'true' }
    });

    assert.equal(res.statusCode, 502);
    assert.equal(res.body.status, 'error');
    assert.equal(typeof res.body.message, 'string');
    assert.ok(!Buffer.isBuffer(res.body));
    assert.equal(res.get('Content-Disposition'), undefined);
    assert.deepEqual(state.reads, [handler === 'downloadFile' ? state.newManifest.files[0] : state.newManifest.report]);
  });
}

for (const handler of ['getStudentSubmissionFiles', 'getStudentOwnFiles', 'downloadFile', 'downloadReport']) {
  test(`${handler} returns a migration conflict for legacy local storage`, async () => {
    const legacy = storedSubmission({ submission_manifest: null, submission_path: 'C:\\old-server\\uploads\\submission' });
    state.poolReplies = handler === 'getStudentSubmissionFiles' ? [[{ teacher_id: 33 }], [legacy]] : [[legacy]];
    const res = await invoke(handler, {
      params: { teacherId: '33', studentId: '22', courseOfferingId: '55', submissionId: '44' },
      query: { relativePath: 'src/answer.txt', studentId: '22' }
    });

    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /migrat/i);
    assert.equal(state.reads.length, 0);
  });
}
