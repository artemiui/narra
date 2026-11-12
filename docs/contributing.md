# Contributor guide

Read the [architecture guide](architecture.md) before changing document ownership or editor state. Follow repository instructions, including the UI design skills required for interface work.

## Extend the command palette

Add templates to `src/commands/structures.ts`. Each `@` marks an editable field, and selected text fills the first field.

```ts
"Math: Example fraction": "\\frac{@}{@}"
```

Use the existing catalog's escaping conventions when writing TypeScript strings. A raw template literal can express LaTeX backslashes directly. The palette automatically wraps mathematical templates in dollar delimiters when inserted outside math, unless the template already begins with a dollar delimiter.

Executable actions belong in the action registry in `src/main.ts`. Keep names descriptive and use the established category prefixes.

## Extend symbols and expansion

A symbol group in `src/commands/symbols.ts` contains lines with a LaTeX command, aliases and a display label separated by vertical bars. Commands omit the leading backslash in the group data. Aliases are separated by spaces.

```text
implies|then implies|Logical Implies
```

Group categories participate in dictionary search. Groups marked exact use case-sensitive aliases, as needed for Greek letters and number sets.

Symbol aliases automatically feed `src/commands/mathAutoExpand.ts`. Structural keyword templates are registered separately in that file. Reuse palette structures where they match the intended expansion.

## Extend preferences

Update the default settings object, validation, Preferences controls and appearance mapping in `src/settings.ts`. Check that old configuration files still load through defaults. Document any new persisted key in the [configuration reference](configuration.md).

Theme entries contain background, ink and muted colors. Check prose, raw source, equations, selections, overlays, focus indication and print output when changing appearance.

## Verify changes

Run the relevant checks from the repository root.

```sh
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --locked --manifest-path src-tauri/Cargo.toml
```

Desktop testing should use `npm run tauri -- dev -- -- --wait`. A production build should also be exercised when the change affects assets, CSP, bundling or launch behavior.

For editor changes, check selection wrapping, template Tab navigation, one-step expansion undo, ordinary prose safety, code spans, incomplete math, multiline math and raw/live switching.

For filesystem changes, use disposable files and check existing-file opening, deferred creation, first save, duplicate paths, different-file windows, stdin, external replacement and closing with pending edits. Verify that a waiting process exits when its document closes, including when another window remains open.

For configuration changes, test missing keys, invalid values, reset, raw-file editing and propagation across windows. Test native font discovery on the supported operating systems.

Record which checks ran and their results in the contribution description. Compilation success alone does not establish that the native workflows passed.
