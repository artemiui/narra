import {
  EditorState,
  StateField,
  StateEffect,
  RangeSetBuilder,
  Prec,
  type Transaction,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  WidgetType,
  ViewPlugin,
  keymap,
  type DecorationSet,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { isolateHistory } from "@codemirror/commands";
import katex from "katex";
import { expansion } from "./commands/mathAutoExpand";

type Equation = { from: number; to: number; display: boolean };
function scan(state: EditorState, start: number, end: number) {
  const out: Equation[] = [];
  const source = state.sliceDoc(start, end);
  const pattern =
    /(?<![\\$])(\$\$)([\s\S]*?)(?<!\\)\$\$|(?<![\\$])\$(?!\$)((?:\\[^\n]|[^\\$\n])*)\$/g;
  for (const m of source.matchAll(pattern)) {
    const from = start + m.index!;
    let node = syntaxTree(state).resolveInner(from, 1),
      code = false;
    for (let n: typeof node | null = node; n; n = n.parent)
      if (/^(FencedCode|InlineCode|CodeBlock)$/.test(n.name)) code = true;
    if (!code) out.push({ from, to: from + m[0].length, display: !!m[1] });
  }
  return out;
}
function changesDelimiters(t:Transaction) {
    let structural = false;
    t.changes.iterChanges((from, to, _a, _b, insert) => {
      const changed = t.startState.sliceDoc(from, to) + insert.toString();
      if (
        /[$\\\n\x60~]/.test(changed) ||
        t.startState.sliceDoc(Math.max(0, from - 1), from + 1).includes("$")
      )
        structural = true;
    });
    return structural;
}
const equations = StateField.define<Equation[]>({
  create: (s) => scan(s, 0, s.doc.length),
  update: (ranges, t) => {
    if (!t.docChanged) return ranges;
    if (changesDelimiters(t)) return scan(t.state, 0, t.newDoc.length);
    return ranges.map((r) => ({
      ...r,
      from: t.changes.mapPos(r.from, 1),
      to: t.changes.mapPos(r.to, -1),
    }));
  },
});
export function inMath(s: EditorState, pos: number) {
  return s
    .field(equations)
    .some(
      (r) =>
        pos >= r.from + (r.display ? 2 : 1) &&
        pos <= r.to - (r.display ? 2 : 1),
    );
}
const cache = new Map<string, HTMLElement>();
class MathWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly display: boolean,
  ) {
    super();
  }
  eq(other: MathWidget) {
    return other.source === this.source && other.display === this.display;
  }
  toDOM() {
    const key = Number(this.display) + this.source;
    let node = cache.get(key);
    if (!node) {
      node = document.createElement("span");
      try {
        katex.render(this.source, node, {
          displayMode: this.display,
          throwOnError: true,
          trust: false,
        });
      } catch {
        node.className = "raw";
        node.textContent = this.source;
      }
    }
    cache.delete(key);
    cache.set(key, node);
    if (cache.size > 512) cache.delete(cache.keys().next().value!);
    return node.cloneNode(true) as HTMLElement;
  }
  ignoreEvent() {
    return false;
  }
}
function renderMath(s: EditorState) {
  const b = new RangeSetBuilder<Decoration>(),
    sel = s.selection.main;
  for (const r of s.field(equations)) {
    if (sel.from <= r.to && sel.to >= r.from) {
      b.add(r.from,r.to,Decoration.mark({class:"raw"}));
      continue;
    }
    const n = r.display ? 2 : 1;
    b.add(
      r.from,
      r.to,
      Decoration.replace({
        widget: new MathWidget(s.sliceDoc(r.from + n, r.to - n), r.display),
      }),
    );
  }
  return b.finish();
}
const mathPreview = StateField.define<DecorationSet>({
  create: renderMath,
  update: (v, t) => {
    if(!t.docChanged&&!t.selection)return v;
    if(changesDelimiters(t))return renderMath(t.state);
    const old=t.startState.selection.main, next=t.state.selection.main;
    const mapped=v.map(t.changes);
    // Ordinary prose edits and cursor motion outside equations retain all widgets.
    const intersects=(r:Equation, s:typeof next)=>r.from<=s.to && r.to>=s.from;
    if(!t.startState.field(equations).some(r=>intersects(r,old)) &&
       !t.state.field(equations).some(r=>intersects(r,next)) &&
       (!t.docChanged || t.isUserEvent("input.type"))) return mapped;
    return renderMath(t.state);
  },
  provide: (f) => EditorView.decorations.from(f),
});
function markdownMarks(view: EditorView) {
  const ranges: import("@codemirror/state").Range<Decoration>[] = [],
    active = view.state.doc.lineAt(view.state.selection.main.head).number;
  for (const { from, to } of view.visibleRanges)
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(n) {
        const line = view.state.doc.lineAt(n.from);
        const names: Record<string, string> = {
          StrongEmphasis: "strong",
          Emphasis: "em",
          InlineCode: "code",
          FencedCode: "code",
          Blockquote: "quote",
          HorizontalRule: "divider",
        };
        const cls = n.name.startsWith("ATXHeading")
          ? "h" + n.name.slice(-1)
          : names[n.name];
        if (cls && n.to > n.from)
          ranges.push(
            Decoration.mark({ class: "md-" + cls }).range(n.from, n.to),
          );
        if (line.number === active) return;
        if (
          ["HeaderMark", "EmphasisMark", "CodeMark", "QuoteMark"].includes(
            n.name,
          )
        )
          ranges.push(Decoration.replace({}).range(n.from, n.to));
        if (n.name === "HorizontalRule")
          ranges.push(Decoration.line({ class: "rule" }).range(line.from));
        if (
          n.name === "ListMark" &&
          /^[-*]$/.test(view.state.sliceDoc(n.from, n.to))
        )
          ranges.push(Decoration.mark({ class: "bullet" }).range(n.from, n.to));
      },
    });
  return Decoration.set(ranges, true);
}
export const preview = [
  mathPreview,
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = markdownMarks(view);
      }
      update(u: import("@codemirror/view").ViewUpdate) {
        if (
          u.docChanged ||
          u.viewportChanged ||
          u.selectionSet ||
          syntaxTree(u.startState) !== syntaxTree(u.state)
        )
          this.decorations = markdownMarks(u.view);
      }
    },
    { decorations: (v) => v.decorations },
  ),
];
const setStops = StateEffect.define<number[]>();
const stops = StateField.define<number[]>({
  create: () => [],
  update: (previous, t) => {
    for (const e of t.effects) if (e.is(setStops)) return e.value;
    if (t.selection && !t.docChanged) return [];
    return previous.map((pos) => t.changes.mapPos(pos, 1));
  },
});
export function insertTemplate(
  v: EditorView,
  template: string,
  from = v.state.selection.main.from,
  to = v.state.selection.main.to,
  selected = v.state.sliceDoc(from, to),
) {
  const [prefix, ...fields] = template.split("@"),
    positions: number[] = [];
  let insert = prefix;
  for (const part of fields) {
    positions.push(from + insert.length);
    if (positions.length === 1) insert += selected;
    insert += part;
  }
  const anchor = positions.shift() ?? from + insert.length;
  v.dispatch({
    changes: { from, to, insert },
    selection: { anchor, head: anchor + (fields.length ? selected.length : 0) },
    effects: setStops.of(positions),
    annotations: isolateHistory.of("full"),
    userEvent: "input.complete",
  });
}
function continuation(v: EditorView) {
  const { head, empty } = v.state.selection.main;
  if (!empty) return false;
  const line = v.state.doc.lineAt(head),
    match = /^(\s*)([-*]|\d+\.|>) (.*)$/.exec(line.text);
  if (!match || head < line.from + match[1].length + match[2].length + 1)
    return false;
  if (!match[3])
    v.dispatch({ changes: { from: line.from, to: line.to, insert: "" } });
  else {
    const prefix =
      "\n" +
      match[1] +
      (/^\d/.test(match[2]) ? parseInt(match[2]) + 1 + "." : match[2]) +
      " ";
    v.dispatch(v.state.replaceSelection(prefix));
  }
  return true;
}
export function engine(expand: () => boolean) {
  return [
    equations,
    stops,
    Prec.high(
      keymap.of([
        { key: "Enter", run: continuation },
        {
          key: "Tab",
          run: (v) => {
            const [next, ...rest] = v.state.field(stops);
            if (next !== undefined) {
              v.dispatch({
                selection: { anchor: next },
                effects: setStops.of(rest),
              });
              return true;
            }
            const p = v.state.selection.main.head,
              tail = v.state.sliceDoc(p, v.state.doc.lineAt(p).to);
            const display=v.state.field(equations).find(r=>r.display&&p>=r.from+2&&p<=r.to-2);
            if(display && !/[)\]}]/.test(tail)) {
              v.dispatch({selection:{anchor:display.to}});return true;
            }
            const m = /^(?:[^)\]}\x60*$]*?)(\\right[)\]}]|[)\]}\x60*$])/.exec(
              tail,
            );
            if (!m) return false;
            v.dispatch({ selection: { anchor: p + m[0].length } });
            return true;
          },
        },
        {
          key: "Backspace",
          run: (v) => {
            const { head, empty } = v.state.selection.main;
            if(empty && head>=3 && v.state.sliceDoc(head-3,head+3)==="$$\n\n$$"){
              v.dispatch({changes:{from:head-3,to:head+3}});return true;
            }
            if (
              !empty ||
              !head ||
              !["$$", "()", "[]", "{}", "**", "\x60\x60"].includes(
                v.state.sliceDoc(head - 1, head + 1),
              )
            )
              return false;
            v.dispatch({ changes: { from: head - 1, to: head + 1 } });
            return true;
          },
        },
      ]),
    ),
    EditorView.inputHandler.of((v, from, to, text) => {
      if (text === " " && expand() && inMath(v.state, from)) {
        const before = v.state.sliceDoc(v.state.doc.lineAt(from).from, from),
          word = /(?<![\\a-zA-Z])([a-zA-Z]+)$/.exec(before)?.[1];
        const replacement = word && expansion(word);
        if (replacement) {
          insertTemplate(v, replacement, from - word!.length, to, "");
          return true;
        }
      }
      const pairs: Record<string, string> = {
        "(": ")",
        "[": "]",
        "{": "}",
        "*": "*",
        $: "$",
        "\x60": "\x60",
      };
      if (!Object.hasOwn(pairs,text)) return false;
      if (
        text === "$" &&
        from > 0 &&
        v.state.sliceDoc(from - 1, from + 1) === "$$"
      ) {
        v.dispatch({
          changes: { from: from - 1, to: from + 1, insert: "$$\n\n$$" },
          selection: { anchor: from + 2 },
        });
        return true;
      }
      const closer =
        text === "(" &&
        from >= 5 &&
        v.state.sliceDoc(from - 5, from) === "\\left" &&
        inMath(v.state, from)
          ? " \\right)"
          : pairs[text];
      v.dispatch({
        changes: {
          from,
          to,
          insert: text + v.state.sliceDoc(from, to) + closer,
        },
        selection: { anchor: from + 1, head: to + 1 },
      });
      return true;
    }),
  ];
}
export function equationRanges(state:EditorState){return state.field(equations)}
