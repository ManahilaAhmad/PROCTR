# PROCTR backend

Student submission files and their security reports are stored in Cloudinary.
PostgreSQL stores the file names, sizes, and Cloudinary asset identifiers in
`student_submission.submission_manifest`. Student and teacher dashboards keep
using the backend submission APIs to list, preview, and download submitted work.

Configure these required variables in `backend/.env`:

- `DATABASE_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Run `npm install` and `npm start` from `backend`. At startup, the backend adds the
nullable JSONB `submission_manifest` column if it does not exist. The database
account must be able to alter `student_submission`; existing rows are preserved.

New submissions have no local disk fallback. Cloudinary errors return a failed
submission response and preserve the previous submission. The desktop's local
`Submissions` directory is still the student's editable working folder; its
contents are uploaded when they submit. Browser localStorage is not used to
store submitted work.

Uploads use server-side signed requests and authenticated raw assets, preserving
source code, documents, binary files, and relative folder names. See Cloudinary's
[signed upload documentation](https://cloudinary.com/documentation/upload_images#generating_authentication_signatures)
and [raw file upload documentation](https://cloudinary.com/documentation/upload_parameters#uploading_non_media_files_as_raw_files).
Credentials stay on the backend. Empty files are represented by zero-byte
metadata and download as empty files without sending an empty upload to Cloudinary.

A submission supports up to 500 files, 10 MB per file, and 40 MB total decoded
file content. The desktop JSON request limit allows for base64 encoding.

To move existing submissions, keep their original folders under
`backend/uploads/submissions` and run this command from `backend`:

```sh
npm run migrate:submissions
```

From the project root, use `npm --prefix backend run migrate:submissions`.

If the project has moved, the migration can recover the relative folder after
`/uploads/submissions/` in an old database path, including Windows paths. It
reads that folder only from the current `backend/uploads/submissions`; it never
reads the old external location. Copy the original submission folders into this
current directory before migrating. Traversal and incomplete paths are rejected.

The migration processes only rows without a Cloudinary manifest. It reads each
existing security report, preserves nested and empty files, uploads to a new
cloud folder, downloads every asset to verify its bytes, and changes the database
pointer only after verification succeeds. It never deletes or changes local originals. Re-running skips rows
already migrated, and a concurrent new submission is not overwritten.
If the database update outcome is uncertain after a connection error, uploaded
assets are retained so a possibly committed submission remains readable.

The migration rejects source folders outside `backend/uploads/submissions`, symbolic
links/junctions, missing security reports, and files exceeding upload limits.
Failures are reported by submission ID and produce a nonzero exit code. Restore
missing originals to their recorded paths and resolve the reported issue before
retrying. Existing local submissions return a migration-required response until
migrated; the dashboards do not silently serve local copies.

Run the backend tests with a Node.js version supporting module mocks:

```sh
node --experimental-test-module-mocks --test
```
