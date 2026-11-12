# Configuration

Open Preferences with Ctrl+, or choose Settings → Open Preferences through Ctrl+P. Changes affect the document immediately and are persisted automatically.

Desktop configuration lives at `~/.narra/config.json`, normally `C:\Users\<user>\.narra\config.json` on Windows and `/home/<user>/.narra/config.json` on Linux. The browser development mode uses localStorage.

## Settings reference

| JSON key | Default | Accepted values or range |
| --- | --- | --- |
| theme | Warm Paper | Warm Paper, Pure Light, True Dark, Nordic Slate, Custom |
| body | Georgia | Font family string |
| mono | Consolas | Font family string |
| size | 19 | 12–32 px |
| height | 1.65 | 1.2–2.2 |
| width | 740 | 540–1100 px |
| scale | 1 | 0.85–1.35 |
| bg | #faf8f5 | Six-digit hex color |
| ink | #24211d | Six-digit hex color |
| accent | #806d49 | Six-digit hex color |
| caret | Bar | Bar, Block, Underline |
| blink | Smooth | Smooth, Standard, Solid |
| fade | true | Boolean |
| raw | false | Boolean |
| typewriter | false | Boolean |
| expand | true | Boolean |
| delay | 300 | 100–2000 ms |

Numeric values are clamped to supported ranges. Missing or invalid values fall back to defaults when loaded through the preference validator. Unknown keys are omitted when the settings object is persisted.

The body family styles prose and headings. The monospace family styles code and exposed math. The desktop font input is populated from Rust font-kit system-font discovery. If the selected family is unavailable, the webview uses its configured fallback.

## Theme colors

| Preset | Background | Ink | Muted |
| --- | --- | --- | --- |
| Pure Light | #FFFFFF | #18181B | #A1A1AA |
| Warm Paper | #FAF8F5 | #24211D | #9E9589 |
| True Dark | #09090B | #E4E4E7 | #52525B |
| Nordic Slate | #11161D | #DCE4EE | #5C6B7E |

Choose Custom to use `bg`, `ink` and `accent`. In the current implementation the custom accent supplies the muted color variable.

## Example config.json

```json
{
  "theme": "Warm Paper",
  "body": "Georgia",
  "mono": "Consolas",
  "size": 19,
  "height": 1.65,
  "width": 740,
  "scale": 1,
  "bg": "#faf8f5",
  "ink": "#24211d",
  "accent": "#806d49",
  "caret": "Bar",
  "blink": "Smooth",
  "fade": true,
  "raw": false,
  "typewriter": false,
  "expand": true,
  "delay": 300
}
```

## Raw editing and reset

Use Open raw config.json in the Preferences footer or its command-palette entry. Editing this buffer uses the same file-saving mechanisms as a document. A saved JSON object is broadcast to open windows as preferences.

The raw configuration file may start as an empty buffer if it has never been created. Insert a valid JSON object, such as the example above, before saving.

Reset defaults restores the complete default settings object and persists it. If an invalid configuration prevents the intended appearance, use this action or replace the file with valid JSON and reopen the application. Startup currently falls back to defaults when the native configuration command fails.
