# Narra

A keyboard-native, single-file Markdown and LaTeX editor for Windows and Linux. Can be used in tandem with nvim as frontend.

<img width="1920" height="1080" alt="typing" src="https://github.com/user-attachments/assets/7c17d6d7-1c87-42e8-83a0-c830a13e86b7" />
*Typing on Narra*

## Install from source

Install Node.js 22, npm and stable Rust. Builds on Windows require MSVC C++ Build Tools and WebView2. On Linux install the Tauri v2 WebKitGTK 4.1 development prerequisites, Fontconfig headers and libxdo development files.

From a checkout, run `./scripts/install.ps1` in PowerShell or `sh scripts/install.sh` on Linux. Reopen the shell after updating PATH.

## Terminal

```sh
narra notes.md
narra
echo "# Draft" | narra
narra --wait message.md
git config core.editor "narra --wait"
```

A new path creates a file after typing. A scratchpad or piped buffer stays in memory until Ctrl+S. Closing an unsaved scratchpad discards it. Open an existing path again to focus its window.

## Writing

Ctrl+P searches commands and templates. Ctrl+O searches individual symbols by name, category or LaTeX. Use arrow keys and Enter to choose, Escape to dismiss and Tab to move between template fields. The command palette includes Markdown and HTML copying, document count and PDF export through the print dialog.

Open Preferences with Ctrl+, to change the theme, fonts, writing width, caret, math expansion and autosave delay. Ctrl+= and Ctrl+- adjust the type size and Ctrl+0 restores the default. Preferences are stored in `~/.narra/config.json`.

## Development

Browse the [documentation](docs/README.md) for installation, usage, configuration, architecture, contributor guidance and troubleshooting.

Run `npm ci` followed by `npm run tauri -- dev -- -- --wait`. For browser-only work, run `npm run dev`. Native file watching, system font discovery and CLI routing require the desktop runtime. Run `npm run build` to type-check and bundle the frontend.


