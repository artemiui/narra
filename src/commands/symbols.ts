export type SymbolEntry = {
  name: string;
  category: string;
  code: string;
  aliases: string[];
  exact: boolean;
};
export const symbols: SymbolEntry[] = [];
function group(category: string, rows: string, exact = false) {
  for (const row of rows.split("\n")) {
    const [command, aliases, label] = row.trim().split("|");
    symbols.push({
      name: label || command,
      category,
      code: "\\" + command,
      aliases: (aliases || command).split(" "),
      exact,
    });
  }
}
group(
  "Logic",
  `implies|then implies|Logical Implies
iff||If and Only If
land|and|Logical And
lor|or|Logical Or
neg|not neg|Negation
forall||For All
exists||There Exists
nexists||Does Not Exist
therefore||Therefore
because||Because
vdash|turnstile proves|Turnstile
models|models entails|Entailment
bot|contradiction|Contradiction
top|tautology|Tautology`,
);
group("Modal logic", "Box|box nec|Necessity\nDiamond|diamond poss|Possibility");
group(
  "Sets",
  `in||Element Of
notin||Not an Element Of
subseteq|subset|Subset or Equal
subset|psubset|Proper Subset
supseteq|superset|Superset or Equal
cup|union|Union
cap|intersect|Intersection
emptyset|empty emptyset|Empty Set`,
);
group(
  "Relations and operators",
  `neq||Not Equal
leq||Less or Equal
geq||Greater or Equal
approx||Approximately Equal
equiv||Equivalent
times|cross|Cross Product
cdot|dot|Dot Product
otimes|tensor|Tensor Product
circ|compose|Composition
infty|inf infinity|Infinity
nabla|nabla grad|Gradient
partial||Partial Derivative
to|to arrow|Right Arrow
mapsto||Maps To Arrow`,
);
for (const word of "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi pi rho sigma tau upsilon phi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega".split(
  " ",
)) {
  group(
    "Greek",
    [
      (word === "epsilon" || word === "phi" ? "var" : "") + word,
      word,
      (word === word.toLowerCase() ? "Lowercase " : "Uppercase ") + word,
    ].join("|"),
    true,
  );
}
for (const [letter, name] of Object.entries({
  R: "Reals",
  N: "Naturals",
  Z: "Integers",
  Q: "Rationals",
  C: "Complex",
}))
  group(
    "Number sets",
    "mathbb{" + letter + "}|" + letter + letter + " " + name + "|" + name,
    true,
  );
