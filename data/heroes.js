// The four delvers. Each has a starting deck, a class mechanic that feeds the Balatro-style tally,
// and a badge the fight screen shows (badge returns text, or null when idle).
export const MOMENTUM_MULT = 0.75;
export const KINDLE_MULT = 0.4;
export const AMBUSH_X = 1.75;
export const BULWARK_PER = 2;
export const CRIT_X = 2;
const critical = ctx => (ctx.roll?.crit ? { kind: "xmult", value: ctx.roll.critX || CRIT_X, label: "Critical!" } : null);

export const HEROES = {
  sellsword: {
    id: "sellsword", name: "The Sellsword", short: "Sellsword", pronoun: "he", color: "#c0392b",
    title: "Blade for hire, delver of crypts",
    blurb: "A battle-hardened mercenary. Chains attacks together, each one hitting harder than the last.",
    maxHp: 80, gold: 99, art: "hero_sellsword",
    deck: ["strike", "strike", "strike", "strike", "guard", "guard", "guard", "guard", "twin_cut", "battle_cry"],
    mechanic: "Momentum",
    mechanicText: `Each attack you play adds +${MOMENTUM_MULT} Mult to your later attacks this turn.`,
    onHit(ctx) {
      const m = ctx.combat?.momentum || 0;
      return m ? { kind: "mult", value: m * MOMENTUM_MULT, label: `Momentum ${m}` } : null;
    },
    badge: c => (c.momentum ? `MOMENTUM ${c.momentum} · +${Math.round(c.momentum * MOMENTUM_MULT * 10) / 10} MULT` : "MOMENTUM"),
    badgeActive: c => c.momentum > 0,
  },
  ember_witch: {
    id: "ember_witch", name: "Ysolde, the Ember Witch", short: "Ember Witch", pronoun: "she", color: "#e0703f",
    title: "Exiled pyromancer of the Ashen Circle",
    blurb: "Sets her foes alight, then fans the flames. The more a monster burns, the harder her spells strike it.",
    maxHp: 68, gold: 99, art: "hero_ember_witch",
    deck: ["firebolt", "firebolt", "firebolt", "firebolt", "firebolt", "ward", "ward", "ward", "ward", "kindling"],
    mechanic: "Kindle",
    mechanicText: `Attacks get +${KINDLE_MULT} Mult for each Burn on the target. Burn deals its amount at the start of the monster's turn, then drops by 1.`,
    onHit(ctx) {
      const b = ctx.target?.statuses?.burn || 0;
      return b ? { kind: "mult", value: b * KINDLE_MULT, label: `Kindle ${b}` } : null;
    },
    badge: () => "KINDLE: BURN FEEDS MULT",
    badgeActive: c => c.enemies.some(e => !e.dead && e.statuses.burn),
  },
  shieldmaiden: {
    id: "shieldmaiden", name: "Brynja, the Shieldmaiden", short: "Shieldmaiden", pronoun: "she", color: "#86afdc",
    title: "Last of the Hall of Winter",
    blurb: "An unbreakable northern warrior. Every bit of Block she raises is weight behind her next blow.",
    maxHp: 82, gold: 99, art: "hero_shieldmaiden",
    deck: ["spear_thrust", "spear_thrust", "spear_thrust", "spear_thrust", "raise_shield", "raise_shield", "raise_shield", "raise_shield", "raise_shield", "shield_rush"],
    mechanic: "Bulwark",
    mechanicText: `Attacks get +1 Base damage for every ${BULWARK_PER} Block you have.`,
    onHit(ctx) {
      const b = Math.floor((ctx.combat?.player?.block || 0) / BULWARK_PER);
      return b ? { kind: "add", value: b, label: "Bulwark" } : null;
    },
    badge: c => { const b = Math.floor(c.player.block / BULWARK_PER); return b ? `BULWARK +${b} DAMAGE` : "BULWARK"; },
    badgeActive: c => c.player.block >= BULWARK_PER,
  },
  grave_thief: {
    id: "grave_thief", name: "Corvin, the Grave Thief", short: "Grave Thief", pronoun: "he", color: "#8bd3a8",
    title: "Picker of locks and pockets",
    blurb: "Strikes from the shadows. His first attack each turn lands with extra force, so he sets it up with tricks and cheap blades.",
    maxHp: 68, gold: 130, art: "hero_grave_thief",
    deck: ["stab", "stab", "stab", "stab", "dodge", "dodge", "dodge", "dodge", "dodge", "backstab"],
    mechanic: "Ambush",
    mechanicText: `Your first attack each turn gets ×${AMBUSH_X} Mult.`,
    onHit(ctx) {
      const free = 1 + (ctx.combat?.player?.statuses?.shadows || 0);
      return ctx.attackIndex < free ? { kind: "xmult", value: AMBUSH_X, label: "Ambush" } : null;
    },
    badge: c => (c.attacksThisTurn === 0 ? `AMBUSH READY · ×${AMBUSH_X}` : "AMBUSH SPENT"),
    badgeActive: c => c.attacksThisTurn === 0,
  },
  paladin: {
    id: "paladin", name: "Sir Aldric, the Paladin", short: "Paladin", pronoun: "he", color: "#e8c25a",
    title: "Oathsworn knight of the Dawn",
    blurb: "A holy warrior who trusts his fate to the dice. His cards roll damage like a tabletop game, and a roll on a die's highest face lands as a Critical.",
    maxHp: 76, gold: 99, art: "hero_paladin",
    deck: ["slash", "slash", "slash", "slash", "parry", "parry", "parry", "parry", "parry", "smite"],
    mechanic: "Critical Hit",
    mechanicText: `His cards roll dice (1d6+2 means one six-sided die plus 2). Any die that lands on its highest face is a Critical: that hit or Block gets ×${CRIT_X} Mult. Small dice crit more often.`,
    onHit: critical,
    onBlock: critical,
    badge: c => {
      const s = c.player.statuses;
      return s.nat20 ? "NATURAL TWENTY READY" : s.advantage ? `ADVANTAGE ${s.advantage} · CRIT ×${CRIT_X}` : `CRITICAL ×${CRIT_X}`;
    },
    badgeActive: c => !!(c.player.statuses.advantage || c.player.statuses.nat20),
  },
};
export const HERO_IDS = Object.keys(HEROES);
