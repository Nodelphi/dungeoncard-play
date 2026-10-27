// Tabletop dice for the Paladin's cards: "2d6+3" means roll two six-sided dice and add 3.
// A die that lands on its highest face (or near it, with Improved Critical or the Loaded Die) is a
// Critical, which the Paladin's mechanic turns into ×Mult.

/** "2d6+3" → { count: 2, sides: 6, mod: 3 }. A plain number is a roll with no dice. */
export function parseRoll(expr) {
  if (typeof expr === "number") return { count: 0, sides: 0, mod: expr };
  const m = /^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/.exec(String(expr).trim());
  if (!m) return { count: 0, sides: 0, mod: Number(expr) || 0 };
  return { count: +m[1], sides: +m[2], mod: m[3] ? (m[3] === "-" ? -1 : 1) * +m[4] : 0 };
}

/** Average result, for the bot and for tooltips. */
export const averageRoll = expr => { const r = parseRoll(expr); return r.count * (r.sides + 1) / 2 + r.mod; };

/**
 * Rolls an expression.
 *   advantage: roll each die twice and keep the higher.
 *   max: every die lands on its highest face (Natural Twenty).
 *   critRange: how many faces below the top also count as a Critical.
 *   extra: more dice to add, e.g. [{ count: 1, sides: 4, label: "Bless" }].
 * Returns { expr, mod, dice: [{ sides, value, other?, crit, label? }], total, crit }.
 */
export function rollDice(rng, expr, { advantage = false, max = false, critRange = 0, extra = [] } = {}) {
  const r = parseRoll(expr);
  const groups = [{ count: r.count, sides: r.sides }, ...extra];
  const dice = [];
  for (const g of groups) {
    for (let i = 0; i < g.count; i++) {
      const roll = () => (max ? g.sides : 1 + rng.int(g.sides));
      let value = roll(), other;
      if (advantage && !max) { other = roll(); if (other > value) [value, other] = [other, value]; }
      const crit = value >= g.sides - critRange;
      dice.push({ sides: g.sides, value, ...(other !== undefined ? { other } : {}), crit, ...(g.label ? { label: g.label } : {}) });
    }
  }
  const total = Math.max(0, dice.reduce((s, d) => s + d.value, 0) + r.mod);
  return { expr: String(expr), mod: r.mod, dice, total, crit: dice.some(d => d.crit) };
}
