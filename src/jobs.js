const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(os.tmpdir(), 'any-to-wasm-jobs');
fs.mkdirSync(ROOT, { recursive: true });

const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

function createJob() {
  const id = crypto.randomBytes(9).toString('base64url');
  const dir = path.join(ROOT, id);
  const input = path.join(dir, 'input');
  const output = path.join(dir, 'output');
  fs.mkdirSync(input, { recursive: true });
  fs.mkdirSync(output, { recursive: true });
  return { id, dir, input, output, createdAt: Date.now() };
}

function jobDir(id) {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Invalid job id');
  return path.join(ROOT, id);
}

function removeJob(id) {
  try {
    fs.rmSync(jobDir(id), { recursive: true, force: true });
  } catch {
    /* already gone */
  }
}

function sweepOldJobs() {
  let entries;
  try {
    entries = fs.readdirSync(ROOT, { withFileTypes: true });
  } catch {
    return;
  }
  const now = Date.now();
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(ROOT, entry.name);
    try {
      const stat = fs.statSync(full);
      if (now - stat.mtimeMs > JOB_TTL_MS) {
        fs.rmSync(full, { recursive: true, force: true });
      }
    } catch {
      /* ignore races */
    }
  }
}

setInterval(sweepOldJobs, 5 * 60 * 1000).unref();

module.exports = { createJob, jobDir, removeJob, sweepOldJobs, ROOT, JOB_TTL_MS };
