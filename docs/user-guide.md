# User guide

## Open a document

```sh
narra notes.md
narra "notes with spaces.md"
narra
narra --wait message.md
narra -w message.md
```

Paths are resolved relative to the invoking terminal's working directory. An existing file loads into a window. A missing file opens an empty buffer bound to its path, then saves after editing. The parent directory must already exist.

Launching without a path opens an untitled scratchpad. Ctrl+S prompts for a destination. Closing a scratchpad without saving discards its contents.

The launcher normally returns control to the shell after starting the GUI process. The intended duplicate-file behavior focuses an existing window for the canonical path. Different files receive separate windows.

With `--wait`, the invoking process stays attached until the associated document window closes. Multiple waiting invocations for one document are tied to that window.

```sh
git config core.editor "narra --wait"
```

## Pipe text

```sh
echo "# Draft" | narra
cat notes.md | narra
```

PowerShell can send text using `Get-Content -Raw notes.md | narra`. Piped text opens in a scratchpad when a file path is absent. An existing named file takes precedence over piped text. Input is read as UTF-8 text.

## Save and synchronize

Named documents use debounced autosave, with a default delay of 300 ms after editing stops. Ctrl+S requests an immediate save. A dot next to the filename represents unsaved changes.

The backend watches the document's parent directory and compares file contents. External changes that differ from the backend buffer trigger a reload. The frontend attempts to preserve the cursor offset and scroll position. An external reload replaces the buffer, including pending local text. Keep this behavior in mind when using Narra alongside nvim or another editor.

Files are written using a temporary file in the destination directory followed by replacement. The implementation preserves existing file permissions when it can read them. It provides no recovery history or scratchpad restoration.

## Keyboard reference

| Shortcut | Action |
| --- | --- |
| Ctrl+P | Open action and structure palette |
| Ctrl+O | Open symbol dictionary |
| Ctrl+, | Open Preferences |
| Ctrl+S | Save or choose a scratchpad destination |
| Ctrl+= or Ctrl++ | Increase text size |
| Ctrl+- | Decrease text size |
| Ctrl+0 | Restore the default text size |
| Ctrl+Z | Undo |
| Ctrl+Y or Ctrl+Shift+Z | Redo through CodeMirror's history bindings |
| Up / Down | Select a palette result |
| Enter | Run the selected palette command |
| Escape | Dismiss an overlay |
| Tab | Advance through template fields or escape a closing delimiter |
| Alt | Reveal the titlebar |

The application also recognizes Meta for its global palette, preferences, save and zoom handlers.

## Markdown and live preview

Headings, emphasis, inline and fenced code, blockquotes, horizontal rules and lists receive in-place styling. Markdown markers on the active line remain visible for editing. Moving away hides supported markers.

Use the live-preview command in Ctrl+P to switch to raw source. Preferences can also set raw source mode. The editor provides list and blockquote continuation on Enter. Press Enter on an empty prefixed line to leave that list or quote.

Narra keeps one document in each window. Document navigation happens through the terminal. Task checkboxes, custom LaTeX macro preambles and split editor panes are outside the specified feature set.

## Math

Use `$x^2$` for inline math and a pair of `$$` delimiters for display math. Moving the cursor into an equation reveals its source. Moving away renders it with KaTeX. Invalid expressions fall back to calm raw text.

Typing a dollar sign inserts a closing dollar sign. Typing a second dollar sign between the pair creates a multiline display block. Parentheses, brackets, braces, asterisks and backticks also receive closing pairs.

Ctrl+O searches individual symbols by name, category or LaTeX. Inserting outside a math range wraps the symbol in dollar delimiters. Inserting inside a math range adds the LaTeX directly.

Ctrl+P provides fractions, roots, powers, subscripts, calculus templates, matrices, cases and aligned equations. Selected text fills the first template field. Use Tab to reach subsequent fields.

## Keyword expansion

Inside a recognized math range, a space after a keyword triggers expansion when enabled. For example, `then` becomes `\\implies `, `alpha` becomes `\\alpha `, and `RR` becomes `\\mathbb{R} `. Greek and number-set aliases use exact case. General logic and operator aliases are case-insensitive.

Structural aliases include `frac`, `sqrt`, `lim`, `int`, `iint`, `iiint`, `oint`, `sum`, `prod`, `dv`, `pdv`, `vec`, `hat` and `bar`. Their fields use the same Tab navigation as palette templates. One undo restores the original keyword.

See the declarative catalogs in `src/commands/` for the complete current vocabulary.

## Focus and export

Typewriter scroll centers the active line after editing or cursor movement. Wheel and trackpad scrolling remain available. Titlebar auto-fade hides the filename and window controls while typing. Move the mouse near the top edge or press Alt to reveal them.

Ctrl+P offers Markdown copying, HTML copying, PDF export and word/character count. Markdown copying uses the current source. HTML export parses Markdown, filters markup and renders recognized equations with KaTeX. PDF export uses the platform print dialog, where PDF availability depends on the operating system.
