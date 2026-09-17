const fs = require('fs');
const path = require('path');
const { renderSite } = require('./siteTemplate');

const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.pdf', '.zip',
  '.gz', '.tar', '.woff', '.woff2', '.ttf', '.eot', '.wasm', '.so', '.dll',
  '.dylib', '.exe', '.bin', '.class', '.jar', '.mp3', '.mp4', '.mov', '.wav',
]);

const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_FILES_SHOWN = 500;

async function buildGeneric({ projectDir, files, type }, outputDir, log, reason) {
  const textFiles = files.filter((f) => !BINARY_EXTS.has(path.extname(f).toLowerCase()));
  const srcDir = path.join(outputDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });

  let total = 0;
  const included = [];
  for (const rel of textFiles) {
    if (included.length >= MAX_FILES_SHOWN) break;
    const size = fs.statSync(path.join(projectDir, rel)).size;
    if (total + size > MAX_TOTAL_BYTES) continue;
    total += size;
    const dest = path.join(srcDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(projectDir, rel), dest);
    included.push(rel);
  }

  const note =
    reason ||
    `No supported wasm toolchain was available for this project (detected: ${type || 'unknown'}). Showing the source as a browsable static site instead.`;

  renderSite(outputDir, {
    title: 'Source code browser',
    bodyTemplate: 'generic',
    files: included,
    note,
  });

  log.push(`Packaged ${included.length} source file(s) as a browsable static site (no wasm compilation performed).`);
  if (included.length < textFiles.length) {
    log.push(`Skipped ${textFiles.length - included.length} additional file(s) to keep the download small.`);
  }
  return { type: 'generic' };
}

module.exports = { buildGeneric };
