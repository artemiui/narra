import { invoke, isTauri } from "@tauri-apps/api/core";
export const themes: Record<string, string[]> = {
  "Warm Paper": ["#FAF8F5", "#24211D", "#9E9589"],
  "Pure Light": ["#FFFFFF", "#18181B", "#A1A1AA"],
  "True Dark": ["#09090B", "#E4E4E7", "#52525B"],
  "Nordic Slate": ["#11161D", "#DCE4EE", "#5C6B7E"],
};
export const defaults = {
  theme: "Warm Paper",
  body: "Georgia",
  mono: "Consolas",
  size: 19,
  height: 1.65,
  width: 740,
  scale: 1,
  bg: "#faf8f5",
  ink: "#24211d",
  accent: "#806d49",
  caret: "Bar",
  blink: "Smooth",
  fade: true,
  raw: false,
  typewriter: false,
  expand: true,
  delay: 300,
};
export type Pref = typeof defaults;
export function readPreferences(input:unknown):Pref {
  const result={...defaults};
  if(!input||typeof input!=="object")return result;
  const values=input as Record<string,unknown>;
  for(const k of ["size","height","width","scale","delay"] as const){
    const bounds={size:[12,32],height:[1.2,2.2],width:[540,1100],scale:[.85,1.35],delay:[100,2000]};
    const value=values[k];
    if(typeof value==="number"&&Number.isFinite(value))result[k]=Math.max(bounds[k][0],Math.min(bounds[k][1],value));
  }
  for(const k of ["bg","ink","accent"] as const){
    const v=values[k];if(typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v))result[k]=v;
  }
  for(const k of ["body","mono"] as const){const v=values[k];if(typeof v==="string")result[k]=v}
  for(const k of ["raw","fade","expand","typewriter"] as const){const v=values[k];if(typeof v==="boolean")result[k]=v}
  for(const [k,allowed] of Object.entries({theme:[...Object.keys(themes),"Custom"],caret:["Bar","Block","Underline"],blink:["Smooth","Standard","Solid"]}) as [("theme"|"caret"|"blink"),string[]][]){
    const v=values[k];if(typeof v==="string"&&allowed.includes(v))result[k]=v;
  }
  return result;
}
export function appearance(p: Pref) {
  const root = document.documentElement,
    colors = themes[p.theme] ?? [p.bg, p.ink, p.accent];
  for (const [key, val] of Object.entries({
    paper: colors[0],
    ink: colors[1],
    muted: colors[2],
    body: JSON.stringify(p.body) + ", serif",
    mono: JSON.stringify(p.mono) + ", monospace",
    size: p.size + "px",
    leading: String(p.height),
    width: p.width + "px",
    math: p.scale + "em",
  }))
    root.style.setProperty("--" + key, val);
  root.dataset.caret = p.caret;
  root.dataset.blink = p.blink;
  root.classList.toggle("typewriter", p.typewriter);
  if (!p.fade) document.body.classList.remove("writing");
}
export function settings(
  panel: HTMLElement,
  p: Pref,
  apply: (p: Partial<Pref>) => void,
  raw: () => void,
) {
  panel.innerHTML =
    '<div class="cap"><h1 id="heading">Preferences</h1><button class="close" aria-label="Close preferences">Esc</button></div><div class="prefs"></div><footer><button id="raw">Open raw config.json</button><button id="reset">Reset defaults</button></footer>';
  panel.querySelector<HTMLButtonElement>(".close")!.onclick = () =>
    panel.closest("dialog")!.close();
  const body = panel.querySelector(".prefs")!;
  const title = (t: string) => {
    const h = document.createElement("h2");
    h.textContent = t;
    body.append(h);
  };
  function field(k: keyof Pref, label: string, options?: string[] | number[]) {
    const row = document.createElement("label"),
      caption = document.createElement("span");
    caption.textContent = label;
    row.append(caption);
    body.append(row);
    if (options && typeof options[0] === "string") {
      const select = document.createElement("select");
      for (const o of options) select.add(new Option(String(o)));
      select.value = String(p[k]);
      select.onchange = () => {
        apply({ [k]: select.value });
        if (k === "theme") {
          settings(panel, p, apply, raw);
          panel.querySelector<HTMLSelectElement>("select")?.focus();
        }
      };
      row.append(select);
      return;
    }
    const el = document.createElement("input");
    row.append(el);
    if (typeof p[k] === "boolean") {
      el.type = "checkbox";
      el.checked = !!p[k];
      el.onchange = () => apply({ [k]: el.checked });
      return;
    }
    if (options) {
      const [min, max, step] = options.map(Number);
      el.type = "range";
      const number = document.createElement("input");
      number.type = "number";
      number.setAttribute("aria-label",label+" value");
      row.append(number);
      for (const i of [el, number]) {
        i.min = String(min);
        i.max = String(max);
        i.step = String(step);
        i.value = String(p[k]);
        i.oninput = () => {
          if (!i.value || !i.validity.valid) return;
          el.value = number.value = i.value;
          apply({ [k]: +i.value });
        };
      }
      return;
    }
    el.value = String(p[k]);
    if (["bg", "ink", "accent"].includes(k)) el.type = "color";
    else {
      el.type="text";
      el.setAttribute("list", "fonts");
      el.style.fontFamily = String(p[k]);
    }
    el.oninput = () => {
      apply({ [k]: el.value });
      if (el.type === "text") el.style.fontFamily = el.value;
    };
  }
  title("Appearance");
  field("theme", "Paper and ink", [...Object.keys(themes), "Custom"]);
  if (p.theme === "Custom") {
    field("bg", "Background");
    field("ink", "Text");
    field("accent", "Accent");
  }
  title("Typography");
  field("body", "Prose font");
  field("mono", "Code and LaTeX font");
  const fonts = document.createElement("datalist");
  fonts.id = "fonts";
  body.append(fonts);
  if (isTauri())
    invoke<string[]>("list_system_fonts")
      .then((names) => names.forEach((name) => fonts.append(new Option(name))))
      .catch(console.error);
  field("size", "Text size", [12, 32, 1]);
  field("height", "Line height", [1.2, 2.2, 0.05]);
  field("width", "Column width", [540, 1100, 10]);
  field("scale", "Math scale", [0.85, 1.35, 0.05]);
  title("Writing");
  field("caret", "Caret", ["Bar", "Block", "Underline"]);
  field("blink", "Caret blink", ["Smooth", "Standard", "Solid"]);
  field("fade", "Fade titlebar while typing");
  field("typewriter", "Typewriter scroll");
  field("raw", "Raw source mode");
  field("expand", "Expand math keywords");
  field("delay", "Autosave delay (ms)", [100, 2000, 50]);
  panel.querySelector<HTMLButtonElement>("#raw")!.onclick = raw;
  panel.querySelector<HTMLButtonElement>("#reset")!.onclick = () => {
    apply(defaults);
    settings(panel, p, apply, raw);
  };
}
