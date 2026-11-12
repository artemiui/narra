import { EditorState, Compartment, Transaction } from "@codemirror/state";
import { EditorView, keymap, drawSelection } from "@codemirror/view";
import { history, historyKeymap, defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { save as choosePath } from "@tauri-apps/plugin-dialog";
import katex from "katex";
import "katex/dist/katex.min.css";
import "./style.css";
import { engine, preview, inMath, insertTemplate, equationRanges } from "./editor";
import { structures } from "./commands/structures";
import { symbols } from "./commands/symbols";
import { appearance, settings, defaults, readPreferences, type Pref } from "./settings";
const native = isTauri(),
  dialog = document.querySelector("dialog")!,
  panel = document.querySelector<HTMLElement>("#panel")!;
const title = document.querySelector("#name")!,
  mode = new Compartment();
let path: string | null = null,
  diskVersion = 0, revision = 0,
  saved = 0,
  timer = 0,
  external = false,
  queue = Promise.resolve(),
  prefsQueue = Promise.resolve();
let p = { ...defaults },
  view: EditorView;
const actions: Record<string, () => unknown> = {};
function message(heading: string, detail: string) {
  panel.replaceChildren();
  const h = document.createElement("h1");
  h.id = "heading";
  h.textContent = heading;
  const para = document.createElement("p");
  para.textContent = detail;
  const close = document.createElement("button");
  close.textContent = "Close";
  close.onclick = () => dialog.close();
  panel.append(h, para, close);
  if (!dialog.open) dialog.showModal();
}
const fail = (e: unknown) => message("Narra", String(e));
function label() {
  title.textContent =
    (revision !== saved ? "•  " : "") +
    (path?.split(/[\\/]/).pop() || "Untitled");
  document.title = title.textContent + " — Narra";
}
function apply(delta: Partial<Pref>, persist = true) {
  const previous = p.raw;
  Object.assign(p, readPreferences({...p,...delta}));
  appearance(p);
  if (view && previous !== p.raw)
    view.dispatch({ effects: mode.reconfigure(p.raw ? [] : preview) });
  if (persist) {
    const value = { ...p };
    prefsQueue = prefsQueue
      .then(async () => {
        if (native) await invoke("configure", { value });
        else localStorage.setItem("narra.settings", JSON.stringify(value));
      })
      .catch(fail);
  }
}
type Buffer = { path: string | null; text: string; version:number };
function save(explicit = false) {
  clearTimeout(timer);
  queue = queue.then(async () => {
    if (!native) {
      if (explicit) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([view.state.doc.toString()]));
        a.download = "Untitled.md";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
      return;
    }
    let target = path;
    if (!target) {
      if (!explicit) return;
      target = await choosePath({ defaultPath: "Untitled.md" });
      if (!target) return;
    }
    if (revision === saved && path) return;
    const version = revision;
    const text=view.state.doc.toString();
    const b = await invoke<Buffer>("save", {
      text, version:diskVersion,
      path: target,
    });
    if(b.version < diskVersion)return;
    if(b.text!==text){reload(b);return;}
    diskVersion=b.version; path = b.path;
    saved = version;
    label();
  });
  return queue.catch((e) => {
    queue = Promise.resolve();
    fail(e);
    throw e;
  });
}
function raw() {
  if (dialog.open) dialog.close();
  if (native) invoke("open_config").catch(fail);
  else
    message(
      "Raw configuration",
      "The desktop app stores preferences in ~/.narra/config.json.",
    );
}
function preferences() {
  settings(panel, p, apply, raw);
  if (!dialog.open) dialog.showModal();
}
async function safeHTML() {
  const {marked}=await import("marked");
  const token = "NARRAMATH" + crypto.randomUUID().replaceAll("-", "") + "X";
  const ranges = equationRanges(view.state);
  const parts: string[] = [];
  let last = 0;
  ranges.forEach((r, i) => {
    parts.push(view.state.sliceDoc(last, r.from),token+i+"Z");
    last = r.to;
  });
  parts.push(view.state.sliceDoc(last));
  const doc = new DOMParser().parseFromString(
    marked.parse(parts.join(""), { async: false }) as string,
    "text/html",
  );
  const allowed = new Set(
    "P H1 H2 H3 H4 H5 H6 UL OL LI STRONG EM PRE CODE BLOCKQUOTE HR BR A TABLE THEAD TBODY TR TD TH".split(
      " ",
    ),
  );
  for (const el of [...doc.body.querySelectorAll("*")]) {
    if (!allowed.has(el.tagName)) {
      el.replaceWith(document.createTextNode(el.textContent || ""));
      continue;
    }
    const href = el.getAttribute("href");
    for (const a of [...el.attributes]) el.removeAttribute(a.name);
    if (el.tagName === "A" && href && /^https?:\/\//i.test(href))
      el.setAttribute("href", href);
  }
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (node.parentElement?.closest("code,pre")) continue;
    const frag = document.createDocumentFragment();
    let pos = 0;
    for (const m of node.data.matchAll(new RegExp(token+"([0-9]+)Z","g"))) {
      frag.append(node.data.slice(pos,m.index));
      const span=document.createElement("span");
      const r=ranges[Number(m[1])], n=r.display?2:1;
      const latex=view.state.sliceDoc(r.from+n,r.to-n);
      try {katex.render(latex,span,{displayMode:r.display});}
      catch {span.textContent=latex;}
      frag.append(span);
      pos = m.index! + m[0].length;
    }
    if (pos) {
      frag.append(node.data.slice(pos));
      node.replaceWith(frag);
    }
  }
  return doc.body.innerHTML;
}
const zoom = (n: number) => apply({ size: Math.max(12, Math.min(32, n)) });
Object.assign(actions, {
  "Settings: Open Preferences": preferences,
  "Settings: Edit Raw config.json": raw,
  "View: Toggle Dark / Light Mode": () =>
    apply({
      theme: ["True Dark", "Nordic Slate"].includes(p.theme)
        ? "Warm Paper"
        : "True Dark",
    }),
  "View: Toggle Live Preview / Raw Source Mode": () => apply({ raw: !p.raw }),
  "View: Toggle Typewriter Scroll": () => apply({ typewriter: !p.typewriter }),
  "Math: Toggle Live Keyword Auto-Expand": () => apply({ expand: !p.expand }),
  "View: Zoom In": () => zoom(p.size + 1),
  "View: Zoom Out": () => zoom(p.size - 1),
  "View: Reset Zoom": () => zoom(defaults.size),
  "File: Save": () => save(true),
  "File: Copy as Clean Markdown": () =>
    navigator.clipboard.writeText(view.state.doc.toString()),
  "File: Copy as HTML": async () => navigator.clipboard.writeText(await safeHTML()),
  "File: Export to PDF": async () => {
    document.querySelector("#print")!.innerHTML = await safeHTML();
    window.print();
  },
  "File: Word & Character Count": () => {
    const t = view.state.doc.toString();
    message(
      "Document count",
      (t.trim().match(/\S+/g)?.length ?? 0) +
        " words · " +
        [...t].length +
        " characters",
    );
  },
});
for (const [name, template] of Object.entries(structures))
  actions[name] = () => {
    const wrap =
      !name.startsWith("Format:") &&
      !template.startsWith("$") &&
      !inMath(view.state, view.state.selection.main.head);
    insertTemplate(view, wrap ? "$" + template + "$" : template);
  };
const recent: string[] = JSON.parse(
  localStorage.getItem("narra.recent") || "[]",
);
function palette(dictionary: boolean) {
  panel.innerHTML =
    '<div class="cap"><h1 id="heading"></h1><kbd>Esc</kbd></div><input id="search" type="search" autocomplete="off"><div class="results" role="listbox"></div>';
  panel.querySelector("h1")!.textContent = dictionary
    ? "Symbol dictionary"
    : "Command palette";
  const input = panel.querySelector("input")!,
    list = panel.querySelector<HTMLElement>(".results")!;
  input.placeholder = dictionary
    ? "Find a symbol, category, or LaTeX…"
    : "Find a command…";
  input.setAttribute("aria-label", input.placeholder);
  list.id="palette-options";
  input.setAttribute("role","combobox");
  input.setAttribute("aria-autocomplete","list");
  input.setAttribute("aria-controls",list.id);
  input.setAttribute("aria-expanded","true");
  let index = 0;
  function draw() {
    index = 0;
    list.replaceChildren();
    const q = input.value.toLowerCase();
    const rows = dictionary
      ? symbols.map((s) => ({
          name: s.name,
          meta: s.category,
          code: s.code,
          terms: [...s.aliases, s.code, s.category].join(" "),
        }))
      : Object.keys(actions)
          .sort(
            (a, b) =>
              (recent.includes(b) ? 100 - recent.indexOf(b) : 0) -
              (recent.includes(a) ? 100 - recent.indexOf(a) : 0),
          )
          .map((name) => ({ name, meta: "", code: "", terms: "" }));
    for (const row of rows) {
      const hay = (row.name + " " + row.terms).toLowerCase();
      if (dictionary && !q.trim().split(/\s+/).every(term=>hay.includes(term))) continue;
      let offset = 0;
      if (
        ![...q].every((ch) => {
          const i = hay.indexOf(ch, offset);
          offset = i + 1;
          return i >= 0;
        })
      )
        continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.tabIndex = -1;
      btn.setAttribute("role", "option");
      btn.id="choice-"+list.children.length;
      if (dictionary) {
        const glyph = document.createElement("i");
        katex.render(row.code, glyph, { throwOnError: false });
        btn.append(glyph);
      }
      const name = document.createElement("span");
      name.textContent = row.name;
      btn.append(name);
      if (dictionary) {
        const small = document.createElement("small");
        small.textContent = row.meta;
        name.append(small);
        const code = document.createElement("code");
        code.textContent = row.code;
        btn.append(code);
      }
      btn.onclick = () => {
        dialog.close();
        view.focus();
        if (dictionary) {
          const code = inMath(view.state, view.state.selection.main.from)
            ? row.code + " "
            : "$" + row.code + "$";
          view.dispatch(view.state.replaceSelection(code));
        } else {
          if (recent.includes(row.name))
            recent.splice(recent.indexOf(row.name), 1);
          recent.unshift(row.name);
          localStorage.setItem(
            "narra.recent",
            JSON.stringify(recent.slice(0, 30)),
          );
          Promise.resolve(actions[row.name]()).catch(fail);
        }
      };
      list.append(btn);
    }
    if (!list.children.length) list.textContent = "No matches";
    highlight();
  }
  function highlight() {
    input.setAttribute("aria-activedescendant",list.children[index]?.id??"");
    [...list.querySelectorAll("button")].forEach((b, i) =>
      b.setAttribute("aria-selected", String(i === index)),
    );
    list.children[index]?.scrollIntoView({ block: "nearest" });
  }
  input.oninput = draw;
  input.onkeydown = (e) => {
    if (["ArrowUp", "ArrowDown", "Enter"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "Enter") (list.children[index] as HTMLElement)?.click();
      else {
        index = Math.max(
          0,
          Math.min(
            list.children.length - 1,
            index + (e.key === "ArrowDown" ? 1 : -1),
          ),
        );
        highlight();
      }
    }
  };
  if (!dialog.open) dialog.showModal();
  draw();
  input.focus();
}
function reload(buffer:Buffer) {
  if(buffer.version<=diskVersion)return;
  diskVersion=buffer.version;
  clearTimeout(timer);
  external=true;
  const scroll=view.scrollDOM.scrollTop;
  try {
    const length=EditorState.create({doc:buffer.text}).doc.length;
    view.dispatch({changes:{from:0,to:view.state.doc.length,insert:buffer.text},selection:{anchor:Math.min(view.state.selection.main.head,length)},annotations:Transaction.addToHistory.of(false)});
    saved=++revision;
    label();
    requestAnimationFrame(()=>view.scrollDOM.scrollTop=scroll);
  }finally{external=false}
}
async function start() {
  let b: Buffer = { path: null, text: "", version:0 };
  if (native) {
    [b, p] = await Promise.all([
      invoke<Buffer>("buffer"),
      invoke<Partial<Pref>>("config").then(readPreferences).catch(()=>({...defaults})),
    ]);
  } else
    Object.assign(
      p,
      JSON.parse(localStorage.getItem("narra.settings") || "{}"),
    );
  path = b.path;
  diskVersion=b.version;
  label();
  appearance(p);
  view = new EditorView({
    parent: document.querySelector("main")!,
    state: EditorState.create({
      doc: b.text,
      extensions: [
        history(),
        markdown(),
        engine(() => p.expand),
        mode.of(p.raw ? [] : preview),
        drawSelection(),
        EditorView.lineWrapping,
        keymap.of([...historyKeymap, ...defaultKeymap]),
        EditorView.contentAttributes.of({
          "aria-label": "Markdown document",
          spellcheck: "true",
        }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !external) {
            revision++;
            label();
            if (p.fade) document.body.classList.add("writing");
            if (path) {
              clearTimeout(timer);
              timer = window.setTimeout(() => save().catch(() => {}), p.delay);
            }
          }
          if ((u.docChanged || u.selectionSet) && p.typewriter && !external)
            view.requestMeasure({
              key: "center-caret",
              read: v => {
                const caret=v.coordsAtPos(v.state.selection.main.head);
                const rect=v.scrollDOM.getBoundingClientRect();
                return caret ? v.scrollDOM.scrollTop+(caret.top+caret.bottom-rect.top-rect.bottom)/2 : null;
              },
              write: (top,v) => {
                if(top!==null)v.scrollDOM.scrollTo({top,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
              }
            });
        }),
      ],
    }),
  });
  view.focus();
  let scrollTimer=0;
  view.scrollDOM.addEventListener("scroll",()=>{
    view.scrollDOM.classList.add("scrolling");
    clearTimeout(scrollTimer);
    scrollTimer=window.setTimeout(()=>view.scrollDOM.classList.remove("scrolling"),500);
  },{passive:true});
  if (native) {
    const win = getCurrentWindow();
    const nav = document.querySelector("nav")!;
    for (const [label, icon, fn] of [
      ["Minimize", "M2 8h10", () => win.minimize()],
      ["Maximize", "M2 2h10v10H2z", () => win.toggleMaximize()],
      ["Close", "M2 2l10 10M12 2L2 12", () => win.close()],
    ] as const) {
      const btn = document.createElement("button");
      btn.setAttribute("aria-label", label);
      btn.innerHTML = '<svg viewBox="0 0 14 14"><path d="' + icon + '"/></svg>';
      btn.onclick = fn;
      nav.append(btn);
    }
    await listen<Partial<Pref>>("preferences", (e) => apply(e.payload, false));
    await listen<Buffer>("disk-change", e=>reload(e.payload));
    reload(await invoke<Buffer>("buffer"));
    await win.onCloseRequested(async (e) => {
      if (path && revision !== saved) {
        e.preventDefault();
        try {
          await save();
          if (revision === saved) await win.destroy();
        } catch {}
      }
    });
  }
}
dialog.onclose = () => {
  if (!dialog.open) view?.focus();
};
window.addEventListener("mousemove", (e) => {
  if (e.clientY < 55) document.body.classList.remove("writing");
});
window.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Alt") document.body.classList.remove("writing");
    if (!view || !(e.ctrlKey || e.metaKey)) return;
    const keys: Record<string, () => unknown> = {
      p: () => palette(false),
      o: () => palette(true),
      ",": preferences,
      s: () => save(true),
      "=": () => zoom(p.size + 1),
      "+": () => zoom(p.size + 1),
      "-": () => zoom(p.size - 1),
      "0": () => zoom(defaults.size),
    };
    const fn = keys[e.key.toLowerCase()];
    if (fn) {
      e.preventDefault();
      Promise.resolve(fn()).catch(fail);
    }
  },
  true,
);
start().catch(fail);


