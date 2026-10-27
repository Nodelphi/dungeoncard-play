// Every screen outside combat.
import { h, svg, art, toast, ROOM_ICON, ROOM_NAME } from "./dom.js";
import { cardEl } from "./card.js";
import { A, act, render, startRun, chooseHero, continueRun, toTitle, hoverTip } from "./app.js";
import { choices, enterRoom, leaveRoom, takeRewardCard, skipRewardCards, takeRewardElixir, takeRewardTreasure,
  buy, price, rest, smith, restAmount, canUpgrade, chooseEvent, takeVaultTreasure, takeBossTreasure, depth, MAX_ELIXIRS } from "../engine/run.js";
import { FLOORS, COLS } from "../engine/map.js";
import { loadRun } from "../engine/save.js";
import { CARDS } from "../../data/cards.js";
import { TREASURES, treasureText } from "../../data/treasures.js";
import { ELIXIRS } from "../../data/elixirs.js";
import { RUNES } from "../../data/runes.js";
import { EVENTS } from "../../data/events.js";
import { HEROES, HERO_IDS } from "../../data/heroes.js";
import { DESCENT } from "../../data/descent.js";
import { ACT_NAMES, ACT_INTROS, ACTS } from "../../data/monsters.js";

const coin = () => svg("coin");
/** Hover details for a treasure, elixir or rune offered somewhere. */
export const treasureHover = id => () => [h("div.rarity", `${TREASURES[id].rarity} treasure${TREASURES[id].hero ? " · " + HEROES[TREASURES[id].hero].short : ""}`), h("h3", TREASURES[id].name), h("p", treasureText({ id, state: {} }))];
const elixirHover = id => () => [h("div.rarity", "Elixir"), h("h3", ELIXIRS[id].name), h("p", ELIXIRS[id].text)];
const runeHover = id => () => [h("div.rarity", "Rune"), h("h3", RUNES[id].name), h("p", RUNES[id].text.replace(" (handled in cardCost)", "")), h("p.hint", "Set into a card of your choice when bought.")];
const treasureCard = (id, extra = {}) => {
  const def = TREASURES[id];
  return hoverTip(h("button.treasure-card", { dataset: { rarity: def.rarity }, ...extra },
    art(def.art, { glyph: def.name[0] }), h("div.rarity", def.rarity), h("h3", def.name), h("p", treasureText({ id, state: {} }))), treasureHover(id));
};

// ---------- title ----------
export function titleView() {
  const saved = loadRun();
  const m = A.meta;
  return h("div.screen.title-screen",
    h("div.eyebrow", "A deckbuilding delve"),
    h("h1.gilt-text", "Dungeoncard"),
    h("p.tag", "Descend into the crypt with sword and deck. Hoard treasures that multiply every blow, and bring down the Bone Tyrant."),
    h("div.buttons",
      saved && h("button.btn", { onclick: continueRun }, `Continue · floor ${Math.max(1, saved.floor)}`),
      h(saved ? "button.btn.ghost" : "button.btn", { onclick: () => {
        if (saved && !A.confirmNew) { A.confirmNew = true; render(); return; }
        A.confirmNew = false; chooseHero();
      } }, saved ? (A.confirmNew ? "Abandon the saved delve?" : "New delve") : "Begin the delve"),
      h("div.title-links",
        h("button.btn.small.ghost", { onclick: () => { A.page = "howto"; render(); } }, "How to play"),
        h("button.btn.small.ghost", { onclick: () => { A.page = "codex"; render(); } }, "Codex"),
        h("button.btn.small.ghost", { onclick: () => { A.overlay = "saves"; render(); } }, "Load game")),
    ),
    m.runs > 0 && h("div.records", `Delves ${m.runs} · Victories ${m.wins} · Deepest floor ${m.bestFloor} · Biggest hit ${m.biggestHit}`),
  );
}

// ---------- choose a hero ----------
export function heroSelectView() {
  return h("div.screen", h("div.room",
    h("div.room-title", h("div.eyebrow", "Who descends?"), h("h2.gilt-text", "Choose your delver")),
    A.meta.descent > 0 && h("div.descent-pick",
      h("div.section-label", "Descent"),
      h("div.tabs", Array.from({ length: A.meta.descent + 1 }, (_, d) => h(`button.tab${d === A.descent ? ".on" : ""}`, { onclick: () => { A.descent = d; render(); } }, d === 0 ? "Normal" : String(d)))),
      h("p.descent-text", A.descent === 0 ? "The delve as intended." : DESCENT.slice(0, A.descent).map(x => x.text).join(" "))),
    h("div.hero-grid", HERO_IDS.map(id => {
      const hero = HEROES[id];
      return h("button.hero-card", { onclick: () => startRun(id), style: { "--hero": hero.color } },
        art(hero.art, { cls: "portrait", glyph: hero.short[0] }),
        h("div.hero-info",
          h("h3", hero.name),
          h("div.hero-title", hero.title),
          h("p", hero.blurb),
          h("div.hero-mech", h("b", hero.mechanic + ": "), hero.mechanicText),
          h("div.hero-stats", svg("heart"), `${hero.maxHp} HP`, svg("coin"), `${hero.gold} gold`, A.meta.heroWins?.[id] ? h("span.hero-wins", svg("crown"), `${A.meta.heroWins[id]} won`) : null),
        ));
    })),
    h("button.btn.ghost", { onclick: toTitle }, "Back"),
  ));
}

// ---------- map ----------
const ROW = 74;
const jitter = (id, amt) => (([...id].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7) % 1000) / 1000 - 0.5) * amt;

export function mapView(run) {
  const nodes = Object.values(run.map.nodes);
  const open = new Set(choices(run));
  const visited = new Set(run.path);
  const height = (FLOORS + 1) * ROW + 70;
  const pos = n => n.type === "boss"
    ? { x: 50, y: height - 54 }
    : { x: ((n.col + 0.5) / COLS) * 100 + jitter(n.id, 5), y: 36 + (n.floor - 1) * ROW + jitter(n.id + "y", 18) };

  const lines = [];
  for (const n of nodes) for (const to of n.next) {
    const a = pos(n), b = pos(run.map.nodes[to]);
    const taken = visited.has(n.id) && visited.has(to) && run.path.indexOf(to) === run.path.indexOf(n.id) + 1;
    const isOpen = n.id === run.node && open.has(to);
    lines.push(`<line x1="${a.x}%" y1="${((height - a.y) / height) * 100}%" x2="${b.x}%" y2="${((height - b.y) / height) * 100}%" class="${taken ? "taken" : isOpen ? "open" : ""}"/>`);
  }
  const map = h("div.map", { style: { height: `${height}px` } });
  const paths = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  paths.setAttribute("class", "paths");
  paths.innerHTML = lines.join("");
  map.append(paths);
  for (const n of nodes) {
    const p = pos(n);
    const cls = [n.type, visited.has(n.id) ? "visited" : "", n.id === run.node ? "current" : "", open.has(n.id) ? "open" : ""].filter(Boolean).join(".");
    map.append(h(`button.node.${cls}`, {
      style: { left: `${p.x}%`, bottom: `${p.y}px` },
      "aria-label": `${ROOM_NAME[n.type]}, floor ${n.floor}${open.has(n.id) ? " (you can go here)" : ""}`,
      disabled: !open.has(n.id),
      onclick: () => act(r => enterRoom(r, n.id)),
    }, svg(ROOM_ICON[n.type])));
  }
  const scroll = h("div.map-scroll", map);
  // Keep the hero's current floor in view.
  requestAnimationFrame(() => {
    const floor = run.node ? run.map.nodes[run.node].floor : 0;
    scroll.scrollTop = Math.max(0, height - (36 + floor * ROW) - scroll.clientHeight * 0.55);
  });
  return h("div.screen.map-screen",
    h("div.act-title", h("span.eyebrow", `Act ${["I", "II", "III"][(run.act || 1) - 1]}`), h("span", ACT_NAMES[run.act || 1])),
    !run.node && h("p.act-intro", ACT_INTROS[run.act || 1]),
    h("div.map-legend", ["fight", "elite", "event", "shop", "rest", "vault", "boss"].map(t => h("span", svg(ROOM_ICON[t]), ROOM_NAME[t]))),
    scroll,
  );
}

// ---------- rewards ----------
export function rewardView(run) {
  const r = run.room;
  const loot = h("div.loot",
    h("div.loot-item.taken", coin(), h("div", h("b", `${r.gold} gold`), h("small", "Added to your purse"))),
    r.treasure && hoverTip(h("button.loot-item", { style: { "--metal": `var(--metal-${TREASURES[r.treasure].rarity})` }, onclick: () => act(takeRewardTreasure) },
      art(TREASURES[r.treasure].art, { glyph: "T" }), h("div", h("b", TREASURES[r.treasure].name), h("small", treasureText({ id: r.treasure, state: {} })))), treasureHover(r.treasure)),
    r.elixir && hoverTip(h("button.loot-item", { onclick: () => { if (run.elixirs.length >= MAX_ELIXIRS) return toast("Your elixir belt is full"); act(takeRewardElixir); } },
      art(ELIXIRS[r.elixir].art, { glyph: "E" }), h("div", h("b", ELIXIRS[r.elixir].name), h("small", ELIXIRS[r.elixir].text))), elixirHover(r.elixir)),
  );
  return h("div.screen", h("div.room",
    h("div.room-title", h("div.eyebrow", r.type === "boss" ? `${ACT_NAMES[run.act]} conquered` : r.type === "elite" ? "Elite slain" : "Victory"),
      h("h2.gilt-text", r.type === "boss" ? "The boss is slain" : "Spoils of battle"),
      r.type === "boss" && h("p", `Rest a while, then descend into ${ACT_NAMES[(run.act || 1) + 1]}.`)),
    loot,
    r.bossTreasures && h("div.section-label", r.bossTaken ? "Boss treasure claimed" : "Claim one boss treasure"),
    r.bossTreasures && h("div.treasure-offers", r.bossTreasures.map((id, i) => treasureCard(id, { onclick: () => act(x => takeBossTreasure(x, i)), disabled: !!r.bossTaken, class: r.bossTaken && r.bossTaken !== id ? "sold" : "" }))),
    r.cards && h("div.section-label", "Add a card to your deck"),
    r.cards && h("div.card-grid", r.cards.map((id, i) => cardEl({ uid: "reward" + i, id, upgraded: false }, { onClick: () => act(run2 => takeRewardCard(run2, i)) }))),
    h("div.actions",
      r.cards && h("button.btn.ghost", { onclick: () => act(skipRewardCards) }, "Skip card"),
      h("button.btn", { onclick: () => act(leaveRoom) }, r.type === "boss" ? "Descend" : "Continue"),
    ),
  ));
}

// ---------- merchant ----------
export function shopView(run) {
  const s = run.room.shop;
  const priceTag = base => { const p = price(run, base); return h(`span.price${run.gold < p ? ".cant" : ""}`, coin(), String(p)); };
  const tryBuy = (kind, i) => () => {
    if (!act(r => buy(r, kind, i))) toast(kind === "elixirs" && run.elixirs.length >= MAX_ELIXIRS ? "Your elixir belt is full"
      : kind === "removal" && run.deck.length <= 5 ? "Your deck is already as small as it can be" : "You can't afford that");
  };
  return h("div.screen", h("div.room",
    h("div.room-title", h("div.eyebrow", "Floor " + run.floor), h("h2.gilt-text", "The Merchant"), h("p", "“Steel, curios, and the odd miracle. Coin first.”")),
    h("div.section-label", "Cards"),
    h("div.card-grid", s.cards.map((it, i) => h(`div.priced${it.sold ? ".sold" : ""}`, cardEl({ uid: "shop" + i, id: it.id, upgraded: false }, { onClick: tryBuy("cards", i) }), priceTag(it.price)))),
    h("div.section-label", "Treasures"),
    h("div.treasure-offers", s.treasures.map((it, i) => h(`div.priced${it.sold ? ".sold" : ""}`, treasureCard(it.id, { onclick: tryBuy("treasures", i) }), priceTag(it.price)))),
    h("div.section-label", "Elixirs, runes and services"),
    h("div.shop-row",
      s.elixirs.map((it, i) => hoverTip(h(`button.service${it.sold ? ".sold" : ""}`, { onclick: tryBuy("elixirs", i) },
        art(ELIXIRS[it.id].art, { glyph: "E" }), h("h3", ELIXIRS[it.id].name), h("p", ELIXIRS[it.id].text), priceTag(it.price)), elixirHover(it.id))),
      s.runes.map((it, i) => hoverTip(h(`button.service${it.sold ? ".sold" : ""}`, { onclick: tryBuy("runes", i), style: { "--rune": RUNES[it.id].color } },
        h("div.orb"), h("h3", RUNES[it.id].name), h("p", RUNES[it.id].text.replace(" (handled in cardCost)", "")), priceTag(it.price)), runeHover(it.id))),
      h(`button.service${s.removal.sold ? ".sold" : ""}`, { onclick: tryBuy("removal") },
        h("div.orb", { style: { "--rune": "#6b6b6b" } }), h("h3", "Remove a card"), h("p", "Thin your deck of a weak card."), priceTag(s.removal.price)),
    ),
    h("div.actions", h("button.btn", { onclick: () => act(leaveRoom) }, "Leave")),
  ));
}

// ---------- campfire ----------
export function restView(run) {
  const done = run.room.done;
  return h("div.screen", h("div.room", { style: { justifyContent: "center" } },
    h("div.room-title", h("div.eyebrow", "Campfire"), h("h2.gilt-text", "A moment's rest"), h("p", done ? (done === "rest" ? "You wake stiff but mended." : "Your blade sings sharper.") : "The fire crackles. The dark can wait.")),
    !done && h("div.rest-options",
      h("button.rest-option", { onclick: () => act(rest) }, svg("bed"), h("h3", "Rest"), h("p", `Heal ${restAmount(run)} HP`)),
      h("button.rest-option", { disabled: !run.deck.some(canUpgrade), onclick: () => act(smith) }, svg("hammer"), h("h3", "Sharpen"), h("p", "Upgrade a card")),
    ),
    done && h("button.btn", { onclick: () => act(leaveRoom) }, "Continue"),
  ));
}

// ---------- events ----------
export function eventView(run) {
  const ev = EVENTS[run.room.event];
  const result = run.room.result;
  return h("div.screen", h("div.room",
    h("div.room-title", h("div.eyebrow", "Floor " + run.floor), h("h2.gilt-text", ev.name)),
    art(ev.art, { cls: "event-art", glyph: "?" }),
    h("div.event-text.parchment", result || ev.text),
    !result && h("div.choices", ev.choices.map((ch, i) => h("button.choice", { disabled: ch.req && !ch.req(run), onclick: () => act(r => chooseEvent(r, i)) },
      h("b", ch.label), ch.detail && h("small", ch.detail)))),
    result && h("button.btn", { onclick: () => act(leaveRoom) }, "Continue"),
  ));
}

// ---------- vault ----------
export function vaultView(run) {
  const taken = run.room.taken;
  return h("div.screen", h("div.room",
    h("div.room-title", h("div.eyebrow", "Floor " + run.floor), h("h2.gilt-text", "The Sealed Vault"), h("p", taken ? `You claim the ${TREASURES[taken].name}.` : "Three relics lie on velvet. The lock will only open once.")),
    h("div.treasure-offers", run.room.treasures.map((id, i) => treasureCard(id, { onclick: () => act(r => takeVaultTreasure(r, i)), disabled: !!taken, class: taken && taken !== id ? "sold" : "" }))),
    taken && h("button.btn", { onclick: () => act(leaveRoom) }, "Continue"),
  ));
}

// ---------- end of the delve ----------
export function endView(run) {
  const won = run.screen === "victory";
  const s = run.stats;
  const stat = (v, k) => h("div", h("b", String(v)), h("span", k));
  return h("div.screen.end-screen", h("div.room", { style: { justifyContent: "center" } },
    h("div.eyebrow", won ? "The crypt is silent" : "Your delve ends"),
    h("h1.gilt-text", won ? "Victory" : "Fallen"),
    h("p.result", won ? "Ashgrim falls, and the Molten Deep goes quiet. You climb toward daylight, heavy with dragon's gold." : `${HEROES[run.hero].name} fell in ${ACT_NAMES[run.act || 1]}, floor ${run.floor}. Others will follow the trail into the dark.`),
    h("div.end-stats",
      stat(won ? ACTS * 16 : depth(run), "Floors delved"), stat(s.kills, "Monsters slain"),
      stat(s.biggestHit, "Biggest hit"), stat(s.elites, "Elites slain"),
      stat(s.goldEarned, "Gold earned"), stat(s.cardsPlayed, "Cards played"),
    ),
    run.treasures.length > 0 && h("div.treasure-offers", run.treasures.map(t => treasureCard(t.id, { disabled: true, style: { cursor: "default" } }))),
    h("div.actions",
      h("button.btn", { onclick: chooseHero }, "New delve"),
      h("button.btn.ghost", { onclick: () => { A.run = null; toTitle(); } }, "Title"),
    ),
  ));
}
