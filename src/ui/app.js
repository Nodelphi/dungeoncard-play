// The app shell: picks the screen for the run's state, draws the top bar and treasure rack,
// and shows overlays (deck, card picker, full treasure rack, menu). Saves after every action.
import { h, svg, art, toast } from "./dom.js";
import { cardEl } from "./card.js";
import { newRun, pickable, resolvePick, cancelPick, canCancelPick, replaceTreasure, discardPendingTreasure, sellTreasure, sellValue, moveTreasure, MAX_TREASURES, MAX_ELIXIRS } from "../engine/run.js";
import { saveRun, loadRun, clearRun, loadMeta, recordRun } from "../engine/save.js";
import { TREASURES, treasureText } from "../../data/treasures.js";
import { ELIXIRS } from "../../data/elixirs.js";
import { CARDS } from "../../data/cards.js";
import { titleView, heroSelectView, mapView, rewardView, shopView, restView, eventView, vaultView, endView } from "./screens.js";
import { ACT_NAMES } from "../../data/monsters.js";
import { combatView, combatElixir, clearCombatSelection } from "./combat-view.js";
import { codexView, howToView } from "./codex.js";
import { prefs, savePrefs, sfx } from "./sfx.js";
import { savesOverlay } from "./saves-view.js";

export const A = { run: null, meta: loadMeta(), overlay: null, title: true, choosing: false, page: null, codexTab: null, busy: false, descent: 0 };
const app = document.getElementById("app");

/** Runs a change to the run, saves, and redraws. */
export function act(fn) {
  if (!A.run || A.busy) return;   // nothing changes while a fight is animating
  const result = fn(A.run);
  persist();
  render();
  return result;
}
export function persist() {
  const run = A.run;
  if (!run) return;
  if ((run.screen === "victory" || run.screen === "defeat") && !run.recorded) {
    run.recorded = true;
    A.meta = recordRun(run);
    clearRun();
    return;
  }
  if (!run.recorded) saveRun(run);
}
export function chooseHero() {
  A.title = true;
  A.choosing = true;
  render();
}
export function startRun(heroId) {
  A.run = newRun(undefined, heroId, Math.min(A.descent, A.meta.descent));
  A.title = false;
  A.choosing = false;
  A.overlay = null;
  persist();
  render();
}
export function continueRun() {
  A.run = loadRun();
  A.title = !A.run;
  render();
}
export function toTitle() {
  A.title = true;
  A.choosing = false;
  A.overlay = null;
  render();
}

// Two rooms per act for ordinary fights (first and second half), plus each boss's lair.
const ACT_ROOMS = { 1: ["backdrop_crypt", "backdrop_ossuary", "backdrop_throne"], 2: ["backdrop_cistern", "backdrop_sunken_temple", "backdrop_queen_lair"], 3: ["backdrop_lava_cavern", "backdrop_forge_hall", "backdrop_dragon_lair"] };
const fightRoom = run => { const r = ACT_ROOMS[run.act || 1]; return run.combat?.kind === "boss" || run.room?.type === "boss" ? r[2] : run.floor > 8 ? r[1] : r[0]; };
const BACKDROP = run => {
  if (A.page) return "backdrop_vault";
  if (A.title || !run) return A.choosing ? "backdrop_crypt" : "title_key";
  switch (run.screen) {
    case "combat": return fightRoom(run);
    case "reward": return fightRoom(run);
    case "event": return ACT_ROOMS[run.act || 1][0];
    case "shop": return "backdrop_merchant";
    case "rest": return "backdrop_campfire";
    case "vault": return "backdrop_vault";
    case "victory": return "backdrop_dragon_lair";
    case "defeat": return "backdrop_crypt";
    default: return null;
  }
};

export function render() {
  const run = A.run;
  app.replaceChildren();
  const bd = BACKDROP(run);
  const backdrop = h("div.backdrop");
  if (bd) { const a = art(bd); a.style.position = "absolute"; a.style.inset = "0"; a.style.background = "none"; a.querySelector("img").style.filter = "saturate(0.95) brightness(0.62)"; backdrop.append(a); }
  app.append(backdrop);

  if (A.page) { app.append(A.page === "codex" ? codexView() : howToView()); return; }
  if (A.title || !run) {
    app.append(A.choosing ? heroSelectView() : titleView());
    if (A.overlay === "saves") app.append(savesOverlay());
    return;
  }
  const ended = run.screen === "victory" || run.screen === "defeat";
  if (!ended) app.append(topbar(run), rack(run));
  const view = { map: mapView, combat: combatView, reward: rewardView, shop: shopView, rest: restView, event: eventView, vault: vaultView, victory: endView, defeat: endView }[run.screen];
  app.append(view ? view(run) : h("div.screen", "Unknown screen"));

  // Pile views only make sense mid-fight.
  if ((A.overlay === "draw" || A.overlay === "discard") && !run.combat) A.overlay = null;
  if (run.pick) app.append(pickerOverlay(run));
  else if (run.pendingTreasure) app.append(replaceOverlay(run));
  else if (A.overlay === "deck") app.append(deckOverlay(run.deck, "Your deck"));
  else if (A.overlay === "draw") app.append(deckOverlay([...run.combat.draw].sort((a, b) => a.id.localeCompare(b.id)), "Draw pile"));
  else if (A.overlay === "discard") app.append(deckOverlay(run.combat.discard, "Discard pile"));
  else if (A.overlay === "menu") app.append(menuOverlay());
  else if (A.overlay === "saves") app.append(savesOverlay());
}

// ---------- top bar ----------
function topbar(run) {
  const elixirs = Array.from({ length: MAX_ELIXIRS }, (_, i) => {
    const id = run.elixirs[i];
    if (!id) return h("button.elixir-slot.empty", { "aria-label": "Empty elixir slot", disabled: true });
    return hoverTip(h("button.elixir-slot", { "aria-label": ELIXIRS[id].name, onclick: e => elixirTip(e.currentTarget, i) }, art(ELIXIRS[id].art, { glyph: "◆" })),
      () => [h("div.rarity", "Elixir"), h("h3", ELIXIRS[id].name), h("p", ELIXIRS[id].text),
        h("p.hint", run.combat && !run.combat.over ? `Click to ${ELIXIRS[id].target === "enemy" ? "throw" : "drink"} it.` : "Click for options.")]);
  });
  return h("div.topbar",
    h("span.stat.hp", { title: "Health" }, svg("heart"), h("span.hp-num", `${run.combat ? run.combat.player.hp : run.hp}/${run.maxHp}`)),
    h("span.stat.gold", { title: "Gold" }, svg("coin"), String(run.gold)),
    run.descent > 0 && h("span.stat.descent", { title: `Descent ${run.descent}` }, svg("skull"), String(run.descent)),
    h("span.stat.floor", { title: ACT_NAMES[run.act || 1] }, h("span", `ACT ${run.act || 1}`), h("span", run.floor > 15 ? "BOSS" : `FLOOR ${Math.max(1, run.floor)}`)),
    h("span.spacer"),
    h("div.elixirs", elixirs),
    h("button.icon-btn", { "aria-label": "View deck", onclick: () => { A.overlay = "deck"; render(); } }, svg("deck"), h("span.badge", String(run.deck.length))),
    h("button.icon-btn", { "aria-label": "Menu", onclick: () => { A.overlay = "menu"; render(); } }, svg("menu")),
  );
}

// ---------- treasure rack ----------
function rack(run) {
  const slots = Array.from({ length: MAX_TREASURES }, (_, i) => {
    const tr = run.treasures[i];
    if (!tr) return h("div.slot.empty", { "aria-hidden": "true" });
    const def = TREASURES[tr.id];
    const el = h("button.slot", { dataset: { slot: i, rarity: def.rarity }, "aria-label": `${def.name}: ${treasureText(tr)}` },
      art(def.art, { glyph: def.name[0] }), h("span.order", String(i + 1)));
    dragToReorder(el, i);
    hoverTip(el, () => [
      h("div.rarity", `${def.rarity} treasure · slot ${i + 1}`), h("h3", def.name), h("p", treasureText(tr)),
      h("p.hint", "Click for options. Drag to reorder: treasures apply left to right."),
    ]);
    return el;
  });
  return h("div.rack", h("span.label", "TREASURE"), slots);
}

/** Drag a treasure onto another slot to swap their order; a plain tap shows its details. */
function dragToReorder(el, index) {
  el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); treasureTip(el, index); } });
  el.addEventListener("pointerdown", e => {
    const start = { x: e.clientX, y: e.clientY };
    let dragging = false, over = null;
    const move = ev => {
      if (!dragging && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) { dragging = true; el.classList.add("dragging"); }
      if (!dragging) return;
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".rack .slot:not(.empty)");
      if (over && over !== target) over.classList.remove("drop-target");
      over = target && target !== el ? target : null;
      over?.classList.add("drop-target");
    };
    const up = ev => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.classList.remove("dragging");
      over?.classList.remove("drop-target");
      if (ev.type === "pointercancel") return;
      if (dragging && over) act(run => moveTreasure(run, index, Number(over.dataset.slot)));
      else if (!dragging) treasureTip(el, index);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  });
}

export function closeTip() { document.querySelectorAll(".tip, .tip-catcher").forEach(t => t.remove()); hoverEl = null; }
export function showTip(anchor, content) {
  closeTip();
  const catcher = h("div.tip-catcher", { style: { position: "absolute", inset: "0", zIndex: "49" }, onpointerdown: closeTip });
  const tip = h("div.tip.panel", content);
  app.append(catcher, tip);
  placeTip(tip, anchor);
}

// Hover tooltips (mouse only): an element registered with hoverTip(el, () => content) shows its
// name and description while the pointer rests on it. Taps still open the full tip with buttons.
const hoverContent = new WeakMap();
let hoverEl = null;
export function hoverTip(el, content) { hoverContent.set(el, content); return el; }
function hideHover() { document.querySelectorAll(".tip.hover").forEach(t => t.remove()); hoverEl = null; }
app.addEventListener("pointerover", e => {
  if (e.pointerType !== "mouse") return;
  let t = e.target;
  while (t && t !== app && !hoverContent.has(t)) t = t.parentElement;
  if (!t || t === app || t === hoverEl) return;
  hideHover();
  if (document.querySelector(".tip:not(.hover)") || t.classList.contains("dragging")) return;   // a tapped tip is already open
  hoverEl = t;
  const content = hoverContent.get(t)();
  if (!content) return;
  const tip = h("div.tip.panel.hover", content);
  app.append(tip);
  placeTip(tip, t);
});
app.addEventListener("pointerout", e => { if (hoverEl && !hoverEl.contains(e.relatedTarget)) hideHover(); });
app.addEventListener("pointerdown", hideHover);

function placeTip(tip, anchor) {
  const r = anchor.getBoundingClientRect(), ar = app.getBoundingClientRect();
  const left = Math.max(8, Math.min(ar.width - tip.offsetWidth - 8, r.left - ar.left + r.width / 2 - tip.offsetWidth / 2));
  tip.style.left = left + "px";
  // Below the anchor if it fits, otherwise above it.
  const below = r.bottom - ar.top + 8;
  tip.style.top = (below + tip.offsetHeight > ar.height - 8 ? Math.max(8, r.top - ar.top - tip.offsetHeight - 8) : below) + "px";
}

function treasureTip(anchor, i) {
  const run = A.run, tr = run.treasures[i], def = TREASURES[tr.id];
  const inCombat = run.screen === "combat";
  showTip(anchor, [
    h("div.rarity", `${def.rarity} treasure · slot ${i + 1}`),
    h("h3", def.name),
    h("p", treasureText(tr)),
    h("p", { style: { color: "var(--text-dim)", fontSize: "0.85rem" } }, "Treasures apply left to right. Drag to reorder."),
    h("div.row",
      i > 0 && h("button.btn.small.ghost", { onclick: () => { closeTip(); act(r => moveTreasure(r, i, i - 1)); } }, "◀ Move"),
      i < run.treasures.length - 1 && h("button.btn.small.ghost", { onclick: () => { closeTip(); act(r => moveTreasure(r, i, i + 1)); } }, "Move ▶"),
      !inCombat && h("button.btn.small", { onclick: () => { closeTip(); act(r => sellTreasure(r, i)); toast(`Sold for ${sellValue(tr)} gold`); } }, `Sell · ${sellValue(tr)}g`),
    ),
  ]);
}

function elixirTip(anchor, i) {
  const run = A.run, def = ELIXIRS[run.elixirs[i]];
  const inCombat = run.screen === "combat" && run.combat && !run.combat.over;
  showTip(anchor, [
    h("div.rarity", "Elixir"),
    h("h3", def.name),
    h("p", def.text),
    h("div.row",
      inCombat && !A.busy && h("button.btn.small.ember", { onclick: () => { closeTip(); combatElixir(i); } }, def.target === "enemy" ? "Throw" : "Drink"),
      !A.busy && h("button.btn.small.ghost", { onclick: () => { closeTip(); clearCombatSelection(); act(r => r.elixirs.splice(i, 1)); } }, "Discard"),
    ),
  ]);
}

// ---------- overlays ----------
function deckOverlay(cards, title) {
  const sorted = [...cards].sort((a, b) => CARDS[a.id].type.localeCompare(CARDS[b.id].type) || a.id.localeCompare(b.id));
  return h("div.overlay", { onclick: e => { if (e.target === e.currentTarget) { A.overlay = null; render(); } } },
    h("div.deck-view",
      h("header", h("h2.gilt-text", `${title} (${cards.length})`), h("button.btn.small.ghost", { onclick: () => { A.overlay = null; render(); } }, "Close")),
      h("div.card-grid", sorted.map(c => cardEl(c, { playable: true }))),
    ));
}

const PICK_TITLE = { remove: "Choose a card to remove", upgrade: "Choose a card to upgrade", duplicate: "Choose a card to copy", rune: "Choose a card for the rune" };
function pickerOverlay(run) {
  const p = run.pick;
  const sub = p.kind === "rune" ? `The ${p.rune[0].toUpperCase() + p.rune.slice(1)} Rune will be set into it for the rest of the delve. A card holds one rune.` :
    p.kind === "upgrade" ? "Upgraded numbers are shown in green." : "";
  return h("div.overlay",
    h("div.deck-view",
      h("header", h("div", h("h2.gilt-text", PICK_TITLE[p.kind]), sub && h("p", { style: { margin: "4px 0 0", color: "var(--text-dim)" } }, sub)),
        canCancelPick(run) ? h("button.btn.small.ghost", { onclick: () => act(r => cancelPick(r)) }, "Back") : null),
      !pickable(run).length && h("div", { style: { textAlign: "center", display: "grid", gap: "10px", justifyItems: "center" } },
        h("p", { style: { margin: 0, color: "var(--text-dim)" } }, "No card in your deck can be chosen for this."),
        h("button.btn", { onclick: () => act(r => cancelPick(r, true)) }, "Continue")),
      h("div.card-grid", pickable(run).map(c => {
        const preview = p.kind === "upgrade" ? { ...c, upgraded: true } : p.kind === "rune" ? { ...c, rune: p.rune } : c;
        return cardEl(preview, { cls: "pickable", onClick: () => act(r => resolvePick(r, c.uid)) });
      })),
    ));
}

function replaceOverlay(run) {
  const id = run.pendingTreasure, def = TREASURES[id];
  return h("div.overlay",
    h("div.panel", { style: { display: "grid", gap: "14px", justifyItems: "center", textAlign: "center" } },
      h("div.eyebrow", "Your rack is full"),
      h("div.treasure-card", { dataset: { rarity: def.rarity }, style: { cursor: "default" } },
        art(def.art, { glyph: def.name[0] }), h("div.rarity", def.rarity), h("h3", def.name), h("p", treasureText({ id, state: {} }))),
      h("p", { style: { margin: 0, color: "var(--text-dim)" } }, "Swap it for one of yours (that one is sold), or leave it behind."),
      h("div.treasure-offers", run.treasures.map((tr, i) => h("button.treasure-card", { dataset: { rarity: TREASURES[tr.id].rarity }, onclick: () => act(r => replaceTreasure(r, i)) },
        art(TREASURES[tr.id].art, { glyph: TREASURES[tr.id].name[0] }), h("h3", TREASURES[tr.id].name), h("p", `Sell for ${sellValue(tr)}g`)))),
      h("button.btn.ghost", { onclick: () => act(r => discardPendingTreasure(r)) }, run.pendingRefund ? `Leave it (refund ${run.pendingRefund}g)` : "Leave it"),
    ));
}

function menuOverlay() {
  let confirming = false;
  const panel = h("div.panel", { style: { display: "grid", gap: "12px", width: "min(340px, 100%)", textAlign: "center" } });
  const draw = () => {
    panel.replaceChildren(
      h("h2.gilt-text", "Paused"),
      h("button.btn", { onclick: () => { A.overlay = null; render(); } }, "Resume"),
      h("button.btn.ghost", { onclick: () => { A.overlay = "saves"; render(); } }, "Save / load"),
      h("button.btn.ghost", { onclick: () => { prefs.muted = !prefs.muted; savePrefs(); draw(); } }, prefs.muted ? "Sound: off" : "Sound: on"),
      h("button.btn.ghost", { onclick: () => { prefs.speed = prefs.speed === 1 ? 2 : 1; savePrefs(); draw(); } }, prefs.speed === 1 ? "Animations: normal" : "Animations: fast"),
      h("button.btn.ghost", { onclick: () => { A.overlay = null; toTitle(); } }, "Title screen"),
      confirming
        ? h("button.btn.ember", { onclick: () => { clearRun(); A.run = null; A.overlay = null; toTitle(); } }, "Yes, abandon this delve")
        : h("button.btn.ghost", { onclick: () => { confirming = true; draw(); } }, "Abandon delve"),
      h("p", { style: { margin: 0, color: "var(--text-dim)", fontSize: "0.9rem" } }, "Your delve is also saved automatically after every move."),
    );
  };
  draw();
  return h("div.overlay", { onclick: e => { if (e.target === e.currentTarget) { A.overlay = null; render(); } } }, panel);
}

// ---------- boot ----------
window.addEventListener("keydown", e => {
  if (e.key === "Escape" && A.overlay === "saves") { A.overlay = A.title ? null : "menu"; render(); return; }
  if (e.key !== "Escape" || !A.run || A.title || A.run.pick || A.run.pendingTreasure) return;
  closeTip(); A.overlay = A.overlay ? null : "menu"; render();
});
// Overlays act as dialogs for assistive technology.
new MutationObserver(() => document.querySelectorAll(".overlay:not([role])").forEach(o => { o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); }))
  .observe(app, { childList: true });
A.run = loadRun();
render();
// Test hook: #test exposes the app state and engine for scripted checks.
if (location.hash === "#test") {
  import("../engine/run.js").then(engine => { window.__dc = { A, act, render, startRun, engine }; });
}
