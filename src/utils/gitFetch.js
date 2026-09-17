const { run } = require('./run');

const URL_RE = /^https:\/\/[a-zA-Z0-9.-]+(:[0-9]+)?\/[\w.\-/]+?(\.git)?\/?$/;

function assertSafeRepoUrl(url) {
  if (typeof url !== 'string' || url.length > 500) {
    throw new Error('Invalid repository URL');
  }
  if (!URL_RE.test(url)) {
    throw new Error('Only plain https:// git repository URLs are supported');
  }
}

async function cloneRepo(url, destDir, { timeoutMs = 60_000 } = {}) {
  assertSafeRepoUrl(url);
  const result = await run(
    'git',
    ['clone', '--depth', '1', '--single-branch', '--', url, destDir],
    { timeoutMs, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }
  );
  if (!result.ok) {
    throw new Error(`git clone failed: ${result.stderr.trim() || result.stdout.trim()}`);
  }
}

module.exports = { cloneRepo, assertSafeRepoUrl };
