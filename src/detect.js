const fs = require('fs');
const path = require('path');
const { walk } = require('./utils/fsx');

// Find the shallowest directory containing a marker file, searching down
// from `root` a few levels (project might be nested one folder in, e.g. a
// GitHub zip export or a repo with a single top-level folder).
function findMarkerDir(root, files, markerNames) {
  const hit = files.find((f) => markerNames.includes(path.basename(f)));
  return hit ? path.join(root, path.dirname(hit)) : null;
}

function detectProject(root) {
  const files = walk(root);
  const exts = files.map((f) => path.extname(f).toLowerCase());
  const count = (ext) => exts.filter((e) => e === ext).length;

  const cargoDir = findMarkerDir(root, files, ['Cargo.toml']);
  if (cargoDir || count('.rs') > 0) {
    return {
      type: 'rust',
      projectDir: cargoDir || root,
      hasCargo: !!cargoDir,
      files,
    };
  }

  const goModDir = findMarkerDir(root, files, ['go.mod']);
  if (goModDir || count('.go') > 0) {
    return { type: 'go', projectDir: goModDir || root, files };
  }

  if (count('.c') > 0 || count('.cpp') > 0 || count('.cc') > 0 || count('.h') > 0) {
    return { type: 'c-cpp', projectDir: root, files };
  }

  // Web project: has an index.html somewhere shallow-ish.
  const indexHtml = files.find(
    (f) => path.basename(f).toLowerCase() === 'index.html' && f.split(path.sep).length <= 3
  );
  if (indexHtml) {
    return { type: 'web', projectDir: path.join(root, path.dirname(indexHtml)), files };
  }

  if (count('.py') > 0) {
    return { type: 'python', projectDir: root, files };
  }

  return { type: 'unknown', projectDir: root, files };
}

module.exports = { detectProject };
