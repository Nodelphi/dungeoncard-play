// The Balatro-style tally behind every hit and every block:
//   result = (Base + flat bonuses) × Mult
// Bonuses apply in a fixed order: the card, Strength (or Dexterity), the card's rune, the hero's
// Momentum, each treasure from left to right, then statuses like Weak or Vulnerable.
// Each step is recorded so the UI can animate the numbers adding up.
//
// A modifier is { kind: "add" | "mult" | "xmult", value, label? }
//   add   → adds to Base (shown in gold)
//   mult  → adds to Mult (shown in crimson, "+2 Mult")
//   xmult → multiplies Mult ("×1.5")
import { TREASURES } from "../../data/treasures.js";
import { RUNES } from "../../data/runes.js";
import { HEROES } from "../../data/heroes.js";

const round2 = n => Math.round(n * 100) / 100;

/**
 * ctx: { kind: "attack" | "block", base, def, card, combat, run, target, hitIndex }
 * Returns { base, add, mult, final, steps }.
 */
export function tally(ctx) {
  const t = { base: ctx.base, add: 0, mult: 1, steps: [], ...(ctx.roll ? { roll: ctx.roll } : {}) };
  const apply = (src, id, mods) => {
    for (const m of [].concat(mods || [])) {
      if (!m || !m.value) continue;
      if (m.kind === "add") t.add += m.value;
      else if (m.kind === "mult") t.mult = round2(t.mult + m.value);
      else if (m.kind === "xmult") t.mult = round2(t.mult * m.value);
      t.steps.push({ src, id, kind: m.kind, value: m.value, label: m.label, add: t.add, mult: t.mult });
    }
  };
  const hook = ctx.kind === "attack" ? "onHit" : "onBlock";
  const player = ctx.combat?.player;

  // 1. The card's own bonuses.
  apply("card", ctx.def?.id, ctx.def?.[hook]?.(ctx));
  // 2. Strength boosts attacks, Dexterity boosts block.
  if (player) {
    const stat = ctx.kind === "attack" ? player.statuses.strength : player.statuses.dexterity;
    if (stat) apply("status", ctx.kind === "attack" ? "strength" : "dexterity", { kind: "add", value: stat });
    if (ctx.kind === "attack" && player.statuses.edge) apply("status", "edge", { kind: "add", value: player.statuses.edge });
  }
  // 3. The rune set into this card.
  const rune = ctx.card?.rune && RUNES[ctx.card.rune];
  if (rune) apply("rune", rune.id, rune[hook]?.(ctx));
  // 4. The hero's class mechanic.
  const hero = HEROES[ctx.run?.hero || "sellsword"];
  apply("hero", hero.id, hero[hook]?.(ctx));
  // 5. Treasures, left to right.
  // The Abyssal Lens copies the treasure to its right.
  const treasures = ctx.run?.treasures || [];
  treasures.forEach((tr, i) => {
    let source = tr;
    if (TREASURES[tr.id]?.copyRight) source = treasures[i + 1] && !TREASURES[treasures[i + 1].id].copyRight ? treasures[i + 1] : null;
    if (!source) return;
    const mods = TREASURES[source.id]?.[hook]?.(ctx, source.state || {});
    if (mods) apply("treasure", tr.id, [].concat(mods).map(m => m && { ...m, slot: i }));
  });
  // 6. Statuses on attacker and target.
  if (player) {
    if (ctx.kind === "attack") {
      if (player.statuses.weak) apply("status", "weak", { kind: "xmult", value: 0.75 });
      if (ctx.target?.statuses?.vulnerable) apply("status", "vulnerable", { kind: "xmult", value: 1.5 });
    } else if (player.statuses.frail) apply("status", "frail", { kind: "xmult", value: 0.75 });
  }
  t.final = Math.max(0, Math.floor((t.base + t.add) * t.mult));
  return t;
}
