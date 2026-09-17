const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const { createJob, jobDir, removeJob } = require('./src/jobs');
const { extractZipSafe, resolveEffectiveRoot, zipDirectory } = require('./src/utils/zip');
const { cloneRepo } = require('./src/utils/gitFetch');
const { convertProject } = require('./src/builders');

const PORT = process.env.PORT || 3000;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  dest: path.join(require('os').tmpdir(), 'any-to-wasm-uploads'),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

app.post('/api/convert', upload.single('zip'), async (req, res) => {
  const job = createJob();
  const uploadedZipPath = req.file ? req.file.path : null;

  try {
    if (uploadedZipPath) {
      extractZipSafe(uploadedZipPath, job.input);
    } else if (req.body && req.body.repoUrl) {
      const cloneTarget = path.join(job.input, 'repo');
      await cloneRepo(req.body.repoUrl, cloneTarget, { timeoutMs: 60_000 });
    } else {
      removeJob(job.id);
      return res.status(400).json({ error: 'Provide either a "zip" file upload or a "repoUrl" field.' });
    }

    const sourceRoot = resolveEffectiveRoot(job.input);
    const { detected, result, log, fellBack } = await convertProject(sourceRoot, job.output);

    const zipPath = path.join(job.dir, 'site.zip');
    await zipDirectory(job.output, zipPath);

    res.json({
      jobId: job.id,
      detected,
      result,
      log,
      fellBack: !!fellBack,
      previewUrl: `/api/preview/${job.id}/`,
      downloadUrl: `/api/download/${job.id}`,
    });
  } catch (err) {
    removeJob(job.id);
    res.status(400).json({ error: err.message || 'Conversion failed' });
  } finally {
    if (uploadedZipPath) fs.unlink(uploadedZipPath, () => {});
  }
});

app.get('/api/download/:jobId', (req, res) => {
  let dir;
  try {
    dir = jobDir(req.params.jobId);
  } catch {
    return res.status(400).send('Invalid job id');
  }
  const zipPath = path.join(dir, 'site.zip');
  if (!fs.existsSync(zipPath)) return res.status(404).send('Not found or expired');
  res.download(zipPath, 'website.zip');
});

app.use('/api/preview/:jobId', (req, res, next) => {
  let dir;
  try {
    dir = jobDir(req.params.jobId);
  } catch {
    return res.status(400).send('Invalid job id');
  }
  const outputDir = path.join(dir, 'output');
  if (!fs.existsSync(outputDir)) return res.status(404).send('Not found or expired');
  express.static(outputDir)(req, res, next);
});

app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: `File too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)` });
  }
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`any-to-wasm listening on http://localhost:${PORT}`);
});
