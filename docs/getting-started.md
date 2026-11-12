# Getting started

## Prerequisites

Install Node.js 22 with npm and a stable Rust toolchain. Ensure `node`, `npm` and `cargo` resolve in the terminal used to build Narra.

Windows also requires Microsoft C++ Build Tools with the desktop C++ workload, a Windows SDK, and WebView2. After installing these tools, open a fresh terminal so PATH changes take effect.

For Ubuntu 22.04, the release workflow installs the following native packages.

```sh
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev librsvg2-dev libfontconfig1-dev \
  libxdo-dev patchelf
```

Other Linux distributions use different package names. Build and run the application in a graphical desktop session.

## Install from the checkout

Run commands from the repository root.

On Windows, use PowerShell.

```powershell
./scripts/install.ps1
```

The script runs `npm ci`, builds a release executable, copies it into `%LOCALAPPDATA%\Programs\Narra\`, and adds that directory to the user PATH when necessary. Open a new terminal before using `narra`.

On Linux, run the shell installer.

```sh
sh scripts/install.sh
```

The script builds the executable and installs it into `~/.local/bin/narra`. It prints a message if that directory needs to be added to PATH.

## Run during development

```sh
npm ci
npm run tauri -- dev -- -- --wait
```

The final `--wait` keeps the CLI launcher attached while the editor window is open. Tauri starts the Vite development server on port 1420.

For browser development, run `npm run dev` and open the printed local URL. The browser version supports editing and UI development, stores preferences in browser storage, and downloads a Markdown file on explicit save. Native filesystem synchronization, CLI routing, installed-font discovery and native dialogs require the desktop runtime.

## Build

```sh
npm run build
npm run tauri -- build --no-bundle
```

The first command type-checks TypeScript and bundles the frontend into `dist/`. The second builds the desktop executable into `src-tauri/target/release/`.

Run `npm run tauri -- build` to request platform bundles. Windows and Linux packaging is also configured in the release workflow.

## Release workflow

Pushing a tag matching `v*` triggers `.github/workflows/release.yml`. It builds on Windows and Ubuntu 22.04, creates a draft GitHub release through the Tauri action, and uploads the Windows executable separately. Review the resulting draft and artifacts before publication. The workflow needs the repository's GitHub Actions token with contents-write permission.
