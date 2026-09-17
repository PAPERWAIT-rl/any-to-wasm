const fs = require('fs');
const path = require('path');

const DEFAULT_IGNORES = new Set(['.git', 'node_modules', 'target', '.DS_Store']);

function walk(dir, { ignore = DEFAULT_IGNORES, base = dir, maxFiles = 20000 } = {}, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignore.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, { ignore, base, maxFiles }, out);
    } else if (entry.isFile()) {
      out.push(path.relative(base, full));
      if (out.length > maxFiles) throw new Error(`Too many files in project (>${maxFiles})`);
    }
    if (out.length > maxFiles) throw new Error(`Too many files in project (>${maxFiles})`);
  }
  return out;
}

function copyDir(src, dest, { ignore = DEFAULT_IGNORES } = {}) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (ignore.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d, { ignore });
    else fs.copyFileSync(s, d);
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function totalSize(dir, ignore = DEFAULT_IGNORES) {
  let size = 0;
  for (const rel of walk(dir, { ignore })) {
    size += fs.statSync(path.join(dir, rel)).size;
  }
  return size;
}

module.exports = { walk, copyDir, ensureDir, totalSize, DEFAULT_IGNORES };
