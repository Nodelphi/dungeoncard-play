// The fight screen. Actions go to the engine first; the UI then replays combat.events as animations
// (the Balatro-style tally for each hit, monster lunges, floating numbers) before redrawing.
import { h, svg, art, sleep, toast, STATUS_ICON } from "./dom.js";
import { cardEl } from "./card.js";
import { A, act, render, persist, closeTip, showTip, hoverTip } from "./app.js";
import { playCard, endTurn, canPlay, intentDamage, useElixir } from "../engine/combat.js";
import { afterCombat } from "../engine/run.js";
import { CARDS } from "../../data/cards.js";
import { STATUSES } from "../../data/statuses.js";
import { TREASURES } from "../../data/treasures.js";
import { RUNES } from "../../data/runes.js";
import { ELIXIRS } from "../../data/elixirs.js";
import { HEROES } from "../../data/heroes.js";
import { sfx, prefs } from "./sfx.js";
import { playTally, sparks } from "./tally-view.js";

let sel = null;            // selected card uid
let elixirTarget = null;   // elixir slot waiting for a target
let freshDraws = new Set();
let lastCombat = null;     // selections reset when a new fight begins
/** Forget any selected card or pending elixir target. */
export function clearCombatSelection() { sel = null; elixirTarget = null; }
const app = () => document.getElementById("app");

export function combatView(run) {
  const c = run.combat;
  if (c !== lastCombat) { lastCombat = c; clearCombatSelection(); }
  const live = c.enemies.filter(e => !e.dead);
  const needsTarget = (sel && CARDS[c.hand.find(x => x.uid === sel)?.id]?.target === "enemy" && live.length > 1) || elixirTarget !== null;
  const root = h("div.screen.combat", { onclick: e => { if (e.target === e.currentTarget || e.target.classList.contains("enemies")) { sel = null; elixirTarget = null; render(); } } });
  const enemies = h("div.enemies", { style: { "--n": String(live.length) } }, live.map(e => enemyEl(c, e, needsTarget)));
  root.append(enemies, playerEl(c), handEl(c));
  requestAnimationFrame(() => layoutHand(root.querySelector(".hand")));
  // Things that happened before any input (start-of-fight treasures, a fight already won) play out now.
  if (!A.busy && (c.events.length || c.over)) setTimeout(() => { if (!A.busy && A.run?.combat === c) playback(); }, 120);
  return root;
}

// ---------- monsters ----------
function enemyEl(c, e, targetable) {
  const el = h(`div.enemy${e.elite ? ".elite" : ""}${e.boss ? ".boss" : ""}${targetable ? ".targetable" : ""}`, {
    dataset: { uid: e.uid }, "aria-label": `${e.name}, ${e.hp} of ${e.maxHp} health`, tabindex: "0", role: "button",
    onclick: ev => { ev.stopPropagation(); onEnemyTap(e.uid); },
    onkeydown: ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); onEnemyTap(e.uid); } },
  },
    intentEl(c, e),
    hoverTip(twinFlip(c, e, art(`monster_${e.id}`, { cls: "portrait", glyph: e.name[0] })), () => monsterTipContent(c, e)),
    h("div.nameplate", e.name),
    barEl(e.hp, e.maxHp, e.block),
    statusesEl(e.statuses),
  );
  return el;
}

/** Mirror every other copy of the same monster so a pair doesn't look cloned. */
function twinFlip(c, e, el) {
  const same = c.enemies.filter(x => x.id === e.id);
  if (same.indexOf(e) % 2 === 1) el.querySelector("img").style.transform = "scaleX(-1)";
  return el;
}

function intentEl(c, e) {
  const m = e.intent;
  if (!m) return h("div.intent", "…");
  const kind = m.intent;
  const parts = [];
  if (m.dmg) { const d = intentDamage(c, e); parts.push(svg("sword"), d.hits > 1 ? `${d.dmg}×${d.hits}` : String(d.dmg)); }
  if (m.block) parts.push(svg("shield"), String(m.block));
  if (kind === "buff") parts.push(svg("up"));
  if (kind === "debuff") parts.push(svg("swirl"));
  if (kind === "summon") parts.push(svg("plus"), "Summon");
  const label = { attack: "Attacking", defend: "Defending", buff: "Growing stronger", debuff: "Casting a curse", summon: "Summoning" }[kind];
  return h(`div.intent.${kind}`, { title: label, "aria-label": `Intends: ${label}` }, parts);
}

function barEl(hp, max, block, who) {
  return h(`div.bar${block ? ".has-block" : ""}`, { dataset: { who: who || "" } },
    h("div.ghost", { style: { width: `calc(${(100 * hp) / max}% - 2px)` } }),
    h("div.fill", { style: { width: `calc(${(100 * hp) / max}% - 2px)` } }),
    h("span", `${hp}/${max}`),
    block ? h("div.block-badge", String(block)) : null,
  );
}
function updateBar(bar, hp, max, block) {
  if (!bar) return;
  if (bar.dataset.who === "player") { const t = document.querySelector(".topbar .hp-num"); if (t) t.textContent = `${Math.max(0, hp)}/${max}`; }
  const pct = `calc(${Math.max(0, (100 * hp) / max)}% - 2px)`;
  bar.querySelector(".fill").style.width = pct;
  bar.querySelector(".ghost").style.width = pct;
  bar.querySelector("span").textContent = `${Math.max(0, hp)}/${max}`;
  bar.classList.toggle("has-block", block > 0);
  bar.querySelector(".block-badge")?.remove();
  if (block > 0) bar.append(h("div.block-badge", String(block)));
}

function statusesEl(statuses) {
  return h("div.statuses", Object.entries(statuses).filter(([, n]) => n).map(([s, n]) => {
    const def = STATUSES[s];
    return hoverTip(h(`span.status.${def.good ? "good" : "bad"}`, { "aria-label": `${def.name}: ${def.text.replace("{n}", n)}` }, svg(STATUS_ICON[s] || "spike"), String(n)),
      () => [h("div.rarity", def.good ? "Boon" : "Affliction"), h("h3", `${def.name} ${n}`), h("p", def.text.replace("{n}", n))]);
  }));
}

// ---------- the hero ----------
function playerEl(c) {
  const p = c.player;
  return h("div.player", { dataset: { who: "player" } },
    h(`div.energy${c.energy ? "" : ".empty"}`, { title: "Energy", "aria-label": `${c.energy} of ${c.maxEnergy} energy` }, `${c.energy}/${c.maxEnergy}`),
    h("div.pmid",
      barEl(p.hp, p.maxHp, p.block, "player"),
      hoverTip(h("div.line", { onclick: ev => heroTip(c, ev.currentTarget) }, momentumEl(c), statusesEl(p.statuses)), () => heroTipContent(c)),
    ),
    h("div.pright",
      h("div.piles",
        h("button.pile", { onclick: () => { A.overlay = "draw"; render(); }, "aria-label": "Draw pile" }, h("b", String(c.draw.length)), "DRAW"),
        h("button.pile", { onclick: () => { A.overlay = "discard"; render(); }, "aria-label": "Discard pile" }, h("b", String(c.discard.length)), "DISCARD")),
      h("button.btn.ember.end", { onclick: doEndTurn, disabled: A.busy || !!c.over }, "End turn"),
    ),
  );
}
/** The hero's class mechanic badge (Momentum, Kindle, Bulwark, Ambush). */
function momentumEl(c) {
  const hero = HEROES[A.run.hero];
  return h(`span.momentum${hero.badgeActive(c) ? "" : ".zero"}`, { title: `${hero.mechanic}: ${hero.mechanicText}` }, svg("flame"), hero.badge(c));
}
function refreshBadge(c, over = {}) {
  const m = document.querySelector(".momentum");
  if (m) m.replaceWith(momentumEl({ ...c, ...over }));
}

// ---------- the hand ----------
function handEl(c) {
  const hand = h("div.hand");
  const selected = c.hand.find(x => x.uid === sel);
  if (selected) {
    const def = CARDS[selected.id];
    const live = c.enemies.filter(e => !e.dead).length;
    hand.append(h("div.hint", def.target === "enemy" && live > 1 ? "Tap a monster to target it" : "Tap again to play"));
  } else if (elixirTarget !== null) hand.append(h("div.hint", "Tap a monster to throw the elixir"));
  c.hand.forEach((card, i) => {
    const playable = canPlay(c, card);
    const el = cardEl(card, { playable, cls: [card.uid === sel ? "selected" : "", freshDraws.has(card.uid) ? "drawn" : ""].filter(Boolean).join(".") });
    if (freshDraws.has(card.uid)) el.style.animationDelay = `${i * 60}ms`;
    el.style.zIndex = String(i + 1);
    cardGestures(el, card);
    hand.append(el);
  });
  freshDraws = new Set();
  return hand;
}

/** Overlaps and fans the hand to fit the screen. */
function layoutHand(hand) {
  if (!hand) return;
  const cards = [...hand.querySelectorAll(".card")];
  if (!cards.length) return;
  const cw = cards[0].offsetWidth, W = hand.clientWidth - 8, n = cards.length;
  const overlap = n > 1 ? Math.max(cw * 0.12, (n * cw - W) / (n - 1)) : 0;
  hand.style.setProperty("--overlap", `${overlap}px`);
  const hr = hand.getBoundingClientRect();
  cards.forEach((el, i) => {
    const off = i - (n - 1) / 2;
    el.style.setProperty("--fan", `rotate(${off * 3.5}deg) translateY(${Math.abs(off) ** 1.6 * 3}px)`);
    // Keep an enlarged card on screen at the edges of the hand.
    const left = hr.left + el.offsetLeft + cw / 2, half = (cw * 1.45) / 2, vw = document.documentElement.clientWidth;
    el.style.setProperty("--sx", `${Math.max(0, 8 + half - left) - Math.max(0, left + half - (vw - 8))}px`);
  });
}

function cardGestures(el, card) {
  el.addEventListener("pointerdown", e => {
    if (A.busy || e.button > 0) return;
    const c = A.run.combat;
    const start = { x: e.clientX, y: e.clientY };
    let dragging = false;
    const move = ev => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!dragging && dy < -14 && canPlay(c, card)) { dragging = true; el.classList.add("dragging"); }
      if (!dragging) return;
      el.style.transform = `translate(${dx}px, ${dy}px) scale(1.15)`;
      document.querySelectorAll(".enemy").forEach(x => x.classList.remove("targetable"));
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".enemy");
      if (over && CARDS[card.id].target === "enemy") over.classList.add("targetable");
    };
    const up = ev => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!dragging) return;
      if (ev.type === "pointercancel") { el.style.transform = ""; el.classList.remove("dragging"); return; }
      el.style.transform = "";
      el.classList.remove("dragging");
      const over = document.elementFromPoint(ev.clientX, ev.clientY);
      const enemy = over?.closest(".enemy");
      const handTop = el.parentElement.getBoundingClientRect().top;
      if (CARDS[card.id].target === "enemy") {
        if (enemy) doPlay(card.uid, enemy.dataset.uid);
        else if (ev.clientY < handTop - 30 && c.enemies.filter(x => !x.dead).length === 1) doPlay(card.uid);
        else render();
      } else if (ev.clientY < handTop - 30) doPlay(card.uid);
      else render();
      el.dataset.dragged = "1";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  });
  el.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); onCardTap(card); } });
  el.addEventListener("click", ev => {
    ev.stopPropagation();
    if (el.dataset.dragged) { delete el.dataset.dragged; return; }
    onCardTap(card);
  });
}

function onCardTap(card) {
  if (A.busy) return;
  const c = A.run.combat;
  closeTip();
  elixirTarget = null;
  if (sel !== card.uid) {
    if (!canPlay(c, card)) toast(CARDS[card.id].type === "curse" ? "Curses can't be played" : "Not enough energy");
    sel = card.uid;
    render();
    return;
  }
  if (!canPlay(c, card)) return;
  const live = c.enemies.filter(e => !e.dead);
  if (CARDS[card.id].target === "enemy" && live.length > 1) { toast("Tap a monster to target it"); return; }
  doPlay(card.uid, live[0]?.uid);
}

function onEnemyTap(uid) {
  if (A.busy) return;
  const c = A.run.combat;
  if (elixirTarget !== null) { const i = elixirTarget; elixirTarget = null; useAndPlay(() => useElixir(c, i, uid)); return; }
  const card = c.hand.find(x => x.uid === sel);
  if (card && canPlay(c, card)) { doPlay(card.uid, uid); return; }
  monsterTip(c, uid);
}

/** Tapping the hero's line explains their mechanic and statuses. */
function heroTip(c, anchor) { showTip(anchor, heroTipContent(c)); }
function heroTipContent(c) {
  const hero = HEROES[A.run.hero];
  return [
    h("div.rarity", hero.short),
    h("h3", hero.mechanic),
    h("p", hero.mechanicText),
    ...Object.entries(c.player.statuses).filter(([, n]) => n).map(([s, n]) => h("p", h("b", `${STATUSES[s].name} ${n}: `), STATUSES[s].text.replace("{n}", n))),
  ];
}

/** Tapping a monster with no card selected explains its intent and statuses. */
function monsterTip(c, uid) {
  const e = c.enemies.find(x => x.uid === uid);
  const el = document.querySelector(`.enemy[data-uid="${uid}"] .portrait`);
  if (!e || !el) return;
  showTip(el, monsterTipContent(c, e));
}
function monsterTipContent(c, e) {
  if (e.dead) return null;
  const m = e.intent, d = intentDamage(c, e);
  const what = !m ? "" : [
    d ? `Attack for ${d.dmg}${d.hits > 1 ? ` × ${d.hits}` : ""}.` : "",
    m.block ? `Gain ${m.block} Block.` : "",
    m.intent === "buff" ? "Grow stronger." : "",
    m.intent === "debuff" ? "Curse you with a harmful effect." : "",
    m.intent === "summon" ? "Call for reinforcements." : "",
  ].filter(Boolean).join(" ");
  return [
    h("div.rarity", e.boss ? "Boss" : e.elite ? "Elite" : "Monster"),
    h("h3", e.name),
    h("p", `${e.hp} / ${e.maxHp} HP${e.block ? ` · ${e.block} Block` : ""}`),
    what && h("p", h("b", "Next: "), what),
    ...Object.entries(e.statuses).filter(([, n]) => n).map(([s, n]) => h("p", h("b", `${STATUSES[s].name} ${n}: `), STATUSES[s].text.replace("{n}", n))),
  ];
}

export function combatElixir(i) {
  if (A.busy) return;
  const c = A.run.combat;
  const def = ELIXIRS[A.run.elixirs[i]];
  const live = c.enemies.filter(e => !e.dead);
  if (def.target === "enemy" && live.length > 1) { elixirTarget = i; sel = null; render(); return; }
  useAndPlay(() => useElixir(c, i, live[0]?.uid));
}

async function useAndPlay(fn) {
  if (A.busy || !fn()) return;
  await playback();
}

// ---------- actions ----------
async function doPlay(uid, targetUid) {
  if (A.busy) return;
  const c = A.run.combat;
  const el = document.querySelector(`.hand .card[data-uid="${uid}"]`);
  if (!playCard(c, uid, targetUid)) { toast("Can't play that now"); render(); return; }
  clearCombatSelection();
  document.querySelector(".hand .hint")?.remove();
  el?.classList.add("played");
  await playback();
}

async function doEndTurn() {
  if (A.busy) return;
  const c = A.run.combat;
  sel = null; elixirTarget = null;
  document.querySelectorAll(".hand .card").forEach((el, i) => { el.style.transition = "transform 0.25s ease, opacity 0.25s ease"; el.style.transform = `translate(${40 + i * 10}vw, 20px) rotate(20deg)`; el.style.opacity = "0"; });
  endTurn(c);
  await playback();
}

async function playback() {
  if (A.busy) return;   // one animation loop at a time; anything queued plays on the next redraw
  const run = A.run, c = run.combat;
  A.busy = true;
  document.querySelector(".end")?.setAttribute("disabled", "");
  document.querySelector(".hand")?.classList.add("locked");
  const events = c.events.splice(0);
  let hitInCard = 0;
  for (const ev of events) {
    if (ev.t === "play" || ev.t === "turn") hitInCard = 0;
    await playEvent(c, ev, ev.t === "hit" && ev.tally ? hitInCard++ : 0);
  }
  if (c.over) {
    // Stay locked through the pause so nothing else starts a second wrap-up.
    await sleep(c.over === "win" ? 700 : 1100);
    A.busy = false;
    A.overlay = null;
    clearCombatSelection();
    if (A.run?.combat === c) act(r => afterCombat(r));
    return;
  }
  A.busy = false;
  persist();
  render();
}

// ---------- event playback ----------
const SPEED = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.35 : 1) / (prefs.speed || 1);
const wait = ms => sleep(ms * SPEED());

async function playEvent(c, ev, hitIndex) {
  switch (ev.t) {
    case "play": sfx.card(); await wait(90); break;
    case "hit": {
      if (ev.target === "player") {
        const from = document.querySelector(`.enemy[data-uid="${ev.from}"]`);
        from?.classList.remove("lunge"); void from?.offsetWidth; from?.classList.add("lunge");
        await wait(160);
        const pl = document.querySelector(".player");
        pl?.classList.remove("hit"); void pl?.offsetWidth; pl?.classList.add("hit");
        if (ev.dmg > 0) { app().append(h("div.flash-red")); sfx.hurt(); } else sfx.block();
        updateBar(document.querySelector('.bar[data-who="player"]'), ev.hpAfter, c.player.maxHp, ev.blockAfter);
        floatAt(pl?.querySelector(".bar"), ev.dmg > 0 ? `-${ev.dmg}` : "Blocked", ev.dmg > 0 ? "player" : "block");
        await wait(380);
      } else {
        const el = document.querySelector(`.enemy[data-uid="${ev.target}"]`);
        if (ev.tally) await showTally(ev.tally, "attack", hitIndex);
        el?.classList.remove("hit"); void el?.offsetWidth; el?.classList.add("hit");
        if (ev.dmg > 0) sfx.hit(ev.amount >= 30); else sfx.block();
        const e = c.enemies.find(x => x.uid === ev.target);
        updateBar(el?.querySelector(".bar"), ev.hpAfter, e?.maxHp || 1, ev.blockAfter);
        const fl = floatAt(el?.querySelector(".portrait"), ev.dmg > 0 ? String(ev.dmg) : "Blocked", ev.amount >= 30 ? "big" : ev.dmg > 0 ? "" : "block");
        if (fl && ev.dmg > 0) fl.style.fontSize = `${Math.min(4.6, 1.8 + Math.log10(ev.dmg) * 1.1).toFixed(2)}rem`;
        if (fl && ev.tally?.roll?.crit) fl.classList.add("crit");
        if (ev.dmg > 0 && el) { const r = el.querySelector(".portrait")?.getBoundingClientRect(), ar = app().getBoundingClientRect(); if (r) sparks(r.left - ar.left + r.width / 2, r.top - ar.top + r.height / 2, { n: ev.amount >= 30 ? 16 : 8, color: "#ffb36b", reach: ev.amount >= 30 ? 90 : 50, size: 5 }); }
        await wait(hitIndex > 0 ? 160 : 260);
      }
      break;
    }
    case "block": {
      if (ev.who === "player") {
        if (ev.tally && ev.tally.steps.length) await showTally(ev.tally, "block", 0);
        sfx.block();
        updateBar(document.querySelector('.bar[data-who="player"]'), c.player.hp, c.player.maxHp, ev.blockAfter);
        if (!ev.silent) floatAt(document.querySelector('.bar[data-who="player"]'), `+${ev.amount}`, "block");
        refreshBadge(c, { player: { ...c.player, block: ev.blockAfter } });
      } else {
        const el = document.querySelector(`.enemy[data-uid="${ev.who}"]`);
        const e = c.enemies.find(x => x.uid === ev.who);
        if (el && e) updateBar(el.querySelector(".bar"), e.hp, e.maxHp, ev.blockAfter);
        floatAt(el?.querySelector(".portrait"), `+${ev.amount}`, "block");
      }
      await wait(220);
      break;
    }
    case "heal": case "hpLoss": {
      const isPlayer = ev.who === "player";
      const el = isPlayer ? document.querySelector(".player") : document.querySelector(`.enemy[data-uid="${ev.who}"]`);
      const who = isPlayer ? c.player : c.enemies.find(x => x.uid === ev.who);
      if (who) updateBar(el?.querySelector(".bar"), ev.hpAfter, who.maxHp, isPlayer ? c.player.block : who.block);
      floatAt(el?.querySelector(isPlayer ? ".bar" : ".portrait"), ev.t === "heal" ? `+${ev.n}` : `-${ev.n}`, ev.t === "heal" ? "heal" : isPlayer ? "player" : "");
      if (ev.t === "heal") sfx.heal();
      await wait(260);
      break;
    }
    case "status": {
      const el = ev.who === "player" ? document.querySelector(".player .statuses") : document.querySelector(`.enemy[data-uid="${ev.who}"] .statuses`);
      const who = ev.who === "player" ? c.player : c.enemies.find(x => x.uid === ev.who);
      if (el && who) el.replaceWith(statusesEl(who.statuses));
      await wait(140);
      break;
    }
    case "momentum": {
      const m = document.querySelector(".momentum");
      if (m) { const fresh = momentumEl({ ...c, momentum: ev.total }); m.replaceWith(fresh); fresh.classList.add("bump"); setTimeout(() => fresh.classList.remove("bump"), 160); }
      break;
    }
    case "energy": { const e = document.querySelector(".energy"); if (e) e.textContent = `${c.energy}/${c.maxEnergy}`; break; }
    case "gold": floatAt(document.querySelector(".topbar .gold"), `+${ev.n} gold`, "heal"); sfx.coin(); break;
    case "death": {
      document.querySelector(`.enemy[data-uid="${ev.uid}"]`)?.classList.add("dead");
      sfx.death();
      await wait(320);
      break;
    }
    case "summon": {
      const row = document.querySelector(".enemies");
      const e = c.enemies.find(x => x.uid === ev.uid);
      if (row && e) { const el = enemyEl(c, e, false); el.style.animation = "fade-in 0.4s ease"; row.append(el); row.style.setProperty("--n", String(row.children.length)); }
      await wait(320);
      break;
    }
    case "phase": banner(ev.text, "var(--metal-legendary)"); await wait(1200); break;
    case "enemyMove": {
      if (ev.intent === "buff" || ev.intent === "defend") sfx.buff();
      if (ev.intent === "debuff" || ev.intent === "summon") sfx.debuff();
      if (!["attack"].includes(ev.intent)) {
        const el = document.querySelector(`.enemy[data-uid="${ev.uid}"] .intent`);
        el?.animate([{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }], { duration: 300 });
      }
      await wait(200);
      break;
    }
    case "turn": if (ev.who === "enemies") await wait(250); break;
    case "draw": ev.uids.forEach(u => freshDraws.add(u)); break;
    case "elixir": await wait(150); break;
    case "end": (ev.result === "win" ? sfx.win : sfx.lose)(); banner(ev.result === "win" ? "Victory" : "Defeated", ev.result === "win" ? "var(--gilt-bright)" : "#e06060"); break;
  }
}

function floatAt(target, text, cls = "") {
  if (!target) return;
  const r = target.getBoundingClientRect(), ar = app().getBoundingClientRect();
  const el = h(`div.float-num${cls ? "." + cls : ""}`, { style: { left: `${r.left - ar.left + r.width / 2 + (Math.random() * 30 - 15)}px`, top: `${r.top - ar.top + r.height / 2}px` } }, text);
  app().append(el);
  setTimeout(() => el.remove(), 950);
  return el;
}

function banner(text, color) {
  const b = h("div.banner", { style: { color } }, text);
  app().append(b);
  setTimeout(() => b.remove(), 1150);
}

/** Balatro-style tally (see tally-view.js). */
function showTally(t, kind, hitIndex) {
  return playTally(t, kind, hitIndex, {
    wait,
    labelOf: stepLabel,
    slotOf: step => document.querySelector(`.rack .slot[data-slot="${step.slot}"]`),
  });
}
/** Who a tally step came from (the value is added by the tally). */
function stepLabel(s) {
  return s.src === "treasure" ? TREASURES[s.id]?.name : s.src === "rune" ? RUNES[s.id]?.name : s.src === "status" ? STATUSES[s.id]?.name : s.label || (s.src === "card" ? CARDS[s.id]?.name : "");
}

// Keyboard: 1-9 pick a card, E or Space ends the turn.
window.addEventListener("keydown", e => {
  if (!A.run || A.run.screen !== "combat" || A.overlay || A.title || A.busy) return;
  const c = A.run.combat;
  const onControl = document.activeElement?.closest?.(".card, .enemy, button, .slot");
  if (e.key === "e" || e.key === "E" || (e.key === " " && !sel && !onControl)) { e.preventDefault(); doEndTurn(); return; }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= c.hand.length) onCardTap(c.hand[n - 1]);
  if (e.key === " " && sel) { e.preventDefault(); const card = c.hand.find(x => x.uid === sel); if (card) onCardTap(card); }
});
