# TinyGo needs a Go toolchain in a version range it supports (1.19-1.23);
# pull one from the official Go image rather than relying on whatever
# version the base distro happens to package.
FROM golang:1.21-bookworm AS go121

FROM node:22-bookworm-slim

# Rust toolchain (needed for the Rust -> WebAssembly builder).
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates git build-essential xz-utils python3 python-is-python3 \
    && rm -rf /var/lib/apt/lists/*
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal \
    && rustup target add wasm32-wasip1

# Emscripten (emcc), for the C/C++ -> WebAssembly builder. This is a ~1 GB
# install; drop this block (and the C/C++ builder) if image size matters
# more than C/C++ support.
RUN git clone --depth 1 https://github.com/emscripten-core/emsdk.git /opt/emsdk \
    && /opt/emsdk/emsdk install latest && /opt/emsdk/emsdk activate latest
ENV PATH=/opt/emsdk:/opt/emsdk/upstream/emscripten:$PATH

# TinyGo, for the Go -> WebAssembly builder. TinyGo shells out to a real Go
# toolchain internally, so bring one in the version range it supports.
COPY --from=go121 /usr/local/go /usr/local/go
ENV PATH=/usr/local/go/bin:$PATH
ARG TINYGO_VERSION=0.34.0
RUN curl -fsSL -o /tmp/tinygo.deb \
      "https://github.com/tinygo-org/tinygo/releases/download/v${TINYGO_VERSION}/tinygo_${TINYGO_VERSION}_amd64.deb" \
    && apt-get install -y --no-install-recommends /tmp/tinygo.deb \
    && rm /tmp/tinygo.deb

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
