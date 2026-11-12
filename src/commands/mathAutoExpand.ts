import { symbols } from "./symbols";
import { structures as s } from "./structures";
const universal = new Map<string, string>(),
  exact = new Map<string, string>();
for (const row of symbols)
  for (const alias of row.aliases)
    (row.exact ? exact : universal).set(alias, row.code + " ");
const templates: Record<string, string> = {
  lim: s["Calculus: Limit"],
  int: s["Calculus: Definite Integral"],
  iint: s["Calculus: Double Integral"],
  iiint: s["Calculus: Triple Integral"],
  oint: s["Calculus: Contour Integral"],
  sum: s["Calculus: Summation"],
  prod: s["Calculus: Product"],
  frac: s["Math: Fraction"],
  sqrt: s["Math: Square Root"],
  dv: "\\frac{d@}{dx}",
  pdv: "\\frac{\\partial @}{\\partial x}",
  vec: "\\vec{@}",
  hat: "\\hat{@}",
  bar: "\\bar{@}",
};
export function expansion(word: string) {
  return (
    exact.get(word) ??
    universal.get(word.toLowerCase()) ??
    (Object.hasOwn(templates,word.toLowerCase())?templates[word.toLowerCase()]:undefined)
  );
}
