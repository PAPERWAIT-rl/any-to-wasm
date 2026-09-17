const fs = require('fs');
const path = require('path');
const { run, which } = require('../utils/run');
const { renderSite } = require('./siteTemplate');

async function buildGo({ projectDir, files }, outputDir, log) {
  const tinygo = await which('tinygo');
  if (!tinygo) {
    throw Object.assign(new Error('tinygo not found on server'), {
      fallbackReason:
        'Compiling Go to WebAssembly requires TinyGo, which is not installed on this server. Showing source instead.',
    });
  }

  const goFiles = files.filter((f) => f.endsWith('.go'));
  if (goFiles.length === 0) throw new Error('No Go source files found');
  const programName = path.basename(projectDir) || 'app';

  log.push(`Found TinyGo (${tinygo}). Building with target=wasip1...`);
  const outWasm = path.join(outputDir, 'app.wasm');
  const result = await run(
    tinygo,
    ['build', '-o', outWasm, '-target', 'wasip1', '-opt=2', '.'],
    { cwd: projectDir, timeoutMs: 120_000 }
  );
  log.push(result.stdout.trim());
  if (!result.ok || !fs.existsSync(outWasm)) {
    throw Object.assign(new Error('tinygo build failed'), { buildLog: result.stderr });
  }

  const wasmBytes = fs.statSync(outWasm).size;
  log.push(`Compiled ${(wasmBytes / 1024).toFixed(1)} KB WebAssembly module (wasip1).`);

  fs.copyFileSync(
    path.join(__dirname, '..', '..', 'templates', 'site', 'wasi-shim.js'),
    path.join(outputDir, 'wasi-shim.js')
  );

  renderSite(outputDir, {
    title: `${programName} (Go → WebAssembly)`,
    bodyTemplate: 'wasi',
    language: 'Go (TinyGo)',
    programName,
  });

  log.push('Generated static site: index.html, style.css, app.js, wasi-shim.js, app.wasm');
  return { type: 'go', programName };
}

module.exports = { buildGo };
