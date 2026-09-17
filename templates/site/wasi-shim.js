// Minimal WASI (wasi_snapshot_preview1) shim, just enough to run a Rust/C
// binary compiled for `wasm32-wasip1` in a browser and capture anything it
// prints to stdout/stderr. No network access, no filesystem, no threads —
// this only wires up the handful of syscalls a "hello world"-style CLI
// program actually needs (write, exit, env/args, clock, random).
function createMinimalWasi({ onStdout, onStderr, args = [] } = {}) {
  let memory = null;
  const decoder = new TextDecoder();
  const view = () => new DataView(memory.buffer);

  function readIovs(iovsPtr, iovsLen) {
    const v = view();
    let text = '';
    let written = 0;
    for (let i = 0; i < iovsLen; i++) {
      const ptr = v.getUint32(iovsPtr + i * 8, true);
      const len = v.getUint32(iovsPtr + i * 8 + 4, true);
      text += decoder.decode(new Uint8Array(memory.buffer, ptr, len));
      written += len;
    }
    return { text, written };
  }

  const imports = {
    args_sizes_get(argcPtr, argvBufSizePtr) {
      const v = view();
      const buf = args.map((a) => a + '\0').join('');
      v.setUint32(argcPtr, args.length, true);
      v.setUint32(argvBufSizePtr, buf.length, true);
      return 0;
    },
    args_get(argvPtr, argvBufPtr) {
      const v = view();
      let bufOffset = argvBufPtr;
      const bytes = new Uint8Array(memory.buffer);
      args.forEach((arg, i) => {
        v.setUint32(argvPtr + i * 4, bufOffset, true);
        const encoded = new TextEncoder().encode(arg + '\0');
        bytes.set(encoded, bufOffset);
        bufOffset += encoded.length;
      });
      return 0;
    },
    environ_sizes_get(countPtr, bufSizePtr) {
      const v = view();
      v.setUint32(countPtr, 0, true);
      v.setUint32(bufSizePtr, 0, true);
      return 0;
    },
    environ_get() {
      return 0;
    },
    proc_exit(code) {
      const err = new Error('wasi-exit');
      err.__wasiExitCode = code;
      throw err;
    },
    fd_write(fd, iovsPtr, iovsLen, nwrittenPtr) {
      const { text, written } = readIovs(iovsPtr, iovsLen);
      if (fd === 1 && onStdout) onStdout(text);
      else if (fd === 2 && onStderr) onStderr(text);
      view().setUint32(nwrittenPtr, written, true);
      return 0;
    },
    fd_read() {
      return 8; // EBADF-ish: no stdin available in the browser
    },
    fd_close() {
      return 0;
    },
    fd_seek(_fd, _offLo, _offHi, _whence, newOffsetPtr) {
      view().setBigUint64(newOffsetPtr, 0n, true);
      return 0;
    },
    fd_fdstat_get() {
      return 0;
    },
    fd_prestat_get() {
      return 8;
    },
    fd_prestat_dir_name() {
      return 8;
    },
    path_open() {
      return 44; // ENOTCAPABLE: no filesystem access
    },
    clock_time_get(_id, _precision, resultPtr) {
      view().setBigUint64(resultPtr, BigInt(Date.now()) * 1000000n, true);
      return 0;
    },
    clock_res_get(_id, resultPtr) {
      view().setBigUint64(resultPtr, 1000000n, true);
      return 0;
    },
    random_get(ptr, len) {
      const bytes = new Uint8Array(memory.buffer, ptr, len);
      crypto.getRandomValues(bytes);
      return 0;
    },
    sched_yield() {
      return 0;
    },
  };

  return {
    imports: { wasi_snapshot_preview1: imports },
    setMemory(mem) {
      memory = mem;
    },
  };
}
