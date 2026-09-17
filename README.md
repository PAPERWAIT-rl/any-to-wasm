# any-to-wasm

Upload a `.zip` of a project, or point at a public GitHub repo, and get back a
downloadable static website (HTML + CSS + JS, plus WebAssembly where
applicable) that runs the project in the browser.

## How it works

1. **Detect** the project type by scanning for marker files (`Cargo.toml`,
   `go.mod`, `*.c`/`*.cpp`, `*.py`, an `index.html`, ...).
2. **Convert**, per language:
   - **Rust** — compiled with `rustc`/`cargo` to a `wasm32-wasip1` module.
     The generated site ships a small (~100 line) hand-written WASI shim
     (`templates/site/wasi-shim.js`) that implements just enough of
     `wasi_snapshot_preview1` (`fd_write`, `proc_exit`, clock/random/env
     stubs) to run the compiled binary in the browser and capture its
     stdout/stderr — no `wasm-bindgen` or Emscripten required.
   - **Python** — the `.py` sources are bundled as-is and run **entirely in
     the browser** with [Pyodide](https://pyodide.org), a full CPython
     interpreter compiled to WebAssembly. Nothing you upload is ever
     executed as Python on the server.
   - **Plain HTML/CSS/JS projects** — already a website, so they're
     repackaged as-is.
   - **Go** — if the server has [TinyGo](https://tinygo.org) installed
     (it is, in the provided `Dockerfile`), it's compiled to `wasm32-wasip1`
     and run with the same WASI shim as Rust. Otherwise falls back to the
     source viewer below.
   - **C/C++** — if the server has [Emscripten](https://emscripten.org)
     (`emcc`) installed (it is, in the provided `Dockerfile`), it's compiled
     to WebAssembly with Emscripten's own HTML/JS shell. Otherwise falls
     back to the source viewer below.
   - **Anything else** (or any build failure) — falls back to a generated
     static "source browser" site so you still get a working, downloadable
     website out of the box.
3. **Package** the result as a zip and offer it for download, plus a live
   preview served from the same job.

## Running locally

```bash
npm install
npm start
# open http://localhost:3000
```

Requirements for full functionality:

- **Node.js 18+**
- **Rust + Cargo**, with the `wasm32-wasip1` target
  (`rustup target add wasm32-wasip1`) — for the Rust builder. If missing,
  the server attempts to install the target automatically via `rustup`
  when a Rust project is submitted.
- **git** — for the "GitHub repo" input mode.
- Optional: **TinyGo** (plus a Go 1.19-1.23 toolchain, which TinyGo shells
  out to) and **Emscripten** (`emcc`) on `PATH` to enable the Go and C/C++
  builders; without them, those project types fall back to the
  source-browser output. Installing these yourself is slow and adds real
  image weight (Emscripten alone is roughly a 1 GB download) — the
  provided `Dockerfile` installs both, so `docker build` gets you every
  builder without manual setup.

See `Dockerfile` for a container image with Node, Rust, Emscripten, and
TinyGo all preinstalled.

## API

- `POST /api/convert` — multipart form with either a `zip` file field or a
  `repoUrl` field (a plain `https://` git URL). Returns JSON with a build
  log, the detected project type, a `previewUrl`, and a `downloadUrl`.
- `GET /api/download/:jobId` — downloads `website.zip` for a completed job.
- `GET /api/preview/:jobId/*` — serves the generated site for in-browser
  preview.

Jobs (uploaded/cloned sources, build output, and the zip) are kept in a
temp directory and swept after 30 minutes.

## Security notes

This service compiles/clones arbitrary user-supplied code, which is
inherently risky. Mitigations already in place:

- `git clone --depth 1` via `execFile` (argv array, no shell), with the
  repo URL validated against a strict `https://` pattern before use.
- Zip extraction guards against zip-slip (path traversal) and zip bombs
  (entry count + uncompressed size caps).
- Upload size is capped (50 MB) and every compiler invocation
  (`cargo`/`rustc`/`tinygo`/`emcc`) runs with a hard timeout.
- Python is never executed server-side — only in the end user's browser,
  inside the Pyodide/WebAssembly sandbox.

What this does **not** do, and what you should add before exposing it on
the open internet: OS-level sandboxing of the compiler processes
themselves (e.g. run each build in its own disposable container/VM with no
network access — `cargo build`/`build.rs` and C/C++ builds run arbitrary
native code at compile time), per-IP rate limiting, and authentication.
