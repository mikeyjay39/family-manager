#!/usr/bin/env bash
# script regenerates TypeScript type definitions from Rust so the frontend and backend share a single source
# of truth for HTTP request/response shapes.
set -euo pipefail


ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

"${ROOT}/backend/scripts/write_rev.sh"
cargo test export_typescript_bindings --workspace --manifest-path "${ROOT}/backend/Cargo.toml"
