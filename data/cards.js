// Every card. `hero` says who can find it: a hero id, "neutral" (anyone), "token" (made by other cards)
// or "curse". Values live in `v`; `up` overrides them when upgraded. Effects name a value by key
// (n: "dmg") so text and play stay in step. Effect kinds:
//   damage {n, hits?, to?: "all", plusMomentum?, baseFrom?: {status, x} | {block: x}}, block, draw, energy,
//   status {status, n, to: "target"|"all"|"self"}, multStatus {status, x, to}, heal, gold, momentum,
//   addCard {id, to, count?}, loseHp, ifKilled {then}, upgradeHand, cleanse.
// Text placeholders like {dmg} are filled with the card's current values.
import { MOMENTUM_MULT } from "./heroes.js";
const C = (hero, id, name, type, rarity, cost, target, v, play, text, extra = {}) =>
  ({ hero, id, name, type, rarity, cost, target, v, play, text, art: "card_" + id, ...extra });

// ======================= The Sellsword =======================
const S = (...a) => C("sellsword", ...a);
const sellsword = [
  S("strike", "Strike", "attack", "starter", 1, "enemy", { dmg: 6 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage.", { up: { dmg: 9 } }),
  S("guard", "Guard", "skill", "starter", 1, "self", { block: 5 }, [{ do: "block", n: "block" }], "Gain {block} Block.", { up: { block: 8 } }),
  S("twin_cut", "Twin Cut", "attack", "starter", 1, "enemy", { dmg: 4, hits: 2 }, [{ do: "damage", n: "dmg", hits: "hits" }], "Deal {dmg} damage {hits} times.", { up: { dmg: 5 } }),
  S("cleave", "Cleave", "attack", "common", 1, "all", { dmg: 7 }, [{ do: "damage", n: "dmg", to: "all" }], "Deal {dmg} damage to ALL enemies.", { up: { dmg: 10 } }),
  S("shield_bash", "Shield Bash", "attack", "common", 1, "enemy", { dmg: 5, block: 5 }, [{ do: "damage", n: "dmg" }, { do: "block", n: "block" }], "Deal {dmg} damage. Gain {block} Block.", { up: { dmg: 7, block: 7 } }),
  S("lunge", "Lunge", "attack", "common", 0, "enemy", { dmg: 4, n: 1 }, [{ do: "damage", n: "dmg" }, { do: "draw", n: "n" }], "Deal {dmg} damage. Draw {n} card.", { up: { dmg: 6 } }),
  S("heavy_blow", "Heavy Blow", "attack", "common", 2, "enemy", { dmg: 14 }, [{ do: "damage", n: "dmg" }], "Heavy. Deal {dmg} damage.", { up: { dmg: 19 }, tags: ["heavy"] }),
  S("pommel_strike", "Pommel Strike", "attack", "common", 1, "enemy", { dmg: 8, n: 1 }, [{ do: "damage", n: "dmg" }, { do: "draw", n: "n" }], "Deal {dmg} damage. Draw {n} card.", { up: { dmg: 9, n: 2 } }),
  S("brace", "Brace", "skill", "common", 1, "self", { block: 8 }, [{ do: "block", n: "block" }], "Gain {block} Block.", { up: { block: 11 } }),
  S("sidestep", "Sidestep", "skill", "common", 1, "self", { block: 5, n: 1 }, [{ do: "block", n: "block" }, { do: "draw", n: "n" }], "Gain {block} Block. Draw {n} card.", { up: { block: 8 } }),
  S("battle_cry", "Battle Cry", "skill", "common", 0, "self", { n: 2 }, [{ do: "momentum", n: "n" }], "Gain {n} Momentum.", { up: { n: 3 } }),
  S("sunder", "Sunder", "attack", "common", 2, "enemy", { dmg: 10, n: 2 }, [{ do: "damage", n: "dmg" }, { do: "status", status: "vulnerable", n: "n", to: "target" }], "Deal {dmg} damage. Apply {n} Vulnerable.", { up: { dmg: 12, n: 3 } }),
  S("jab", "Jab", "attack", "common", 0, "enemy", { dmg: 3 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage.", { up: { dmg: 5 } }),
  S("taunt", "Taunt", "skill", "common", 1, "all", { n: 1, block: 4 }, [{ do: "status", status: "weak", n: "n", to: "all" }, { do: "block", n: "block" }], "Apply {n} Weak to ALL enemies. Gain {block} Block.", { up: { n: 2, block: 6 } }),
  S("second_wind", "Second Wind", "skill", "common", 1, "self", { block: 7, n: 1 }, [{ do: "block", n: "block" }, { do: "momentum", n: "n" }], "Gain {block} Block. Gain {n} Momentum.", { up: { block: 10 } }),
  S("flurry", "Flurry", "attack", "common", 1, "enemy", { dmg: 2, hits: 3 }, [{ do: "damage", n: "dmg", hits: "hits" }], "Deal {dmg} damage {hits} times.", { up: { hits: 4 } }),
  S("field_dressing", "Field Dressing", "skill", "common", 1, "self", { n: 5 }, [{ do: "heal", n: "n" }], "Heal {n} HP. Exhaust.", { up: { n: 8 }, exhaust: true }),
  S("serrated_edge", "Serrated Edge", "attack", "common", 1, "enemy", { dmg: 5, n: 3 }, [{ do: "damage", n: "dmg" }, { do: "status", status: "bleed", n: "n", to: "target" }], "Deal {dmg} damage. Apply {n} Bleed.", { up: { dmg: 6, n: 5 } }),
  S("whirlwind", "Whirlwind", "attack", "uncommon", 2, "all", { dmg: 5, hits: 2 }, [{ do: "damage", n: "dmg", hits: "hits", to: "all" }], "Deal {dmg} damage to ALL enemies {hits} times.", { up: { dmg: 7 } }),
  S("reaping_strike", "Reaping Strike", "attack", "uncommon", 2, "enemy", { dmg: 12, n: 2 }, [{ do: "damage", n: "dmg" }, { do: "ifKilled", then: [{ do: "energy", n: "n" }] }], "Deal {dmg} damage. If this kills, gain {n} Energy.", { up: { dmg: 16 } }),
  S("crushing_momentum", "Crushing Momentum", "attack", "uncommon", 1, "enemy", { dmg: 6 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage. Momentum counts double for this attack.", { up: { dmg: 9 },
    onHit: ctx => { const m = ctx.combat?.momentum || 0; return m ? { kind: "mult", value: m * MOMENTUM_MULT, label: "Crushing" } : null; } }),
  S("iron_will", "Iron Will", "power", "uncommon", 1, "self", { n: 3 }, [{ do: "status", status: "plating", n: "n", to: "self" }], "At the start of each turn, gain {n} Block.", { up: { n: 4 } }),
  S("inspire", "Inspire", "skill", "uncommon", 1, "self", { n: 2 }, [{ do: "draw", n: "n" }], "Draw {n} cards.", { up: { n: 3 } }),
  S("riposte", "Riposte", "skill", "uncommon", 1, "self", { block: 6, n: 5 }, [{ do: "block", n: "block" }, { do: "status", status: "edge", n: "n", to: "self" }], "Gain {block} Block. Your next attack gets +{n} damage.", { up: { block: 8, n: 7 } }),
  S("shield_wall", "Shield Wall", "skill", "uncommon", 2, "self", { block: 16 }, [{ do: "block", n: "block" }], "Gain {block} Block.", { up: { block: 22 } }),
  S("executioner", "Executioner", "attack", "uncommon", 2, "enemy", { dmg: 10 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage. ×2 Mult against enemies below half HP.", { up: { dmg: 14 },
    onHit: ctx => (ctx.target && ctx.target.hp < ctx.target.maxHp / 2 ? { kind: "xmult", value: 2, label: "Execute" } : null) }),
  S("adrenaline", "Adrenaline", "skill", "uncommon", 0, "self", { n: 1 }, [{ do: "energy", n: "n" }, { do: "draw", n: 1 }], "Gain {n} Energy. Draw 1 card. Exhaust.", { up: { n: 2 }, exhaust: true }),
  S("forge_ahead", "Forge Ahead", "attack", "uncommon", 1, "enemy", { dmg: 7, n: 1 }, [{ do: "damage", n: "dmg" }, { do: "momentum", n: "n" }], "Deal {dmg} damage. Gain {n} extra Momentum.", { up: { dmg: 10 } }),
  S("colossus_strike", "Colossus Strike", "attack", "rare", 3, "enemy", { dmg: 30 }, [{ do: "damage", n: "dmg" }], "Heavy. Deal {dmg} damage.", { up: { dmg: 40 }, tags: ["heavy"] }),
  S("berserk", "Berserk", "power", "rare", 1, "self", { n: 1 }, [{ do: "status", status: "berserk", n: "n", to: "self" }], "Start each turn with {n} Momentum.", { up: { cost: 0 } }),
  S("bloodlust", "Bloodlust", "power", "rare", 2, "self", { n: 1 }, [{ do: "status", status: "ritual", n: "n", to: "self" }], "At the start of each turn, gain {n} Strength.", { up: { cost: 1 } }),
  S("crescendo", "Crescendo", "attack", "rare", 2, "enemy", { dmg: 8 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage. +1 Mult for every other card played this turn.", { up: { dmg: 12 },
    onHit: ctx => { const n = ctx.combat?.cardsThisTurn || 0; return n ? { kind: "mult", value: n, label: "Crescendo" } : null; } }),
  S("gilded_blade", "Gilded Blade", "attack", "rare", 1, "enemy", { dmg: 4 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage, +1 for every 10 gold you hold.", { up: { dmg: 8 },
    onHit: ctx => { const g = Math.floor((ctx.run?.gold || 0) / 10); return g ? { kind: "add", value: g, label: "Gold" } : null; } }),
  S("storm_of_steel", "Storm of Steel", "attack", "rare", 2, "enemy", { dmg: 4, hits: 2 }, [{ do: "damage", n: "dmg", hits: "hits", plusMomentum: true }], "Deal {dmg} damage {hits} times, plus once more per Momentum.", { up: { dmg: 6 } }),
  S("unbreakable", "Unbreakable", "skill", "rare", 2, "self", { block: 10, n: 2 }, [{ do: "block", n: "block" }, { do: "status", status: "dexterity", n: "n", to: "self" }], "Gain {block} Block. Gain {n} Dexterity. Exhaust.", { up: { block: 14, n: 3 }, exhaust: true }),
];

// ======================= The Ember Witch =======================
const W = (...a) => C("ember_witch", ...a);
const burn = (n, to = "target") => ({ do: "status", status: "burn", n, to });
const witch = [
  W("firebolt", "Firebolt", "attack", "starter", 1, "enemy", { dmg: 5, n: 2 }, [{ do: "damage", n: "dmg" }, burn("n")], "Deal {dmg} damage. Apply {n} Burn.", { up: { dmg: 7, n: 3 } }),
  W("ward", "Ward", "skill", "starter", 1, "self", { block: 5 }, [{ do: "block", n: "block" }], "Gain {block} Block.", { up: { block: 8 } }),
  W("kindling", "Kindling", "skill", "starter", 0, "enemy", { n: 4 }, [burn("n")], "Apply {n} Burn.", { up: { n: 6 } }),
  W("flame_lash", "Flame Lash", "attack", "common", 1, "enemy", { dmg: 8 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage.", { up: { dmg: 11 } }),
  W("ember_spray", "Ember Spray", "attack", "common", 1, "all", { dmg: 4, n: 1 }, [{ do: "damage", n: "dmg", to: "all" }, burn("n", "all")], "Deal {dmg} damage and apply {n} Burn to ALL enemies.", { up: { dmg: 6, n: 2 } }),
  W("smolder", "Smolder", "skill", "common", 1, "enemy", { n: 5 }, [burn("n")], "Apply {n} Burn.", { up: { n: 8 } }),
  W("heat_shield", "Heat Shield", "skill", "common", 1, "self", { block: 7, n: 1 }, [{ do: "block", n: "block" }, burn("n", "all")], "Gain {block} Block. Apply {n} Burn to ALL enemies.", { up: { block: 10 } }),
  W("scorch", "Scorch", "attack", "common", 0, "enemy", { dmg: 3, n: 2 }, [{ do: "damage", n: "dmg" }, burn("n")], "Deal {dmg} damage. Apply {n} Burn.", { up: { dmg: 4, n: 3 } }),
  W("cinder_step", "Cinder Step", "skill", "common", 1, "self", { block: 5, n: 1 }, [{ do: "block", n: "block" }, { do: "draw", n: "n" }], "Gain {block} Block. Draw {n} card.", { up: { block: 8 } }),
  W("flare", "Flare", "attack", "common", 2, "enemy", { dmg: 14 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage.", { up: { dmg: 19 } }),
  W("fan_the_flames", "Fan the Flames", "skill", "uncommon", 1, "enemy", { x: 2 }, [{ do: "multStatus", status: "burn", x: "x", to: "target" }], "Double the target's Burn. Exhaust.", { up: { cost: 0 }, exhaust: true }),
  W("immolate", "Immolate", "attack", "uncommon", 2, "all", { dmg: 8, n: 3 }, [{ do: "damage", n: "dmg", to: "all" }, burn("n", "all")], "Deal {dmg} damage and apply {n} Burn to ALL enemies.", { up: { dmg: 11, n: 4 } }),
  W("wall_of_fire", "Wall of Fire", "skill", "uncommon", 2, "self", { block: 14, n: 2 }, [{ do: "block", n: "block" }, burn("n", "all")], "Gain {block} Block. Apply {n} Burn to ALL enemies.", { up: { block: 18 } }),
  W("pyre", "Pyre", "attack", "uncommon", 1, "enemy", { x: 2 }, [{ do: "damage", n: 0, baseFrom: { status: "burn", x: "x" } }], "Deal damage equal to {x}× the target's Burn.", { up: { x: 3 } }),
  W("searing_aura", "Searing Aura", "power", "uncommon", 1, "self", { n: 1 }, [{ do: "status", status: "aura", n: "n", to: "self" }], "At the start of each turn, apply {n} Burn to ALL enemies.", { up: { cost: 0 } }),
  W("flashfire", "Flashfire", "skill", "uncommon", 0, "enemy", { n: 2 }, [burn("n"), { do: "energy", n: 1 }], "Apply {n} Burn. Gain 1 Energy. Exhaust.", { up: { n: 4 }, exhaust: true }),
  W("cauterize", "Cauterize", "skill", "uncommon", 1, "self", { n: 4, block: 6 }, [{ do: "heal", n: "n" }, { do: "block", n: "block" }], "Heal {n} HP. Gain {block} Block. Exhaust.", { up: { n: 6, block: 9 }, exhaust: true }),
  W("conflagration", "Conflagration", "attack", "rare", 3, "enemy", { x: 4 }, [{ do: "damage", n: 0, baseFrom: { status: "burn", x: "x" } }], "Deal damage equal to {x}× the target's Burn.", { up: { x: 5 } }),
  W("phoenix_form", "Phoenix Form", "power", "rare", 2, "self", { n: 1 }, [{ do: "status", status: "ritual", n: "n", to: "self" }, { do: "status", status: "aura", n: "n", to: "self" }], "At the start of each turn, gain {n} Strength and apply {n} Burn to ALL enemies.", { up: { cost: 1 } }),
  W("inferno", "Inferno", "attack", "rare", 2, "all", { dmg: 5, hits: 3 }, [{ do: "damage", n: "dmg", hits: "hits", to: "all" }], "Deal {dmg} damage to ALL enemies {hits} times.", { up: { dmg: 7 } }),
  W("witchfire_brand", "Witchfire Brand", "skill", "rare", 1, "enemy", { x: 3 }, [{ do: "multStatus", status: "burn", x: "x", to: "target" }], "Triple the target's Burn. Exhaust.", { up: { cost: 0 }, exhaust: true }),
];

// ======================= The Shieldmaiden =======================
const M = (...a) => C("shieldmaiden", ...a);
const maiden = [
  M("spear_thrust", "Spear Thrust", "attack", "starter", 1, "enemy", { dmg: 6 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage.", { up: { dmg: 9 } }),
  M("raise_shield", "Raise Shield", "skill", "starter", 1, "self", { block: 6 }, [{ do: "block", n: "block" }], "Gain {block} Block.", { up: { block: 9 } }),
  M("shield_rush", "Shield Rush", "attack", "starter", 1, "enemy", { block: 5, dmg: 5 }, [{ do: "block", n: "block" }, { do: "damage", n: "dmg" }], "Gain {block} Block, then deal {dmg} damage.", { up: { block: 7, dmg: 7 } }),
  M("shield_slam", "Shield Slam", "attack", "common", 1, "enemy", { x: 1 }, [{ do: "damage", n: 0, baseFrom: { block: "x" } }], "Deal damage equal to your Block.", { up: { cost: 0 } }),
  M("phalanx", "Phalanx", "skill", "common", 1, "self", { block: 9 }, [{ do: "block", n: "block" }], "Gain {block} Block.", { up: { block: 12 } }),
  M("hold_the_line", "Hold the Line", "skill", "common", 2, "self", { block: 13, n: 1 }, [{ do: "block", n: "block" }, { do: "status", status: "fortify", n: "n", to: "self" }], "Gain {block} Block. Your Block doesn't expire next turn.", { up: { block: 17 } }),
  M("spear_volley", "Spear Volley", "attack", "common", 1, "all", { block: 3, dmg: 4 }, [{ do: "block", n: "block" }, { do: "damage", n: "dmg", to: "all" }], "Gain {block} Block, then deal {dmg} damage to ALL enemies.", { up: { block: 4, dmg: 6 } }),
  M("shove", "Shove", "attack", "common", 0, "enemy", { block: 3, dmg: 3 }, [{ do: "block", n: "block" }, { do: "damage", n: "dmg" }], "Gain {block} Block, then deal {dmg} damage.", { up: { block: 5, dmg: 5 } }),
  M("rally", "Rally", "skill", "common", 1, "self", { block: 5, n: 1 }, [{ do: "block", n: "block" }, { do: "draw", n: "n" }], "Gain {block} Block. Draw {n} card.", { up: { block: 8 } }),
  M("winter_gale", "Winter Gale", "skill", "common", 1, "all", { n: 1, block: 4 }, [{ do: "status", status: "weak", n: "n", to: "all" }, { do: "block", n: "block" }], "Apply {n} Weak to ALL enemies. Gain {block} Block.", { up: { n: 2, block: 6 } }),
  M("valkyrie_dive", "Valkyrie Dive", "attack", "uncommon", 2, "enemy", { dmg: 14 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage.", { up: { dmg: 19 } }),
  M("frost_aegis", "Frost Aegis", "power", "rare", 2, "self", { n: 1 }, [{ do: "status", status: "barricade", n: "n", to: "self" }], "Your Block no longer expires at the start of your turn.", { up: { cost: 1 } }),
  M("impale", "Impale", "attack", "uncommon", 2, "enemy", { dmg: 10, n: 2 }, [{ do: "damage", n: "dmg" }, { do: "status", status: "vulnerable", n: "n", to: "target" }], "Deal {dmg} damage. Apply {n} Vulnerable.", { up: { dmg: 13, n: 3 } }),
  M("counterstrike", "Counterstrike", "skill", "uncommon", 1, "self", { block: 6, n: 3 }, [{ do: "block", n: "block" }, { do: "status", status: "thorns", n: "n", to: "self" }], "Gain {block} Block. Gain {n} Thorns.", { up: { block: 9, n: 4 } }),
  M("battle_hymn", "Battle Hymn", "skill", "uncommon", 1, "self", { n: 1, block: 4 }, [{ do: "status", status: "strength", n: "n", to: "self" }, { do: "block", n: "block" }], "Gain {n} Strength. Gain {block} Block. Exhaust.", { up: { n: 2 }, exhaust: true }),
  M("aegis", "Aegis", "skill", "uncommon", 0, "self", { block: 4 }, [{ do: "block", n: "block" }], "Gain {block} Block.", { up: { block: 7 } }),
  M("shieldmaidens_oath", "Shieldmaiden's Oath", "power", "uncommon", 1, "self", { n: 4 }, [{ do: "status", status: "plating", n: "n", to: "self" }], "At the start of each turn, gain {n} Block.", { up: { n: 6 } }),
  M("ragnarok", "Ragnarok", "attack", "rare", 2, "all", { x: 1 }, [{ do: "damage", n: 0, to: "all", baseFrom: { block: "x" } }], "Deal damage equal to your Block to ALL enemies.", { up: { cost: 1 } }),
  M("unyielding", "Unyielding", "power", "rare", 1, "self", { n: 2 }, [{ do: "status", status: "dexterity", n: "n", to: "self" }], "Gain {n} Dexterity.", { up: { n: 3 } }),
  M("shield_of_ages", "Shield of Ages", "skill", "rare", 2, "self", { block: 24, n: 1 }, [{ do: "block", n: "block" }, { do: "status", status: "fortify", n: "n", to: "self" }], "Gain {block} Block. It doesn't expire next turn. Exhaust.", { up: { block: 32 }, exhaust: true }),
  M("thunder_spear", "Thunder Spear", "attack", "rare", 2, "enemy", { dmg: 9, hits: 2 }, [{ do: "damage", n: "dmg", hits: "hits" }], "Deal {dmg} damage {hits} times.", { up: { dmg: 12 } }),
];

// ======================= The Grave Thief =======================
const T = (...a) => C("grave_thief", ...a);
const thief = [
  T("stab", "Stab", "attack", "starter", 1, "enemy", { dmg: 6 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage.", { up: { dmg: 9 } }),
  T("dodge", "Dodge", "skill", "starter", 1, "self", { block: 5 }, [{ do: "block", n: "block" }], "Gain {block} Block.", { up: { block: 8 } }),
  T("backstab", "Backstab", "attack", "starter", 1, "enemy", { dmg: 9 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage.", { up: { dmg: 13 } }),
  T("shiv_toss", "Shiv Toss", "skill", "common", 0, "self", { n: 2 }, [{ do: "addCard", id: "shiv", to: "hand", count: "n" }], "Add {n} Shivs to your hand.", { up: { n: 3 } }),
  T("quick_slash", "Quick Slash", "attack", "common", 1, "enemy", { dmg: 7, n: 1 }, [{ do: "damage", n: "dmg" }, { do: "draw", n: "n" }], "Deal {dmg} damage. Draw {n} card.", { up: { dmg: 10 } }),
  T("pickpocket", "Pickpocket", "attack", "common", 1, "enemy", { dmg: 5, n: 8 }, [{ do: "damage", n: "dmg" }, { do: "gold", n: "n" }], "Deal {dmg} damage. Gain {n} gold. Exhaust.", { up: { dmg: 7, n: 12 }, exhaust: true }),
  T("smoke_bomb", "Smoke Bomb", "skill", "common", 1, "all", { block: 7, n: 1 }, [{ do: "block", n: "block" }, { do: "status", status: "weak", n: "n", to: "all" }], "Gain {block} Block. Apply {n} Weak to ALL enemies.", { up: { block: 10 } }),
  T("poisoned_blade", "Poisoned Blade", "attack", "common", 1, "enemy", { dmg: 4, n: 4 }, [{ do: "damage", n: "dmg" }, { do: "status", status: "bleed", n: "n", to: "target" }], "Deal {dmg} damage. Apply {n} Bleed.", { up: { dmg: 5, n: 6 } }),
  T("cheap_shot", "Cheap Shot", "attack", "common", 0, "enemy", { dmg: 4, n: 1 }, [{ do: "damage", n: "dmg" }, { do: "status", status: "vulnerable", n: "n", to: "target" }], "Deal {dmg} damage. Apply {n} Vulnerable.", { up: { dmg: 6 } }),
  T("tumble", "Tumble", "skill", "common", 0, "self", { block: 3, n: 1 }, [{ do: "block", n: "block" }, { do: "draw", n: "n" }], "Gain {block} Block. Draw {n} card.", { up: { block: 5 } }),
  T("assassinate", "Assassinate", "attack", "uncommon", 2, "enemy", { dmg: 18 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage.", { up: { dmg: 25 } }),
  T("blade_dance", "Blade Dance", "skill", "uncommon", 1, "self", { n: 3 }, [{ do: "addCard", id: "shiv", to: "hand", count: "n" }], "Add {n} Shivs to your hand.", { up: { n: 4 } }),
  T("garrote", "Garrote", "attack", "uncommon", 1, "enemy", { dmg: 3, n: 7 }, [{ do: "damage", n: "dmg" }, { do: "status", status: "bleed", n: "n", to: "target" }], "Deal {dmg} damage. Apply {n} Bleed.", { up: { n: 10 } }),
  T("shadowstep", "Shadowstep", "skill", "uncommon", 1, "self", { n: 2 }, [{ do: "energy", n: 1 }, { do: "draw", n: "n" }], "Gain 1 Energy. Draw {n} cards. Exhaust.", { up: { n: 3 }, exhaust: true }),
  T("marked_for_death", "Marked for Death", "skill", "uncommon", 1, "enemy", { n: 3 }, [{ do: "status", status: "vulnerable", n: "n", to: "target" }], "Apply {n} Vulnerable.", { up: { n: 5 } }),
  T("fence_goods", "Fence the Goods", "skill", "uncommon", 0, "self", { n: 20 }, [{ do: "gold", n: "n" }], "Gain {n} gold. Exhaust.", { up: { n: 30 }, exhaust: true }),
  T("evasion", "Evasion", "skill", "uncommon", 2, "self", { block: 15 }, [{ do: "block", n: "block" }], "Gain {block} Block.", { up: { block: 20 } }),
  T("deathblow", "Deathblow", "attack", "rare", 2, "enemy", { dmg: 12 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage. ×3 Mult if it's your first attack this turn.", { up: { dmg: 16 },
    onHit: ctx => (ctx.attackIndex === 0 ? { kind: "xmult", value: 3, label: "Deathblow" } : null) }),
  T("master_of_shadows", "Master of Shadows", "power", "rare", 1, "self", { n: 1 }, [{ do: "status", status: "shadows", n: "n", to: "self" }], "Your first {n} extra attack each turn also gets Ambush.", { up: { cost: 0 } }),
  T("jackpot", "Jackpot", "attack", "rare", 1, "enemy", { dmg: 5 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage. +1 Mult for every 25 gold you hold.", { up: { dmg: 9 },
    onHit: ctx => { const g = Math.floor((ctx.run?.gold || 0) / 25); return g ? { kind: "mult", value: g, label: "Jackpot" } : null; } }),
  T("blood_money", "Blood Money", "skill", "rare", 0, "self", { n: 2, gold: 15 }, [{ do: "loseHp", n: 6 }, { do: "energy", n: "n" }, { do: "gold", n: "gold" }], "Lose 6 HP. Gain {n} Energy and {gold} gold. Exhaust.", { up: { n: 3 }, exhaust: true }),
];

// ======================= Neutral: any hero can find these =======================
const N = (...a) => C("neutral", ...a);
const neutral = [
  N("quick_draw", "Quick Draw", "skill", "common", 0, "self", { n: 2 }, [{ do: "draw", n: "n" }], "Draw {n} cards. Exhaust.", { up: { n: 3 }, exhaust: true }),
  N("rusty_dagger", "Rusty Dagger", "attack", "common", 0, "enemy", { dmg: 4 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage.", { up: { dmg: 6 } }),
  N("bolas", "Bolas", "skill", "common", 1, "enemy", { n: 2 }, [{ do: "status", status: "weak", n: "n", to: "target" }], "Apply {n} Weak.", { up: { n: 3 } }),
  N("flask_toss", "Flask Toss", "attack", "common", 1, "all", { dmg: 6 }, [{ do: "damage", n: "dmg", to: "all" }], "Deal {dmg} damage to ALL enemies.", { up: { dmg: 9 } }),
  N("tactical_retreat", "Tactical Retreat", "skill", "common", 1, "self", { block: 12 }, [{ do: "block", n: "block" }], "Gain {block} Block. Exhaust.", { up: { block: 16 }, exhaust: true }),
  N("torchlight", "Torchlight", "attack", "common", 1, "enemy", { dmg: 7, n: 1 }, [{ do: "damage", n: "dmg" }, burn("n")], "Deal {dmg} damage. Apply {n} Burn.", { up: { dmg: 10, n: 2 } }),
  N("trip_wire", "Trip Wire", "skill", "common", 1, "all", { block: 6, n: 1 }, [{ do: "block", n: "block" }, { do: "status", status: "vulnerable", n: "n", to: "all" }], "Gain {block} Block. Apply {n} Vulnerable to ALL enemies.", { up: { block: 8 } }),
  N("bandage", "Bandage", "skill", "common", 0, "self", { n: 3 }, [{ do: "heal", n: "n" }], "Heal {n} HP. Exhaust.", { up: { n: 5 }, exhaust: true }),
  N("lantern", "Lantern", "power", "uncommon", 1, "self", { n: 1 }, [{ do: "status", status: "lantern", n: "n", to: "self" }], "Draw {n} extra card at the start of each turn.", { up: { cost: 0 } }),
  N("mercenary_contract", "Mercenary Contract", "skill", "uncommon", 0, "self", { n: 2 }, [{ do: "loseHp", n: 4 }, { do: "energy", n: "n" }], "Lose 4 HP. Gain {n} Energy. Exhaust.", { up: { n: 3 }, exhaust: true }),
  N("gold_tooth", "Gold Tooth", "skill", "uncommon", 0, "self", { n: 12 }, [{ do: "gold", n: "n" }], "Gain {n} gold. Exhaust.", { up: { n: 20 }, exhaust: true }),
  N("panacea", "Panacea", "skill", "uncommon", 1, "self", { block: 4 }, [{ do: "cleanse" }, { do: "block", n: "block" }], "Remove your Weak, Vulnerable, Frail, Bleed and Burn. Gain {block} Block.", { up: { block: 8 } }),
  N("iron_skin", "Iron Skin", "power", "uncommon", 1, "self", { n: 1 }, [{ do: "status", status: "dexterity", n: "n", to: "self" }], "Gain {n} Dexterity.", { up: { n: 2 } }),
  N("caltrops", "Caltrops", "power", "uncommon", 1, "self", { n: 3 }, [{ do: "status", status: "thorns", n: "n", to: "self" }], "Gain {n} Thorns.", { up: { n: 5 } }),
  N("desperate_strike", "Desperate Strike", "attack", "uncommon", 1, "enemy", { dmg: 8 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage. ×2 Mult while you're below half HP.", { up: { dmg: 11 },
    onHit: ctx => (ctx.combat && ctx.combat.player.hp < ctx.combat.player.maxHp / 2 ? { kind: "xmult", value: 2, label: "Desperate" } : null) }),
  N("apotheosis", "Apotheosis", "skill", "rare", 1, "self", {}, [{ do: "upgradeHand" }], "Upgrade every card in your hand for this fight. Exhaust.", { up: { cost: 0 }, exhaust: true }),
  N("dark_pact", "Dark Pact", "power", "rare", 1, "self", { n: 1 }, [{ do: "status", status: "pact", n: "n", to: "self" }], "At the start of each turn, gain {n} Energy and lose 2 HP.", { up: { cost: 0 } }),
  N("war_banner", "War Banner", "power", "rare", 2, "self", { n: 2 }, [{ do: "status", status: "strength", n: "n", to: "self" }], "Gain {n} Strength.", { up: { n: 3 } }),
];

// ======================= The Paladin (dice) =======================
// His numbers are tabletop rolls: { roll: "1d6+2" } and { do: "damage", roll: "roll" }.
const P = (...a) => C("paladin", ...a);
const dmgRoll = (k = "roll", extra = {}) => ({ do: "damage", roll: k, ...extra });
const blockRoll = (k = "guard") => ({ do: "block", roll: k });
const paladin = [
  P("slash", "Slash", "attack", "starter", 1, "enemy", { roll: "1d6+2" }, [dmgRoll()], "Deal {roll} damage.", { up: { roll: "1d6+5" } }),
  P("parry", "Parry", "skill", "starter", 1, "self", { guard: "1d4+3" }, [blockRoll()], "Gain {guard} Block.", { up: { guard: "1d4+6" } }),
  P("smite", "Smite", "attack", "starter", 1, "enemy", { roll: "2d6" }, [dmgRoll()], "Deal {roll} radiant damage.", { up: { roll: "2d8+1" } }),
  P("longsword", "Longsword", "attack", "common", 2, "enemy", { roll: "2d8+4" }, [dmgRoll()], "Heavy. Deal {roll} damage.", { up: { roll: "2d8+8" }, tags: ["heavy"] }),
  P("throwing_hammer", "Throwing Hammer", "attack", "common", 0, "enemy", { roll: "1d4+1" }, [dmgRoll()], "Deal {roll} damage.", { up: { roll: "1d4+3" } }),
  P("sweeping_blow", "Sweeping Blow", "attack", "common", 1, "all", { roll: "1d12" }, [dmgRoll("roll", { to: "all" })], "Deal {roll} damage to ALL enemies.", { up: { roll: "1d12+3" } }),
  P("bless", "Bless", "skill", "common", 1, "self", { n: 2, guard: "1d4+2" }, [{ do: "status", status: "advantage", n: "n", to: "self" }, blockRoll()], "Gain {n} Advantage. Gain {guard} Block.", { up: { n: 3, guard: "1d4+4" } }),
  P("buckler_bash", "Buckler Bash", "attack", "common", 1, "enemy", { roll: "1d6+1", guard: "1d6+1" }, [dmgRoll(), blockRoll()], "Deal {roll} damage. Gain {guard} Block.", { up: { roll: "1d6+3", guard: "1d6+3" } }),
  P("lay_on_hands", "Lay on Hands", "skill", "common", 1, "self", { heal: "2d6" }, [{ do: "heal", roll: "heal" }], "Heal {heal} HP. Exhaust.", { up: { heal: "3d6+1" }, exhaust: true }),
  P("turn_undead", "Turn Undead", "skill", "common", 1, "all", { n: 1, guard: "1d6+1" }, [{ do: "status", status: "weak", n: "n", to: "all" }, blockRoll()], "Apply {n} Weak to ALL enemies. Gain {guard} Block.", { up: { n: 2, guard: "1d6+3" } }),
  P("vow_of_enmity", "Vow of Enmity", "skill", "common", 1, "enemy", { n: 2, a: 1 }, [{ do: "status", status: "vulnerable", n: "n", to: "target" }, { do: "status", status: "advantage", n: "a", to: "self" }], "Apply {n} Vulnerable. Gain {a} Advantage.", { up: { n: 3 } }),
  P("hail_of_blows", "Hail of Blows", "attack", "common", 1, "enemy", { roll: "1d4+1", hits: 3 }, [dmgRoll("roll", { hits: "hits" })], "Deal {roll} damage {hits} times. Each hit rolls its own die.", { up: { hits: 4 } }),
  P("defensive_stance", "Defensive Stance", "skill", "common", 1, "self", { guard: "2d4+3", n: 1 }, [blockRoll(), { do: "draw", n: "n" }], "Gain {guard} Block. Draw {n} card.", { up: { guard: "2d4+6" } }),
  P("inspiration", "Inspiration", "skill", "common", 0, "self", { n: 1 }, [{ do: "status", status: "advantage", n: "n", to: "self" }, { do: "draw", n: 1 }], "Gain {n} Advantage. Draw 1 card.", { up: { n: 2 } }),
  P("destructive_wave", "Destructive Wave", "attack", "uncommon", 2, "all", { roll: "4d6" }, [dmgRoll("roll", { to: "all" })], "Deal {roll} thunder damage to ALL enemies.", { up: { roll: "5d6+2" } }),
  P("divine_favor", "Divine Favor", "power", "uncommon", 1, "self", { n: 1 }, [{ do: "status", status: "bless", n: "n", to: "self" }], "Your attacks roll an extra {n}d4.", { up: { cost: 0 } }),
  P("reckless_attack", "Reckless Attack", "attack", "uncommon", 1, "enemy", { roll: "2d6+3" }, [{ do: "status", status: "advantage", n: 1, to: "self" }, dmgRoll(), { do: "status", status: "vulnerable", n: 1, to: "self" }], "Attack with Advantage for {roll} damage. Gain 1 Vulnerable.", { up: { roll: "2d6+7" } }),
  P("improved_critical", "Improved Critical", "power", "uncommon", 1, "self", { n: 1 }, [{ do: "status", status: "keen", n: "n", to: "self" }], "Your dice also score a Critical one face below their highest.", { up: { cost: 0 } }),
  P("guiding_bolt", "Guiding Bolt", "attack", "uncommon", 1, "enemy", { roll: "2d6", n: 1 }, [dmgRoll(), { do: "status", status: "vulnerable", n: "n", to: "target" }], "Deal {roll} radiant damage. Apply {n} Vulnerable.", { up: { roll: "2d6+3", n: 2 } }),
  P("spiritual_weapon", "Spiritual Weapon", "power", "uncommon", 2, "self", { n: 1 }, [{ do: "status", status: "spirit", n: "n", to: "self" }], "At the start of each turn, a spectral blade deals {n}d8 damage to a random enemy.", { up: { cost: 1 } }),
  P("shield_of_faith", "Shield of Faith", "skill", "uncommon", 1, "self", { guard: "2d8+3" }, [blockRoll()], "Gain {guard} Block.", { up: { guard: "2d8+7" } }),
  P("extra_attack", "Extra Attack", "attack", "uncommon", 1, "enemy", { roll: "1d8+1", hits: 2 }, [dmgRoll("roll", { hits: "hits" })], "Deal {roll} damage {hits} times.", { up: { roll: "1d8+3" } }),
  P("heroism", "Heroism", "skill", "uncommon", 1, "self", { guard: "1d6+4", n: 1 }, [blockRoll(), { do: "status", status: "strength", n: "n", to: "self" }], "Gain {guard} Block and {n} Strength. Exhaust.", { up: { n: 2 }, exhaust: true }),
  P("vorpal_strike", "Vorpal Strike", "attack", "rare", 2, "enemy", { roll: "3d10" }, [dmgRoll()], "Deal {roll} damage. Criticals on this card are ×3 instead of ×2.", { up: { roll: "3d10+6" }, critX: 3 }),
  P("natural_twenty", "Natural Twenty", "skill", "rare", 1, "self", { n: 1 }, [{ do: "status", status: "nat20", n: "n", to: "self" }], "Your next card that rolls dice rolls every die at its highest. Exhaust.", { up: { cost: 0 }, exhaust: true }),
  P("sunburst", "Sunburst", "attack", "rare", 3, "all", { roll: "5d6" }, [dmgRoll("roll", { to: "all" })], "Deal {roll} radiant damage to ALL enemies.", { up: { roll: "7d6" } }),
  P("divine_smite", "Divine Smite", "attack", "rare", 2, "enemy", { roll: "4d8", heal: "1d8" }, [dmgRoll(), { do: "heal", roll: "heal" }], "Deal {roll} radiant damage. Heal {heal} HP.", { up: { roll: "5d8" } }),
  P("aura_of_courage", "Aura of Courage", "power", "rare", 1, "self", { n: 1 }, [{ do: "status", status: "courage", n: "n", to: "self" }], "Gain {n} Advantage at the start of each turn.", { up: { cost: 0 } }),
];

// ======================= Tokens and curses =======================
const tokens = [
  C("token", "shiv", "Shiv", "attack", "token", 0, "enemy", { dmg: 4 }, [{ do: "damage", n: "dmg" }], "Deal {dmg} damage. Exhaust.", { up: { dmg: 6 }, exhaust: true }),
  C("curse", "wound", "Wound", "curse", "curse", null, "none", {}, [], "Unplayable."),
  C("curse", "dread", "Dread", "curse", "curse", null, "none", {}, [], "Unplayable. While in hand, lose 1 HP at the end of your turn.", { endTurnInHand: [{ do: "loseHp", n: 1 }] }),
];

const list = [...sellsword, ...witch, ...maiden, ...thief, ...paladin, ...neutral, ...tokens];
export const CARDS = Object.fromEntries(list.map(c => [c.id, c]));

/** Cards a hero can be offered (their own plus neutral ones) of a rarity. */
export const cardPool = (heroId, rarity) => list.filter(c => c.rarity === rarity && (c.hero === heroId || c.hero === "neutral"));

/** The card's numbers, with upgrades applied. */
export function cardValues(card) {
  const def = CARDS[card.id];
  return { ...def.v, ...(card.upgraded ? def.up : {}) };
}
export function cardCost(card) {
  const def = CARDS[card.id];
  if (def.cost === null) return null;
  let cost = card.upgraded && def.up?.cost !== undefined ? def.up.cost : def.cost;
  if (card.rune === "swift") cost = Math.max(0, cost - 1);
  return cost;
}
export function cardText(card) {
  const v = cardValues(card);
  return CARDS[card.id].text.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "?");
}
export const cardName = card => CARDS[card.id].name + (card.upgraded ? "+" : "");
