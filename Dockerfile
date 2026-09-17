FROM node:22-bookworm-slim

# Rust toolchain (needed for the Rust -> WebAssembly builder).
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates git build-essential \
    && rm -rf /var/lib/apt/lists/*
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal \
    && rustup target add wasm32-wasip1

# Optional: TinyGo, for the best-effort Go -> WebAssembly builder.
# Optional: Emscripten (emcc), for the best-effort C/C++ -> WebAssembly builder.
# Both are large installs; add them here if you need those languages, e.g.:
#   RUN git clone --depth 1 https://github.com/emscripten-core/emsdk.git /opt/emsdk \
#       && /opt/emsdk/emsdk install latest && /opt/emsdk/emsdk activate latest
#   ENV PATH=/opt/emsdk:/opt/emsdk/upstream/emscripten:$PATH

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
