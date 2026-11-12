# Narra documentation

Narra is a single-file Markdown and LaTeX desktop editor. It uses Tauri v2, CodeMirror 6 and KaTeX, with Windows as the primary platform and Linux as a build target.

| Guide | Contents |
| --- | --- |
| [Getting started](getting-started.md) | Prerequisites, installation, development and release builds |
| [User guide](user-guide.md) | CLI, saving, keyboard commands, Markdown, math and export |
| [Configuration](configuration.md) | Every persisted setting, defaults, ranges and themes |
| [Architecture](architecture.md) | Source layout, IPC, document lifecycle and rendering |
| [Contributing](contributing.md) | Extending catalogs, making changes and verifying behavior |
| [Troubleshooting](troubleshooting.md) | Build problems, file issues and verification limits |

These guides describe the current source implementation. Compilation checks have passed for the frontend and Windows backend. Full native behavior still needs verification following an unsuccessful native smoke test. Performance thresholds and Linux runtime behavior have yet to be measured.
