// Treasures are the run's Balatro jokers: you hold up to 5, their order matters (they apply left to
// right), and you can sell them. Hooks:
//   onHit(ctx, state) / onBlock(ctx, state) → modifier(s) for a tally: { kind: "add"|"mult"|"xmult", value }
//   onCombatStart(api, state), onTurnStart(api, state), onCardPlayed(api, card, def, state),
//   onKill(api, enemy, state), onCombatEnd(api, state), onPickup(run, state)
// `state` is the treasure's own saved memory (for treasures that grow). `text` may use {x} from describe().
const T = (id, name, rarity, text, hooks = {}) => ({ id, name, rarity, text, art: "treasure_" + id, ...hooks });
const isAttack = ctx => ctx.def?.type === "attack";
const cost = ctx => ctx.cost ?? ctx.def?.cost ?? 0;

const list = [
  // ---------- Common: flat bonuses and small comforts ----------
  T("whetstone", "Whetstone", "common", "Attacks deal +3 damage.",
    { onHit: () => ({ kind: "add", value: 3 }) }),
  T("iron_buckler", "Iron Buckler", "common", "Block cards give +3 Block.",
    { onBlock: () => ({ kind: "add", value: 3 }) }),
  T("ogres_belt", "Ogre's Belt", "common", "Attacks that cost 2 or more get +1 Mult.",
    { onHit: ctx => (cost(ctx) >= 2 ? { kind: "mult", value: 1 } : null) }),
  T("lucky_coin", "Lucky Coin", "common", "Each hit has a 1 in 4 chance of +2 Mult.",
    { onHit: ctx => (ctx.combat?.rng.chance(0.25) ? { kind: "mult", value: 2 } : null) }),
  T("misers_purse", "Miser's Purse", "common", "After each fight, gain 1 gold for every 10 you hold (up to 6).",
    { onCombatEnd: api => api.gold(Math.min(6, Math.floor(api.run.gold / 10))) }),
  T("travelers_flask", "Traveler's Flask", "common", "Heal 4 HP after each fight.",
    { onCombatEnd: api => api.heal(4) }),
  T("jagged_edge", "Jagged Edge", "common", "Hits with 5 or less Base damage get +4.",
    { onHit: ctx => (ctx.base <= 5 ? { kind: "add", value: 4 } : null) }),
  T("war_drum", "War Drum", "common", "Start each fight with 2 Momentum on your first turn.",
    { hero: "sellsword", onCombatStart: api => api.momentum(2) }),
  T("oak_heart", "Oak Heart", "common", "Gain 10 Max HP when found.",
    { onPickup: run => { run.maxHp += 10; run.hp += 10; } }),

  // ---------- Uncommon: +Mult and synergies ----------
  T("duelists_glove", "Duelist's Glove", "uncommon", "Attacks against an enemy at full HP get +2 Mult.",
    { onHit: ctx => (ctx.target && ctx.target.hp >= ctx.target.maxHp ? { kind: "mult", value: 2 } : null) }),
  T("rage_mask", "Rage Mask", "uncommon", "While you're below half HP, attacks get +2 Mult.",
    { onHit: ctx => (ctx.combat && ctx.combat.player.hp < ctx.combat.player.maxHp / 2 ? { kind: "mult", value: 2 } : null) }),
  T("chain_links", "Chain Links", "uncommon", "Attacks get +0.5 Mult for every card played before them this turn.",
    { onHit: ctx => { const n = ctx.combat?.cardsThisTurn || 0; return n ? { kind: "mult", value: n * 0.5 } : null; } }),
  T("spiked_pauldron", "Spiked Pauldron", "uncommon", "Start each fight with 3 Thorns.",
    { onCombatStart: api => api.status(api.combat.player, "thorns", 3) }),
  T("tower_shield", "Tower Shield", "uncommon", "Block gets +1 Mult.",
    { onBlock: () => ({ kind: "mult", value: 1 }) }),
  T("bone_dice", "Bone Dice", "uncommon", "Attacks that cost 0 get ×2 Mult.",
    { onHit: ctx => (cost(ctx) === 0 && isAttack(ctx) ? { kind: "xmult", value: 2 } : null) }),
  T("blood_chalice", "Blood Chalice", "uncommon", "Heal 3 HP whenever you slay an enemy.",
    { onKill: api => api.heal(3) }),
  T("merchants_scale", "Merchant's Scale", "uncommon", "Everything in the shop costs 25% less.", { discount: 0.25 }),
  T("hunters_mark", "Hunter's Mark", "uncommon", "Attacks against Vulnerable enemies get +2 Mult.",
    { onHit: ctx => (ctx.target?.statuses?.vulnerable ? { kind: "mult", value: 2 } : null) }),
  T("grimoire", "Crimson Grimoire", "uncommon", "Draw 2 extra cards at the start of each fight.",
    { onCombatStart: api => api.draw(2) }),
  T("ember_brand", "Ember Brand", "uncommon", "In a multi-hit attack, each hit gets +1 more Mult than the hit before it.",
    { onHit: ctx => (ctx.hitIndex > 0 ? { kind: "mult", value: ctx.hitIndex } : null) }),

  // ---------- Rare: ×Mult ----------
  T("wyrms_eye", "Wyrm's Eye", "rare", "Your third attack each turn gets ×2 Mult.",
    { onHit: ctx => (ctx.attackIndex === 2 ? { kind: "xmult", value: 2 } : null) }),
  T("glass_crown", "Glass Crown", "rare", "Attacks get ×1.5 Mult, but you take 25% more damage.",
    { onHit: () => ({ kind: "xmult", value: 1.5 }), fragile: 1.25 }),
  T("bloodied_banner", "Bloodied Banner", "rare", "Attacks get ×{x} Mult. Gains ×0.25 each time you slay an elite or boss.",
    { describe: s => ({ x: (1 + 0.25 * (s.elites || 0)).toFixed(2) }),
      onHit: (ctx, s) => (s.elites ? { kind: "xmult", value: 1 + 0.25 * s.elites } : null),
      onKill: (api, enemy, s) => { if (enemy.elite || enemy.boss) s.elites = (s.elites || 0) + 1; } }),
  T("executioners_hood", "Executioner's Hood", "rare", "Attacks against enemies below 30% HP get ×2 Mult.",
    { onHit: ctx => (ctx.target && ctx.target.hp < ctx.target.maxHp * 0.3 ? { kind: "xmult", value: 2 } : null) }),
  T("golden_idol", "Golden Idol", "rare", "Attacks get ×1 Mult plus ×0.1 for every 25 gold you hold.",
    { onHit: ctx => { const g = Math.floor((ctx.run?.gold || 0) / 25); return g ? { kind: "xmult", value: 1 + g * 0.1 } : null; } }),
  T("berserkers_torc", "Berserker's Torc", "rare", "Each attack this turn gets ×1.2 Mult for every attack played before it.",
    { onHit: ctx => (ctx.attackIndex > 0 ? { kind: "xmult", value: Math.round(1.2 ** ctx.attackIndex * 100) / 100 } : null) }),
  T("heirloom_hammer", "Heirloom Hammer", "rare", "Heavy attacks get +{x} damage. Grows by 3 each time you play a Heavy attack.",
    { describe: s => ({ x: 6 + 3 * (s.n || 0) }),
      onHit: (ctx, s) => (ctx.def?.tags?.includes("heavy") ? { kind: "add", value: 6 + 3 * (s.n || 0) } : null),
      onCardPlayed: (api, card, def, s) => { if (def.tags?.includes("heavy")) s.n = (s.n || 0) + 1; } }),

  // ---------- Legendary ----------
  T("dragons_heart", "Dragon's Heart", "legendary", "Attacks get ×2 Mult.",
    { onHit: () => ({ kind: "xmult", value: 2 }) }),
  T("mountain_crown", "Crown of the Mountain King", "legendary", "Attacks get +1 Mult for every treasure you hold.",
    { onHit: ctx => ({ kind: "mult", value: ctx.run?.treasures?.length || 0 }) }),
  T("abyssal_lens", "Abyssal Lens", "legendary", "Copies the treasure to its right.", { copyRight: true }),

  // ---------- Expansion: neutral ----------
  T("hourglass", "Sandglass of Haste", "uncommon", "Attacks on your first turn of each fight get ×2 Mult.",
    { onHit: ctx => (ctx.combat?.turn === 1 ? { kind: "xmult", value: 2 } : null) }),
  T("crows_feather", "Crow's Feather", "uncommon", "Draw 1 extra card at the start of each turn.",
    { onTurnStart: api => api.draw(1) }),
  T("philosophers_stone", "Philosopher's Stone", "legendary", "Gain 1 Energy each turn. Monsters start each fight with 2 Strength.",
    { onTurnStart: api => api.energy(1), onCombatStart: api => api.combat.enemies.forEach(e => api.status(e, "strength", 2)) }),
  T("lantern_of_souls", "Lantern of Souls", "rare", "Attacks get +{x} Mult. Gains +0.1 for every monster you slay.",
    { describe: s => ({ x: ((s.kills || 0) * 0.1).toFixed(1) }),
      onHit: (ctx, s) => (s.kills ? { kind: "mult", value: Math.round(s.kills) / 10 } : null),
      onKill: (api, e, s) => { s.kills = (s.kills || 0) + 1; } }),
  T("minimalist_band", "Ascetic's Band", "rare", "While your deck has 15 cards or fewer, attacks get ×2 Mult.",
    { onHit: ctx => ((ctx.run?.deck?.length || 99) <= 15 ? { kind: "xmult", value: 2 } : null) }),
  T("hoarders_sigil", "Hoarder's Sigil", "rare", "Attacks get +0.05 Mult for every card in your deck.",
    { onHit: ctx => ({ kind: "mult", value: Math.round((ctx.run?.deck?.length || 0) * 5) / 100 }) }),
  T("rusted_gorget", "Rusted Gorget", "common", "Start each fight with 6 Block.",
    { onCombatStart: api => api.gainBlock(6) }),
  T("steel_toecaps", "Steel Toecaps", "common", "Attacks against Weak enemies get +4 damage.",
    { onHit: ctx => (ctx.target?.statuses?.weak ? { kind: "add", value: 4 } : null) }),
  T("quartz_prism", "Quartz Prism", "uncommon", "Attacks that hit ALL enemies get +2 Mult.",
    { onHit: ctx => (ctx.def?.target === "all" ? { kind: "mult", value: 2 } : null) }),
  T("grave_dust", "Grave Dust", "uncommon", "Deal 6 damage to ALL enemies at the start of each fight.",
    { onCombatStart: api => api.combat.enemies.forEach(e => api.rawDamage(e, 6)) }),
  T("runic_anvil", "Runic Anvil", "rare", "Cards with a rune get ×1.5 Mult on attacks and Block.",
    { onHit: ctx => (ctx.card?.rune ? { kind: "xmult", value: 1.5 } : null), onBlock: ctx => (ctx.card?.rune ? { kind: "xmult", value: 1.5 } : null) }),
  T("blood_moon", "Blood Moon Amulet", "legendary", "Attacks get ×3 Mult. Lose 3 HP at the start of each turn.",
    { onHit: () => ({ kind: "xmult", value: 3 }), onTurnStart: api => api.loseHp(3) }),

  // ---------- Expansion: one hero only ----------
  T("war_horn", "Mercenary's War Horn", "uncommon", "Momentum gives +0.25 extra Mult per stack.",
    { hero: "sellsword", onHit: ctx => (ctx.combat?.momentum ? { kind: "mult", value: ctx.combat.momentum * 0.25 } : null) }),
  T("captains_seal", "Captain's Seal", "rare", "Start each turn with 1 Momentum.",
    { hero: "sellsword", onTurnStart: api => api.momentum(1) }),
  T("ember_heart", "Ember Heart", "rare", "Burn you apply is increased by 1.", { hero: "ember_witch", burnBonus: 1 }),
  T("cinder_crown", "Cinder Crown", "uncommon", "Kindle gives +0.25 extra Mult per Burn.",
    { hero: "ember_witch", onHit: ctx => (ctx.target?.statuses?.burn ? { kind: "mult", value: ctx.target.statuses.burn * 0.25 } : null) }),
  T("valkyrie_helm", "Valkyrie Helm", "uncommon", "Start each fight with 10 Block.",
    { hero: "shieldmaiden", onCombatStart: api => api.gainBlock(10) }),
  T("jarls_shield_boss", "Jarl's Shield Boss", "rare", "Attacks get +1 more damage for every 4 Block you have.",
    { hero: "shieldmaiden", onHit: ctx => { const extra = Math.floor((ctx.combat?.player?.block || 0) / 4); return extra ? { kind: "add", value: extra } : null; } }),
  T("shadow_cloak", "Shadow Cloak", "uncommon", "Your Ambush attack also gets +6 damage.",
    { hero: "grave_thief", onHit: ctx => (ctx.attackIndex === 0 ? { kind: "add", value: 6 } : null) }),
  T("lockpick_set", "Lockpick Set", "common", "Gain 6 gold after each fight.",
    { hero: "grave_thief", onCombatEnd: api => api.gold(6) }),

  // ---------- The Paladin's dice ----------
  T("dice_bag", "Dice Bag", "common", "Every die you roll adds +1 to that hit or Block.",
    { hero: "paladin", onHit: ctx => (ctx.roll?.dice.length ? { kind: "add", value: ctx.roll.dice.length } : null),
      onBlock: ctx => (ctx.roll?.dice.length ? { kind: "add", value: ctx.roll.dice.length } : null) }),
  T("loaded_die", "Loaded Die", "uncommon", "Your dice also score a Critical one face below their highest.", { hero: "paladin", critRange: 1 }),
  T("holy_symbol", "Holy Symbol", "rare", "Criticals get one more ×Mult (×3 instead of ×2).", { hero: "paladin", critBonus: 1 }),
  T("fates_dice", "Fate's Dice", "legendary", "Every die you roll has Advantage: roll it twice and keep the higher.", { hero: "paladin", advantage: 1 }),
];

export const TREASURES = Object.fromEntries(list.map(t => [t.id, t]));

/**
 * Treasures as they act, with the Abyssal Lens standing in for its right-hand neighbour.
 * The Lens copies effects, not memory: a copied treasure that grows (has describe/state) only grows once.
 */
export function effectiveTreasures(run) {
  const ts = run.treasures || [];
  return ts.map((tr, i) => {
    if (!TREASURES[tr.id]?.copyRight) return { slot: i, id: tr.id, def: TREASURES[tr.id], state: (tr.state ||= {}) };
    const next = ts[i + 1];
    if (!next || TREASURES[next.id].copyRight) return null;
    const src = TREASURES[next.id];
    const def = src.describe ? { ...src, onKill: undefined, onCardPlayed: undefined } : src;
    return { slot: i, id: tr.id, def, state: (next.state ||= {}), copy: true };
  }).filter(Boolean);
}
/** Passive treasure flags, counting Abyssal Lens copies: fragile (×), burnBonus (+), discount (max). */
export function treasureFlag(run, key) {
  const defs = effectiveTreasures(run).map(t => t.def);
  if (key === "fragile") return defs.reduce((m, d) => m * (d.fragile || 1), 1);
  if (key === "discount") return defs.reduce((m, d) => Math.max(m, d.discount || 0), 0);
  return defs.reduce((sum, d) => sum + (d[key] || 0), 0);
}
export const RARITY_PRICE = { common: 90, uncommon: 135, rare: 190, legendary: 280 };

/** Treasure text with its current numbers filled in. */
export function treasureText(tr) {
  const def = TREASURES[tr.id];
  const vals = def.describe ? def.describe(tr.state || {}) : {};
  return def.text.replace(/\{(\w+)\}/g, (_, k) => vals[k] ?? "?");
}
