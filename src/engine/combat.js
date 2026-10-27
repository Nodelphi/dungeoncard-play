// Turn-based combat. Doesn't touch the page: the UI calls these functions and replays
// combat.events (hits with their tallies, blocks, deaths...) as animations.
import { CARDS, cardValues, cardCost } from "../../data/cards.js";
import { MONSTERS } from "../../data/monsters.js";
import { STATUSES } from "../../data/statuses.js";
import { TREASURES, effectiveTreasures, treasureFlag } from "../../data/treasures.js";
import { RUNES } from "../../data/runes.js";
import { ELIXIRS } from "../../data/elixirs.js";
import { tally } from "./scoring.js";
import { rollDice } from "./dice.js";
import { Rng } from "./rng.js";

export const HAND_LIMIT = 10;
export const MAX_ENEMIES = 4;
// Monster health climbs steeply through the act, like Balatro's blinds.
// Later acts' monsters are authored stronger, so their in-act climb is gentler.
export const hpScale = (floor, act = 1) => act === 1 ? 1 + 0.04 * (floor - 1) + 0.004 * (floor - 1) ** 2 : 1 + 0.035 * (floor - 1) + 0.002 * (floor - 1) ** 2;
export const dmgScale = (floor, act = 1) => 1 + (act === 1 ? 0.02 : 0.012) * (floor - 1);
// Treasures multiply the hero's damage over a run, so later acts' monsters get tougher still.
export const ACT_HP = { 1: 1, 2: 1.1, 3: 1.45 };
export const ACT_DMG = { 1: 1, 2: 0.9, 3: 0.92 };

let uidSeq = 0;
export const newUid = prefix => `${prefix}${Date.now().toString(36)}${(uidSeq++).toString(36)}`;

/** Treasures with their hooks resolved (the Abyssal Lens borrows its right-hand neighbour's). */
const treasureHooks = run => effectiveTreasures(run);
// Cards drawn by card effects in one turn are capped, so two free draw cards can't loop forever.
const EFFECT_DRAW_CAP = 12;

function makeEnemy(id, floor, rng, scale = true, minion = false, act = 1, descent = 0) {
  const def = MONSTERS[id];
  const base = rng.range(def.hp[0], def.hp[1]);
  let hp = def.boss || !scale ? base : Math.round(base * hpScale(floor, act) * (ACT_HP[act] || 1));
  if (def.elite && descent >= 1) hp = Math.round(hp * 1.2);
  if (def.boss && descent >= 5) hp = Math.round(hp * 1.2);
  return { uid: newUid("e"), id, name: def.name, hp, maxHp: hp, block: 0, statuses: {}, history: [], intent: null,
           elite: !!def.elite, boss: !!def.boss, minion, phase: 1, dead: false };
}

export function createCombat(run, monsterIds, { floor = 1, kind = "fight" } = {}) {
  const act = run.act || 1;
  const rng = new Rng((run.seed ^ (floor * 7919) ^ (run.fights || 0) * 104729 ^ act * 15485863) >>> 0);
  const c = {
    rng, floor, act, kind, turn: 0, energy: 0, maxEnergy: 3, drawSize: 5,
    momentum: 0, startMomentum: 0, attacksThisTurn: 0, cardsThisTurn: 0, effectDraws: 0, freshDebuffs: {},
    player: { hp: run.hp, maxHp: run.maxHp, block: 0, statuses: {} },
    enemies: monsterIds.map(id => makeEnemy(id, floor, rng, true, false, act, run.descent || 0)),
    draw: rng.shuffle(run.deck.map(card => ({ ...card }))), hand: [], discard: [], exhaust: [],
    over: null, events: [], gold: 0,
  };
  c.run = run;
  const api = makeApi(c);
  treasureHooks(run).forEach(h => h.def.onCombatStart?.(api, h.state));
  c.enemies.forEach(e => chooseIntent(c, e));
  startPlayerTurn(c);
  return c;
}

const emit = (c, ev) => { c.events.push(ev); return ev; };
const alive = c => c.enemies.filter(e => !e.dead);
const findEnemy = (c, uid) => c.enemies.find(e => e.uid === uid && !e.dead);
const fragile = run => treasureFlag(run, "fragile");

/** Hooks for treasures, runes and elixirs to act on the fight. */
function makeApi(c) {
  const api = {
    combat: c, run: c.run, rng: c.rng,
    gold: n => { if (!n) return; c.run.gold = Math.max(0, c.run.gold + n); c.gold += n; emit(c, { t: "gold", n }); },
    heal: n => heal(c, c.player, n),
    gainBlock: n => gainBlock(c, n, null),
    draw: n => drawCards(c, n, c.turn > 0),
    energy: n => { c.energy += n; emit(c, { t: "energy", n }); },
    // Before the first turn (start-of-fight treasures), Momentum is saved for turn one.
    momentum: n => { if (c.turn === 0) { c.startMomentum += n; return; } c.momentum += n; emit(c, { t: "momentum", n, total: c.momentum }); },
    status: (who, s, n) => applyStatus(c, who, s, n),
    rawDamage: (target, n) => { const e = typeof target === "string" ? findEnemy(c, target) : target; if (e && !e.dead) damageEnemy(c, e, n, null); },
    loseHp: n => loseHp(c, c.player, n),
  };
  return api;
}

// ---------- turn flow ----------

function startPlayerTurn(c) {
  c.turn++;
  const p = c.player, s = p.statuses;
  if (c.turn > 1 && !s.fortify && !s.barricade) p.block = 0;
  if (s.fortify) { s.fortify--; if (!s.fortify) delete s.fortify; }   // Fortify keeps Block for one turn
  c.energy = c.maxEnergy;
  c.momentum = (s.berserk || 0) + (c.turn === 1 ? c.startMomentum : 0);
  c.attacksThisTurn = 0;
  c.cardsThisTurn = 0;
  c.effectDraws = 0;
  emit(c, { t: "turn", who: "player", turn: c.turn });
  for (const dot of ["bleed", "burn"]) {
    if (s[dot]) { loseHp(c, p, s[dot]); s[dot]--; if (!s[dot]) delete s[dot]; if (c.over) return; }
  }
  if (s.plating) gainBlock(c, s.plating, null, true);
  if (s.ritual) applyStatus(c, p, "strength", s.ritual);
  if (s.pact) { c.energy += s.pact; loseHp(c, p, 2 * s.pact); if (c.over) return; }
  if (s.aura) alive(c).forEach(e => applyStatus(c, e, "burn", s.aura));
  if (s.courage) applyStatus(c, p, "advantage", s.courage);
  if (s.spirit) {
    // Spiritual Weapon: a spectral blade strikes a random monster.
    const t = c.rng.pick(alive(c));
    if (t) { const r = rollDice(c.rng, `${s.spirit}d8`); damageEnemy(c, t, r.total, null); if (c.over) return; }
  }
  const api = makeApi(c);
  treasureHooks(c.run).forEach(h => h.def.onTurnStart?.(api, h.state));
  drawCards(c, c.drawSize + (s.lantern || 0));
}

export function drawCards(c, n, fromEffect = false) {
  const drawn = [];
  for (let i = 0; i < n; i++) {
    if (c.hand.length >= HAND_LIMIT) break;
    if (fromEffect && c.effectDraws >= EFFECT_DRAW_CAP) break;
    if (fromEffect) c.effectDraws++;
    if (!c.draw.length) {
      if (!c.discard.length) break;
      c.draw = c.rng.shuffle(c.discard);
      c.discard = [];
      emit(c, { t: "shuffle" });
    }
    const card = c.draw.pop();
    c.hand.push(card);
    drawn.push(card.uid);
  }
  if (drawn.length) emit(c, { t: "draw", uids: drawn });
  return drawn;
}

export function canPlay(c, card) {
  if (c.over) return false;
  const cost = cardCost(card);
  return cost !== null && c.energy >= cost;
}

/** Plays a card from hand. targetUid is needed for "enemy" cards. Returns false if it can't be played. */
export function playCard(c, uid, targetUid) {
  const idx = c.hand.findIndex(x => x.uid === uid);
  if (idx < 0) return false;
  const card = c.hand[idx], def = CARDS[card.id];
  if (!canPlay(c, card)) return false;
  let target = null;
  if (def.target === "enemy") {
    target = findEnemy(c, targetUid) || (alive(c).length === 1 ? alive(c)[0] : null);
    if (!target) return false;
  }
  const cost = cardCost(card);
  c.energy -= cost;
  c.hand.splice(idx, 1);
  emit(c, { t: "play", uid, id: card.id, target: target?.uid });

  const src = { card, def, values: cardValues(card), target, cost, attackIndex: c.attacksThisTurn };
  const api = makeApi(c);
  for (const eff of def.play) { runEffect(c, eff, src); if (c.over) break; }
  if (!c.over) RUNES[card.rune]?.onPlay?.(api);
  // Advantage and Natural Twenty are spent by the card that rolled dice.
  if (src.rolled) {
    const s = c.player.statuses;
    if (s.advantage) applyStatus(c, c.player, "advantage", -1);
    if (s.nat20) applyStatus(c, c.player, "nat20", -s.nat20);
  }

  if (def.type === "attack") {
    c.attacksThisTurn++;
    c.momentum++;
    delete c.player.statuses.edge;
    emit(c, { t: "momentum", n: 1, total: c.momentum });
  }
  c.cardsThisTurn++;
  if (c.run.stats) c.run.stats.cardsPlayed++;
  treasureHooks(c.run).forEach(h => h.def.onCardPlayed?.(api, card, def, h.state));
  // Powers stay in play (as statuses); exhausting cards are gone for the fight.
  if (def.type === "power" || def.exhaust) c.exhaust.push(card);
  else c.discard.push(card);
  checkEnd(c);
  return true;
}

function resolveN(n, values) { return typeof n === "string" ? values[n] ?? 0 : n ?? 0; }

/** Rolls a card's dice (the Paladin's cards), with Advantage, Bless, Natural Twenty and crit range applied. */
function rollFor(c, src, expr, kind) {
  const s = c.player.statuses;
  const extra = kind === "attack" && s.bless ? [{ count: s.bless, sides: 4, label: "Bless" }] : [];
  const r = rollDice(c.rng, expr, {
    advantage: !!s.advantage || treasureFlag(c.run, "advantage") > 0,
    max: !!s.nat20,
    critRange: (s.keen || 0) + treasureFlag(c.run, "critRange"),
    extra,
  });
  r.critX = (src.def?.critX || 2) + treasureFlag(c.run, "critBonus");
  src.rolled = true;
  return r;
}

function runEffect(c, eff, src) {
  const n = resolveN(eff.n, src.values);
  const p = c.player;
  switch (eff.do) {
    case "damage": {
      let hits = resolveN(eff.hits, src.values) || 1;
      if (eff.plusMomentum) hits += c.momentum;
      for (let h = 0; h < hits; h++) {
        const targets = eff.to === "all" ? alive(c) : [src.target && !src.target.dead ? src.target : alive(c)[0]].filter(Boolean);
        // Dice are rolled once per hit; an area attack uses the same roll for every target, as in the tabletop game.
        const roll = eff.roll && targets.length ? rollFor(c, src, src.values[eff.roll] ?? eff.roll, "attack") : null;
        for (const target of targets) {
          // Some cards take their Base from a status on the target or from your Block.
          const bf = eff.baseFrom;
          const base = roll ? roll.total : !bf ? n : bf.status ? (target.statuses[bf.status] || 0) * resolveN(bf.x, src.values) : Math.floor(p.block * resolveN(bf.block, src.values));
          const t = tally({ kind: "attack", base, def: src.def, card: src.card, combat: c, run: c.run, target, roll,
                            hitIndex: h, attackIndex: src.attackIndex, cost: src.cost });
          const res = damageEnemy(c, target, t.final, t);
          if (res.killed && target === src.target) src.killed = true;
        }
        if (c.over) return;
      }
      break;
    }
    case "block": {
      const roll = eff.roll ? rollFor(c, src, src.values[eff.roll] ?? eff.roll, "block") : null;
      const t = tally({ kind: "block", base: roll ? roll.total : n, def: src.def, card: src.card, combat: c, run: c.run, cost: src.cost, roll });
      gainBlock(c, t.final, t);
      break;
    }
    case "draw": drawCards(c, n, true); break;
    case "energy": c.energy += n; emit(c, { t: "energy", n }); break;
    case "momentum": c.momentum += n; emit(c, { t: "momentum", n, total: c.momentum }); break;
    case "heal": heal(c, p, eff.roll ? rollFor(c, src, src.values[eff.roll] ?? eff.roll, "heal").total : n); break;
    case "gold": makeApi(c).gold(n); break;
    case "loseHp": loseHp(c, p, n); break;
    case "status": {
      const who = eff.to === "self" ? [p] : eff.to === "all" ? alive(c) : [src.target].filter(Boolean);
      who.forEach(w => applyStatus(c, w, eff.status, n));
      break;
    }
    case "addCard": {
      const count = resolveN(eff.count, src.values || {}) || 1;
      const made = [];
      for (let i = 0; i < count; i++) {
        const card = { uid: newUid("c"), id: eff.id, upgraded: false, temp: true };
        const toHand = eff.to === "hand" && c.hand.length < HAND_LIMIT;
        (toHand ? c.hand : eff.to === "draw" ? c.draw : c.discard).push(card);
        if (toHand) made.push(card.uid);
      }
      emit(c, { t: "addCard", id: eff.id, to: eff.to || "discard" });
      if (made.length) emit(c, { t: "draw", uids: made });
      break;
    }
    case "multStatus": {
      const who = eff.to === "all" ? alive(c) : [src.target].filter(Boolean);
      const x = resolveN(eff.x, src.values);
      who.forEach(w => { const cur = w.statuses[eff.status] || 0; if (cur) applyStatus(c, w, eff.status, cur * (x - 1), true); });
      break;
    }
    case "upgradeHand": c.hand.forEach(card => { card.upgraded = true; }); emit(c, { t: "upgradeHand" }); break;
    case "cleanse": for (const s of ["weak", "vulnerable", "frail", "bleed", "burn"]) delete p.statuses[s]; emit(c, { t: "status", who: "player", status: "cleanse", n: 0, total: 0 }); break;
    case "ifKilled": if (src.killed) eff.then.forEach(e => runEffect(c, e, src)); break;
  }
}

// ---------- damage, block, statuses ----------

function damageEnemy(c, e, amount, t) {
  const blocked = Math.min(e.block, amount);
  e.block -= blocked;
  const dmg = amount - blocked;
  e.hp = Math.max(0, e.hp - dmg);
  const ev = emit(c, { t: "hit", target: e.uid, tally: t, amount, blocked, dmg, hpAfter: e.hp, blockAfter: e.block });
  const st = c.run.stats;
  if (st && amount > st.biggestHit) st.biggestHit = amount;
  if (e.hp <= 0) { ev.killed = true; killEnemy(c, e); return { killed: true }; }
  checkPhase(c, e);
  return { killed: false };
}

function checkPhase(c, e) {
  const def = MONSTERS[e.id];
  if (!def.phase2 || e.phase === 2 || e.hp > e.maxHp * def.phase2.at) return;
  e.phase = 2;
  for (const s of ["weak", "vulnerable", "frail", "bleed"]) delete e.statuses[s];
  emit(c, { t: "phase", uid: e.uid, text: def.phase2.text });
  (def.phase2.effects || []).forEach(eff => monsterEffect(c, e, eff));
  chooseIntent(c, e);
}

function killEnemy(c, e) {
  e.dead = true;
  e.hp = 0;
  emit(c, { t: "death", uid: e.uid });
  if (c.run.stats) c.run.stats.kills++;
  const api = makeApi(c);
  treasureHooks(c.run).forEach(h => h.def.onKill?.(api, e, h.state));
  // Minions crumble when the boss falls.
  if (e.boss) c.enemies.forEach(o => { if (!o.dead) { o.dead = true; emit(c, { t: "death", uid: o.uid }); } });
  checkEnd(c);
}

function gainBlock(c, n, t, silent) {
  if (n <= 0) return;
  c.player.block += n;
  emit(c, { t: "block", who: "player", amount: n, tally: t, blockAfter: c.player.block, silent });
}

function heal(c, who, n) {
  const before = who.hp;
  who.hp = Math.min(who.maxHp, who.hp + n);
  if (who.hp > before) emit(c, { t: "heal", who: who === c.player ? "player" : who.uid, n: who.hp - before, hpAfter: who.hp });
}

function loseHp(c, who, n) {
  who.hp = Math.max(0, who.hp - n);
  emit(c, { t: "hpLoss", who: who === c.player ? "player" : who.uid, n, hpAfter: who.hp });
  if (who === c.player) checkEnd(c);
  else if (who.hp <= 0) killEnemy(c, who);
  else checkPhase(c, who);   // Burn and Bleed can push a boss into its second phase too
}

function applyStatus(c, who, s, n, noBonus = false) {
  if (!n || !STATUSES[s]) return;
  // Ember Heart: Burn applied to monsters is stronger (not when an existing stack is multiplied).
  if (s === "burn" && n > 0 && who !== c.player && !noBonus) n += treasureFlag(c.run, "burnBonus");
  // Debuffs a monster puts on the hero last through the hero's next turn and the next round of attacks.
  if (who === c.player && c.phase === "enemies" && STATUSES[s].turns) c.freshDebuffs[s] = true;
  who.statuses[s] = (who.statuses[s] || 0) + n;
  if (who.statuses[s] <= 0) delete who.statuses[s];
  emit(c, { t: "status", who: who === c.player ? "player" : who.uid, status: s, n, total: who.statuses[s] || 0 });
}

function tickTurnStatuses(who, skip = {}) {
  for (const [s, v] of Object.entries(who.statuses)) {
    if (s === "fortify" || skip[s]) continue;
    if (STATUSES[s]?.turns) { if (v <= 1) delete who.statuses[s]; else who.statuses[s] = v - 1; }
  }
}

function checkEnd(c) {
  if (c.over) return;
  if (c.player.hp <= 0) { c.over = "lose"; emit(c, { t: "end", result: "lose" }); }
  else if (!alive(c).length) { c.over = "win"; emit(c, { t: "end", result: "win" }); }
}

// ---------- monsters ----------

export function chooseIntent(c, e) {
  const def = MONSTERS[e.id];
  const moveId = def.ai(e, c, c.rng);
  e.intent = { move: moveId, ...def.moves[moveId] };
}

/** Damage a monster's attack would deal to the hero right now (for the intent display). */
export function intentDamage(c, e) {
  const m = e.intent;
  if (!m || !m.dmg) return null;
  return { dmg: monsterHitDamage(c, e, m.dmg, true), hits: m.hits || 1 };
}

function monsterHitDamage(c, e, base, forIntent = false) {
  // The intent shows the Strength that Ritual will add just before the monster acts.
  const ritual = forIntent && e.statuses.ritual && e.history.length > 0 ? e.statuses.ritual : 0;
  let d = base * dmgScale(e.boss || e.minion ? 1 : c.floor, c.act || 1) * (ACT_DMG[c.act || 1] || 1) + (e.statuses.strength || 0) + ritual;
  if (e.statuses.weak) d *= 0.75;
  if (c.player.statuses.vulnerable) d *= 1.5;
  d *= fragile(c.run);
  if ((c.run.descent || 0) >= 2) d *= 1.1;
  return Math.max(0, Math.floor(d));
}

function monsterEffect(c, e, eff) {
  const p = c.player;
  if (eff.do === "status") applyStatus(c, eff.to === "self" ? e : p, eff.status, eff.n);
  else if (eff.do === "heal") heal(c, e, eff.n);
  else if (eff.do === "addCard") runEffect(c, eff, {});
}

function monsterTurn(c, e) {
  e.block = 0;
  for (const dot of ["bleed", "burn"]) {
    if (e.statuses[dot]) { loseHp(c, e, e.statuses[dot]); if (e.dead) return; e.statuses[dot]--; if (!e.statuses[dot]) delete e.statuses[dot]; }
  }
  if (e.statuses.ritual && e.history.length > 0) applyStatus(c, e, "strength", e.statuses.ritual);
  const m = e.intent;
  emit(c, { t: "enemyMove", uid: e.uid, move: m.move, intent: m.intent });
  const p = c.player;
  if (m.dmg) {
    for (let h = 0; h < (m.hits || 1); h++) {
      const dmg = monsterHitDamage(c, e, m.dmg);
      const blocked = Math.min(p.block, dmg);
      p.block -= blocked;
      p.hp = Math.max(0, p.hp - (dmg - blocked));
      emit(c, { t: "hit", target: "player", from: e.uid, amount: dmg, blocked, dmg: dmg - blocked, hpAfter: p.hp, blockAfter: p.block });
      if (p.statuses.thorns && !e.dead) damageEnemy(c, e, p.statuses.thorns, null);
      checkEnd(c);
      if (c.over || e.dead) break;
    }
  }
  if (c.over || e.dead) return;
  if (m.block) { e.block += m.block; emit(c, { t: "block", who: e.uid, amount: m.block, blockAfter: e.block }); }
  (m.effects || []).forEach(eff => monsterEffect(c, e, eff));
  if (m.summon) {
    for (const id of m.summon) {
      if (alive(c).length >= MAX_ENEMIES) break;
      const s = makeEnemy(id, c.floor, c.rng, false, true);
      c.enemies.push(s);
      chooseIntent(c, s);
      emit(c, { t: "summon", uid: s.uid, id });
    }
  }
  e.history.push(m.move);
  tickTurnStatuses(e);
}

/** Ends the hero's turn: monsters act, then a new turn starts. */
export function endTurn(c) {
  if (c.over) return;
  const p = c.player;
  // Curses that hurt while held.
  for (const card of c.hand) for (const eff of CARDS[card.id].endTurnInHand || []) runEffect(c, eff, { values: {} });
  if (c.over) return;
  c.discard.push(...c.hand);
  c.hand = [];
  delete p.statuses.edge;
  emit(c, { t: "turn", who: "enemies", turn: c.turn });
  c.phase = "enemies";
  c.freshDebuffs = {};
  for (const e of [...c.enemies]) {
    if (e.dead) continue;
    monsterTurn(c, e);
    if (c.over) { c.phase = "player"; return; }
  }
  c.phase = "player";
  // The hero's timed statuses count down at the end of the round, after the monsters have acted;
  // debuffs the monsters just applied are spared this once.
  tickTurnStatuses(p, c.freshDebuffs);
  for (const e of alive(c)) chooseIntent(c, e);
  startPlayerTurn(c);
}

export function useElixir(c, index, targetUid) {
  const id = c.run.elixirs[index];
  const def = ELIXIRS[id];
  if (!def || c.over) return false;
  const target = def.target === "enemy" ? findEnemy(c, targetUid) || alive(c)[0] : null;
  if (def.target === "enemy" && !target) return false;
  c.run.elixirs.splice(index, 1);
  emit(c, { t: "elixir", id, target: target?.uid });
  def.use(makeApi(c), target);
  checkEnd(c);
  return true;
}

/** After the fight: carry HP back to the run and fire end-of-fight treasures. */
export function finishCombat(c) {
  const run = c.run;
  run.hp = Math.max(0, c.player.hp);
  if (c.over === "win") {
    const api = makeApi(c);
    api.heal = n => { run.hp = Math.min(run.maxHp, run.hp + n); };
    treasureHooks(run).forEach(h => h.def.onCombatEnd?.(api, h.state));
  }
  run.fights = (run.fights || 0) + 1;
}
