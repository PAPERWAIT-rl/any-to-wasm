const fs = require('fs');
const AdmZip = require('adm-zip');
const archiver = require('archiver');
const path = require('path');

const MAX_EXTRACT_BYTES = 200 * 1024 * 1024; // 200 MB, guards against zip bombs
const MAX_EXTRACT_ENTRIES = 20000;

// Extract a zip, refusing entries that would escape `destDir` (zip-slip) and
// stopping if the archive is absurdly large or has too many entries.
function extractZipSafe(zipPath, destDir) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  if (entries.length > MAX_EXTRACT_ENTRIES) {
    throw new Error(`Zip has too many entries (>${MAX_EXTRACT_ENTRIES})`);
  }
  let totalSize = 0;
  const destResolved = path.resolve(destDir);
  for (const entry of entries) {
    const targetPath = path.resolve(destDir, entry.entryName);
    if (!targetPath.startsWith(destResolved + path.sep) && targetPath !== destResolved) {
      throw new Error(`Zip entry escapes destination: ${entry.entryName}`);
    }
    totalSize += entry.header.size;
    if (totalSize > MAX_EXTRACT_BYTES) {
      throw new Error(`Zip contents too large (>${MAX_EXTRACT_BYTES / 1024 / 1024} MB uncompressed)`);
    }
  }
  zip.extractAllTo(destDir, true);
}

// If the zip contained a single top-level folder (common for GitHub zip
// exports / drag-and-drop project folders), treat that folder as the root.
function resolveEffectiveRoot(destDir) {
  const entries = fs.readdirSync(destDir, { withFileTypes: true }).filter((e) => e.name !== '__MACOSX');
  if (entries.length === 1 && entries[0].isDirectory()) {
    return path.join(destDir, entries[0].name);
  }
  return destDir;
}

function zipDirectory(sourceDir, outZipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

module.exports = { extractZipSafe, resolveEffectiveRoot, zipDirectory };
