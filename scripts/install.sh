#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
npm ci
npm run tauri -- build --no-bundle
dest="$HOME/.local/bin"
mkdir -p "$dest"
install -m 755 src-tauri/target/release/narra "$dest/narra"
case ":$PATH:" in *":$dest:"*) ;; *) echo "Add $dest to your PATH." ;; esac

