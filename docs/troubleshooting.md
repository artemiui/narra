# Troubleshooting

## narra is unavailable in the shell

Open a fresh terminal after installation. On Windows confirm that the user PATH includes `%LOCALAPPDATA%\Programs\Narra`. On Linux confirm that it includes `~/.local/bin`.

Check command discovery with `Get-Command narra` in PowerShell or `command -v narra` in a POSIX shell.

## Windows build reports a missing linker or library

Check that the desktop C++ workload and a Windows SDK completed installation. Rust uses MSVC linker tools and SDK libraries such as `kernel32.lib` and `DbgHelp.lib`. Open a new terminal after installation and retry the build.

A partially installed SDK can expose some libraries before the complete set is available. Wait for the installer to finish before retrying.

## Access denied while replacing narra.exe

Close running Narra windows that use the executable being rebuilt. Check Task Manager for a remaining Narra process before rebuilding. Also confirm that the output directory is writable. An earlier local rebuild encountered this error at the executable-replacement stage.

## Dependency downloads fail

Confirm access to the npm registry and crates.io, then retry `npm ci` or the Cargo build. Offline Cargo commands work only after the required crates have been downloaded. Restricted execution environments may require explicit network approval.

## Port 1420 is already in use

The Vite development command uses a fixed port with strict checking. Stop the earlier development server and restart the desktop development command. The production executable serves bundled assets.

## A new path does not open or save

Create its parent directory first and check write permissions. Opening and saving resolve paths through the existing parent directory. A file already open in another Narra window cannot be assigned to a second document through save.

Use a temporary directory when diagnosing behavior. The current implementation reads text with UTF-8 decoding and does not include a general character-encoding converter.

## Text changes after another editor saves

External file changes intentionally replace the current buffer. The editor attempts to retain the cursor offset and scroll position, but provides no conflict-merging UI or revision history. Save a separate copy when preserving both versions matters.

## Preferences look wrong

Use Reset defaults in Preferences. For raw editing, ensure `~/.narra/config.json` contains a JSON object with supported types and six-digit hex colors. The [configuration guide](configuration.md) includes a complete example.

Font availability varies by machine. Use the installed-font input and choose a family present on that operating system.

## A formula stays as source

Move the cursor outside the equation and confirm that raw source mode is disabled. Check the dollar delimiters and LaTeX syntax. KaTeX rendering errors use a raw-text fallback. Keyword expansion also requires a recognized math range and the expansion setting to be enabled.

## PDF export

The command opens the platform printing flow. Select the operating system's PDF destination where available. Browser preview and native webviews can offer different print behavior.

## Current verification limits

Frontend TypeScript checks, production bundling and Windows Rust compilation have succeeded. A later native smoke test failed during the deferred-file-creation check and reported that the requested document could not be opened. Its root cause remains unresolved.

Native file routing, waiting, external reload, printing and Linux behavior therefore need end-to-end verification. The startup, frame-time and memory targets have not been benchmarked.

When reporting a problem, include the operating system, application version or commit, launch command, relevant error text and minimal disposable input that reproduces it.
