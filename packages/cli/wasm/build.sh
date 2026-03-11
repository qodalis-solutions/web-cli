#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Ensure cargo/wasm-pack are on PATH
export PATH="$HOME/.cargo/bin:$PATH"

wasm-pack build --target web --out-dir pkg --release
