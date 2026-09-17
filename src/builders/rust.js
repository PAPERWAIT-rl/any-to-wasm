const fs = require('fs');
const path = require('path');
const { run, which } = require('../utils/run');
const { renderSite } = require('./siteTemplate');

const WASM_TARGET = 'wasm32-wasip1';

function readCrateName(cargoTomlPath) {
  const text = fs.readFileSync(cargoTomlPath, 'utf8');
  const pkgSection = text.match(/\[package\][^[]*/);
  const nameMatch = (pkgSection ? pkgSection[0] : text).match(/name\s*=\s*"([^"]+)"/);
  return nameMatch ? nameMatch[1] : null;
}

function findMainRustFile(projectDir, files) {
  const rsFiles = files.filter((f) => f.endsWith('.rs'));
  const withMain = rsFiles.filter((f) => {
    const text = fs.readFileSync(path.join(projectDir, f), 'utf8');
    return /fn\s+main\s*\(/.test(text);
  });
  const preferred =
    withMain.find((f) => path.basename(f) === 'main.rs') || withMain[0] || rsFiles[0];
  return preferred || null;
}

async function ensureWasmTarget(log) {
  const rustup = await which('rustup');
  if (!rustup) return; // no rustup (e.g. a minimal toolchain) - just try the build and see
  const list = await run(rustup, ['target', 'list', '--installed'], { timeoutMs: 15_000 });
  if (list.ok && list.stdout.includes(WASM_TARGET)) return;
  log.push(`Installing rust target ${WASM_TARGET}...`);
  const add = await run(rustup, ['target', 'add', WASM_TARGET], { timeoutMs: 120_000 });
  if (!add.ok) log.push(`Warning: could not install ${WASM_TARGET}: ${add.stderr.trim()}`);
}

async function buildRust({ projectDir, hasCargo, files }, outputDir, log) {
  await ensureWasmTarget(log);

  let wasmPath;
  let programName;

  if (hasCargo) {
    const cargoToml = path.join(projectDir, 'Cargo.toml');
    programName = readCrateName(cargoToml) || 'app';
    log.push(`Found Cargo.toml (crate "${programName}"). Running cargo build --release --target ${WASM_TARGET}...`);
    const result = await run(
      'cargo',
      ['build', '--release', '--target', WASM_TARGET],
      { cwd: projectDir, timeoutMs: 180_000 }
    );
    log.push(result.stdout.trim());
    if (!result.ok) {
      throw Object.assign(new Error('cargo build failed'), { buildLog: result.stderr });
    }
    const releaseDir = path.join(projectDir, 'target', WASM_TARGET, 'release');
    const wasmFiles = fs.existsSync(releaseDir)
      ? fs.readdirSync(releaseDir).filter((f) => f.endsWith('.wasm'))
      : [];
    if (wasmFiles.length === 0) {
      throw Object.assign(new Error('cargo build produced no .wasm output'), {
        buildLog: result.stderr,
      });
    }
    wasmPath = path.join(releaseDir, wasmFiles.find((f) => f.includes(programName)) || wasmFiles[0]);
  } else {
    const mainFile = findMainRustFile(projectDir, files);
    if (!mainFile) throw new Error('No Rust source file with fn main() was found');
    programName = path.basename(mainFile, '.rs');
    log.push(`No Cargo.toml found. Compiling ${mainFile} directly with rustc...`);
    const buildTmp = path.join(outputDir, '..', 'rustc-build');
    fs.mkdirSync(buildTmp, { recursive: true });
    const outWasm = path.join(buildTmp, `${programName}.wasm`);
    const result = await run(
      'rustc',
      ['--edition', '2021', '--target', WASM_TARGET, '-O', '-o', outWasm, path.join(projectDir, mainFile)],
      { cwd: path.dirname(path.join(projectDir, mainFile)), timeoutMs: 120_000 }
    );
    log.push(result.stdout.trim());
    if (!result.ok || !fs.existsSync(outWasm)) {
      throw Object.assign(new Error('rustc compile failed'), { buildLog: result.stderr });
    }
    wasmPath = outWasm;
  }

  const wasmBytes = fs.statSync(wasmPath).size;
  log.push(`Compiled ${(wasmBytes / 1024).toFixed(1)} KB WebAssembly module (${WASM_TARGET}).`);

  fs.copyFileSync(wasmPath, path.join(outputDir, 'app.wasm'));
  fs.copyFileSync(
    path.join(__dirname, '..', '..', 'templates', 'site', 'wasi-shim.js'),
    path.join(outputDir, 'wasi-shim.js')
  );

  renderSite(outputDir, {
    title: `${programName} (Rust → WebAssembly)`,
    bodyTemplate: 'wasi',
    language: 'Rust',
    programName,
  });

  log.push('Generated static site: index.html, style.css, app.js, wasi-shim.js, app.wasm');
  return { type: 'rust', programName };
}

module.exports = { buildRust };
