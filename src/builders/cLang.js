const fs = require('fs');
const path = require('path');
const { run, which } = require('../utils/run');

async function buildC({ projectDir, files }, outputDir, log) {
  const emcc = await which('emcc');
  if (!emcc) {
    throw Object.assign(new Error('emcc not found on server'), {
      fallbackReason:
        'Compiling C/C++ to WebAssembly requires Emscripten (emcc), which is not installed on this server. Showing source instead.',
    });
  }

  const sources = files.filter((f) => /\.(c|cpp|cc|cxx)$/i.test(f));
  if (sources.length === 0) throw new Error('No C/C++ source files found');

  log.push(`Found Emscripten (${emcc}). Compiling ${sources.length} source file(s)...`);
  const outHtml = path.join(outputDir, 'index.html');
  const result = await run(
    emcc,
    [...sources, '-O2', '-s', 'ALLOW_MEMORY_GROWTH=1', '-o', outHtml],
    { cwd: projectDir, timeoutMs: 180_000 }
  );
  log.push(result.stdout.trim());
  if (!result.ok || !fs.existsSync(outHtml)) {
    throw Object.assign(new Error('emcc build failed'), { buildLog: result.stderr });
  }

  log.push('Compiled to WebAssembly with Emscripten (index.html + glue JS + .wasm).');
  return { type: 'c-cpp' };
}

module.exports = { buildC };
