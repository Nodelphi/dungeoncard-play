// A whole delve: the map, the deck, treasures, gold, and what each room does.
// Screens: map, combat, reward, shop, rest, event, vault, victory, defeat.
// When a card has to be chosen from the deck (remove, upgrade, copy, set a rune), run.pick is set and
// the UI shows the deck picker; resolvePick() finishes it.
import { Rng, newSeed } from "./rng.js";
import { generateMap, reachable } from "./map.js";
import { createCombat, finishCombat, newUid } from "./combat.js";
import { HEROES } from "../../data/heroes.js";
import { CARDS, cardPool } from "../../data/cards.js";
import { TREASURES, RARITY_PRICE, treasureFlag } from "../../data/treasures.js";
import { RUNES } from "../../data/runes.js";
import { ELIXIRS } from "../../data/elixirs.js";
import { ENCOUNTERS, ACTS } from "../../data/monsters.js";
import { EVENTS } from "../../data/events.js";

export const MAX_TREASURES = 5;
export const MAX_ELIXIRS = 3;
const CARD_PRICE = { common: 50, uncommon: 75, rare: 145 };
const RUNE_PRICE = 90;

const makeCard = (id, upgraded = false) => ({ uid: newUid("c"), id, upgraded, rune: null });

export function newRun(seed = newSeed(), heroId = "sellsword", descent = 0) {
  const rng = new Rng(seed);
  const hero = HEROES[heroId] || HEROES.sellsword;
  const deck = hero.deck.map(id => makeCard(id));
  if (descent >= 3) deck.push(makeCard("wound"));
  return {
    version: 2, seed, rng, hero: hero.id, act: 1, descent,
    hp: hero.maxHp, maxHp: hero.maxHp, gold: hero.gold,
    deck,
    treasures: [], elixirs: ["healing_draught"],
    map: generateMap(rng), node: null, floor: 0, path: [],
    fights: 0, removals: 0, seenEvents: [], seenFights: [],
    screen: "map", room: null, combat: null, pick: null, pendingTreasure: null,
    stats: { kills: 0, elites: 0, biggestHit: 0, goldEarned: 0, cardsPlayed: 0, floors: 0 },
  };
}

export const choices = run => (run.screen === "map" ? reachable(run.map, run.node) : []);
const discount = run => treasureFlag(run, "discount");
export const price = (run, base) => Math.round(base * (1 - discount(run)));

// ---------- moving through the map ----------

export function enterRoom(run, nodeId) {
  if (!choices(run).includes(nodeId)) return false;
  const node = run.map.nodes[nodeId];
  run.node = nodeId;
  run.path.push(nodeId);
  run.floor = node.floor;
  run.stats.floors = Math.max(run.stats.floors, depth(run) - 1);
  run.room = { type: node.type };
  switch (node.type) {
    case "fight": case "elite": case "boss": {
      const tiers = ENCOUNTERS[run.act || 1];
      const pool = node.type === "fight" ? (node.floor <= 3 ? tiers.easy : tiers.hard) : tiers[node.type];
      const fresh = pool.filter(e => !run.seenFights.includes(e.join(",")));
      const enc = run.rng.pick(fresh.length ? fresh : pool);
      run.seenFights.push(enc.join(","));
      run.combat = createCombat(run, enc, { floor: node.floor, kind: node.type });
      run.screen = "combat";
      break;
    }
    case "event": {
      const fresh = Object.keys(EVENTS).filter(id => !run.seenEvents.includes(id));
      const id = run.rng.pick(fresh.length ? fresh : Object.keys(EVENTS));
      run.seenEvents.push(id);
      run.room.event = id;
      run.screen = "event";
      break;
    }
    case "shop": run.room.shop = generateShop(run); run.screen = "shop"; break;
    case "rest": run.screen = "rest"; break;
    case "vault":
      run.room.treasures = randomTreasures(run, 3, { common: 0, uncommon: 55, rare: 40, legendary: 5 });
      run.screen = "vault";
      break;
  }
  return true;
}

export function leaveRoom(run) {
  if (run.pick || run.pendingTreasure) return false;
  if (run.room?.type === "boss") { nextAct(run); return true; }
  run.room = null;
  run.combat = null;
  run.screen = "map";
  return true;
}

// ---------- after a fight ----------

/** Call once the combat is over: rewards on a win, the end screen on a loss or after the boss. */
export function afterCombat(run) {
  const c = run.combat;
  if (!c || !c.over) return;
  finishCombat(c);
  if (c.over === "lose" || run.hp <= 0) { run.screen = "defeat"; run.combat = null; return; }
  if (c.kind === "elite") run.stats.elites++;
  if (c.kind === "boss" && (run.act || 1) >= ACTS) { run.stats.floors = depth(run); run.screen = "victory"; run.combat = null; return; }
  if (c.kind === "boss") {
    // Between acts: a rich reward and the pick of three boss treasures.
    const gold = run.rng.range(80, 100);
    gainGold(run, gold);
    run.room = { type: "boss", gold, cards: randomCards(run, 3, { uncommon: 30, rare: 70 }),
      elixir: run.rng.pick(Object.keys(ELIXIRS)), treasure: null,
      bossTreasures: randomTreasures(run, 3, { rare: 70, legendary: 30 }) };
    run.combat = null;
    run.screen = "reward";
    return;
  }
  const elite = c.kind === "elite";
  const gold = elite ? run.rng.range(32, 42) + 8 * (run.act - 1) : run.rng.range(14, 22) + 5 * (run.act - 1);
  gainGold(run, gold);
  run.room = {
    type: run.room.type, gold,
    cards: randomCards(run, 3, elite ? { common: 45, uncommon: 40, rare: 15 } : { common: 60, uncommon: 33, rare: 7 }),
    elixir: run.rng.chance(elite ? 0.5 : 0.35) ? run.rng.pick(Object.keys(ELIXIRS)) : null,
    // Elites always drop a treasure; tougher ordinary fights sometimes do.
    treasure: elite || (run.floor > 3 && run.rng.chance(0.12))
      ? randomTreasures(run, 1, elite ? { common: 45, uncommon: 38, rare: 15, legendary: 2 } : { common: 70, uncommon: 30 })[0] : null,
  };
  run.combat = null;
  run.screen = "reward";
}

export function takeRewardCard(run, index) {
  const id = run.room?.cards?.[index];
  if (!id) return false;
  run.deck.push(makeCard(id));
  run.room.cards = null;
  return true;
}
export function skipRewardCards(run) { if (run.room) run.room.cards = null; }
export function takeRewardElixir(run) {
  if (!run.room?.elixir || run.elixirs.length >= MAX_ELIXIRS) return false;
  run.elixirs.push(run.room.elixir);
  run.room.elixir = null;
  return true;
}
export function takeBossTreasure(run, index) {
  const id = run.room?.bossTreasures?.[index];
  if (!id || run.room.bossTaken) return false;
  run.room.bossTaken = id;
  gainTreasure(run, id);
  return true;
}

/** How deep the hero is across all acts (each act is 16 floors). */
export const depth = run => ((run.act || 1) - 1) * 16 + run.floor;

/** Moves to the next act: a fresh map, and the hero is fully healed. */
export function nextAct(run) {
  run.act = (run.act || 1) + 1;
  run.map = generateMap(run.rng);
  run.node = null;
  run.path = [];
  run.floor = 0;
  run.hp = run.maxHp;   // a full recovery between acts
  run.room = null;
  run.combat = null;
  run.screen = "map";
}

export function takeRewardTreasure(run) {
  if (!run.room?.treasure) return false;
  gainTreasure(run, run.room.treasure);
  run.room.treasure = null;
  return true;
}

// ---------- treasures ----------

export function gainTreasure(run, id) {
  if (run.treasures.length >= MAX_TREASURES) { run.pendingTreasure = id; return false; }
  const tr = { id, state: {} };
  run.treasures.push(tr);
  TREASURES[id].onPickup?.(run, tr.state);
  return true;
}
/** With the rack full: swap the waiting treasure into a slot (the old one is sold), or let it go. */
export function replaceTreasure(run, slot) {
  if (!run.pendingTreasure) return false;
  sellTreasure(run, slot);
  const id = run.pendingTreasure;
  run.pendingTreasure = null;
  run.pendingRefund = 0;
  run.treasures.splice(slot, 0, { id, state: {} });
  TREASURES[id].onPickup?.(run, run.treasures[slot].state);
  return true;
}
export function discardPendingTreasure(run) {
  // A treasure bought in the shop and then left behind is refunded.
  if (run.pendingRefund) { run.gold += run.pendingRefund; run.pendingRefund = 0; }
  run.pendingTreasure = null;
}
export const sellValue = tr => Math.floor(RARITY_PRICE[TREASURES[tr.id].rarity] / 2);
export function sellTreasure(run, slot) {
  const tr = run.treasures[slot];
  if (!tr || run.screen === "combat") return false;
  run.treasures.splice(slot, 1);
  gainGold(run, sellValue(tr));
  return true;
}
/** Treasures apply left to right, so their order matters. */
export function moveTreasure(run, from, to) {
  if (from === to || !run.treasures[from] || to < 0 || to >= run.treasures.length) return false;
  const [tr] = run.treasures.splice(from, 1);
  run.treasures.splice(to, 0, tr);
  return true;
}

// ---------- random offers ----------

function randomCards(run, n, weights) {
  const out = [];
  for (let tries = 0; out.length < n && tries < 50; tries++) {
    const rarity = run.rng.weighted(weights);
    const pool = cardPool(run.hero, rarity).filter(c => !out.includes(c.id));
    if (pool.length) out.push(run.rng.pick(pool).id);
  }
  return out;
}

function randomTreasures(run, n, weights) {
  const owned = new Set(run.treasures.map(t => t.id));
  const out = [];
  for (let tries = 0; out.length < n && tries < 60; tries++) {
    const rarity = run.rng.weighted(weights);
    const pool = Object.values(TREASURES).filter(t => t.rarity === rarity && (!t.hero || t.hero === run.hero) && !owned.has(t.id) && !out.includes(t.id));
    if (pool.length) out.push(run.rng.pick(pool).id);
  }
  return out;
}

const gainGold = (run, n) => { run.gold = Math.max(0, run.gold + n); if (n > 0) run.stats.goldEarned += n; };

// ---------- shop ----------

function generateShop(run) {
  const jitter = base => Math.round(base * (0.9 + run.rng.next() * 0.2));
  const cards = [...randomCards(run, 2, { common: 1 }), ...randomCards(run, 2, { uncommon: 1 }), ...randomCards(run, 1, { rare: 1 })];
  return {
    cards: cards.map(id => ({ id, price: jitter(CARD_PRICE[CARDS[id].rarity]), sold: false })),
    treasures: randomTreasures(run, 3, { common: 45, uncommon: 35, rare: 17, legendary: 3 })
      .map(id => ({ id, price: jitter(RARITY_PRICE[TREASURES[id].rarity]), sold: false })),
    elixirs: run.rng.shuffle(Object.keys(ELIXIRS)).slice(0, 3).map(id => ({ id, price: jitter(ELIXIRS[id].price), sold: false })),
    runes: run.rng.shuffle(Object.keys(RUNES)).slice(0, 2).map(id => ({ id, price: jitter(RUNE_PRICE), sold: false })),
    removal: { price: 75 + 25 * run.removals, sold: false },
  };
}

/** Buys a shop item. kind: cards | treasures | elixirs | runes | removal. */
export function buy(run, kind, index = 0) {
  const shop = run.room?.shop;
  const item = kind === "removal" ? shop?.removal : shop?.[kind]?.[index];
  if (!item || item.sold || run.pick || run.pendingTreasure) return false;
  const cost = price(run, item.price);
  if (run.gold < cost) return false;
  if (kind === "elixirs" && run.elixirs.length >= MAX_ELIXIRS) return false;
  if (kind === "removal" && run.deck.length <= 5) return false;
  run.gold -= cost;
  item.sold = true;
  if (kind === "cards") run.deck.push(makeCard(item.id));
  else if (kind === "treasures") { if (!gainTreasure(run, item.id)) run.pendingRefund = cost; }
  else if (kind === "elixirs") run.elixirs.push(item.id);
  else if (kind === "runes") run.pick = { kind: "rune", rune: item.id };
  else if (kind === "removal") { run.removals++; run.pick = { kind: "remove" }; }
  return true;
}

// ---------- campfire ----------

export const restAmount = run => Math.round(run.maxHp * ((run.descent || 0) >= 4 ? 0.2 : 0.3));
export function rest(run) {
  if (run.screen !== "rest" || run.room.done) return false;
  run.hp = Math.min(run.maxHp, run.hp + restAmount(run));
  run.room.done = "rest";
  return true;
}
export function smith(run) {
  if (run.screen !== "rest" || run.room.done) return false;
  if (!run.deck.some(c => canUpgrade(c))) return false;
  run.pick = { kind: "upgrade" };
  run.room.done = "smith";
  return true;
}
export const canUpgrade = card => !card.upgraded && CARDS[card.id].up;

// ---------- choosing a card from the deck ----------

/** Cards that can be chosen for the current pick. */
export function pickable(run) {
  const p = run.pick;
  if (!p) return [];
  return run.deck.filter(c => p.kind === "upgrade" ? canUpgrade(c) : p.kind === "rune" ? CARDS[c.id].type !== "curse" : true);
}
export function resolvePick(run, uid) {
  const p = run.pick;
  const card = run.deck.find(c => c.uid === uid);
  if (!p || !card || !pickable(run).includes(card)) return false;
  if (p.kind === "remove") run.deck = run.deck.filter(c => c !== card);
  else if (p.kind === "upgrade") card.upgraded = true;
  else if (p.kind === "duplicate") run.deck.push({ ...card, uid: newUid("c") });
  else if (p.kind === "rune") card.rune = p.rune;
  run.pick = null;
  return true;
}
/** Picks you can back out of: a campfire upgrade (the campfire stays unused). Paid picks must be completed,
 *  unless no card can be chosen at all (force), so the player is never stuck. */
export const canCancelPick = run => !!run.pick && (run.pick.kind === "upgrade" && run.screen === "rest");
export function cancelPick(run, force = false) {
  if (!run.pick) return false;
  if (!force && !canCancelPick(run)) return false;
  if (run.pick.kind === "upgrade" && run.screen === "rest" && run.room) run.room.done = null;
  run.pick = null;
  return true;
}

// ---------- events and vault ----------

export function chooseEvent(run, index) {
  const room = run.room;
  if (run.screen !== "event" || room.result) return false;
  const choice = EVENTS[room.event].choices[index];
  if (!choice || (choice.req && !choice.req(run))) return false;
  let outcome = choice;
  if (choice.outcomes) {
    const w = Object.fromEntries(choice.outcomes.map((o, i) => [i, o.weight]));
    outcome = choice.outcomes[run.rng.weighted(w)];
  }
  outcome.effects.forEach(eff => runEffect(run, eff));
  room.result = outcome.result;
  if (run.hp <= 0) run.screen = "defeat";
  return true;
}

function runEffect(run, eff) {
  switch (eff.do) {
    case "gold": gainGold(run, eff.n); break;
    case "loseHp": run.hp = Math.max(1, run.hp - eff.n); break;   // events wound but never kill
    case "heal": run.hp = Math.min(run.maxHp, run.hp + eff.n); break;
    case "maxHp": run.maxHp = Math.max(1, run.maxHp + eff.n); run.hp = Math.max(1, Math.min(run.maxHp, run.hp + Math.max(0, eff.n))); break;
    case "addCard": run.deck.push(makeCard(eff.id || randomCards(run, 1, { [eff.rarity]: 1 })[0])); break;
    case "removeCard": run.pick = { kind: "remove" }; break;
    case "duplicateCard": run.pick = { kind: "duplicate" }; break;
    case "upgradeCard": {
      const options = run.rng.shuffle(run.deck.filter(canUpgrade));
      options.slice(0, eff.n || 1).forEach(c => { c.upgraded = true; });
      break;
    }
    case "rune": run.pick = { kind: "rune", rune: eff.id || run.rng.pick(Object.keys(RUNES)) }; break;
    case "treasure": {
      // A named treasure you already own turns into gold instead of a duplicate.
      if (eff.id && run.treasures.some(t => t.id === eff.id)) { gainGold(run, 100); break; }
      const id = eff.id || randomTreasures(run, 1, { [eff.rarity]: 1 })[0];
      if (id) gainTreasure(run, id); else gainGold(run, 60);
      break;
    }
    case "elixir": if (run.elixirs.length < MAX_ELIXIRS) run.elixirs.push(run.rng.pick(Object.keys(ELIXIRS))); break;
  }
}

export function takeVaultTreasure(run, index) {
  const id = run.room?.treasures?.[index];
  if (run.screen !== "vault" || !id || run.room.taken) return false;
  run.room.taken = id;
  gainTreasure(run, id);
  return true;
}
