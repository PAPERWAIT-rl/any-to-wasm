const path = require('path');
const { copyDir, walk } = require('../utils/fsx');

async function buildWeb({ projectDir }, outputDir, log) {
  log.push('Found an existing static site (index.html). Copying as-is.');
  copyDir(projectDir, outputDir);
  const fileCount = walk(outputDir).length;
  log.push(`Copied ${fileCount} file(s) into the output site (already HTML/CSS/JS, no compilation needed).`);
  return { type: 'web' };
}

module.exports = { buildWeb };
