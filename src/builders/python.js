const fs = require('fs');
const path = require('path');
const { copyDir } = require('../utils/fsx');
const { renderSite } = require('./siteTemplate');

function findEntryFile(projectDir, files) {
  const pyFiles = files.filter((f) => f.endsWith('.py'));
  const byBasename = (name) => pyFiles.find((f) => path.basename(f) === name);
  const withMainGuard = pyFiles.filter((f) => {
    const text = fs.readFileSync(path.join(projectDir, f), 'utf8');
    return /if\s+__name__\s*==\s*['"]__main__['"]/.test(text);
  });
  return (
    byBasename('main.py') ||
    byBasename('app.py') ||
    withMainGuard[0] ||
    pyFiles[0] ||
    null
  );
}

async function buildPython({ projectDir, files }, outputDir, log) {
  const pyFiles = files.filter((f) => f.endsWith('.py'));
  if (pyFiles.length === 0) throw new Error('No Python source files found');

  const entryFile = findEntryFile(projectDir, files);
  log.push(`Found ${pyFiles.length} Python file(s). Using "${entryFile}" as the entry point.`);

  const pysrcDir = path.join(outputDir, 'pysrc');
  fs.mkdirSync(pysrcDir, { recursive: true });
  for (const rel of pyFiles) {
    const dest = path.join(pysrcDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(projectDir, rel), dest);
  }

  renderSite(outputDir, {
    title: `${entryFile} (Python → WebAssembly via Pyodide)`,
    bodyTemplate: 'python',
    entryFile,
    pyFiles,
  });

  log.push('Bundled Python sources under pysrc/ and generated a Pyodide-powered site.');
  log.push('Note: Pyodide (~10 MB) loads from a CDN at runtime; the site needs internet access to run.');
  return { type: 'python', entryFile };
}

module.exports = { buildPython };
