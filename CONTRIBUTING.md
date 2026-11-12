# Contributing

Add command-palette templates to `src/commands/structures.ts`. Each @ marks an editable field. The first field receives selected text. Add executable actions in `src/main.ts`.

Add individual symbols in `src/commands/symbols.ts` using command, space-separated aliases and display name separated by vertical bars. Groups carry their searchable category. Greek and number-set aliases use exact case.

Shared symbol aliases feed `src/commands/mathAutoExpand.ts`. Add structural expansions there and reuse existing palette templates where possible. Add paper, ink and muted colors to the theme table in `src/settings.ts`.

Before submitting a change, run the frontend build and test the affected command in a desktop window. For CLI changes, exercise duplicate paths, deferred creation, stdin and waiting in a second terminal.

