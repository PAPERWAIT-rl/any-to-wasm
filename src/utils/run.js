const { execFile } = require('child_process');

// Run a command with argv (never a shell string) so user-controlled paths
// can't be used for command injection, plus a hard timeout so a malicious
// or runaway build (infinite loop in a build.rs, a fork bomb, etc.) can't
// hang the server indefinitely.
function run(cmd, args, { cwd, timeoutMs = 60_000, maxBuffer = 16 * 1024 * 1024, env } = {}) {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { cwd, timeout: timeoutMs, maxBuffer, env: env || process.env },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          code: error ? error.code : 0,
          killed: !!(error && error.killed),
          stdout: stdout || '',
          stderr: stderr || (error ? String(error.message) : ''),
        });
      }
    );
  });
}

function which(cmd) {
  return new Promise((resolve) => {
    execFile(process.platform === 'win32' ? 'where' : 'which', [cmd], (error, stdout) => {
      resolve(!error && stdout.trim().length > 0 ? stdout.trim().split('\n')[0] : null);
    });
  });
}

module.exports = { run, which };
