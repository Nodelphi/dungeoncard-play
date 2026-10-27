// Monsters for all three acts. Each move has an intent the player can see:
//   attack (dmg, hits), defend (block), buff/debuff (effects), summon (ids), plus optional effects.
// ai(monster, combat, rng) returns the next move id; monster.history holds earlier moves.
// Effects on the hero use to: "player"; on the monster itself, to: "self".
const last = m => m.history[m.history.length - 1];
const cycle = (...moves) => m => moves[m.history.length % moves.length];
const st = (status, n, to = "player") => ({ do: "status", status, n, to });
const minionCount = (m, c) => c.enemies.filter(e => !e.dead && e !== m).length;
/** Cycles through moves; a summon slot falls back to `fallback` while two minions are already up. */
const withSummon = (moves, summon, fallback) => (m, c) => {
  const mv = moves[m.history.length % moves.length];
  return mv === summon && minionCount(m, c) >= 2 ? fallback : mv;
};
/** Bosses switch to a second move cycle once they enter phase two. */
const phased = (one, two, summon) => (m, c) => {
  if (m.phase === 2) return two[m.history.filter(h => two.includes(h)).length % two.length];
  const mv = one[m.history.length % one.length];
  return mv === summon && minionCount(m, c) >= 2 ? one.find(x => x !== summon) : mv;
};

const list = [
  // ======================= Act 1: The Crypt =======================
  { act: 1, id: "skeleton", name: "Crypt Skeleton", hp: [17, 21],
    moves: { slash: { intent: "attack", dmg: 7 }, guard: { intent: "defend", block: 6, effects: [st("strength", 1, "self")] } },
    ai: cycle("slash", "guard", "slash") },
  { act: 1, id: "giant_rat", name: "Plague Rat", hp: [11, 14],
    moves: { bite: { intent: "attack", dmg: 5 }, gnaw: { intent: "attack", dmg: 3, effects: [st("weak", 1)] } },
    ai: (m, c, rng) => (last(m) === "gnaw" ? "bite" : rng.chance(0.4) ? "gnaw" : "bite") },
  { act: 1, id: "spider", name: "Tomb Spider", hp: [15, 19],
    moves: { bite: { intent: "attack", dmg: 6, effects: [st("weak", 1)] }, lunge: { intent: "attack", dmg: 9 } },
    ai: cycle("bite", "lunge") },
  { act: 1, id: "cultist", name: "Ashen Cultist", hp: [24, 28],
    moves: { chant: { intent: "buff", effects: [st("ritual", 2, "self")] }, dagger: { intent: "attack", dmg: 5 } },
    ai: m => (m.history.length === 0 ? "chant" : "dagger") },
  { act: 1, id: "ghoul", name: "Ghoul", hp: [30, 35],
    moves: { claw: { intent: "attack", dmg: 9 }, rend: { intent: "attack", dmg: 6, effects: [st("bleed", 3)] },
      feast: { intent: "buff", effects: [{ do: "heal", n: 8, to: "self" }, st("strength", 2, "self")] } },
    ai: cycle("rend", "claw", "feast", "claw") },
  { act: 1, id: "ooze", name: "Cistern Ooze", hp: [36, 42],
    moves: { slam: { intent: "attack", dmg: 11 }, engulf: { intent: "debuff", effects: [st("frail", 2), st("weak", 1)] } },
    ai: cycle("engulf", "slam", "slam") },
  { act: 1, id: "bandit", name: "Grave Robber", hp: [26, 30],
    moves: { stab: { intent: "attack", dmg: 8 }, smoke: { intent: "defend", block: 10 }, flurry: { intent: "attack", dmg: 3, hits: 3 } },
    ai: cycle("stab", "flurry", "smoke") },
  { act: 1, id: "wraith", name: "Wailing Wraith", hp: [28, 32],
    moves: { drain: { intent: "attack", dmg: 7, effects: [{ do: "heal", n: 5, to: "self" }] }, wail: { intent: "debuff", effects: [st("vulnerable", 2)] } },
    ai: cycle("wail", "drain", "drain") },
  { act: 1, id: "ogre", name: "Cave Ogre", hp: [82, 88], elite: true,
    moves: { smash: { intent: "attack", dmg: 16 }, warcry: { intent: "buff", block: 10, effects: [st("strength", 2, "self")] }, sweep: { intent: "attack", dmg: 7, hits: 2 } },
    ai: cycle("warcry", "smash", "sweep", "smash") },
  { act: 1, id: "crypt_knight", name: "Crypt Knight", hp: [92, 98], elite: true,
    moves: { shield: { intent: "defend", block: 16 }, strike: { intent: "attack", dmg: 11 }, execute: { intent: "attack", dmg: 20 } },
    ai: cycle("strike", "shield", "execute") },
  { act: 1, id: "witch", name: "Bog Witch", hp: [68, 72], elite: true,
    moves: { hex: { intent: "debuff", effects: [st("weak", 2), st("vulnerable", 2)] }, bolt: { intent: "attack", dmg: 13 },
      curse: { intent: "debuff", effects: [{ do: "addCard", id: "dread", to: "discard" }, st("frail", 2)] } },
    ai: cycle("hex", "bolt", "curse", "bolt") },
  { act: 1, id: "bone_tyrant", name: "The Bone Tyrant", hp: [220, 220], boss: true,
    moves: {
      cleave: { intent: "attack", dmg: 13 }, raise: { intent: "summon", summon: ["skeleton", "skeleton"] },
      roar: { intent: "buff", block: 15, effects: [st("strength", 2, "self")] },
      wrath: { intent: "attack", dmg: 7, hits: 3 }, ward: { intent: "defend", block: 25 }, soul_rend: { intent: "attack", dmg: 28 },
    },
    phase2: { at: 0.5, text: "The Bone Tyrant's crown blazes with grave-fire!", effects: [st("strength", 2, "self")] },
    ai: phased(["cleave", "raise", "cleave", "roar"], ["wrath", "ward", "soul_rend"], "raise") },

  // ======================= Act 2: The Drowned Catacombs =======================
  { act: 2, id: "drowned_dead", name: "Drowned Dead", hp: [40, 46],
    moves: { grasp: { intent: "attack", dmg: 10 }, drag: { intent: "attack", dmg: 7, effects: [st("weak", 1)] } },
    ai: cycle("drag", "grasp", "grasp") },
  { act: 2, id: "leech", name: "Gorged Leech", hp: [30, 34],
    moves: { latch: { intent: "attack", dmg: 6, effects: [{ do: "heal", n: 6, to: "self" }] }, swell: { intent: "buff", effects: [st("strength", 3, "self")] } },
    ai: cycle("latch", "latch", "swell") },
  { act: 2, id: "deep_one", name: "Deep One", hp: [44, 50],
    moves: { trident: { intent: "attack", dmg: 13 }, bubble: { intent: "defend", block: 14 } },
    ai: cycle("trident", "bubble", "trident") },
  { act: 2, id: "eel", name: "Lantern Eel", hp: [36, 40],
    moves: { shock: { intent: "attack", dmg: 8, effects: [st("frail", 1)] }, coil: { intent: "attack", dmg: 5, hits: 2 } },
    ai: cycle("shock", "coil") },
  { act: 2, id: "plague_priest", name: "Plague Priest", hp: [42, 46],
    moves: { pestilence: { intent: "debuff", effects: [st("vulnerable", 2), st("weak", 2)] }, rot: { intent: "attack", dmg: 12 } },
    ai: cycle("pestilence", "rot", "rot") },
  { act: 2, id: "gargoyle", name: "Catacomb Gargoyle", hp: [52, 58],
    moves: { skin: { intent: "defend", block: 18, effects: [st("strength", 1, "self")] }, talon: { intent: "attack", dmg: 14 } },
    ai: cycle("skin", "talon", "talon") },
  { act: 2, id: "banshee", name: "Banshee", hp: [38, 42],
    moves: { scream: { intent: "attack", dmg: 6, hits: 2, effects: [st("vulnerable", 1)] }, fade: { intent: "defend", block: 12 } },
    ai: cycle("scream", "fade", "scream") },
  { act: 2, id: "bog_crawler", name: "Bog Crawler", hp: [48, 54],
    moves: { pincer: { intent: "attack", dmg: 9, hits: 2 }, shell: { intent: "defend", block: 16 } },
    ai: cycle("shell", "pincer", "pincer") },
  { act: 2, id: "hag_matriarch", name: "Hag Matriarch", hp: [150, 156], elite: true,
    moves: { hex: { intent: "debuff", effects: [st("weak", 3), st("vulnerable", 3)] }, cauldron: { intent: "attack", dmg: 20 },
      brood: { intent: "summon", summon: ["leech", "leech"] } },
    ai: withSummon(["hex", "cauldron", "brood", "cauldron"], "brood", "cauldron") },
  { act: 2, id: "stone_golem", name: "Stone Golem", hp: [188, 196], elite: true,
    moves: { crush: { intent: "attack", dmg: 26 }, fortify: { intent: "defend", block: 30 }, quake: { intent: "attack", dmg: 10, hits: 2, effects: [st("frail", 1)] } },
    ai: cycle("quake", "crush", "fortify") },
  { act: 2, id: "naga", name: "Naga Sorceress", hp: [162, 168], elite: true,
    moves: { constrict: { intent: "attack", dmg: 10, effects: [st("bleed", 4)] }, venom: { intent: "attack", dmg: 18 },
      scales: { intent: "buff", block: 20, effects: [st("strength", 2, "self")] } },
    ai: cycle("constrict", "venom", "scales", "venom") },
  { act: 2, id: "drowned_queen", name: "The Drowned Queen", hp: [580, 580], boss: true,
    moves: {
      tide: { intent: "attack", dmg: 18 }, call: { intent: "summon", summon: ["deep_one", "eel"] },
      song: { intent: "debuff", effects: [st("weak", 2), st("vulnerable", 1)] },
      maelstrom: { intent: "attack", dmg: 7, hits: 4 }, depths: { intent: "attack", dmg: 38 }, shell: { intent: "defend", block: 40, effects: [st("strength", 2, "self")] },
    },
    phase2: { at: 0.5, text: "The Drowned Queen rises on a pillar of black water!", effects: [st("strength", 3, "self")] },
    ai: phased(["song", "call", "tide", "tide"], ["maelstrom", "shell", "depths"], "call") },

  // ======================= Act 3: The Molten Deep =======================
  { act: 3, id: "fire_imp", name: "Fire Imp", hp: [52, 58],
    moves: { firebolt: { intent: "attack", dmg: 11, effects: [st("burn", 2)] }, cackle: { intent: "buff", effects: [st("strength", 2, "self")] } },
    ai: cycle("firebolt", "firebolt", "cackle") },
  { act: 3, id: "salamander", name: "Salamander", hp: [70, 76],
    moves: { breath: { intent: "attack", dmg: 15 }, molt: { intent: "defend", block: 18 } },
    ai: cycle("breath", "molt", "breath") },
  { act: 3, id: "magma_golem", name: "Magma Golem", hp: [90, 96],
    moves: { slam: { intent: "attack", dmg: 20 }, harden: { intent: "defend", block: 24 } },
    ai: cycle("harden", "slam", "slam") },
  { act: 3, id: "duergar", name: "Duergar Smith", hp: [76, 82],
    moves: { hammer: { intent: "attack", dmg: 16 }, forge: { intent: "buff", block: 16, effects: [st("strength", 2, "self")] } },
    ai: cycle("hammer", "forge", "hammer") },
  { act: 3, id: "hellhound", name: "Hellhound", hp: [64, 70],
    moves: { bite: { intent: "attack", dmg: 9, hits: 2, effects: [st("burn", 1)] }, howl: { intent: "debuff", effects: [st("vulnerable", 2)] } },
    ai: cycle("howl", "bite", "bite") },
  { act: 3, id: "flame_cultist", name: "Flame Cultist", hp: [68, 74],
    moves: { ignite: { intent: "debuff", effects: [st("burn", 5)] }, sacrifice: { intent: "buff", effects: [st("strength", 4, "self")] }, dagger: { intent: "attack", dmg: 12 } },
    ai: cycle("ignite", "dagger", "sacrifice", "dagger") },
  { act: 3, id: "obsidian_spider", name: "Obsidian Spider", hp: [60, 66],
    moves: { fangs: { intent: "attack", dmg: 13, effects: [st("weak", 1)] }, web: { intent: "debuff", effects: [st("frail", 2), st("weak", 1)] } },
    ai: cycle("web", "fangs", "fangs") },
  { act: 3, id: "ash_wraith", name: "Ash Wraith", hp: [66, 72],
    moves: { soulburn: { intent: "attack", dmg: 12, effects: [{ do: "heal", n: 8, to: "self" }] }, wail: { intent: "debuff", effects: [st("vulnerable", 2), st("weak", 1)] } },
    ai: cycle("wail", "soulburn", "soulburn") },
  { act: 3, id: "minotaur", name: "Minotaur Warlord", hp: [258, 266], elite: true,
    moves: { gore: { intent: "attack", dmg: 30 }, charge: { intent: "attack", dmg: 14, hits: 2 }, bellow: { intent: "buff", block: 20, effects: [st("strength", 4, "self")] } },
    ai: cycle("bellow", "charge", "gore", "charge") },
  { act: 3, id: "fire_giant", name: "Fire Giant", hp: [296, 304], elite: true,
    moves: { fist: { intent: "attack", dmg: 34 }, eruption: { intent: "attack", dmg: 11, hits: 3, effects: [st("burn", 3)] }, stoke: { intent: "buff", block: 30, effects: [st("strength", 3, "self")] } },
    ai: cycle("eruption", "fist", "stoke") },
  { act: 3, id: "lich", name: "The Lich", hp: [238, 244], elite: true,
    moves: { bolt: { intent: "attack", dmg: 26 }, curse: { intent: "debuff", effects: [{ do: "addCard", id: "dread", to: "discard" }, st("weak", 2), st("vulnerable", 2)] },
      raise: { intent: "summon", summon: ["skeleton", "skeleton"] } },
    ai: withSummon(["curse", "raise", "bolt"], "raise", "bolt") },
  { act: 3, id: "red_wyrm", name: "Ashgrim, the Red Wyrm", hp: [1250, 1250], boss: true,
    moves: {
      claws: { intent: "attack", dmg: 14, hits: 2 }, tail: { intent: "attack", dmg: 24 }, fire: { intent: "attack", dmg: 18, effects: [st("burn", 5)] },
      inferno: { intent: "attack", dmg: 46 }, wings: { intent: "attack", dmg: 10, hits: 3, effects: [st("weak", 2)] }, scales: { intent: "defend", block: 50, effects: [st("strength", 3, "self")] },
    },
    phase2: { at: 0.5, text: "Ashgrim takes wing, and the cavern ignites!", effects: [st("strength", 3, "self")] },
    ai: phased(["fire", "claws", "tail", "claws"], ["wings", "scales", "inferno"]) },
];

export const MONSTERS = Object.fromEntries(list.map(m => [m.id, { art: "monster_" + m.id, ...m }]));

// Fights by act and tier. Each entry is a list of monster ids fought together.
export const ENCOUNTERS = {
  1: {
    easy: [["skeleton"], ["giant_rat", "giant_rat"], ["spider", "giant_rat"], ["cultist"], ["skeleton", "giant_rat"]],
    hard: [["ghoul"], ["ooze"], ["bandit", "giant_rat"], ["wraith", "skeleton"], ["cultist", "spider"], ["ghoul", "giant_rat"], ["bandit", "wraith"], ["skeleton", "skeleton", "spider"]],
    elite: [["ogre"], ["crypt_knight"], ["witch", "giant_rat"]],
    boss: [["bone_tyrant"]],
  },
  2: {
    easy: [["drowned_dead"], ["leech", "leech"], ["deep_one"], ["eel", "leech"], ["banshee"]],
    hard: [["gargoyle"], ["bog_crawler", "leech"], ["plague_priest", "drowned_dead"], ["deep_one", "eel"], ["banshee", "drowned_dead"], ["gargoyle", "leech"], ["plague_priest", "bog_crawler"], ["drowned_dead", "drowned_dead", "leech"]],
    elite: [["hag_matriarch"], ["stone_golem"], ["naga"]],
    boss: [["drowned_queen"]],
  },
  3: {
    easy: [["fire_imp"], ["salamander"], ["hellhound"], ["obsidian_spider"], ["fire_imp", "fire_imp"]],
    hard: [["magma_golem"], ["duergar", "fire_imp"], ["flame_cultist", "hellhound"], ["ash_wraith", "salamander"], ["obsidian_spider", "fire_imp", "fire_imp"], ["duergar", "flame_cultist"], ["hellhound", "hellhound"], ["magma_golem", "fire_imp"]],
    elite: [["minotaur"], ["fire_giant"], ["lich", "fire_imp"]],
    boss: [["red_wyrm"]],
  },
};
export const ACT_NAMES = { 1: "The Crypt", 2: "The Drowned Catacombs", 3: "The Molten Deep" };
export const ACT_INTROS = {
  1: "Beneath the ruined chapel the dead do not rest. The Bone Tyrant holds court in the deepest vault.",
  2: "Below the crypt, the catacombs drown in black water, and something sings from the deep.",
  3: "Heat rises from the abyss. On a mountain of gold, Ashgrim the Red Wyrm stirs.",
};
export const ACTS = 3;
