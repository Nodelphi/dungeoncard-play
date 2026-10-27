// The Codex (every card, treasure and monster, with its painting) and the How to Play guide.
import { h, art, svg } from "./dom.js";
import { cardEl } from "./card.js";
import { A, render } from "./app.js";
import { CARDS } from "../../data/cards.js";
import { TREASURES } from "../../data/treasures.js";
import { MONSTERS, ACT_NAMES } from "../../data/monsters.js";
import { HEROES, HERO_IDS } from "../../data/heroes.js";
import { RUNES } from "../../data/runes.js";
import { ELIXIRS } from "../../data/elixirs.js";
import { STATUSES } from "../../data/statuses.js";

const back = () => h("button.btn.ghost", { onclick: () => { A.page = null; render(); } }, "Back");
const RARITY_ORDER = { starter: 0, common: 1, uncommon: 2, rare: 3, legendary: 4, token: 5, curse: 6 };

export function codexView() {
  const tab = A.codexTab || "sellsword";
  const tabs = [...HERO_IDS.map(id => [id, HEROES[id].short]), ["neutral", "Neutral"], ["treasures", "Treasures"], ["monsters", "Monsters"], ["other", "Runes & Elixirs"]];
  let body;
  if (HEROES[tab] || tab === "neutral") {
    const cards = Object.values(CARDS).filter(c => c.hero === tab).sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.name.localeCompare(b.name));
    body = h("div.card-grid", cards.map(c => cardEl({ uid: "cx" + c.id, id: c.id, upgraded: false })));
  } else if (tab === "treasures") {
    const ts = Object.values(TREASURES).sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.name.localeCompare(b.name));
    body = h("div.treasure-offers", ts.map(t => h("div.treasure-card", { dataset: { rarity: t.rarity }, style: { cursor: "default" } },
      art(t.art, { glyph: t.name[0] }), h("div.rarity", t.hero ? `${t.rarity} · ${HEROES[t.hero].short}` : t.rarity), h("h3", t.name),
      h("p", t.text.replace("{x}", t.describe ? t.describe({}).x : "")))));
  } else if (tab === "monsters") {
    body = h("div.codex-acts", [1, 2, 3].map(a => h("section.codex-act",
      h("div.section-label", `Act ${a}: ${ACT_NAMES[a]}`),
      h("div.monster-grid", Object.values(MONSTERS).filter(m => m.act === a).sort((x, y) => (x.boss - y.boss) || (x.elite - y.elite)).map(m =>
        h(`div.monster-card${m.boss ? ".boss" : m.elite ? ".elite" : ""}`, art(m.art, { cls: "portrait", glyph: m.name[0] }),
          h("h3", m.name), h("small", `${m.boss ? "Boss" : m.elite ? "Elite" : "Monster"} · ${m.hp[0]}${m.hp[1] !== m.hp[0] ? "–" + m.hp[1] : ""} HP`)))))));
  } else {
    body = h("div.treasure-offers",
      Object.values(RUNES).map(r => h("div.service", { style: { "--rune": r.color, cursor: "default" } }, h("div.orb"), h("h3", r.name), h("p", r.text.replace(" (handled in cardCost)", "")))),
      Object.values(ELIXIRS).map(e => h("div.service", { style: { cursor: "default" } }, art(e.art, { glyph: "E" }), h("h3", e.name), h("p", e.text))));
  }
  return h("div.screen", h("div.room",
    h("div.room-title", h("div.eyebrow", "The Delver's Codex"), h("h2.gilt-text", "Codex")),
    h("div.tabs", tabs.map(([id, label]) => h(`button.tab${id === tab ? ".on" : ""}`, { onclick: () => { A.codexTab = id; render(); } }, label))),
    body,
    back(),
  ));
}

export function howToView() {
  const chip = (cls, t) => h(`span.chip.${cls}`, t);
  return h("div.screen", h("div.room",
    h("div.room-title", h("div.eyebrow", "Before you descend"), h("h2.gilt-text", "How to play")),
    h("div.howto",
      h("section.parchment",
        h("h3", "The delve"),
        h("p", "Each act is a map of 15 floors with a boss at the top. Choose your path: fights, elites (tougher, but they always drop a treasure), events, the merchant, campfires and a vault. Beat all three bosses to win."),
      ),
      h("section.parchment",
        h("h3", "Fighting"),
        h("p", "Each turn you get 3 Energy and draw 5 cards. A card's cost is in its top-left coin. Tap a card, then tap a monster to play it (or drag it up). Monsters show what they'll do next above their heads: plan your Block around it. Tap a monster to read its intent and statuses."),
      ),
      h("section.parchment",
        h("h3", "The tally"),
        h("p", "Every hit is counted up like this:"),
        h("div.tally.demo", chip("base", "6"), h("span.op", "×"), chip("mult", "2.5"), h("span.op", "="), chip("final", "15")),
        h("p", "The card sets the Base. Bonuses then apply in order: Strength, the card's rune, your hero's mechanic, then each treasure from left to right. Some add to Base (gold), some add Mult (+2 Mult), and the rarest multiply it (×2). Because they apply in order, ", h("b", "the order of your treasures matters"), ": put the ×Mult treasures last."),
      ),
      h("section.parchment",
        h("h3", "Dice (the Paladin)"),
        h("p", "The Paladin's cards roll tabletop dice instead of dealing a fixed number. ", h("b", "1d6+2"), " means roll one six-sided die and add 2; ", h("b", "3d10"), " means roll three ten-sided dice. The roll becomes the Base of the tally, and everything else stacks on top as usual."),
        h("p", "Any die that lands on its highest face is a ", h("b", "Critical"), ": the whole hit (or Block) gets ×2 Mult. Small dice crit more often, and cards that roll many dice crit most of all. ", h("b", "Advantage"), " rolls each die twice and keeps the higher. Area attacks roll once and hit every monster with the same result."),
      ),
      h("section.parchment",
        h("h3", "Saving"),
        h("p", "Your delve is saved automatically after every move, so you can close the page and continue later. From the pause menu, ", h("b", "Save / load"), " keeps up to three snapshots you can return to, and can export a delve to a file to carry it to another device (import it from ", h("b", "Load game"), " on the title screen)."),
      ),
      h("section.parchment",
        h("h3", "Treasures and runes"),
        h("p", "You can carry 5 treasures. Drag them in the rack to reorder; hover or tap one to read it, and tap to sell it (outside fights). Runes are set into a single card for the rest of the run, like a permanent enhancement."),
      ),
      h("section.parchment",
        h("h3", "Keywords"),
        h("p", h("b", "Block: "), "Absorbs damage until the start of your next turn."),
        h("p", h("b", "Exhaust: "), "The card is removed for the rest of the fight."),
        h("p", h("b", "Heavy: "), "A big blow that some treasures reward."),
        ...Object.values(STATUSES).map(st => h("p", h("b", st.name + ": "), st.text.replace("{n}", "N"))),
      ),
      h("section.parchment",
        h("h3", "The heroes"),
        ...HERO_IDS.map(id => h("p", h("b", `${HEROES[id].name}. ${HEROES[id].mechanic}: `), HEROES[id].mechanicText)),
      ),
    ),
    back(),
  ));
}
