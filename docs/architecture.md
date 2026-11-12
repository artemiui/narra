# Architecture

## Source map

| Path | Responsibility |
| --- | --- |
| src/main.ts | Application startup, shortcuts, palettes, save queue, native events and export |
| src/editor.ts | CodeMirror extensions, math indexing, decorations, typing behavior and template fields |
| src/settings.ts | Defaults, validation, CSS variables and Preferences UI |
| src/style.css | Canvas, typography, overlays, caret and print styles |
| src/commands/structures.ts | Markdown and mathematical templates |
| src/commands/symbols.ts | Symbol dictionary and aliases |
| src/commands/mathAutoExpand.ts | Alias lookup and structural expansion |
| src-tauri/src/main.rs | CLI, document registry, files, watchers, fonts and IPC |
| src-tauri/tauri.conf.json | Application, build, CSP and bundle configuration |
| src-tauri/capabilities/default.json | Webview permissions |
| scripts/ | Source installers |
| .github/workflows/release.yml | Tag-triggered release builds |

## Launch and document ownership

Clap parses an optional path and the public `--wait` flag. The launcher resolves the path, reads redirected stdin, and writes a UUID-addressed request under `~/.narra/launch/`. A child process consumes this request through a hidden internal argument.

The child hosts Tauri. The single-instance plugin forwards later request identifiers to the running application. A mutex-protected map associates window labels with document buffers, file watchers and waiting CLI connections.

Each buffer contains an optional path, text and a version counter. Canonical path equality guards duplicate documents. Window labels use a generated `doc-` prefix and UUID.

For waiting invocations, the launcher binds a loopback TCP listener. The GUI connects and acknowledges opening, then retains the connection with the document. Closing the window drops that connection and releases the waiting launcher. Opening has a 30-second connection deadline.

## IPC and events

| Command | Purpose |
| --- | --- |
| buffer | Return the calling window's document |
| save | Persist text with an expected buffer version and optional path |
| list_system_fonts | Return sorted, unique font family names |
| config | Load native JSON preferences |
| configure | Write preferences and broadcast them |
| open_config | Open the raw configuration in a document window |

The `disk-change` event carries an updated buffer to its window. The `preferences` event broadcasts configuration to open windows.

The frontend tracks local edit and saved revisions separately from the backend buffer version. Saves are serialized through a promise queue. A stale expected backend version returns the current buffer so the frontend can reload it.

## Filesystem synchronization

Writes use a temporary file in the destination directory and then persist it over the target. Existing permissions are copied when available. Notify watches the parent directory so replacement-style external writes can be observed.

Watcher callbacks compare the disk text with the backend buffer. Equal text suppresses self-generated reloads. Differing text increments the version and emits an update. This is content-based suppression and does not provide a merge algorithm.

## Rendering and typing

CodeMirror's Markdown language parser supplies syntax nodes for visible-range Markdown decorations. The active line retains editable syntax.

A state field indexes delimited equations. Ordinary changes map existing ranges, while delimiter-affecting changes rescan. Math preview decorations replace inactive ranges with KaTeX widgets and expose active ranges as raw monospace text.

A bounded 512-entry map caches rendered DOM templates by expression and display mode. Widgets clone the cached template to obtain independently mounted nodes. Invalid KaTeX expressions fall back to raw text.

Templates use `@` as field markers. Insertion creates one text transaction and records remaining field positions in a state field. Subsequent changes map those positions, and Tab advances through them. Undo isolation keeps expansions individually reversible.

## Configuration and export

Preference changes update CSS variables immediately, then enter a persistence queue. The raw-mode compartment can reconfigure preview extensions without replacing the editor.

HTML export lazily loads marked, substitutes equation placeholders, filters parsed markup and renders math. PDF export places that HTML into a print-only article and invokes the platform print dialog. The configured content security policy restricts loaded content and permits the inline styles required by the editor and KaTeX.

## Performance and verification

The design targets fast startup, responsive typing and low idle resource use. These remain measurement targets. Syntax checks and successful compilation establish a narrower level of confidence than native lifecycle, cross-platform, memory or latency testing.
