const { detectProject } = require('../detect');
const { buildRust } = require('./rust');
const { buildPython } = require('./python');
const { buildWeb } = require('./web');
const { buildGo } = require('./go');
const { buildC } = require('./cLang');
const { buildGeneric } = require('./generic');

async function convertProject(sourceDir, outputDir) {
  const log = [];
  const detected = detectProject(sourceDir);
  log.push(`Detected project type: ${detected.type}`);

  const dispatch = { rust: buildRust, python: buildPython, web: buildWeb, go: buildGo, 'c-cpp': buildC };
  const builder = dispatch[detected.type];

  if (!builder) {
    const result = await buildGeneric(detected, outputDir, log);
    return { detected: detected.type, result, log };
  }

  try {
    const result = await builder(detected, outputDir, log);
    return { detected: detected.type, result, log };
  } catch (err) {
    log.push(`Build failed: ${err.message}`);
    if (err.buildLog) log.push(String(err.buildLog).trim());
    const reason =
      err.fallbackReason ||
      `Automatic ${detected.type} → WebAssembly compilation failed. Showing the source as a browsable static site instead.`;
    const result = await buildGeneric(detected, outputDir, log, reason);
    return { detected: detected.type, result, log, fellBack: true };
  }
}

module.exports = { convertProject };
